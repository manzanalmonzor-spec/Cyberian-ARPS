import { collection, onSnapshot, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../../firebase-config.js";

const {
  assessPlaceRisk,
  createCenterMarker,
  createResidentMarker,
  DEFAULT_LOCATION,
  estimateWalkMinutes,
  fetchHazardSignalsAround,
  fetchNearbyEvacuationPlaces,
  fitMapToPoints,
  formatDistance,
  haversineKm,
  popupContent
} = window.ResqMaps;


const statusBadgeClass = {
  Pending: "badge-pending",
  Responding: "badge-responding",
  Resolved: "badge-resolved"
};

const severityBadgeClass = {
  Critical: "badge-critical",
  High: "badge-high",
  Medium: "badge-medium",
  Low: "badge-low"
};

const markerColors = {
  Critical: "#DC2626",
  High: "#F59E0B",
  Medium: "#2563EB",
  Low: "#10B981"
};

const markerCounter = document.getElementById("markerCounter");
const mapIncidentList = document.getElementById("mapIncidentList");
const mapStatsGrid = document.getElementById("mapStatsGrid");
const mapAiSummary = document.getElementById("mapAiSummary");
const currentDate = document.getElementById("currentDate");
const filterButtons = document.querySelectorAll(".map-filter-btn");

const selectedIncidentState = document.getElementById("selectedIncidentState");
const emptySelectedState = document.getElementById("emptySelectedState");
const selectedIncidentId = document.getElementById("selectedIncidentId");
const selectedIncidentReporter = document.getElementById("selectedIncidentReporter");
const selectedIncidentBadge = document.getElementById("selectedIncidentBadge");
const selectedIncidentType = document.getElementById("selectedIncidentType");
const selectedIncidentSeverity = document.getElementById("selectedIncidentSeverity");
const selectedIncidentStatus = document.getElementById("selectedIncidentStatus");
const selectedIncidentTime = document.getElementById("selectedIncidentTime");
const selectedIncidentCoords = document.getElementById("selectedIncidentCoords");
const selectedIncidentDesc = document.getElementById("selectedIncidentDesc");
const evacuationStatus = document.getElementById("evacuationStatus");
const evacuationOptions = document.getElementById("evacuationOptions");

const state = {
  activeCenterId: null,
  centerFetchAbortController: null,
  centerLayer: null,
  centerMarkers: new Map(),
  evacuationCenters: [],
  evacuationError: null,
  evacuationLoading: false,
  hazardSignals: [],
  hazardSignalsUnavailable: false,
  currentFilter: "all",
  incidentMarkers: [],
  incidents: [],
  liveIncidents: [],
  map: null,
  rescuerMarker: null,
  rescuerLocation: null,
  rescuerWatchId: null,
  routeLayer: null,
  selectedIncidentId: null
};

function badge(label) {
  return `<span class="badge ${statusBadgeClass[label] || "badge-pending"}">${label}</span>`;
}

function severityBadge(label) {
  return `<span class="badge ${severityBadgeClass[label] || "badge-medium"}">${label}</span>`;
}

function setCurrentDate() {
  currentDate.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatExactTime(timestampMs) {
  if (!timestampMs) {
    return "Just now";
  }
  const d = new Date(timestampMs);
  const time = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const date = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${time} — ${date}`;
}

function getTimestampMs(rawValue) {
  if (!rawValue) {
    return null;
  }
  if (typeof rawValue.toMillis === "function") {
    return rawValue.toMillis();
  }
  if (typeof rawValue === "number") {
    return rawValue;
  }
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
    lat: Number(data.latitude || DEFAULT_LOCATION.lat),
    lng: Number(data.longitude || DEFAULT_LOCATION.lng),
    locationLabel: data.locationLabel || null,
    locationDesc: data.locationDesc || null,
    uid: data.uid || null,
    selfieUrl: null,
    sortTime: timestampMs
  };
}

function mergeIncidents() {
  state.incidents = [...state.liveIncidents];
}

function getFilteredIncidents() {
  if (state.currentFilter === "all") {
    return state.incidents;
  }
  return state.incidents.filter((item) => item.status === state.currentFilter);
}

function getSelectedIncident() {
  if (!state.selectedIncidentId) {
    return null;
  }
  return state.incidents.find((incident) => incident.id === state.selectedIncidentId) || null;
}

function getActiveCenter() {
  if (!state.activeCenterId) {
    return null;
  }
  return state.evacuationCenters.find((center) => center.id === state.activeCenterId) || null;
}

function createIncidentIcon(incident, active) {
  const borderColor = markerColors[incident.severity] || "#64748B";
  const size = active ? 44 : 36;

  if (incident.selfieUrl) {
    return window.L.divIcon({
      className: "resq-admin-marker-wrap",
      html: `
        <div style="
          width:${size}px; height:${size}px; border-radius:50%;
          border:3px solid ${borderColor};
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          overflow:hidden; background:#fff;
          ${active ? "ring:2px solid #fff;" : ""}
        ">
          <img src="${incident.selfieUrl}" style="width:100%; height:100%; object-fit:cover; display:block;" />
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }


  const initials = (incident.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return window.L.divIcon({
    className: "resq-admin-marker-wrap",
    html: `
      <div style="
        width:${size}px; height:${size}px; border-radius:50%;
        border:3px solid ${borderColor};
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        background:#fff; display:flex; align-items:center; justify-content:center;
        font-size:${active ? 14 : 12}px; font-weight:800; color:${borderColor};
        font-family:'Inter',sans-serif;
      ">${initials}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function ensureMap() {
  if (state.map) {
    return;
  }

  if (!window.L) {
    console.error("RESQ: Leaflet not loaded — map cannot initialize.");
    return;
  }

  try {
    state.map = window.L.map("adminLiveMap", {
      preferCanvas: true,
      zoomControl: false,
      scrollWheelZoom: true
    }).setView([14.6507, 121.0497], 13);


    window.L.control.zoom({ position: "topright" }).addTo(state.map);

    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);

    state.centerLayer = window.L.layerGroup().addTo(state.map);
    state.routeLayer = window.L.layerGroup().addTo(state.map);


    setTimeout(() => state.map && state.map.invalidateSize(), 0);
    setTimeout(() => state.map && state.map.invalidateSize(), 200);
    setTimeout(() => state.map && state.map.invalidateSize(), 500);
    setTimeout(() => state.map && state.map.invalidateSize(), 1000);
    setTimeout(() => state.map && state.map.invalidateSize(), 2000);
  } catch (err) {
    console.error("RESQ: Map initialization failed —", err.message);
    state.map = null;
  }
}

function updateRescuerMarker(lat, lng) {
  if (!state.map) {
    return;
  }

  if (state.rescuerMarker) {
    state.rescuerMarker.setLatLng([lat, lng]);
  } else {
    state.rescuerMarker = window.L.marker([lat, lng], {
      icon: window.L.divIcon({
        className: "",
        html: `<div style="width:32px;height:32px;background:#1D4ED8;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 5px rgba(29,78,216,0.28),0 5px 16px rgba(29,78,216,0.45);display:flex;align-items:center;justify-content:center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -20]
      })
    }).addTo(state.map);

    state.rescuerMarker.bindPopup(
      popupContent("You (Rescuer)", "Admin — Live GPS Location"),
      { className: "resq-popup" }
    );
  }

  state.rescuerLocation = { lat, lng };
}

