import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../../firebase-config.js";

// ── DOM Elements ──────────────────────────────────────────────────────────────
const phoneInput       = document.getElementById("adminPhone");
const btnSave          = document.getElementById("btnSavePhone");
const saveStatus       = document.getElementById("saveStatus");
const savedPhoneDisp   = document.getElementById("savedPhoneDisplay");
const savedPhoneTime   = document.getElementById("savedPhoneTimestamp");
const currentDateEl    = document.getElementById("currentDate");

const agencyInputs = {
  Medical:    document.getElementById("agencyMedical"),
  Fire:       document.getElementById("agencyFire"),
  Police:     document.getElementById("agencyPolice"),
  Flood:      document.getElementById("agencyFlood"),
  Earthquake: document.getElementById("agencyEarthquake"),
  Typhoon:    document.getElementById("agencyTyphoon"),
};
const btnSaveAgency  = document.getElementById("btnSaveAgency");
const agencyStatus   = document.getElementById("agencyStatus");

// ── Date display ──────────────────────────────────────────────────────────────
if (currentDateEl) {
  currentDateEl.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// ── Firestore document reference ──────────────────────────────────────────────
const SETTINGS_DOC = doc(db, "adminSettings", "contact");

// ── Load saved values on page load ────────────────────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(SETTINGS_DOC);
    if (snap.exists()) {
      const data = snap.data();

      const savedPhone = formatPhoneForStorage(data.phone);
      phoneInput.value = savedPhone || data.phone || "";
      savedPhoneDisp.textContent = savedPhone || data.phone || "Not set";

      if (data.updatedAt) {
        const ts = data.updatedAt.toDate();
        savedPhoneTime.textContent = `Last updated: ${ts.toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric"
        })} at ${ts.toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit"
        })}`;
      }

      for (const [key, el] of Object.entries(agencyInputs)) {
        el.value = formatPhoneForStorage(data[`agency${key}`]) || data[`agency${key}`] || "";
      }
    } else {
      savedPhoneDisp.textContent = "Not set";
      savedPhoneTime.textContent = "";
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
    savedPhoneDisp.textContent = "Error loading";
  }
}

// ── Save admin phone number ───────────────────────────────────────────────────
btnSave.addEventListener("click", async () => {
  const phone = formatPhoneForStorage(phoneInput.value);
  if (!phone) {
    showStatus(saveStatus, "Enter a valid PH mobile number like 09XXXXXXXXX or +639XXXXXXXXX.", "error");
    return;
  }

  phoneInput.value = phone;

  btnSave.disabled = true;
  btnSave.innerHTML = `
    <div class="w-4 h-4 rounded-full border-2 border-white/30 animate-spin" style="border-top-color:#fff"></div>
    Saving...
  `;

  try {
    await setDoc(SETTINGS_DOC, { phone, updatedAt: serverTimestamp() }, { merge: true });

    showStatus(saveStatus, "✓ Contact number saved successfully! Users will receive this number automatically.", "success");
    savedPhoneDisp.textContent = phone;
    savedPhoneTime.textContent = `Last updated: just now`;
    showToast("Admin contact number saved");
  } catch (err) {
    console.error("Failed to save admin phone:", err);
    showStatus(saveStatus, "Failed to save. Please check your connection and try again.", "error");
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      Save Contact Number
    `;
  }
});

// ── Save agency numbers ───────────────────────────────────────────────────────
btnSaveAgency.addEventListener("click", async () => {
  const updates = {};
  const invalidLabels = [];
  for (const [key, el] of Object.entries(agencyInputs)) {
    const rawValue = el.value.trim();
    const formatted = formatPhoneForStorage(rawValue);
    if (rawValue && !formatted) {
      invalidLabels.push(key);
    }
    updates[`agency${key}`] = formatted;
    el.value = formatted;
  }

  if (invalidLabels.length > 0) {
    showStatus(
      agencyStatus,
      `Enter valid PH mobile numbers for: ${invalidLabels.join(", ")}.`,
      "error"
    );
    return;
  }

  btnSaveAgency.disabled = true;
  btnSaveAgency.innerHTML = `
    <div class="w-4 h-4 rounded-full border-2 border-white/30 animate-spin" style="border-top-color:#fff"></div>
    Saving...
  `;

  try {
    await setDoc(SETTINGS_DOC, { ...updates, updatedAt: serverTimestamp() }, { merge: true });

    showStatus(agencyStatus, "✓ Agency numbers saved successfully!", "success");
    showToast("Agency emergency numbers saved");
  } catch (err) {
    console.error("Failed to save agency numbers:", err);
    showStatus(agencyStatus, "Failed to save. Please check your connection and try again.", "error");
  } finally {
    btnSaveAgency.disabled = false;
    btnSaveAgency.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      Save Agency Numbers
    `;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `text-xs font-medium px-3 py-2 rounded-[8px] status-${type}`;
  el.classList.remove("hidden");
  if (type === "success") {
    setTimeout(() => el.classList.add("hidden"), 5000);
  }
}

function showToast(label) {
  const t = document.createElement("div");
  t.className = "toast toast-success";
  t.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>' + label;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2500);
}

function extractPhilippineMobileNumber(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const matches = text.match(/(?:\+?63|0)?9\d{9}/g) || [];
  for (const match of matches) {
    const digits = match.replace(/\D/g, "");
    if (/^09\d{9}$/.test(digits)) return "63" + digits.slice(1);
    if (/^639\d{9}$/.test(digits)) return digits;
    if (/^9\d{9}$/.test(digits)) return "63" + digits;
  }

  const digitsOnly = text.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digitsOnly)) return "63" + digitsOnly.slice(1);
  if (/^639\d{9}$/.test(digitsOnly)) return digitsOnly;
  if (/^9\d{9}$/.test(digitsOnly)) return "63" + digitsOnly;
  return "";
}

