const API_BASE =
  "https://script.google.com/macros/s/AKfycbwWvHxO3LJbV8iuqE4rz2qJjApNHuCfqzJmSNMdhMmZHicnIE7qn3AAc-_hjEA3E9CcJQ/exec?route=claims";

document.addEventListener("DOMContentLoaded", () => {
  const claimsEl = document.getElementById("claims");
  if (!claimsEl) return;
  init(claimsEl);
});

async function init(claimsEl) {
  claimsEl.innerHTML = `<div class="muted">Loading claim history…</div>`;

  try {
    const url = new URL(API_BASE);
    url.searchParams.set("action", "listClaims");

    const res = await fetch(url.toString());
    const data = await res.json();

    const claims = Array.isArray(data.claims) ? data.claims : [];
    renderClaims(claimsEl, claims);
  } catch (err) {
    claimsEl.innerHTML = `<div class="error-text">Could not load history. Please refresh.</div>`;
  }
}

function renderClaims(claimsEl, claims) {
  if (claims.length === 0) {
    claimsEl.innerHTML = `<div class="muted">No claim activity yet.</div>`;
    return;
  }

  claimsEl.innerHTML = claims
    .map((c) => {
      const time = escapeHtml(c.timestamp || "");
      const action = escapeHtml(c.action || "");
      const giftId = escapeHtml(c.giftId || "");
      const name = escapeHtml(c.name || "");
      return `
        <div class="claim-row">
          <div class="claim-time">${time}</div>
          <div class="claim-action">${action}</div>
          <div class="claim-gift">${giftId}</div>
          <div class="claim-name">${name}</div>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
