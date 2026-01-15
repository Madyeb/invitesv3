/* rsvp.js
   Frontend RSVP UI + submit to Google Apps Script

   IMPORTANT:
   - GET list:  ?route=rsvps
   - POST submit: ?route=rsvp   (singular)
   - Use URLSearchParams for POST to avoid CORS preflight issues from localhost.
*/

console.log("[rsvp.js] loaded", new Date().toISOString());

window.addEventListener("error", (e) => {
  console.error("[rsvp.js] window error:", e.message, e.filename, e.lineno, e.colno, e.error);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[rsvp.js] unhandled promise rejection:", e.reason);
});

const RSVP_BASE =
  "https://script.google.com/macros/s/AKfycbwWvHxO3LJbV8iuqE4rz2qJjApNHuCfqzJmSNMdhMmZHicnIE7qn3AAc-_hjEA3E9CcJQ/exec";

const RSVP_GET_ENDPOINT = `${RSVP_BASE}?route=rsvps`;
const RSVP_POST_ENDPOINT = `${RSVP_BASE}?route=rsvp`;

const rsvpState = {
  rsvp: "YES", // "YES" or "NO"
  people: [],
};

const RSVP_YES_IMAGE_URL = "assets/images/Leslie-yes.jpeg";
const RSVP_NO_IMAGE_URL  = "assets/images/Leslie-no.jpeg";

function uid() {
  return crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  children.forEach((child) => node.appendChild(child));
  return node;
}

function setMessage(text, kind) {
  const box = document.getElementById("rsvpMessage");
  if (!box) return;
  box.textContent = text;
  box.dataset.kind = kind || "";
}

/* -----------------------------------------
   Show/Hide helpers
----------------------------------------- */
function setRsvpUiVisible(visible) {
  const form = document.getElementById("rsvpForm");
  const choice = document.querySelector(".rsvp-choice");

  if (form) form.hidden = !visible;
  if (choice) choice.hidden = !visible;
}

function setCalendarVisible(visible) {
  const calendarRow = document.getElementById("rsvpCalendarRow");
  if (calendarRow) calendarRow.hidden = !visible;
}

function revealRsvpFormAndScroll() {
  hideRsvpResult(); 
  setRsvpUiVisible(true);
  document.getElementById("rsvpForm")?.scrollIntoView({ behavior: "smooth", block: "start" });

  setTimeout(() => {
    const firstInput = document.querySelector("#rsvpPeople input, #rsvpPeople select, #rsvpPeople textarea");
    firstInput?.focus();
  }, 250);
}

/* -----------------------------------------
   Rendering
----------------------------------------- */
function render() {
  const container = document.getElementById("rsvpPeople");
  const addBtn = document.getElementById("addPersonBtn");
  if (!container || !addBtn) return;

  container.innerHTML = "";
  setMessage("", "");

  if (rsvpState.rsvp === "NO") {
    addBtn.style.display = "none";

    const p = rsvpState.people[0] ?? { attendeeId: uid(), attendeeName: "" };
    rsvpState.people = [p];

    const row = el("div", { class: "person-row" }, [
      el("div", { class: "field" }, [
        el("label", { class: "field-label", for: `name_${p.attendeeId}`, text: "Kid name" }),
        el("input", {
          id: `name_${p.attendeeId}`,
          class: "field-input",
          type: "text",
          placeholder: "Name",
          value: p.attendeeName || "",
        }),
      ]),
    ]);

    row.querySelector("input")?.addEventListener("input", (e) => {
      p.attendeeName = e.target.value;
    });

    container.appendChild(row);
    return;
  }

  addBtn.style.display = "inline-flex";

  rsvpState.people.forEach((p, idx) => {
    const removable = idx >= 2;

    const row = el("div", { class: "person-row" }, [
      el("div", { class: "field" }, [
        el("label", { class: "field-label", for: `name_${p.attendeeId}`, text: "Name" }),
        el("input", {
          id: `name_${p.attendeeId}`,
          class: "field-input",
          type: "text",
          placeholder: "Name",
          value: p.attendeeName || "",
        }),
      ]),
      el("div", { class: "field" }, [
        el("label", { class: "field-label", for: `type_${p.attendeeId}`, text: "Type" }),
        (() => {
          // Values here are already aligned to Apps Script expectations after normalization (see normalizeType_)
          const sel = el("select", { id: `type_${p.attendeeId}`, class: "field-select" }, [
            el("option", { value: "", text: "Select" }),
            el("option", { value: "child", text: "Child" }),
            el("option", { value: "grown-up", text: "Grown up" }),
          ]);
          sel.value = p.type || "";
          return sel;
        })(),
      ]),
      el("div", { class: "field" }, [
        el("label", { class: "field-label", for: `all_${p.attendeeId}`, text: "Allergies (optional)" }),
        el("input", {
          id: `all_${p.attendeeId}`,
          class: "field-input",
          type: "text",
          placeholder: "Allergies",
          value: p.allergies || "",
        }),
      ]),
      removable
        ? el(
            "button",
            {
              type: "button",
              class: "icon-btn remove-btn",
              "aria-label": "Remove person",
              onClick: () => {
                rsvpState.people = rsvpState.people.filter((x) => x.attendeeId !== p.attendeeId);
                render();
              },
            },
            [el("span", { text: "−" })]
          )
        : el("div", { class: "icon-btn placeholder-btn", "aria-hidden": "true" }, [el("span", { text: "" })]),
    ]);

    const nameInput = row.querySelector(`#name_${p.attendeeId}`);
    const typeSel = row.querySelector(`#type_${p.attendeeId}`);
    const allInput = row.querySelector(`#all_${p.attendeeId}`);

    nameInput?.addEventListener("input", (e) => (p.attendeeName = e.target.value));
    typeSel?.addEventListener("change", (e) => (p.type = e.target.value));
    allInput?.addEventListener("input", (e) => (p.allergies = e.target.value));

    container.appendChild(row);
  });
}