function initRescuerTracking() {
  if (!navigator.geolocation) {
    console.warn("RESQ: Geolocation not available in this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      updateRescuerMarker(lat, lng);

      if (state.map && !state.selectedIncidentId) {
        state.map.setView([lat, lng], 14);
      }
    },
    (err) => console.warn("RESQ: Rescuer GPS —", err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );

  state.rescuerWatchId = navigator.geolocation.watchPosition(
    (pos) => updateRescuerMarker(pos.coords.latitude, pos.coords.longitude),
    null,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
}

function renderStats() {
  const pending = state.incidents.filter((item) => item.status === "Pending").length;
  const responding = state.incidents.filter((item) => item.status === "Responding").length;
  const resolved = state.incidents.filter((item) => item.status === "Resolved").length;

  const stats = [
    {
      label: "Total Markers",
      value: state.incidents.length,
      icon: `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21s-6-4.35-6-10a6 6 0 1112 0c0 5.65-6 10-6 10z"></path>
          <circle cx="12" cy="11" r="2.5"></circle>
        </svg>
      `,
      bg: "bg-red-100"
    },
    {
      label: "Pending",
      value: pending,
      icon: `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>
      `,
      bg: "bg-amber-100"
    },
    {
      label: "Responding",
      value: responding,
      icon: `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      `,
      bg: "bg-blue-100"
    },
    {
      label: "Resolved",
      value: resolved,
      icon: `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round">
          <path d="M5 13l4 4L19 7"></path>
        </svg>
      `,
      bg: "bg-emerald-100"
    }
  ];

  mapStatsGrid.innerHTML = stats.map((stat) => `
    <div class="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-[13px] text-slate-500 font-semibold tracking-wide uppercase">${stat.label}</p>
          <p class="text-4xl font-black text-slate-900 mt-2.5 tracking-tight">${stat.value}</p>
        </div>
        <div class="w-12 h-12 rounded-[14px] ${stat.bg} flex items-center justify-center">
          ${stat.icon}
        </div>
      </div>
    </div>
  `).join("");
}

function renderIncidentMarkers() {
  ensureMap();

  if (!state.map) {
    markerCounter.textContent = "Live Map — map loading…";
    return;
  }

  state.incidentMarkers.forEach((marker) => marker.remove());
  state.incidentMarkers = [];

  const filtered = getFilteredIncidents();

  filtered.forEach((incident) => {
    const marker = window.L.marker([incident.lat, incident.lng], {
      icon: createIncidentIcon(incident, incident.id === state.selectedIncidentId)
    });

    marker.addTo(state.map);
    marker.bindPopup(
      popupContent(
        `${incident.id} · ${incident.type}`,
        `${incident.locationLabel || `${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}`} · ${incident.status}`
      ),
      { className: "resq-popup" }
    );

    marker.on("click", () => {
      selectIncidentById(incident.id);
    });

    state.incidentMarkers.push(marker);
  });

  markerCounter.textContent = `Live Map - ${filtered.length} incident${filtered.length !== 1 ? "s" : ""}`;
}

function renderFeed() {
  const filtered = getFilteredIncidents();

  if (filtered.length === 0) {
    mapIncidentList.innerHTML = `
      <div class="p-6 text-center">
        <p class="text-sm text-slate-400 font-medium">No SOS alerts yet.</p>
        <p class="text-xs text-slate-300 mt-1">Waiting for live data from Firebase...</p>
      </div>
    `;
    return;
  }

  mapIncidentList.innerHTML = filtered.map((incident) => `
    <div class="map-feed-item ${incident.id === state.selectedIncidentId ? "active" : ""}" data-incident-id="${incident.id}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-bold text-slate-900">${incident.id}</p>
          <p class="text-xs text-slate-400 mt-1">${incident.locationLabel || incident.name}</p>
        </div>
        ${badge(incident.status)}
      </div>

      <div class="mt-3 flex items-center justify-between">
        <div>
          <p class="text-[13px] font-semibold text-slate-800">${incident.type}</p>
          <p class="text-[11px] text-slate-400 mt-1">${incident.time}</p>
        </div>
        <div>${severityBadge(incident.severity)}</div>
      </div>
    </div>
  `).join("");
}

function renderSelectedIncident() {
  const incident = getSelectedIncident();

  if (!incident) {
    emptySelectedState.classList.remove("hidden");
    selectedIncidentState.classList.add("hidden");
    return;
  }

  emptySelectedState.classList.add("hidden");
  selectedIncidentState.classList.remove("hidden");

  selectedIncidentId.textContent = incident.id;
  selectedIncidentReporter.textContent = `${incident.name} · ${incident.contact}`;
  selectedIncidentBadge.innerHTML = badge(incident.status);
  selectedIncidentType.textContent = incident.type;
  selectedIncidentSeverity.innerHTML = severityBadge(incident.severity);
  selectedIncidentStatus.textContent = incident.status;
  selectedIncidentTime.textContent = incident.time;
  selectedIncidentCoords.textContent = incident.locationLabel || `${incident.lat.toFixed(5)}, ${incident.lng.toFixed(5)}`;
  selectedIncidentDesc.textContent = incident.desc;
}

function renderEvacuationPanel() {
  const incident = getSelectedIncident();

  if (!incident) {
    evacuationStatus.textContent = "Select an incident to calculate nearby evacuation centers and route options.";
    evacuationOptions.innerHTML = "";
    return;
  }

  if (state.evacuationLoading) {
    evacuationStatus.textContent = `Loading evacuation candidates around ${incident.id}.`;
    evacuationOptions.innerHTML = "";
    return;
  }

  if (state.evacuationError && state.evacuationCenters.length === 0) {
    evacuationStatus.textContent = "Unable to load nearby evacuation places right now.";
    evacuationOptions.innerHTML = "";
    return;
  }

  if (state.evacuationCenters.length === 0) {
    evacuationStatus.textContent = `No nearby named shelters, halls, gyms, or schools were found near ${incident.id}.`;
    evacuationOptions.innerHTML = "";
    return;
  }

  const activeCenter = getActiveCenter();
  const nearestCenter = state.evacuationCenters.find((center) => center.isNearest);

  evacuationStatus.textContent = activeCenter
    ? `Showing the route from ${incident.id} to ${activeCenter.name}.`
    : `Nearest evacuation option: ${nearestCenter?.name || "Unavailable"}.`;

  evacuationOptions.innerHTML = state.evacuationCenters.map((center) => `
    <button
      type="button"
      class="w-full text-left rounded-2xl border ${center.id === state.activeCenterId ? "border-blue-500 bg-blue-50/80" : "border-slate-200 bg-slate-50/80 hover:bg-slate-100"} p-3 transition-colors"
      data-center-id="${center.id}"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-bold text-slate-900">${center.name}</p>
          <p class="text-[11px] text-slate-400 mt-1">${center.address}</p>
        </div>
        <div class="flex flex-col items-end gap-2 shrink-0">
          ${center.isNearest ? '<span class="badge badge-low">Nearest</span>' : ""}
          <span class="badge ${center.riskBadgeClass}">${center.riskBadgeLabel}</span>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-3">
        <div class="rounded-xl bg-white/80 p-2.5">
          <p class="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Distance</p>
          <p class="text-sm font-bold text-slate-900 mt-1">${center.distanceLabel}</p>
        </div>
        <div class="rounded-xl bg-white/80 p-2.5">
          <p class="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Walk</p>
          <p class="text-sm font-bold text-slate-900 mt-1">${center.walkLabel}</p>
        </div>
        <div class="rounded-xl bg-white/80 p-2.5">
          <p class="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Type</p>
          <p class="text-xs font-bold text-slate-900 mt-1">${center.badgeLabel}</p>
        </div>
      </div>
      <p class="text-[11px] text-slate-600 leading-relaxed mt-3">${center.threatSummary}</p>
    </button>
  `).join("");
}

function renderCenterMarkers() {
  if (!state.centerLayer) {
    return;
  }

  state.centerLayer.clearLayers();
  state.centerMarkers.clear();

  state.evacuationCenters.forEach((center) => {
    const marker = createCenterMarker(center, {
      fillColor: center.id === state.activeCenterId ? "#0F172A" : undefined,
      radius: center.id === state.activeCenterId ? 11 : center.isNearest ? 10 : 8
    }).addTo(state.centerLayer);

    marker.bindPopup(
      popupContent(
        center.name,
        `${center.riskLabel} · ${center.distanceLabel} away · ${center.walkLabel} walk`
      ),
      { className: "resq-popup" }
    );

    marker.on("click", () => {
      activateCenter(center.id);
    });

    state.centerMarkers.set(center.id, marker);
  });
}

function renderRouteOverlay() {
  if (!state.routeLayer) {
    return;
  }

  state.routeLayer.clearLayers();

  const incident = getSelectedIncident();
  const center = getActiveCenter();

  if (!incident || !center) {
    return;
  }

  const routeLine = window.L.polyline(
    [
      [incident.lat, incident.lng],
      [center.lat, center.lng]
    ],
    {
      color: "#2563EB",
      dashArray: "10 8",
      opacity: 0.92,
      weight: 4
    }
  );

  const originMarker = createResidentMarker(
    { lat: incident.lat, lng: incident.lng },
    { fillColor: "#DC2626" }
  ).bindPopup(
    popupContent(`${incident.id} origin`, "Selected incident location"),
    { className: "resq-popup" }
  );

  const centerMarker = createCenterMarker(center, {
    fillColor: "#0F172A",
    radius: 11
  }).bindPopup(
    popupContent(center.name, `${center.distanceLabel} away · ${center.walkLabel} walk`),
    { className: "resq-popup" }
  );

  state.routeLayer.addLayer(routeLine);
  state.routeLayer.addLayer(originMarker);
  state.routeLayer.addLayer(centerMarker);
}

function syncMapViewport() {

  if (state._skipViewportSync) return;

  const incident = getSelectedIncident();
  const center = getActiveCenter();


  if (incident && center) {
    fitMapToPoints(state.map, [incident, center], {
      maxZoom: 15,
      padding: [40, 40]
    });
    return;
  }


  if (incident) {
    return;
  }

  const filtered = getFilteredIncidents();
  if (filtered.length > 0) {
    fitMapToPoints(state.map, filtered, {
      maxZoom: 15,
      singleZoom: 15
    });
    return;
  }

  const fallbackLat = state.rescuerLocation?.lat || 14.6507;
  const fallbackLng = state.rescuerLocation?.lng || 121.0497;
  state.map.setView([fallbackLat, fallbackLng], 13);
}

function renderAiSummary() {
  const pending = state.incidents.filter((item) => item.status === "Pending").length;
  const responding = state.incidents.filter((item) => item.status === "Responding").length;
  const resolved = state.incidents.filter((item) => item.status === "Resolved").length;
  const critical = state.incidents.filter((item) => item.severity === "Critical").length;
  const activeCenter = getActiveCenter();

  mapAiSummary.textContent = state.incidents.length === 0
    ? "No SOS alerts received yet. Map will update automatically when users trigger an emergency."
    : `${state.incidents.length} live SOS alert${state.incidents.length === 1 ? "" : "s"} from Firebase. ` +
      `${pending} pending, ${responding} responding, ${resolved} resolved. ` +
      `${critical > 0 ? `${critical} critical — fast dispatch needed. ` : ""}` +
      `${activeCenter ? `Route set to ${activeCenter.name} at ${activeCenter.distanceLabel}.` : "Select an incident to load evacuation options."}`;
}

function activateCenter(centerId) {
  if (!state.evacuationCenters.some((center) => center.id === centerId)) {
    return;
  }

  state.activeCenterId = centerId;
  renderEvacuationPanel();
  renderCenterMarkers();
  renderRouteOverlay();
  renderAiSummary();
  syncMapViewport();
}

function clearEvacuationState() {
  if (state.centerFetchAbortController) {
    state.centerFetchAbortController.abort();
    state.centerFetchAbortController = null;
  }

  state.activeCenterId = null;
  state.evacuationCenters = [];
  state.evacuationError = null;
  state.evacuationLoading = false;
  state.hazardSignals = [];
  state.hazardSignalsUnavailable = false;
}

async function loadEvacuationOptionsForSelectedIncident() {
  const incident = getSelectedIncident();

  if (!incident) {
    clearEvacuationState();
    renderEvacuationPanel();
    renderCenterMarkers();
    renderRouteOverlay();
    renderAiSummary();
    syncMapViewport();
    return;
  }

  if (state.centerFetchAbortController) {
    state.centerFetchAbortController.abort();
  }

  const controller = new AbortController();
  state.centerFetchAbortController = controller;
  state.evacuationLoading = true;
  state.evacuationError = null;
  state.evacuationCenters = [];
  state.activeCenterId = null;
  renderEvacuationPanel();
  renderCenterMarkers();
  renderRouteOverlay();
  renderAiSummary();
  syncMapViewport();

  try {
    const [placesResult, hazardSignalsResult] = await Promise.allSettled([
      fetchNearbyEvacuationPlaces(
        { lat: incident.lat, lng: incident.lng },
        { force: true, signal: controller.signal }
      ),
      fetchHazardSignalsAround(
        { lat: incident.lat, lng: incident.lng },
        { force: true, signal: controller.signal }
      )
    ]);

    if (controller.signal.aborted) {
      return;
    }

    if (placesResult.status !== "fulfilled") {
      throw placesResult.reason;
    }

    state.hazardSignals = hazardSignalsResult.status === "fulfilled" ? hazardSignalsResult.value : [];
    state.hazardSignalsUnavailable = hazardSignalsResult.status !== "fulfilled";

    const centers = placesResult.value
      .map((place) => {
        const distanceKm = haversineKm({ lat: incident.lat, lng: incident.lng }, place);
        const walkMinutes = estimateWalkMinutes(distanceKm);
        const risk = assessPlaceRisk(place, state.hazardSignals, {
          unavailable: state.hazardSignalsUnavailable
        });

        return {
          ...place,
          distanceKm,
          distanceLabel: formatDistance(distanceKm),
          walkLabel: `${walkMinutes} min`,
          riskBadgeClass: risk.riskBadgeClass,
          riskBadgeLabel: risk.riskBadgeLabel,
          riskLabel: risk.riskLabel,
          threatSummary: risk.threatSummary
        };
      })
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, 5);

    const nearestId = centers[0]?.id || null;

    state.evacuationCenters = centers.map((center) => ({
      ...center,
      isNearest: center.id === nearestId
    }));
    state.activeCenterId = nearestId;
    state.evacuationLoading = false;
    state.evacuationError = null;
    state.centerFetchAbortController = null;

    renderEvacuationPanel();
    renderCenterMarkers();
    renderRouteOverlay();
    renderAiSummary();
    syncMapViewport();
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    state.centerFetchAbortController = null;
    state.evacuationLoading = false;
    state.evacuationError = error;
    state.evacuationCenters = [];
    state.activeCenterId = null;
    renderEvacuationPanel();
    renderCenterMarkers();
    renderRouteOverlay();
    renderAiSummary();
    syncMapViewport();
  }
}

function selectIncidentById(incidentId) {
  const incident = state.incidents.find((item) => item.id === incidentId);
  if (!incident) {
    return;
  }

  state.selectedIncidentId = incidentId;
  renderIncidentMarkers();
  renderFeed();
  renderSelectedIncident();


  if (state.map) {

    state.map.stop();
    state.map.setView([incident.lat, incident.lng], 17, { animate: true, duration: 0.5 });


    const marker = state.incidentMarkers.find((m) => {
      const ll = m.getLatLng();
      return Math.abs(ll.lat - incident.lat) < 0.0001 && Math.abs(ll.lng - incident.lng) < 0.0001;
    });
    if (marker) {
      setTimeout(() => marker.openPopup(), 300);
    }
  }


  state._skipViewportSync = true;
  setTimeout(() => { state._skipViewportSync = false; }, 2000);

  void loadEvacuationOptionsForSelectedIncident();
}

function setFilter(filter) {
  state.currentFilter = filter;

  filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });

  const filtered = getFilteredIncidents();
  if (
    state.selectedIncidentId &&
    !filtered.some((incident) => incident.id === state.selectedIncidentId)
  ) {
    state.selectedIncidentId = null;
    clearEvacuationState();
  }

  renderAll();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const feedItem = event.target.closest(".map-feed-item");
    if (feedItem) {
      selectIncidentById(feedItem.dataset.incidentId);
      return;
    }

    const filterBtn = event.target.closest(".map-filter-btn");
    if (filterBtn) {
      setFilter(filterBtn.dataset.filter);
      return;
    }

    const centerBtn = event.target.closest("[data-center-id]");
    if (centerBtn && centerBtn.closest("#evacuationOptions")) {
      activateCenter(centerBtn.dataset.centerId);
    }
  });
}

