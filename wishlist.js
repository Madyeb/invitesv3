/* wishlist.js
   Google Sheets–backed wishlist with claim + unclaim.
   Items live in Sheets. Only tokens live in localStorage for unclaim.
*/

let modalBusy = false;

const API_GIFTS =
  "https://script.google.com/macros/s/AKfycbwWvHxO3LJbV8iuqE4rz2qJjApNHuCfqzJmSNMdhMmZHicnIE7qn3AAc-_hjEA3E9CcJQ/exec?route=gifts";
const API_CLAIM =
  "https://script.google.com/macros/s/AKfycbwWvHxO3LJbV8iuqE4rz2qJjApNHuCfqzJmSNMdhMmZHicnIE7qn3AAc-_hjEA3E9CcJQ/exec?route=claim";
const API_UNCLAIM =
  "https://script.google.com/macros/s/AKfycbwWvHxO3LJbV8iuqE4rz2qJjApNHuCfqzJmSNMdhMmZHicnIE7qn3AAc-_hjEA3E9CcJQ/exec?route=unclaim";

const TOKEN_KEY_PREFIX = "wishlist_token_v1_"; // per gift id

/** DOM */
const listEl = document.getElementById("wishlistList");

const claimModal = document.getElementById("claimModal");
const claimModalItemTitle = document.getElementById("claimModalItemTitle");
const claimerNameInput = document.getElementById("claimerName");
const cancelClaimBtn = document.getElementById("cancelClaim");
const confirmClaimBtn = document.getElementById("confirmClaim");
const claimErrorEl = document.getElementById("claimError");

const unclaimModal = document.getElementById("unclaimModal");
const unclaimModalItemTitle = document.getElementById("unclaimModalItemTitle");
const unclaimerNameInput = document.getElementById("unclaimerName");
const cancelUnclaimBtn = document.getElementById("cancelUnclaim");
const confirmUnclaimBtn = document.getElementById("confirmUnclaim");
const unclaimErrorEl = document.getElementById("unclaimError");

/** State */
let items = [];
let activeItemId = null;

init();

async function init() {
  if (!listEl) return;

  // Claim modal input enable/disable
  claimerNameInput?.addEventListener("input", () => {
    if (!confirmClaimBtn) return;
    const value = (claimerNameInput.value || "").trim();
    confirmClaimBtn.disabled = value.length === 0;
    hideError(claimErrorEl);
  });

  // Unclaim modal input enable/disable
  unclaimerNameInput?.addEventListener("input", () => {
    if (!confirmUnclaimBtn) return;
    const value = (unclaimerNameInput.value || "").trim();
    confirmUnclaimBtn.disabled = value.length === 0;
    hideError(unclaimErrorEl);
  });

  // Modal buttons
  cancelClaimBtn?.addEventListener("click", () => closeModal(claimModal));
  confirmClaimBtn?.addEventListener("click", onConfirmClaim);

  cancelUnclaimBtn?.addEventListener("click", () => closeModal(unclaimModal));
  confirmUnclaimBtn?.addEventListener("click", onConfirmUnclaim);

  wireBackdropClose(claimModal);
  wireBackdropClose(unclaimModal);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modalBusy) return;

    if (claimModal && !claimModal.hidden) closeModal(claimModal);
    if (unclaimModal && !unclaimModal.hidden) closeModal(unclaimModal);
  });

  // Click delegation for claim/unclaim buttons in the list
  listEl.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!id) return;

    const item = items.find((x) => String(x.id) === String(id));
    if (!item) return;

    if (action === "open-claim") openClaimModal(item);
    if (action === "open-unclaim") openUnclaimModal(item);
  });

  // Initial load
  await refreshItems();
}

/** -----------------------------
 * Data load + render
 * ----------------------------- */

async function refreshItems() {
  try {
    listEl.innerHTML = `<div class="muted">Loading gifts…</div>`;

    const data = await apiGet(API_GIFTS);

    const gifts =
      Array.isArray(data?.gifts) ? data.gifts :
      Array.isArray(data?.items) ? data.items :
      Array.isArray(data) ? data :
      [];

    items = gifts.map((g) => ({ ...g, id: String(g.id) }));
    render();
  } catch (err) {
    listEl.innerHTML = `<div class="error-text">Could not load gifts. Please refresh.</div>`;
  }
}

