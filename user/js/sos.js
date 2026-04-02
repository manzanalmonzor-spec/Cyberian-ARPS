import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../../firebase-config.js";

// ── Agency key map: SOS type → localStorage key / display name ───────────────
const AGENCY_STORAGE_KEY = {
  Medical:    'arps_agency_medical',
  Fire:       'arps_agency_fire',
  Police:     'arps_agency_police',
  Flood:      'arps_agency_flood',
  Earthquake: 'arps_agency_earthquake',
  Typhoon:    'arps_agency_typhoon',
};
const AGENCY_DISPLAY_NAME = {
  Medical:    'MHO/CHO',
  Fire:       'BFP',
  Police:     'PNP',
  Flood:      'MDRRMO',
  Earthquake: 'MDRRMO',
  Typhoon:    'MDRRMO',
};

// ── Cache admin contact + agency numbers from Firestore into localStorage ─────
async function cacheAdminContact() {
  try {
    const snap = await getDoc(doc(db, "adminSettings", "contact"));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.phone) localStorage.setItem('arps_admin_contact', data.phone);
    for (const [type, key] of Object.entries(AGENCY_STORAGE_KEY)) {
      const num = data[`agency${type}`];
      if (num) localStorage.setItem(key, num);
      else localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('Could not fetch admin contact (offline?):', err.message);
  }
}
cacheAdminContact();

// ── Pre-geocode on page load: save location name to localStorage ──────────────
(async function preGeocode() {
  // Only try if online — when offline we'll use what's already saved
  if (!navigator.onLine) return;
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, timeout: 5000, maximumAge: 60000
      });
    });
    const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    // reverseGeocode already saves to localStorage if successful
  } catch {}
})();

async function callPhilSMS(recipient, message) {
  const response = await fetch(window.getArpsApiUrl('api/send-sms'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ recipient, message })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// ── Step management ───────────────────────────────────────────────────────────
const ALL_STEPS = ["step-main", "step-type", "step-sending", "step-success"];

function showStep(id) {
  ALL_STEPS.forEach(stepId => {
    const el = document.getElementById(stepId);
    el.classList.add("hidden");
    el.classList.remove("flex");
  });
  const active = document.getElementById(id);
  active.classList.remove("hidden");
  active.classList.add("flex");
}

// ── Open directly on type selection ───────────────────────────────────────────
showStep("step-type");

// ── Step 2 → 3: Tap emergency type → send immediately ────────────────────────
document.getElementById("typeGrid").addEventListener("click", e => {
  const btn = e.target.closest("[data-type]");
  if (!btn) return;
  sendSosAlert(btn.dataset.type);
});

document.getElementById("btnBackToSOS").addEventListener("click", () => {
  window.location.href = "home.html";
});

// ── Step progress helpers ─────────────────────────────────────────────────────
const CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>';
const SPINNER   = '<div class="w-2 h-2 rounded-full border-2 border-slate-300 animate-spin" style="border-top-color:#1D4ED8"></div>';

function setVisible(n) {
  const row = document.getElementById(`s${n}`);
  row.style.opacity = 1;
  row.classList.add("animate-fade");
}

function markDone(n, label) {
  const icon = document.getElementById(`s${n}i`);
  const text = document.getElementById(`s${n}t`);
  icon.innerHTML = CHECK_SVG;
  icon.className = "w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center";
  text.className = "text-[13px] text-emerald-600 font-medium";
  if (label) text.textContent = label;
}

function markError(n, label) {
  const icon = document.getElementById(`s${n}i`);
  const text = document.getElementById(`s${n}t`);
  icon.innerHTML = "!";
  icon.className = "w-5 h-5 rounded-full bg-red-100 text-red-600 text-[11px] font-bold flex items-center justify-center";
  text.className = "text-[13px] text-red-600 font-medium";
  text.textContent = label;
}

function resetSteps() {
  [1, 2, 3].forEach(n => {
    const row  = document.getElementById(`s${n}`);
    const icon = document.getElementById(`s${n}i`);
    const text = document.getElementById(`s${n}t`);
    row.style.opacity = 0;
    row.classList.remove("animate-fade");
    icon.innerHTML = SPINNER;
    icon.className = "w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center";
    text.className = "text-[13px] text-slate-400 font-medium";
  });
  document.getElementById("s1t").textContent = "Capturing GPS location...";
  document.getElementById("s2t").textContent = "Sending SOS signal...";
  document.getElementById("s3t").textContent = "Notifying responders...";
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem("resq-device-id");
  if (!id) {
    id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("resq-device-id", id);
  }
  return id;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    // Try getting last-known cached position first (stored from home.html)
    const cachedLoc = localStorage.getItem('arps_last_location');

    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      // If permission denied or unavailable, try cached location
      if (cachedLoc) {
        try {
          const loc = JSON.parse(cachedLoc);
          resolve({ coords: { latitude: loc.lat, longitude: loc.lng, accuracy: loc.accuracy || 100 } });
          return;
        } catch {}
      }
      reject(err);
    }, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000
    });
  });
}