function renderAll() {
  renderStats();
  renderIncidentMarkers();
  renderFeed();
  renderSelectedIncident();
  renderEvacuationPanel();
  renderCenterMarkers();
  renderRouteOverlay();
  renderAiSummary();
  syncMapViewport();
}


const userSelfieByUid = new Map();
const userSelfieByName = new Map();
let usersLoadedOnce = false;

async function loadAllUserSelfies(forceRefresh) {
  if (usersLoadedOnce && !forceRefresh) return;
  try {
    const snapshot = await getDocs(collection(db, "users"));
    userSelfieByUid.clear();
    userSelfieByName.clear();
    snapshot.forEach(userDoc => {
      const data = userDoc.data();
      const selfie = data.selfie_front || data.selfie_image || null;
      if (selfie) {
        userSelfieByUid.set(userDoc.id, selfie);
        if (data.name) userSelfieByName.set(data.name.trim().toLowerCase(), selfie);
      }
    });
    usersLoadedOnce = true;
  } catch (e) {
    console.error("Failed to load user selfies:", e);
  }
}

function applySelfies() {
  let changed = false;
  state.incidents.forEach(incident => {
    if (incident.selfieUrl) return;

    let selfie = incident.uid ? userSelfieByUid.get(incident.uid) : null;
    if (!selfie && incident.name) {
      selfie = userSelfieByName.get(incident.name.trim().toLowerCase());
    }
    if (selfie) {
      incident.selfieUrl = selfie;
      changed = true;
    }
  });
  return changed;
}

