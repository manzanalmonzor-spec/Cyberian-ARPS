import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../../firebase-config.js";


const typeIcons = {
  Flood: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21c3.5 0 6-2.5 6-6.2C18 11 12 3 12 3S6 11 6 14.8C6 18.5 8.5 21 12 21z"/></svg>`,
  Medical: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>`,
  Fire: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
  Earthquake: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
  Typhoon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>`,
  SOS: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
};

const statusColors = {
  Pending: { bg: "bg-amber-100", text: "text-amber-500" },
  Responding: { bg: "bg-blue-100", text: "text-blue-500" },
  Resolved: { bg: "bg-emerald-100", text: "text-emerald-500" }
};

const severityColor = {
  Critical: "#DC2626",
  High: "#F59E0B",
  Medium: "#2563EB",
  Low: "#10B981"
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const currentDateEl = document.getElementById("currentDate");
const statsGrid = document.getElementById("statsGrid");
const filterStatus = document.getElementById("filterStatus");
const rowsContainer = document.getElementById("rowsContainer");
const incidentList = document.getElementById("incidentList");
const incidentDetail = document.getElementById("incidentDetail");
const aiSummary = document.getElementById("aiSummary");
const contactModal = document.getElementById("contactModal");
const contactInfo = document.getElementById("contactInfo");
const contactOverlay = document.getElementById("contactOverlay");
const contactDialog = document.getElementById("contactDialog");
const callBtn = document.getElementById("callBtn");
const smsBtn = document.getElementById("smsBtn");
const cancelContactBtn = document.getElementById("cancelContactBtn");

// ── State ─────────────────────────────────────────────────────────────────────
let incidents = [];
let liveIncidents = [];
let openDetailIncidentId = null;

// ── Admin GPS tracking state ───────────────────────────────────────────────────
let adminLocation = null;
let adminMarkerOnMiniMap = null;
let adminMarkerOnDetailMap = null;

function buildAdminIcon(size = 18) {
  return window.L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#1D4ED8;border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(29,78,216,0.28);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function startAdminLocationTracking() {
  if (!navigator.geolocation) return;

  const opts = { enableHighAccuracy: true, timeout: 9000, maximumAge: 15000 };

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      adminLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      renderDashboardMapMarkers();
    },
    (err) => console.warn("Admin GPS unavailable:", err.message),
    opts
  );

  navigator.geolocation.watchPosition(
    (pos) => {
      adminLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      if (dashMap && adminMarkerOnMiniMap) {
        adminMarkerOnMiniMap.setLatLng([adminLocation.lat, adminLocation.lng]);
      }
      if (detailMap && adminMarkerOnDetailMap) {
        adminMarkerOnDetailMap.setLatLng([adminLocation.lat, adminLocation.lng]);
      }
    },
    (err) => console.warn("Admin GPS watch error:", err.message),
    opts
  );
}

// ── Mini-map (right panel) ────────────────────────────────────────────────────
let dashMap = null;
let dashMapMarkers = [];

function initDashboardMap() {
  if (dashMap || !window.L) return;

  const el = document.getElementById("dashboardMap");
  if (!el) return;

  try {
    dashMap = window.L.map(el, {
      preferCanvas: true,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false
    }).setView([14.6507, 121.0497], 13);

    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(dashMap);

    // Staggered invalidateSize calls to guarantee tiles render in all environments
    setTimeout(() => dashMap && dashMap.invalidateSize(), 0);
    setTimeout(() => dashMap && dashMap.invalidateSize(), 200);
    setTimeout(() => dashMap && dashMap.invalidateSize(), 500);
  } catch (e) {
    console.warn("Dashboard mini-map failed to init:", e);
  }
}