function setChoice(rsvp) {
    hideRsvpResult();
    rsvpState.rsvp = rsvp;

  document.querySelectorAll(".choice-btn").forEach((b) => {
    const active = b.dataset.rsvp === rsvp;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-pressed", active ? "true" : "false");
  });

  if (rsvp === "YES") {
    rsvpState.people = [
      { attendeeId: uid(), attendeeName: "", type: "child", allergies: "" },
      { attendeeId: uid(), attendeeName: "", type: "grown-up", allergies: "" },
    ];
  } else {
    rsvpState.people = [{ attendeeId: uid(), attendeeName: "" }];
  }

  render();
}

function addPerson() {
  rsvpState.people.push({ attendeeId: uid(), attendeeName: "", type: "", allergies: "" });
  render();
}

function validate() {
  if (rsvpState.rsvp === "NO") {
    const kid = rsvpState.people[0];
    if (!kid?.attendeeName?.trim()) return { ok: false, message: "Please enter your child’s name." };
    return { ok: true };
  }

  for (const p of rsvpState.people) {
    if (!p.attendeeName?.trim()) return { ok: false, message: "Please fill in all required names." };
    if (!p.type?.trim()) return { ok: false, message: "Please select Child or Grown up for each person." };
  }
  return { ok: true };
}

/* -----------------------------------------
   API helpers
----------------------------------------- */

function normalizeType_(raw) {
  // UI values: "child" or "grown-up"
  // Apps Script expects: "CHILD" or "GROWNUP"
  const s = String(raw || "").trim().toLowerCase();
  if (s === "child") return "CHILD";
  if (s === "grown-up" || s === "grownup" || s === "grown up") return "GROWNUP";
  return "";
}

async function postOneRsvpRow_(row) {
  // Use URLSearchParams to avoid preflight CORS issues
  const params = new URLSearchParams();
  params.set("rsvp", row.rsvp); // YES/NO
  params.set("attendeeName", row.attendeeName || "");
  params.set("attendeeId", row.attendeeId || "");
  params.set("type", row.type || "");
  params.set("allergies", row.allergies || "");

  const res = await fetch(RSVP_POST_ENDPOINT, {
    method: "POST",
    body: params,
    // NO headers
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error || "Unknown error");
  return json;
}

function showRsvpResult({ kind, message, imageUrl }) {
  const result = document.getElementById("rsvpResult");
  const img = document.getElementById("rsvpResultImg");
  const text = document.getElementById("rsvpResultText");

  if (result) result.hidden = false;

  if (img) {
    img.src = imageUrl || "";
    img.alt = kind === "yes" ? "Hurray!! You can make it!!" : "Oh no! You can't make it...";
  }

  if (text) text.textContent = message || "";
}

function hideRsvpResult() {
  const result = document.getElementById("rsvpResult");
  if (result) result.hidden = true;
}


// Optional: if you ever want to read RSVPs client-side
async function getRsvps_() {
  const res = await fetch(RSVP_GET_ENDPOINT);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error || "Unknown error");
  return json.rsvps || [];
}