async function loadSelfiesForIncidents() {
  await loadAllUserSelfies(false);
  const changed = applySelfies();


  const missing = state.incidents.some(i => !i.selfieUrl);
  if (missing && usersLoadedOnce) {
    await loadAllUserSelfies(true);
    applySelfies();
  }

  if (changed || missing) {
    renderIncidentMarkers();
  }
}

function startLiveSubscription() {
  onSnapshot(collection(db, "sosAlerts"), (snapshot) => {
    state.liveIncidents = snapshot.docs
      .map(mapLiveIncident)
      .sort((left, right) => (right.sortTime || 0) - (left.sortTime || 0));

    mergeIncidents();

    if (
      state.selectedIncidentId &&
      !state.incidents.some((incident) => incident.id === state.selectedIncidentId)
    ) {
      state.selectedIncidentId = null;
      clearEvacuationState();
    }

    renderAll();
    loadSelfiesForIncidents();
  }, () => {
    mergeIncidents();
    renderAll();
  });
}

function init() {
  setCurrentDate();
  bindEvents();
  mergeIncidents();
  renderAll();
  startLiveSubscription();


  if (document.readyState === "complete") {
    ensureMap();
    renderIncidentMarkers();
    initRescuerTracking();
  } else {
    window.addEventListener("load", () => {
      ensureMap();
      renderIncidentMarkers();
      initRescuerTracking();
    });
  }
}

init();