function render() {
  const html = items.map(renderItemCard).join("");
  listEl.innerHTML = html || `<div class="muted">No gifts yet.</div>`;
}

function renderItemCard(item) {
  const isClaimed = Boolean(item.claimedAt);
  const isClaimable = item.claimable !== false;

  const myToken = getTokenForGift(item.id);
  const isMine = isClaimed && Boolean(myToken);

  const safeTitle = escapeHtml(item.title || "");
  const safeNote = item.note ? escapeHtml(item.note) : "";
  const safeBuyUrl = item.buyUrl ? item.buyUrl : "";
  const safeImageUrl = item.imageUrl ? item.imageUrl : "";

  const claimedLabel = isClaimed ? (isMine ? "Claimed by you" : "Claimed") : "";
  const claimedPill = isClaimed ? `<span class="pill">${escapeHtml(claimedLabel)}</span>` : "";
  const watermark = isClaimed ? `<div class="wishlist-watermark" aria-hidden="true">CLAIMED</div>` : "";
  const claimedClass = isClaimed ? "is-claimed" : "";

  const buyLink =
    !isClaimed && safeBuyUrl
      ? `<a class="btn btn--secondary btn--small" href="${safeBuyUrl}" target="_blank" rel="noopener">Buy from here</a>`
      : "";

  const actionButton = (() => {
    if (!isClaimable) return "";

    if (!isClaimed) {
      return `
        <button type="button" class="btn btn--secondary btn--icon" data-action="open-claim" data-id="${item.id}">
          <span class="icon-check" aria-hidden="true">✓</span>
          <span>Claim</span>
        </button>
      `;
    }

    if (isMine) {
      return `
        <button type="button" class="btn btn--secondary" data-action="open-unclaim" data-id="${item.id}">
          Unclaim
        </button>
      `;
    }

    return `<button type="button" class="btn btn--secondary" disabled>Claimed</button>`;
  })();

  const note = safeNote ? `<div class="wishlist-note">${safeNote}</div>` : "";

  const image = safeImageUrl
    ? `<div class="wishlist-thumb"><img src="${safeImageUrl}" alt="" loading="lazy" decoding="async"></div>`
    : "";

  return `
    <article class="wishlist-item ${claimedClass}">
      ${watermark}
      ${image}

      <div class="wishlist-main">
        ${buyLink ? `<a href="${safeBuyUrl}" target="_blank" rel="noopener" class="wishlist-title-link">` : ""}
          <div class="wishlist-title-row">
            <h3 class="wishlist-title">${safeTitle}</h3>
            ${claimedPill}
          </div>
          ${note}
        ${buyLink ? `</a>` : ""}
      </div>

      <div class="wishlist-actions">
        ${actionButton}
      </div>
    </article>
  `;
}

/** -----------------------------
 * Modal open helpers
 * ----------------------------- */

function openClaimModal(item) {
  const isClaimable = item.claimable !== false;
  if (!isClaimable) return;
  if (item.claimedAt) return;

  activeItemId = String(item.id);
  claimModalItemTitle.textContent = item.title || "";

  if (claimerNameInput) claimerNameInput.value = "";
  if (confirmClaimBtn) confirmClaimBtn.disabled = true;

  hideError(claimErrorEl);

  openModal(claimModal);
  claimerNameInput?.focus();
}

function openUnclaimModal(item) {
  const myToken = getTokenForGift(item.id);
  if (!item.claimedAt || !myToken) return;

  activeItemId = String(item.id);
  unclaimModalItemTitle.textContent = item.title || "";

  if (unclaimerNameInput) unclaimerNameInput.value = "";
  if (confirmUnclaimBtn) confirmUnclaimBtn.disabled = true;

  hideError(unclaimErrorEl);

  openModal(unclaimModal);
  unclaimerNameInput?.focus();
}

/** -----------------------------
 * Claim / Unclaim actions
 * ----------------------------- */