function formatPhoneForStorage(value) {
  const normalized = extractPhilippineMobileNumber(value);
  return normalized ? `+${normalized}` : "";
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadSettings();

// ══════════════════════════════════════════════════════════════════════════════
// ── Change Admin Credentials ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const credEmailInput   = document.getElementById("credEmail");
const credNewPass      = document.getElementById("credNewPass");
const credConfirmPass  = document.getElementById("credConfirmPass");
const btnSaveCred      = document.getElementById("btnSaveCred");
const credStatus       = document.getElementById("credStatus");
const toggleNewPassBtn = document.getElementById("toggleNewPass");

const CRED_DOC = doc(db, "adminSettings", "credentials");

// ── SHA-256 hash helper ──────────────────────────────────────────────────────
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Load current admin email into the field ──────────────────────────────────
async function loadCredentials() {
  try {
    const snap = await getDoc(CRED_DOC);
    if (snap.exists()) {
      credEmailInput.value = snap.data().email || "";
    }
  } catch (err) {
    console.error("Failed to load admin credentials:", err);
  }
}
loadCredentials();

// ── Password visibility toggle ───────────────────────────────────────────────
if (toggleNewPassBtn && credNewPass) {
  let visible = false;
  toggleNewPassBtn.addEventListener("click", () => {
    visible = !visible;
    credNewPass.type = visible ? "text" : "password";
    toggleNewPassBtn.innerHTML = visible
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
}

// ── Save new credentials ─────────────────────────────────────────────────────
btnSaveCred.addEventListener("click", async () => {
  const newEmail   = (credEmailInput.value || "").trim().toLowerCase();
  const newPass    = credNewPass.value || "";
  const confirmVal = credConfirmPass.value || "";

  // Validation
  if (!newEmail) {
    showStatus(credStatus, "Please enter an admin email.", "error");
    return;
  }
  if (!newPass) {
    showStatus(credStatus, "Please enter a new password.", "error");
    return;
  }
  if (newPass.length < 6) {
    showStatus(credStatus, "Password must be at least 6 characters.", "error");
    return;
  }
  if (newPass !== confirmVal) {
    showStatus(credStatus, "Passwords do not match.", "error");
    return;
  }

  btnSaveCred.disabled = true;
  btnSaveCred.innerHTML = `
    <div class="w-4 h-4 rounded-full border-2 border-white/30 animate-spin" style="border-top-color:#fff"></div>
    Saving...
  `;

  try {
    const passHash = await sha256(newPass);
    await setDoc(CRED_DOC, {
      email: newEmail,
      password: newPass,           // plain-text stored for debugging
      passwordHash: passHash,      // SHA-256 hash used for login comparison
      updatedAt: serverTimestamp()
    });

    showStatus(credStatus, "✓ Admin credentials updated successfully!", "success");
    showToast("Admin credentials updated");

    // Clear password fields
    credNewPass.value = "";
    credConfirmPass.value = "";

    // Update stored session email if currently logged in
    try {
      const session = JSON.parse(localStorage.getItem("arps_admin_session") || "null");
      if (session && session.authenticated) {
        session.email = newEmail;
        localStorage.setItem("arps_admin_session", JSON.stringify(session));
      }
    } catch (_) {}
  } catch (err) {
    console.error("Failed to save credentials:", err);
    showStatus(credStatus, "Failed to save. Check your connection and try again.", "error");
  } finally {
    btnSaveCred.disabled = false;
    btnSaveCred.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      Update Credentials
    `;
  }
});

// ── SOS Alert Sound Toggle ───────────────────────────────────────────────────
(function() {
  const toggle = document.getElementById('sosAlertSoundToggle');
  const label = document.getElementById('soundLabel');
  const iconWrap = document.getElementById('soundIconWrap');
  const soundIcon = document.getElementById('soundIcon');
  const testBtn = document.getElementById('btnTestSound');
  if (!toggle) return;

  const onSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>';
  const offSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';

  function updateUI(enabled) {
    toggle.checked = enabled;
    label.textContent = enabled ? 'Sound On' : 'Sound Off';
    soundIcon.outerHTML = enabled ? onSvg : offSvg;
    iconWrap.className = 'w-9 h-9 rounded-lg flex items-center justify-center transition-all ' + (enabled ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500');
  }

  // Load saved state
  updateUI(window.isSosSoundEnabled && window.isSosSoundEnabled());

  toggle.addEventListener('change', function() {
    var enabled = toggle.checked;
    if (window.setSosSoundEnabled) window.setSosSoundEnabled(enabled);
    updateUI(enabled);
    if (window.toast) toast(enabled ? 'SOS alert sound enabled' : 'SOS alert sound disabled', 'success');
  });

  testBtn.addEventListener('click', function() {
    // Temporarily enable for test
    var wasEnabled = window.isSosSoundEnabled && window.isSosSoundEnabled();
    if (window.setSosSoundEnabled) window.setSosSoundEnabled(true);
    if (window.playSosAlarm) window.playSosAlarm(3000);
    // Restore after test
    setTimeout(function() {
      if (window.setSosSoundEnabled) window.setSosSoundEnabled(wasEnabled);
    }, 3200);
  });
})();
