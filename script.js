
// ------------------------------
// Add to Calendar
// ------------------------------
const EVENT = {
  title: "Leslie’s Birthday Party 🤸‍♀️",
  description: "Come help us celebrate Leslie! \n\nMarch 15 10:00 AM – 11:30 AM\n\nGold Medal Gymnastics Center\n266 Pulaski Rd\nGreenlawn, NY 11740",
  location: "Gold Medal Gymnastics Center, 266 Pulaski Rd, Greenlawn, NY 11740",
  timezone: "America/New_York",
  startLocal: { year: 2026, month: 3, day: 15, hour: 10, minute: 0 },
  endLocal:   { year: 2026, month: 3, day: 15, hour: 11, minute: 30 }
};

function formatIcsUtc(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function localToUtcDate(localParts, timeZone) {
  const { year, month, day, hour, minute } = localParts;

  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = dtf.formatToParts(naiveUtc).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  const desiredWallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMs = wallAsUtc - naiveUtc.getTime();

  return new Date(desiredWallAsUtc - offsetMs);
}

function buildIcsFile() {
  const start = localToUtcDate(EVENT.startLocal, EVENT.timezone);
  const end   = localToUtcDate(EVENT.endLocal, EVENT.timezone);

  const dtStamp = formatIcsUtc(new Date());
  const dtStart = formatIcsUtc(start);
  const dtEnd   = formatIcsUtc(end);

  const uid = `leslie-bday-${dtStart}@madye-invite`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Made by Madye//Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(EVENT.title)}`,
    `DESCRIPTION:${escapeIcsText(EVENT.description)}`,
    `LOCATION:${escapeIcsText(EVENT.location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function downloadIcs(filename) {
  const ics = buildIcsFile();
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Wire up button AFTER DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const addToCalendarBtn = document.getElementById("addToCalendarBtn");

  if (!addToCalendarBtn) {
    console.warn("Add to Calendar button not found. Check the id in HTML.");
    return;
  }

  addToCalendarBtn.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("calendar click");
    downloadIcs("Leslie-Birthday-Invite.ics");
  });
});