function renderDashboardMapMarkers() {
  if (!dashMap) return;

  dashMapMarkers.forEach((m) => m.remove());
  dashMapMarkers = [];
  adminMarkerOnMiniMap = null;

  const allToShow = liveIncidents.filter(
    (inc) => Number(inc.lat) !== 0 && Number(inc.lng) !== 0
  );
  const bounds = [];

  allToShow.forEach((inc) => {
    const lat = Number(inc.lat);
    const lng = Number(inc.lng);
    if (!lat || !lng) return;

    const color = severityColor[inc.severity] || "#DC2626";
    const isLive = !!inc.alertDocId;

    const marker = window.L.circleMarker([lat, lng], {
      radius: isLive ? 10 : 7,
      fillColor: color,
      color: "#fff",
      weight: isLive ? 3 : 2,
      opacity: 1,
      fillOpacity: isLive ? 1 : 0.75
    });

    marker.bindPopup(
      `<div style="font-size:12px;line-height:1.6">
        <strong>${inc.id}</strong>${isLive ? ' <span style="color:#DC2626;">● LIVE</span>' : ''}<br>
        ${inc.locationLabel ? `<span style="font-weight:600;">${inc.locationLabel}</span><br>` : ""}
        ${inc.name}<br>
        <span style="color:${color}">${inc.severity} · ${inc.type}</span>
      </div>`
    );

    marker.addTo(dashMap);
    dashMapMarkers.push(marker);
    bounds.push([lat, lng]);
  });

  // ── Admin / Responder marker on mini-map ──
  if (adminLocation && adminLocation.lat && adminLocation.lng) {
    adminMarkerOnMiniMap = window.L.marker(
      [adminLocation.lat, adminLocation.lng],
      { icon: buildAdminIcon(16) }
    )
      .bindPopup('<div style="font-size:12px;"><strong style="color:#1D4ED8;">● Admin / Responder</strong><br>Your current location</div>')
      .addTo(dashMap);
    dashMapMarkers.push(adminMarkerOnMiniMap);
    bounds.push([adminLocation.lat, adminLocation.lng]);
  }

  if (bounds.length === 0) return;

  if (bounds.length === 1) {
    dashMap.setView(bounds[0], 15);
  } else {
    try {
      dashMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    } catch (e) { /* ignore */ }
  }
}

// ── Detail map (incident detail view) ─────────────────────────────────────────
let detailMap = null;

function destroyDetailMap() {
  if (detailMap) {
    try { detailMap.remove(); } catch (e) { /* ignore */ }
    detailMap = null;
  }
  adminMarkerOnDetailMap = null;
}

let detailMapLocationLabel = null;