function timedFetch(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function reverseGeocode(lat, lng) {
  let result = null;
  let streetName = null;
  let nearbyDesc = null;

  // 1) Try Photon geocoder (OSM-powered, has barangay data, no strict rate limit)
  try {
    const res = await timedFetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`,
      {}, 5000
    );
    if (res.ok) {
      const data = await res.json();
      const props = data.features?.[0]?.properties || {};
      const barangay     = props.district || props.locality || null;
      const municipality = props.city || props.county || null;
      const province     = props.state || null;
      streetName = props.street || props.name || null;
      const parts = [];
      if (barangay) parts.push(barangay);
      if (municipality && municipality !== barangay) parts.push(municipality);
      // Skip province if it contains 'Region' (that's the region, not actual province)
      if (province && province !== municipality && !province.includes('Region')) parts.push(province);
      if (parts.length > 0) result = parts.join(', ');
    }
  } catch {}

  // 2) Try Nominatim (has barangay in 'village' field — also grab road & nearby features)
  if (!result || !streetName) {
    try {
      const res = await timedFetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
        { headers: { 'User-Agent': 'ARPS-EmergencyApp/1.0' } }, 6000
      );
      if (res.ok) {
        const data = await res.json();
        const a = data.address || {};
        if (!streetName) streetName = a.road || a.pedestrian || a.footway || a.path || null;
        if (!result) {
          const barangay     = a.village || a.suburb || a.hamlet || a.quarter || a.neighbourhood || null;
          const municipality = a.city || a.municipality || a.town || a.city_district || null;
          const province     = a.county || a.province || a.state_district || null;
          const parts = [];
          if (barangay) parts.push(barangay);
          if (municipality && municipality !== barangay) parts.push(municipality);
          if (province && province !== municipality) parts.push(province);
          if (parts.length > 0) result = parts.join(', ');
          else if (data.display_name) result = data.display_name.split(',').slice(0, 3).join(',').trim();
        }
      }
    } catch {}
  }

  // 3) Fallback: BigDataCloud (no barangay data but has municipality + province)
  if (!result) {
    try {
      const res = await timedFetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
        {}, 6000
      );
      if (res.ok) {
        const data = await res.json();
        const adminList = data.localityInfo?.administrative || [];
        // Municipality = adminLevel 6 for PH
        const muniEntry = adminList.find(l =>
          (l.description || '').toLowerCase().includes('municipality') ||
          (l.description || '').toLowerCase().includes('city') ||
          l.adminLevel === 6
        );
        // Province = adminLevel 4 ONLY (adminLevel 3 is region, skip it)
        const provEntry = adminList.find(l => l.adminLevel === 4);

        const municipality = muniEntry?.name || data.city || null;
        const province     = provEntry?.name || null;

        const parts = [];
        if (municipality) parts.push(municipality);
        if (province && province !== municipality) parts.push(province);
        if (parts.length > 0) result = parts.join(', ');
      }
    } catch {}
  }

  // 4) Get nearby terrain/landmark description using Overpass API
  nearbyDesc = await getNearbyDescription(lat, lng, streetName);

  // Save to localStorage so offline SOS can use it
  if (result) {
    localStorage.setItem('arps_location_name', result);
  }
  if (nearbyDesc) {
    localStorage.setItem('arps_location_desc', nearbyDesc);
  }

  return result;
}

// ── Get descriptive terrain/landmark info ("malapit sa baybay", "sa kalsada", etc.) ──
async function getNearbyDescription(lat, lng, streetName) {
  const hints = [];

  // Check nearby features via Overpass API (water, mountains, roads, schools, churches, etc.)
  try {
    const radius = 300; // 300m radius
    const query = `
      [out:json][timeout:5];
      (
        way["natural"="water"](around:${radius},${lat},${lng});
        way["natural"="coastline"](around:${radius},${lat},${lng});
        way["natural"="beach"](around:${radius},${lat},${lng});
        way["natural"="wetland"](around:${radius},${lat},${lng});
        node["natural"="peak"](around:1000,${lat},${lng});
        way["landuse"="forest"](around:${radius},${lat},${lng});
        way["natural"="wood"](around:${radius},${lat},${lng});
        node["amenity"="school"](around:${radius},${lat},${lng});
        node["amenity"="place_of_worship"](around:${radius},${lat},${lng});
        node["amenity"="hospital"](around:${radius},${lat},${lng});
        node["amenity"="marketplace"](around:${radius},${lat},${lng});
        node["shop"="mall"](around:${radius},${lat},${lng});
        way["waterway"="river"](around:${radius},${lat},${lng});
        way["waterway"="stream"](around:${radius},${lat},${lng});
        way["highway"="primary"](around:100,${lat},${lng});
        way["highway"="secondary"](around:100,${lat},${lng});
        way["highway"="tertiary"](around:100,${lat},${lng});
        way["highway"="residential"](around:50,${lat},${lng});
        node["amenity"="fuel"](around:${radius},${lat},${lng});
        node["amenity"="police"](around:${radius},${lat},${lng});
        node["amenity"="fire_station"](around:${radius},${lat},${lng});
        way["landuse"="farmland"](around:${radius},${lat},${lng});
        way["landuse"="residential"](around:100,${lat},${lng});
      );
      out tags 1;
    `;
    const res = await timedFetch(
      'https://overpass-api.de/api/interpreter',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query)
      },
      6000
    );
    if (res.ok) {
      const data = await res.json();
      const elements = data.elements || [];

      // Categorize nearby features
      const found = { coast: false, river: false, mountain: false, forest: false, farm: false,
        road: false, school: null, church: null, hospital: null, market: null, gasStation: null,
        police: null, fireStation: null, residential: false };

      for (const el of elements) {
        const t = el.tags || {};
        if (t.natural === 'coastline' || t.natural === 'beach') found.coast = true;
        if (t.natural === 'water' || t.waterway === 'river' || t.waterway === 'stream' || t.natural === 'wetland') found.river = true;
        if (t.natural === 'peak') found.mountain = true;
        if (t.natural === 'wood' || t.landuse === 'forest') found.forest = true;
        if (t.landuse === 'farmland') found.farm = true;
        if (t.landuse === 'residential') found.residential = true;
        if (t.highway) found.road = true;
        if (t.amenity === 'school') found.school = t.name || 'school';
        if (t.amenity === 'place_of_worship') found.church = t.name || 'simbahan';
        if (t.amenity === 'hospital') found.hospital = t.name || 'hospital';
        if (t.amenity === 'marketplace' || t.shop === 'mall') found.market = t.name || 'palengke';
        if (t.amenity === 'fuel') found.gasStation = t.name || 'gasolinahan';
        if (t.amenity === 'police') found.police = t.name || 'police station';
        if (t.amenity === 'fire_station') found.fireStation = t.name || 'fire station';
      }

      // Build descriptive hints in Filipino/English mix
      if (found.coast) hints.push('malapit sa dagat/baybay');
      if (found.river) hints.push('malapit sa ilog');
      if (found.mountain) hints.push('malapit sa bukid/bundok');
      if (found.forest) hints.push('malapit sa kagubatan');
      if (found.farm) hints.push('malapit sa bukirin/taniman');
      if (found.school) hints.push(`malapit sa ${found.school}`);
      if (found.church) hints.push(`malapit sa ${found.church}`);
      if (found.hospital) hints.push(`malapit sa ${found.hospital}`);
      if (found.market) hints.push(`malapit sa ${found.market}`);
      if (found.gasStation) hints.push(`malapit sa ${found.gasStation}`);
      if (found.police) hints.push(`malapit sa ${found.police}`);
      if (found.fireStation) hints.push(`malapit sa ${found.fireStation}`);
      if (found.residential && hints.length === 0) hints.push('sa residential area');
    }
  } catch {
    // Overpass failed — continue with what we have
  }

  // Add street name if we have one
  if (streetName) {
    hints.unshift(`sa ${streetName}`);
  } else if (hints.length === 0) {
    // No overpass data and no street — skip
    return null;
  }

  // Limit to 3 most useful hints
  const finalHints = hints.slice(0, 3);
  return finalHints.length > 0 ? finalHints.join(', ') : null;
}

// ── Send SOS ──────────────────────────────────────────────────────────────────
async function sendSosAlert(type) {
  resetSteps();
  showStep("step-sending");
  setVisible(1);

  // Step 1 — GPS
  let lat, lng, accuracy, locationLabel, locationDesc, createdAtMs;
  const DEFAULT_LAT = 14.6507, DEFAULT_LNG = 121.0497;
  // Read saved place name & description from localStorage (saved by home.html / last geocode)
  const savedLocationName = localStorage.getItem('arps_location_name');
  const savedLocationDesc = localStorage.getItem('arps_location_desc');

  try {
    const pos = await getCurrentPosition();
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = pos.coords.accuracy;
    createdAtMs = Date.now();

    if (navigator.onLine) {
      const place = await reverseGeocode(lat, lng);
      locationLabel = place || savedLocationName || `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
      locationDesc = localStorage.getItem('arps_location_desc') || savedLocationDesc || null;
    } else {
      // Offline — use saved name & description from localStorage
      locationLabel = savedLocationName || `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
      locationDesc = savedLocationDesc || null;
    }
    markDone(1, "GPS location captured");
  } catch (err) {
    lat = DEFAULT_LAT; lng = DEFAULT_LNG; accuracy = null;
    createdAtMs = Date.now();
    locationLabel = savedLocationName || "Location unavailable";
    locationDesc = savedLocationDesc || null;
    const hint = err?.code === 1 ? "GPS denied — using last known location"
      : err?.code === 3 ? "GPS timed out — using last known location"
      : "GPS unavailable — using last known location";
    markDone(1, hint);
  }

  // Step 2 — Write to Firestore
  setVisible(2);
  const { userName, userContact, userAtRisk } = getSosProfile();
  const payload = {
    source:       "user-sos",
    reporterId:   getDeviceId(),
    name:         userName,
    contact:      userContact,
    type,
    severity:     "Critical",
    status:       "Pending",
    atRisk:       userAtRisk,
    desc:         `${type} emergency SOS triggered from the resident app.`,
    latitude:     lat,
    longitude:    lng,
    accuracy,
    locationLabel,
    locationDesc: locationDesc || null,
    createdAt:    serverTimestamp(),
    createdAtMs,
    updatedAt:    serverTimestamp()
  };

  try {
    if (!navigator.onLine) {
      // Fire-and-forget when offline
      addDoc(collection(db, "sosAlerts"), payload).catch(console.error);
      markError(2, "Offline — proceeding to SMS fallback");
    } else {
      // 4-second timeout when online to prevent hanging on weak connections
      const dbPromise = addDoc(collection(db, "sosAlerts"), payload);
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
      await Promise.race([dbPromise, timeout]);
      markDone(2, "SOS signal sent to admin dashboard");
    }
  } catch (err) {
    if (err.message === "timeout") {
      markError(2, "Connection weak — proceeding to SMS");
    } else {
      markError(2, err?.code === "permission-denied" ? "Permission error" : "Dashboard sync failed");
    }
  }

  // Step 3 — Send SMS to emergency contact + admin + agency
  setVisible(3);

  const { ecName, ecNumber } = getSosProfile();
  const adminPhone  = localStorage.getItem('arps_admin_contact');
  const agencyPhone = localStorage.getItem(AGENCY_STORAGE_KEY[type] || '') || null;
  const agencyName  = AGENCY_DISPLAY_NAME[type] || 'Agency';

  const time = new Date(createdAtMs).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(createdAtMs).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const atRiskNote = userAtRisk && userAtRisk !== 'None' ? ` [At-Risk: ${userAtRisk}]` : '';
  const descLine = locationDesc ? `Landmark: ${locationDesc}\n` : '';
  const coordsLine = (lat && lng && lat !== 14.6507) ? `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` : '';
  const mapLink = (lat && lng && lat !== 14.6507) ? `Map: https://maps.google.com/?q=${lat},${lng}\n` : '';
  const message =
    `[ARPS EMERGENCY ALERT]\n` +
    `${userName}${atRiskNote} has triggered a ${type} Emergency SOS.\n` +
    `Location: ${locationLabel}\n` +
    `${descLine}` +
    `${coordsLine}` +
    `${mapLink}` +
    `Time: ${time}, ${dateStr}\n\n` +
    `Please respond immediately.\n` +
    `- ARPS Emergency Response System`;

  const phoneUser   = ecNumber    ? normalizePhone(ecNumber)    : null;
  const phoneAdmin  = adminPhone  ? normalizePhone(adminPhone)  : null;
  const phoneAgency = agencyPhone ? normalizePhone(agencyPhone) : null;

  if (!phoneAgency) {
    // Warn in console so admin knows to configure it — not fatal
    console.warn(`Agency number for ${type} not configured. Only admin will be notified.`);
  }

  if (!navigator.onLine) {
    // ─── OFFLINE: Open phone's native SMS app — admin only (agency requires internet for PhilSMS) ───
    document.getElementById("s3t").textContent = "Opening SMS app...";
    const allPhones = [phoneAdmin, phoneUser].filter(Boolean);
    if (allPhones.length > 0) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const sep = isIOS ? ',' : ';';
      const smsUrl = `sms:${allPhones.join(sep)}?body=${encodeURIComponent(message)}`;
      window.location.href = smsUrl;
      markDone(3, "SMS app opened — tap Send to notify admin");
    } else {
      markDone(3, "No contacts set — SMS skipped");
    }
  } else {
    // ─── ONLINE: Use PhilSMS API (automatic, no user action needed) ───
    document.getElementById("s3t").textContent = "Sending SMS via PhilSMS...";
    let sentTo = [];

    if (phoneUser) {
      try {
        await callPhilSMS(phoneUser, message);
        sentTo.push(ecName || 'Contact');
      } catch (err) {
        console.error('PhilSMS failed for user contact:', err);
      }
    }
    if (phoneAdmin) {
      try {
        await callPhilSMS(phoneAdmin, message);
        sentTo.push('Admin');
      } catch (err) {
        console.error('PhilSMS failed for admin:', err);
      }
    }
    if (phoneAgency) {
      try {
        await callPhilSMS(phoneAgency, message);
        sentTo.push(agencyName);
      } catch (err) {
        console.error(`PhilSMS failed for agency (${agencyName}):`, err);
      }
    } else {
      // Agency number not configured — show non-blocking warning after step completes
      console.warn(`No ${agencyName} number configured by admin.`);
    }

    if (sentTo.length === 0 && (phoneUser || phoneAdmin || phoneAgency)) {
      // PhilSMS failed for all — fallback to native SMS (admin + user only, no agency without internet)
      const allPhones = [phoneAdmin, phoneUser].filter(Boolean);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const sep = isIOS ? ',' : ';';
      window.location.href = `sms:${allPhones.join(sep)}?body=${encodeURIComponent(message)}`;
      markError(3, "PhilSMS failed — SMS app opened as backup");
    } else if (sentTo.length === 0) {
      markDone(3, "No contacts set — SMS skipped");
    } else {
      markDone(3, `SMS auto-sent to ${sentTo.join(', ')}`);
    }

    // Show non-blocking agency-not-configured warning below the step row
    if (!phoneAgency) {
      const warnEl = document.createElement('p');
      warnEl.className = 'text-[11px] text-amber-600 font-medium mt-1 text-center';
      warnEl.textContent = `⚠ ${agencyName} number not set by admin — only admin was notified.`;
      document.getElementById('s3')?.after(warnEl);
    }
  }

  document.getElementById("typeSent").textContent = type + " Emergency";
  document.getElementById("timeSent").textContent = new Date(createdAtMs).toLocaleTimeString();
  document.getElementById("locSent").textContent  = locationLabel;
  showStep("step-success");
}

// ── PhilSMS helpers ───────────────────────────────────────────────────────────
function getSosProfile() {
  const session = window.arpsUser;
  const uid = session ? session.uid : 'guest';
  const profile = JSON.parse(localStorage.getItem('arps_profile_' + uid) || '{}');
  const ec      = JSON.parse(localStorage.getItem('arps_emergency_contact_' + uid) || '{}');
  return {
    userName:    profile.name    || (session ? session.name : 'A resident'),
    userContact: profile.contact || '',
    userAtRisk:  profile.atRisk  || 'None',
    ecName:      ec.name         || '',
    ecNumber:    ec.number       || ''
  };
}

function normalizePhone(num) {
  let n = (num || '').replace(/[\s\-().+]/g, '');
  if (n.startsWith('0') && n.length === 11) n = '63' + n.slice(1); // 09... → 639...
  return n; // already 639... or +63 stripped to 639...
}

// ── Send Another ──────────────────────────────────────────────────────────────
document.getElementById("btnSendAnother").addEventListener("click", () => {
  showStep("step-type");
});