async function onConfirmClaim() {
  if (modalBusy) return;

  try {
    hideError(claimErrorEl);

    if (!activeItemId) return;

    const name = (claimerNameInput?.value || "").trim();
    if (!name) {
      showError(claimErrorEl, "Please enter your name.");
      return;
    }

    lockModalBusy_({
      confirmBtn: confirmClaimBtn,
      cancelBtn: cancelClaimBtn,
    });

    const resp = await apiPost(API_CLAIM, {
      giftId: activeItemId,
      name,
    });

    if (!resp || resp.ok === false || resp.error) {
      showError(claimErrorEl, resp?.error || "Could not claim. Try again.");
      return;
    }

    if (resp.token) {
      setTokenForGift(activeItemId, resp.token);
    }

    closeModal(claimModal);
    activeItemId = null;

    await refreshItems();
  } catch (err) {
    showError(claimErrorEl, "Something went wrong. Please try again.");
  } finally {
    unlockModalBusy_({
      modalEl: claimModal,
      confirmBtn: confirmClaimBtn,
      cancelBtn: cancelClaimBtn,
      // re-disable if name is empty when still open
      reDisableIfEmpty: () => ((claimerNameInput?.value || "").trim().length === 0),
    });
  }
}

async function onConfirmUnclaim() {
  if (modalBusy) return;

  try {
    hideError(unclaimErrorEl);

    if (!activeItemId) return;

    const name = (unclaimerNameInput?.value || "").trim();
    if (!name) {
      showError(unclaimErrorEl, "Please enter your name.");
      return;
    }

    const token = getTokenForGift(activeItemId);
    if (!token) {
      showError(unclaimErrorEl, "You can only unclaim items you claimed on this device.");
      return;
    }

    lockModalBusy_({
      confirmBtn: confirmUnclaimBtn,
      cancelBtn: cancelUnclaimBtn,
    });

    const resp = await apiPost(API_UNCLAIM, {
      giftId: activeItemId,
      token,
      name,
    });

    if (!resp || resp.ok === false || resp.error) {
      showError(unclaimErrorEl, resp?.error || "Could not unclaim. Try again.");
      return;
    }

    removeTokenForGift(activeItemId);

    closeModal(unclaimModal);
    activeItemId = null;

    await refreshItems();
  } catch (err) {
    showError(unclaimErrorEl, "Something went wrong. Please try again.");
  } finally {
    unlockModalBusy_({
      modalEl: unclaimModal,
      confirmBtn: confirmUnclaimBtn,
      cancelBtn: cancelUnclaimBtn,
      reDisableIfEmpty: () => ((unclaimerNameInput?.value || "").trim().length === 0),
    });
  }
}

/** -----------------------------
 * API helpers
 * ----------------------------- */

async function apiGet(url, params = {}) {
  const u = new URL(url);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  const res = await fetch(u.toString(), { method: "GET" });
  return res.json();
}

async function apiPost(url, body) {
  const form = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => form.append(k, String(v)));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: form.toString(),
  });

  return res.json();
}

/** -----------------------------
 * Token helpers (local-only)
 * ----------------------------- */

function tokenKey(giftId) {
  return `${TOKEN_KEY_PREFIX}${giftId}`;
}

function getTokenForGift(giftId) {
  return localStorage.getItem(tokenKey(giftId)) || "";
}

function setTokenForGift(giftId, token) {
  localStorage.setItem(tokenKey(giftId), token);
}

function removeTokenForGift(giftId) {
  localStorage.removeItem(tokenKey(giftId));
}

/** -----------------------------
 * UI helpers
 * ----------------------------- */

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(modalEl) {
  if (!modalEl) return;
  if (modalBusy) return; // prevents closing during submit
  modalEl.hidden = true;
  document.body.classList.remove("modal-open");
}

function wireBackdropClose(modalEl) {
  if (!modalEl) return;

  modalEl.addEventListener("click", (e) => {
    if (modalBusy) return;

    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.matches("[data-close='true']")) closeModal(modalEl);
  });
}

function showError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function hideError(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** -----------------------------
 * Modal busy helpers
 * ----------------------------- */

function lockModalBusy_({ confirmBtn, cancelBtn }) {
  modalBusy = true;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.classList.add("is-loading");
  }
  if (cancelBtn) cancelBtn.disabled = true;
}

function unlockModalBusy_({ modalEl, confirmBtn, cancelBtn, reDisableIfEmpty }) {
  modalBusy = false;

  // Only reset buttons if the modal is still open.
  if (!modalEl || modalEl.hidden) return;

  if (confirmBtn) {
    confirmBtn.classList.remove("is-loading");
    const shouldDisable = typeof reDisableIfEmpty === "function" ? reDisableIfEmpty() : false;
    confirmBtn.disabled = Boolean(shouldDisable);
  }
  if (cancelBtn) cancelBtn.disabled = false;
}
