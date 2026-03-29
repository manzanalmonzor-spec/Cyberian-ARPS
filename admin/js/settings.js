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

      phoneInput.value = data.phone || "";
      savedPhoneDisp.textContent = data.phone || "Not set";

      if (data.updatedAt) {
        const ts = data.updatedAt.toDate();
        savedPhoneTime.textContent = `Last updated: ${ts.toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric"
        })} at ${ts.toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit"
        })}`;
      }

      for (const [key, el] of Object.entries(agencyInputs)) {
        el.value = data[`agency${key}`] || "";
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
  const phone = phoneInput.value.trim();
  if (!phone) {
    showStatus(saveStatus, "Please enter a phone number.", "error");
    return;
  }

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
  for (const [key, el] of Object.entries(agencyInputs)) {
    updates[`agency${key}`] = el.value.trim();
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

// ── Init ──────────────────────────────────────────────────────────────────────
loadSettings();