/* -----------------------------------------
   Submit handler
----------------------------------------- */
async function submitRsvp(e) {
  e.preventDefault();

  const submitBtn = document.getElementById("submitRsvpBtn");
  if (!submitBtn) return;

  submitBtn.disabled = true;
  setMessage("", "");

  const v = validate();
  if (!v.ok) {
    setMessage(v.message, "error");
    submitBtn.disabled = false;
    return;
  }

  const timestamp = new Date().toISOString();
  // Hide UI immediately and show an instant message
    setRsvpUiVisible(false);

    if (rsvpState.rsvp === "YES") {
    setCalendarVisible(true);
    showRsvpResult({
        kind: "yes",
        message: "Leslie is doing flips of excitement… saving your RSVP now!",
        imageUrl: RSVP_YES_IMAGE_URL
    });
    } else {
    setCalendarVisible(false);
    showRsvpResult({
        kind: "no",
        message: "Leslie will miss you… saving your RSVP now.",
        imageUrl: RSVP_NO_IMAGE_URL
    });
    }

  // Build rows to submit
  const rows =
    rsvpState.rsvp === "NO"
      ? [
          {
            timestamp,
            rsvp: "NO",
            attendeeId: rsvpState.people[0].attendeeId,
            attendeeName: rsvpState.people[0].attendeeName.trim(),
            type: "", // NO -> backend will blank anyway, but keep clean
            allergies: "",
          },
        ]
      : rsvpState.people.map((p) => ({
          timestamp,
          rsvp: "YES",
          attendeeId: p.attendeeId,
          attendeeName: p.attendeeName.trim(),
          type: normalizeType_(p.type),
          allergies: (p.allergies || "").trim(),
        }));

  try {
    // Submit each attendee as its own row
    for (const row of rows) {
      await postOneRsvpRow_(row);
    }

    // Always hide the form + choice buttons after submit
setRsvpUiVisible(false);

if (rsvpState.rsvp === "YES") {
  setCalendarVisible(true);

  const names = rsvpState.people.map(p => p.attendeeName.trim()).filter(Boolean);
  const line = names.length
    ? `Leslie is so excited to celebrate with ${names.join(" and ")}!`
    : "Hurray! You can make it!!";

  showRsvpResult({ kind: "yes", message: line, imageUrl: RSVP_YES_IMAGE_URL });
} else {
  setCalendarVisible(false);

  const name = rsvpState.people[0].attendeeName.trim();
  const line = name ? `Leslie will miss you, ${name}.` : "Oh no! You can't make it...";

  showRsvpResult({ kind: "no", message: line, imageUrl: RSVP_NO_IMAGE_URL });
}


// Optional: scroll them back up a bit
setTimeout(() => {
  document.getElementById("details")?.scrollIntoView({ behavior: "smooth", block: "start" });
}, 400);

  } catch (err) {
    showRsvpResult({
  kind: "no",
  message: "Something went wrong while saving. Please try again.",
  imageUrl: RSVP_NO_IMAGE_URL
});
setCalendarVisible(false);
setRsvpUiVisible(true);

  } finally {
    submitBtn.disabled = false;
  }
}

/* -----------------------------------------
   Init
----------------------------------------- */
function initRsvp() {
  // Keep hidden until reveal
  setRsvpUiVisible(false);
  setCalendarVisible(false);
  hideRsvpResult();

  const revealLink = document.getElementById("rsvpRevealBtn") || document.querySelector('a[href="#rsvpForm"]');
  if (revealLink) {
    revealLink.setAttribute("aria-controls", "rsvpForm");
    revealLink.setAttribute("aria-expanded", "false");

    revealLink.addEventListener("click", (e) => {
      e.preventDefault();
      revealRsvpFormAndScroll();
      revealLink.setAttribute("aria-expanded", "true");
    });
  }

  document.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => setChoice(btn.dataset.rsvp));
  });

  document.getElementById("addPersonBtn")?.addEventListener("click", addPerson);
  document.getElementById("rsvpForm")?.addEventListener("submit", submitRsvp);

  document.getElementById("addToCalendarBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();

  const url = "Leslie-Birthday-Invite.ics"; // adjust path if needed

  // Create a temporary <a download> and click it
  const a = document.createElement("a");
  a.href = url;
  a.download = "Leslie-Birthday-Invite.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRsvp);
} else {
  initRsvp();
}