function initDetailMap(lat, lng, locationLabel) {
  destroyDetailMap();
  detailMapLocationLabel = locationLabel || null;
  if (!window.L) return;

  const el = document.getElementById("incidentDetailMap");
  if (!el) return;

  try {
    const hasAdmin = adminLocation && adminLocation.lat && adminLocation.lng;

    detailMap = window.L.map(el, {
      preferCanvas: true,
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true
    }).setView([lat, lng], 16);

    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(detailMap);

    // ── User SOS marker (red) ──
    const userIcon = window.L.divIcon({
      className: "",
      html: `<div style="
        width:22px;height:22px;border-radius:50%;
        background:#DC2626;border:3px solid #fff;
        box-shadow:0 0 0 5px rgba(220,38,38,0.3);
      "></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const popupLabel = detailMapLocationLabel || `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
    window.L.marker([lat, lng], { icon: userIcon })
      .bindPopup(`
        <div style="font-size:12px;line-height:1.6;">
          <strong style="color:#DC2626;">● SOS Location</strong><br>
          ${popupLabel}
          ${detailMapLocationLabel ? `<br><span style="color:#94a3b8;font-size:10px;">${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E</span>` : ""}
        </div>`)
      .addTo(detailMap)
      .openPopup();

    // ── Admin / Responder marker (blue) ──
    if (hasAdmin) {
      adminMarkerOnDetailMap = window.L.marker(
        [adminLocation.lat, adminLocation.lng],
        { icon: buildAdminIcon(20) }
      )
        .bindPopup(`
          <div style="font-size:12px;line-height:1.6;">
            <strong style="color:#1D4ED8;">● Admin / Responder</strong><br>
            Your current location
          </div>`)
        .addTo(detailMap);

      // Fit map to show both markers with padding
      const bounds = window.L.latLngBounds(
        [lat, lng],
        [adminLocation.lat, adminLocation.lng]
      );
      detailMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }

    // ── Legend overlay ──
    const legend = window.L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const div = window.L.DomUtil.create("div");
      div.style.cssText = "background:rgba(255,255,255,0.92);border-radius:8px;padding:6px 10px;font-size:11px;line-height:1.8;pointer-events:none;box-shadow:0 1px 6px rgba(0,0,0,0.12);";
      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:10px;height:10px;border-radius:50%;background:#DC2626;display:inline-block;flex-shrink:0;"></span>
          <span>Incident (User)</span>
        </div>
        ${hasAdmin ? `<div style="display:flex;align-items:center;gap:6px;">
          <span style="width:10px;height:10px;border-radius:50%;background:#1D4ED8;display:inline-block;flex-shrink:0;"></span>
          <span>Admin / Responder</span>
        </div>` : ""}
      `;
      return div;
    };
    legend.addTo(detailMap);

    setTimeout(() => detailMap && detailMap.invalidateSize(), 120);
  } catch (e) {
    console.warn("Detail map failed to init:", e);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function toast(msg, type = "success") {
  const toastEl = document.createElement("div");
  const prefix = type === "success" ? "OK " : type === "info" ? "INFO " : "WARN ";
  toastEl.className = `toast toast-${type}`;
  toastEl.style.bottom = "20px";
  toastEl.textContent = `${prefix}${msg}`;
  document.body.appendChild(toastEl);
  setTimeout(() => {
    toastEl.classList.add("out");
    setTimeout(() => toastEl.remove(), 300);
  }, 2500);
}

function badge(label) {
  return `<span class="badge badge-${label.toLowerCase()}">${label}</span>`;
}

function setCurrentDate() {
  currentDateEl.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric"
  });
}

function formatExactTime(timestampMs) {
  if (!timestampMs) return "Just now";
  const d = new Date(timestampMs);
  const time = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const date = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${time} — ${date}`;
}

function getTimestampMs(rawValue) {
  if (!rawValue) return null;
  if (typeof rawValue.toMillis === "function") return rawValue.toMillis();
  if (typeof rawValue === "number") return rawValue;
  return null;
}

function mapLiveIncident(snapshotDoc) {
  const data = snapshotDoc.data();
  const timestampMs = getTimestampMs(data.createdAt) || data.createdAtMs || Date.now();
  return {
    id: `SOS-${snapshotDoc.id.slice(0, 5).toUpperCase()}`,
    alertDocId: snapshotDoc.id,
    name: data.name || "Resident",
    contact: data.contact || "Not provided",
    type: data.type || "SOS",
    severity: data.severity || "Critical",
    desc: data.desc || "Emergency SOS triggered from the resident mobile app.",
    status: data.status || "Pending",
    time: formatExactTime(timestampMs),
    lat: String(data.latitude || 0),
    lng: String(data.longitude || 0),
    locationLabel: data.locationLabel || null,
    locationDesc: data.locationDesc || null,
    sortTime: timestampMs
  };
}

function mergeIncidents() {
  incidents = [...liveIncidents];
}

function updateStats() {
  const pendingCount = incidents.filter((i) => i.status === "Pending").length;
  const respondingCount = incidents.filter((i) => i.status === "Responding").length;
  const resolvedCount = incidents.filter((i) => i.status === "Resolved").length;

  const stats = [
    {
      label: "SOS Today", value: incidents.length, bg: "bg-red-100",
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
    },
    {
      label: "Pending", value: pendingCount, bg: "bg-amber-100",
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`
    },
    {
      label: "Responding", value: respondingCount, bg: "bg-blue-100",
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
    },
    {
      label: "Resolved", value: resolvedCount, bg: "bg-emerald-100",
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>`
    }
  ];

  statsGrid.innerHTML = stats.map((stat) => `
    <div class="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-[13px] text-slate-500 font-semibold tracking-wide uppercase">${stat.label}</p>
          <p class="text-4xl font-black text-slate-900 mt-2.5 tracking-tight">${stat.value}</p>
        </div>
        <div class="w-12 h-12 rounded-[14px] ${stat.bg} flex items-center justify-center">${stat.icon}</div>
      </div>
    </div>
  `).join("");

  aiSummary.textContent = incidents.length === 0
    ? "No SOS alerts have been received yet. The dashboard will update automatically when users trigger an emergency."
    : `${incidents.length} live SOS alert${incidents.length === 1 ? "" : "s"} from Firebase. ${pendingCount} pending, ${respondingCount} being responded to, ${resolvedCount} resolved. ${pendingCount > 0 ? "Prioritize pending cases immediately." : "All cases are currently being handled."}`;
}

function getFilteredIncidents() {
  const filter = filterStatus.value;
  return filter ? incidents.filter((i) => i.status === filter) : incidents;
}

function renderRows() {
  const filteredIncidents = getFilteredIncidents();

  if (filteredIncidents.length === 0) {
    rowsContainer.innerHTML = `
      <div class="p-10 text-center">
        <svg class="mx-auto mb-3 text-slate-300" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        <p class="text-slate-400 text-sm font-medium">No SOS alerts received yet.</p>
        <p class="text-slate-300 text-xs mt-1">Waiting for live data from Firebase...</p>
      </div>`;
    return;
  }

  rowsContainer.innerHTML = filteredIncidents.map((incident) => {
    const realIndex = incidents.findIndex((item) => item.id === incident.id);
    const statusColor = statusColors[incident.status] || statusColors.Pending;
    const isLive = !!incident.alertDocId;
    return `
      <div class="incident-row" data-index="${realIndex}">
        <div class="flex items-center gap-3.5">
          <div class="w-[38px] h-[38px] rounded-[10px] ${statusColor.bg} ${statusColor.text} flex items-center justify-center shrink-0">
            ${typeIcons[incident.type] || typeIcons.SOS}
          </div>
          <div>
            <p class="text-[13px] font-semibold text-slate-900">${incident.name}${isLive ? ' <span class="text-[10px] text-red-500 font-bold">● LIVE</span>' : ''}</p>
            <p class="text-[11px] text-slate-400 mt-0.5">${incident.type} · ${incident.locationLabel || 'No location'}</p>
            <p class="text-[10px] text-slate-400">${incident.time}</p>
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          ${badge(incident.status)}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>
    `;
  }).join("");
}

function showDetail(index) {
  const incident = incidents[index];
  if (!incident) return;

  openDetailIncidentId = incident.id;
  incidentList.classList.add("hidden");
  incidentDetail.classList.remove("hidden");

  const lat = Number(incident.lat);
  const lng = Number(incident.lng);
  const hasCoords = lat !== 0 && lng !== 0;

  incidentDetail.innerHTML = `
    <div class="animate-fade">
      <div class="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
        <div class="flex items-center gap-2.5">
          <button id="backToListBtn" class="w-[30px] h-[30px] rounded-lg bg-[#F8FAFC] flex items-center justify-center border-none cursor-pointer btn-press">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h3 class="text-base font-bold">Incident ${incident.id}</h3>
        </div>
        ${badge(incident.status)}
      </div>

      <div class="p-5">
        <div class="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p class="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Reporter</p>
            <p class="text-sm font-semibold text-slate-900 mt-1">${incident.name}</p>
          </div>
          <div>
            <p class="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Contact</p>
            <p class="text-sm font-semibold text-slate-900 mt-1">${incident.contact}</p>
          </div>
          <div>
            <p class="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Emergency Type</p>
            <p class="text-sm font-semibold text-slate-900 mt-1">${incident.type}</p>
          </div>
          <div>
            <p class="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Severity</p>
            <div class="mt-1">${badge(incident.severity)}</div>
          </div>
          <div>
            <p class="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Timestamp</p>
            <p class="text-sm font-semibold text-slate-900 mt-1">${incident.time}</p>
          </div>
          <div>
            <p class="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Location</p>
            <p class="text-sm font-semibold text-slate-900 mt-1">${incident.locationLabel || (hasCoords ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "No GPS data")}</p>
            ${incident.locationDesc ? `<p class="text-[11px] text-blue-600 mt-0.5 italic">📍 ${incident.locationDesc}</p>` : ""}
            ${incident.locationLabel && hasCoords ? `<p class="text-[10px] text-slate-400 mt-0.5">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>` : ""}
          </div>
        </div>

        <div class="mb-4">
          <p class="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Description</p>
          <p class="text-[13px] text-slate-900 leading-relaxed mt-1.5">${incident.desc}</p>
        </div>

        <!-- Real Leaflet map showing actual GPS location -->
        <div id="incidentDetailMap" style="height:240px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;position:relative;background:#f1f5f9;"></div>
        ${!hasCoords ? `<p class="text-[11px] text-slate-400 text-center mt-2">No GPS coordinates available for this incident.</p>` : ""}

        <div class="flex gap-2.5 mt-4">
          <button
            id="respondingBtn"
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 border-none cursor-pointer btn-press font-sans ${incident.status === "Responding" || incident.status === "Resolved" ? "opacity-50 cursor-not-allowed" : ""}"
            ${incident.status !== "Pending" ? "disabled" : ""}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Responding
          </button>
          <button
            id="resolvedBtn"
            class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 border-none cursor-pointer btn-press font-sans ${incident.status === "Resolved" ? "opacity-50 cursor-not-allowed" : ""}"
            ${incident.status === "Resolved" ? "disabled" : ""}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>
            Resolved
          </button>
          <button id="contactBtn" class="bg-white border border-slate-200 shadow-sm text-slate-900 font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer btn-press hover:bg-slate-50 font-sans">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            Contact
          </button>
          ${hasCoords ? `
          <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener"
            class="bg-white border border-slate-200 shadow-sm text-slate-900 font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer btn-press hover:bg-slate-50 font-sans no-underline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            Google Maps
          </a>` : ""}
        </div>
      </div>
    </div>
  `;

  // Initialize real Leaflet map in the detail view
  if (hasCoords) {
    setTimeout(() => initDetailMap(lat, lng, incident.locationLabel), 50);
  }

  document.getElementById("backToListBtn").addEventListener("click", closeDetail);

  const respondingBtn = document.getElementById("respondingBtn");
  const resolvedBtn = document.getElementById("resolvedBtn");
  const contactBtn = document.getElementById("contactBtn");

  if (respondingBtn && !respondingBtn.disabled) {
    respondingBtn.addEventListener("click", () => setStatus(index, "Responding"));
  }
  if (resolvedBtn && !resolvedBtn.disabled) {
    resolvedBtn.addEventListener("click", () => setStatus(index, "Resolved"));
  }
  if (contactBtn) {
    contactBtn.addEventListener("click", () => openContact(index));
  }
}

function closeDetail() {
  destroyDetailMap();
  openDetailIncidentId = null;
  incidentDetail.classList.add("hidden");
  incidentDetail.innerHTML = "";
  incidentList.classList.remove("hidden");
}

async function setStatus(index, status) {
  const incident = incidents[index];
  if (!incident) return;

  if (!incident.alertDocId) {
    toast("This incident has no Firebase record and cannot be updated.", "error");
    return;
  }

  try {
    await updateDoc(doc(db, "sosAlerts", incident.alertDocId), {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    const msg = error?.code === "permission-denied"
      ? "Permission denied — run: firebase deploy --only firestore:rules"
      : "Failed to update status. Check your connection.";
    toast(msg, "error");
    return;
  }

  // Immediately mirror the new status in local state so the UI
  // stays consistent even before the next onSnapshot arrives.
  const docId = incident.alertDocId;
  const li = liveIncidents.findIndex((i) => i.alertDocId === docId);
  if (li !== -1) liveIncidents[li].status = status;
  incidents = [...liveIncidents];

  toast(`${incident.id} marked as ${status}`);
  updateStats();
  renderRows();
  // Use syncOpenDetail (ID-based) instead of index-based showDetail
  // so it stays correct after any re-sort triggered by the onSnapshot.
  syncOpenDetail();
}

function openContact(index) {
  const incident = incidents[index];
  contactInfo.textContent = `${incident.name} - ${incident.contact}`;
  contactModal.classList.remove("hidden");
}

function closeContact() {
  contactModal.classList.add("hidden");
}

function doContact(method) {
  closeContact();
  toast(`Contacting reporter via ${method}`, "info");
}

function syncOpenDetail() {
  if (!openDetailIncidentId) return;
  const nextIndex = incidents.findIndex((i) => i.id === openDetailIncidentId);
  if (nextIndex === -1) { closeDetail(); return; }
  showDetail(nextIndex);
}

// ── Event listeners ────────────────────────────────────────────────────────────
filterStatus.addEventListener("change", renderRows);

rowsContainer.addEventListener("click", (event) => {
  const row = event.target.closest(".incident-row");
  if (!row) return;
  showDetail(Number(row.dataset.index));
});

contactOverlay.addEventListener("click", (event) => {
  if (event.target === contactOverlay) closeContact();
});

contactDialog.addEventListener("click", (event) => event.stopPropagation());

callBtn.addEventListener("click", () => doContact("Call"));
smsBtn.addEventListener("click", () => doContact("SMS"));
cancelContactBtn.addEventListener("click", closeContact);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
setCurrentDate();
mergeIncidents();
updateStats();
renderRows();

// Initialize maps after full page load to guarantee container dimensions are computed
window.addEventListener("load", () => {
  initDashboardMap();
  renderDashboardMapMarkers();
  startAdminLocationTracking();
  fetchLiveSignal();
});

// ── Live PAGASA Wind Signal for Antique ──────────────────────────────────────
async function fetchLiveSignal() {
  const LAT = 11.3683;
  const LNG = 122.0643;
  const badge = document.getElementById('signalBadge');
  const text = document.getElementById('signalText');
  if (!badge || !text) return;

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current_weather=true&windspeed_unit=kmh`
    );
    const data = await res.json();
    const wind = data.current_weather;
    const gustKmh = wind.windspeed || 0;
    const wmoCode = wind.weathercode || 0;

    // PAGASA wind signal thresholds
    let signal, bgClass, dotClass, textClass, dotPing;
    if (gustKmh >= 185) {
      signal = { num: 5, label: 'SIGNAL #5 ACTIVE' };
    } else if (gustKmh >= 118) {
      signal = { num: 4, label: 'SIGNAL #4 ACTIVE' };
    } else if (gustKmh >= 89) {
      signal = { num: 3, label: 'SIGNAL #3 ACTIVE' };
    } else if (gustKmh >= 62) {
      signal = { num: 2, label: 'SIGNAL #2 ACTIVE' };
    } else if (gustKmh >= 39) {
      signal = { num: 1, label: 'SIGNAL #1 ACTIVE' };
    } else {
      signal = { num: 0, label: '' };
    }

    if (signal.num >= 3) {
      bgClass = 'bg-red-100'; dotClass = 'bg-red-600'; textClass = 'text-red-900';
      dotPing = '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>';
    } else if (signal.num === 2) {
      bgClass = 'bg-orange-100'; dotClass = 'bg-orange-500'; textClass = 'text-orange-900';
      dotPing = '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>';
    } else if (signal.num === 1) {
      bgClass = 'bg-amber-100'; dotClass = 'bg-amber-500'; textClass = 'text-amber-900';
      dotPing = '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>';
    } else {
      // No signal — show weather description
      var desc = 'Fair Weather';
      if (wmoCode === 0) desc = 'Clear Sky';
      else if (wmoCode <= 3) desc = 'Partly Cloudy';
      else if (wmoCode <= 48) desc = 'Foggy';
      else if (wmoCode <= 57) desc = 'Light Drizzle';
      else if (wmoCode <= 67) desc = 'Rainy';
      else if (wmoCode <= 82) desc = 'Rain Showers';
      else if (wmoCode <= 94) desc = 'Heavy Showers';
      else desc = 'Thunderstorm';

      bgClass = 'bg-emerald-50'; dotClass = 'bg-emerald-500'; textClass = 'text-emerald-800';
      dotPing = '';
      signal.label = desc + ' · No Signal';
    }

    badge.className = `flex items-center gap-1.5 ${bgClass} px-3.5 py-2 rounded-[10px] transition-all`;
    badge.querySelector('.relative.flex').innerHTML = (dotPing ? dotPing : '') +
      `<span class="relative inline-flex rounded-full h-2 w-2 ${dotClass}"></span>`;
    text.className = `text-xs font-semibold ${textClass}`;
    text.textContent = signal.label;

  } catch (e) {
    console.error('Signal fetch error:', e);
    text.textContent = 'Weather unavailable';
  }

  // Refresh every 10 minutes
  setTimeout(fetchLiveSignal, 10 * 60 * 1000);
}

// ── Firebase real-time listener ────────────────────────────────────────────────
let _prevSosCount = -1;
onSnapshot(collection(db, "sosAlerts"), (snapshot) => {
  const prevCount = _prevSosCount;
  const pendingNow = snapshot.docs.filter(d => (d.data().status || 'Pending') === 'Pending').length;

  liveIncidents = snapshot.docs
    .map(mapLiveIncident)
    .sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));

  mergeIncidents();
  updateStats();
  renderRows();
  renderDashboardMapMarkers();
  syncOpenDetail();

  // Play alarm if there are new pending SOS alerts
  if (prevCount >= 0 && pendingNow > prevCount && window.playSosAlarm) {
    window.playSosAlarm(5000);
  }
  _prevSosCount = pendingNow;
}, (err) => {
  console.error("Firestore listener error:", err);
  toast("Could not connect to Firebase. Check Firestore rules.", "error");
});
