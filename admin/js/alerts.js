import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  updateDoc,
  doc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from '../../firebase-config.js';

async function callPhilSMS(recipient, message) {
  const response = await fetch('/api/send-sms', {
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

// Province of Antique default coordinates for weather alerts
const ANTIQUE_LAT = 11.3683;
const ANTIQUE_LNG = 122.0643;

// ── State ────────────────────────────────────────────────────────────────────
let alerts            = [];
let weatherAlerts     = [];
let firestoreAlerts   = [];
let currentFilter     = 'all';
let selectedAlertId   = null;
let selectedAlertIndex = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const alertsStatsGrid    = document.getElementById('alertsStatsGrid');
const alertsList         = document.getElementById('alertsList');
const alertsAiSummary    = document.getElementById('alertsAiSummary');
const currentDate        = document.getElementById('currentDate');
const filterButtons      = document.querySelectorAll('.alert-filter-btn');
const activeAlertsCount  = document.getElementById('activeAlertsCount');

const selectedAlertState    = document.getElementById('selectedAlertState');
const emptyAlertState       = document.getElementById('emptyAlertState');
const selectedAlertTitle    = document.getElementById('selectedAlertTitle');
const selectedAlertIssued   = document.getElementById('selectedAlertIssued');
const selectedAlertSeverity = document.getElementById('selectedAlertSeverity');
const selectedAlertCategory = document.getElementById('selectedAlertCategory');
const selectedAlertStatus   = document.getElementById('selectedAlertStatus');
const selectedAlertArea     = document.getElementById('selectedAlertArea');
const selectedAlertUrgency  = document.getElementById('selectedAlertUrgency');
const selectedAlertSummary  = document.getElementById('selectedAlertSummary');
const selectedAlertAction   = document.getElementById('selectedAlertAction');

// ── Severity config ───────────────────────────────────────────────────────────
const severityConfig = {
  Critical: { bg: 'bg-red-50',    border: 'border-red-200',    iconWrap: 'bg-red-100',    iconStroke: '#DC2626', title: 'text-red-800',    text: 'text-red-600',    badge: 'badge-critical' },
  High:     { bg: 'bg-orange-50', border: 'border-orange-200', iconWrap: 'bg-orange-100', iconStroke: '#EA580C', title: 'text-orange-800', text: 'text-orange-600', badge: 'badge-high'     },
  Medium:   { bg: 'bg-amber-50',  border: 'border-amber-200',  iconWrap: 'bg-amber-100',  iconStroke: '#F59E0B', title: 'text-amber-800',  text: 'text-amber-600',  badge: 'badge-medium'   },
  Low:      { bg: 'bg-blue-50',   border: 'border-blue-200',   iconWrap: 'bg-blue-100',   iconStroke: '#2563EB', title: 'text-blue-800',   text: 'text-blue-600',   badge: 'badge-low'      }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function setCurrentDate() {
  currentDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function badge(label) {
  const normalized = label.toLowerCase();
  return `<span class="badge badge-${normalized}">${label}</span>`;
}

function timeAgo(ms) {
  const diff = Math.round((Date.now() - ms) / 60000);
  if (diff < 1)  return 'Just now';
  if (diff < 60) return `${diff} min ago`;
  const hrs = Math.round(diff / 60);
  return `${hrs}h ago`;
}

function getAlertIcon(type, strokeColor) {
  const icons = {
    wind: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>`,
    flood: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c3.5 0 6-2.5 6-6.2C18 11 12 3 12 3S6 11 6 14.8C6 18.5 8.5 21 12 21z"/></svg>`,
    rain: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>`,
    landslide: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18M6 20l4-8 3 4 2-3 3 7"/></svg>`,
    sos: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };
  return icons[type] || icons.rain;
}

// ── Convert Firestore SOS doc → alert object ──────────────────────────────────
function sosToAlert(docSnap) {
  const d   = docSnap.data();
  const msTs = d.createdAtMs || (d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now());
  const ago  = timeAgo(msTs);

  const typeIconMap = { Fire: 'wind', Flood: 'flood', Medical: 'sos', Earthquake: 'landslide', Typhoon: 'wind', SOS: 'sos', Other: 'rain' };
  const typeTitle   = d.type === 'SOS'
    ? `Emergency SOS — ${d.name || 'Resident'}`
    : `${d.type || 'Emergency'} Report — ${d.name || 'Resident'}`;

  const urgencyMap = { Critical: 'Immediate', High: 'High', Medium: 'Moderate', Low: 'Low' };

  return {
    id:          docSnap.id.slice(0, 8).toUpperCase(),
    firestoreId: docSnap.id,
    title:       typeTitle,
    category:    d.type || 'Emergency',
    severity:    d.severity || 'High',
    status:      d.status   || 'Pending',
    urgency:     urgencyMap[d.severity] || 'High',
    area:        d.locationLabel || 'Unknown Location',
    issued:      `Reported ${ago}`,
    contact:     d.contact || '',
    reporterName: d.name   || 'Resident',
    summary:     d.desc || `Emergency alert reported by ${d.name || 'a resident'}.`,
    action:      d.status === 'Pending'    ? 'Dispatch nearest response team and confirm situation on the ground immediately.' :
                 d.status === 'Responding' ? 'Response is in progress. Continue monitoring and provide logistical support.' :
                 'Incident resolved. Monitor for secondary impacts and document findings.',
    icon:        typeIconMap[d.type] || 'sos'
  };
}

// ── Generate weather-based alerts from Open-Meteo data ───────────────────────
async function fetchWeatherAlerts() {
  try {
    const params = [
      `latitude=${ANTIQUE_LAT}`, `longitude=${ANTIQUE_LNG}`,
      'current=wind_gusts_10m,precipitation,weather_code',
      'timezone=Asia/Manila', 'forecast_days=1'
    ].join('&');
    const res  = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const data = await res.json();
    const c    = data.current;
    const gust = c.wind_gusts_10m;
    const mm   = c.precipitation;
    const now  = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const generated = [];

    if (gust >= 30) {
      const signalNum = gust >= 185 ? 4 : gust >= 100 ? 3 : gust >= 60 ? 2 : 1;
      generated.push({
        id:       `WTH-WND`,
        title:    `PAGASA Wind Signal #${signalNum} — Province of Antique`,
        category: 'Typhoon',
        severity: gust >= 100 ? 'Critical' : gust >= 60 ? 'High' : 'Medium',
        status:   'Active',
        urgency:  gust >= 60 ? 'Immediate' : 'High',
        area:     'Province of Antique',
        issued:   `Live weather — ${now}`,
        summary:  `Wind gusts of ${Math.round(gust)} km/h detected over Antique Province. Signal #${signalNum} conditions affect field operations, exposed structures, and coastal communities.`,
        action:   gust >= 100 ? 'Activate full evacuation. Suspend all non-essential field operations immediately.' :
                  gust >= 60  ? 'Pre-position rescue assets, alert coastal barangays, and prepare evacuation centers.' :
                  'Alert field teams to elevated wind conditions and monitor updates.',
        icon:     'wind'
      });
    }

    if (mm >= 5) {
      generated.push({
        id:       `WTH-RAIN`,
        title:    `Rainfall Advisory — Province of Antique`,
        category: 'Rainfall',
        severity: mm >= 50 ? 'Critical' : mm >= 20 ? 'High' : 'Medium',
        status:   'Active',
        urgency:  mm >= 20 ? 'Immediate' : 'Moderate',
        area:     'Province of Antique',
        issued:   `Live weather — ${now}`,
        summary:  `${mm.toFixed(1)} mm of precipitation recorded. ${mm >= 20 ? 'Heavy rainfall' : 'Moderate rainfall'} increases flood risk in drainage-sensitive and low-lying zones.`,
        action:   mm >= 20 ? 'Alert flood-prone barangays, inspect drainage hotspots, and pre-position flood response teams.' :
                  'Monitor drainage conditions and prepare standby response teams.',
        icon:     'rain'
      });
    }

    weatherAlerts = generated;
  } catch (_) {
    weatherAlerts = [];
  }
  refreshAlerts();
}

// ── Merge and re-render ───────────────────────────────────────────────────────
function refreshAlerts() {
  const prevId = selectedAlertId;
  alerts = [...weatherAlerts, ...firestoreAlerts];

  const newIdx = prevId ? alerts.findIndex(a => a.id === prevId || a.firestoreId === prevId) : -1;
  selectedAlertIndex = newIdx >= 0 ? newIdx : null;
  if (newIdx < 0) selectedAlertId = null;

  if (activeAlertsCount) {
    const active = alerts.filter(a => a.status === 'Active' || a.status === 'Pending' || a.status === 'Responding').length;
    activeAlertsCount.textContent = `${active} ACTIVE ALERT${active !== 1 ? 'S' : ''}`;
  }

  renderStats();
  renderAlertsList();
  renderSelectedAlert();
  renderAiSummary();
  updateReadinessMetrics();
}

// ── Render functions ──────────────────────────────────────────────────────────
function renderStats() {
  const critical = alerts.filter(a => a.severity === 'Critical').length;
  const high     = alerts.filter(a => a.severity === 'High').length;
  const active   = alerts.filter(a => a.status === 'Active' || a.status === 'Pending' || a.status === 'Responding').length;

  const stats = [
    { label: 'Total Alerts', value: alerts.length, bg: 'bg-red-100',    stroke: '#DC2626', d: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    { label: 'Critical',     value: critical,       bg: 'bg-red-100',    stroke: '#DC2626', d: 'M12 2v8m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z' },
    { label: 'High',         value: high,           bg: 'bg-orange-100', stroke: '#EA580C', d: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'Active',       value: active,         bg: 'bg-blue-100',   stroke: '#2563EB', d: 'M12 2v20M2 12h20' }
  ];

  alertsStatsGrid.innerHTML = stats.map(s => `
    <div class="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-[13px] text-slate-500 font-semibold tracking-wide uppercase">${s.label}</p>
          <p class="text-4xl font-black text-slate-900 mt-2.5 tracking-tight">${s.value}</p>
        </div>
        <div class="w-12 h-12 rounded-[14px] ${s.bg} flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${s.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${s.d}"/></svg>
        </div>
      </div>
    </div>
  `).join('');
}

function getFilteredAlerts() {
  if (currentFilter === 'all') return alerts;
  return alerts.filter(a => a.severity === currentFilter);
}

function renderAlertsList() {
  const filtered = getFilteredAlerts();

  if (alerts.length === 0) {
    alertsList.innerHTML = `
      <div class="p-10 text-center text-slate-400">
        <svg class="mx-auto mb-3 opacity-30" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <p class="text-sm font-medium">No active alerts</p>
        <p class="text-xs mt-1">Weather conditions and incident reports are within normal limits.</p>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    alertsList.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">No alerts match this filter.</div>';
    return;
  }

  alertsList.innerHTML = filtered.map(alert => {
    const realIndex = alerts.indexOf(alert);
    const cfg       = severityConfig[alert.severity] || severityConfig.Low;
    const isActive  = realIndex === selectedAlertIndex;

    return `
      <div class="alert-card ${isActive ? 'active' : ''}" data-index="${realIndex}">
        <div class="rounded-2xl border ${cfg.border} ${cfg.bg} p-4">
          <div class="flex items-start gap-3">
            <div class="alert-icon-wrap ${cfg.iconWrap}">
              ${getAlertIcon(alert.icon, cfg.iconStroke)}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-bold ${cfg.title}">${alert.title}</p>
                  <p class="text-xs ${cfg.text} mt-1">${alert.issued}</p>
                </div>
                ${badge(alert.severity)}
              </div>
              <div class="mt-3 flex items-center gap-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">
                <span>${alert.category}</span>
                <span>•</span>
                <span>${alert.area}</span>
              </div>
              <p class="text-xs text-slate-600 mt-3 leading-relaxed alert-summary-line">${alert.summary}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSelectedAlert() {
  if (selectedAlertIndex === null) {
    emptyAlertState.classList.remove('hidden');
    selectedAlertState.classList.add('hidden');
    return;
  }

  const alert = alerts[selectedAlertIndex];
  if (!alert) {
    selectedAlertIndex = null;
    selectedAlertId    = null;
    emptyAlertState.classList.remove('hidden');
    selectedAlertState.classList.add('hidden');
    return;
  }

  emptyAlertState.classList.add('hidden');
  selectedAlertState.classList.remove('hidden');

  selectedAlertTitle.textContent    = alert.title;
  selectedAlertIssued.textContent   = `${alert.issued} • ${alert.id}`;
  selectedAlertSeverity.innerHTML   = badge(alert.severity);
  selectedAlertCategory.textContent = alert.category;
  selectedAlertStatus.textContent   = alert.status;
  selectedAlertArea.textContent     = alert.area;
  selectedAlertUrgency.textContent  = alert.urgency;
  selectedAlertSummary.textContent  = alert.summary;
  selectedAlertAction.textContent   = alert.action;

  // Action buttons — only for Firestore SOS alerts
  const actionBtns = document.getElementById('alertActionBtns');
  if (actionBtns) {
    if (alert.firestoreId && alert.status === 'Pending') {
      actionBtns.innerHTML = `
        <button class="btn-alert-action w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          data-fid="${alert.firestoreId}" data-action="respond"
          data-contact="${alert.contact}" data-type="${alert.category}"
          data-area="${alert.area}" data-name="${alert.reporterName}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
          Respond &amp; Notify via SMS
        </button>`;
    } else if (alert.firestoreId && alert.status === 'Responding') {
      actionBtns.innerHTML = `
        <button class="btn-alert-action w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          data-fid="${alert.firestoreId}" data-action="resolve">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
          Mark as Resolved
        </button>`;
    } else {
      actionBtns.innerHTML = '';
    }
  }
}

function renderAiSummary() {
  const critical   = alerts.filter(a => a.severity === 'Critical').length;
  const pending    = alerts.filter(a => a.status   === 'Pending').length;
  const responding = alerts.filter(a => a.status   === 'Responding').length;
  const weather    = weatherAlerts.length;
  const incidents  = firestoreAlerts.length;

  if (alerts.length === 0) {
    alertsAiSummary.textContent = 'No active alerts at this time. Weather conditions and incoming SOS reports are within normal parameters.';
    return;
  }

  let text = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''} active: `;
  if (weather > 0)   text += `${weather} live weather advisory${weather !== 1 ? 'ies' : ''} for Antique Province, `;
  if (incidents > 0) text += `${incidents} field incident${incidents !== 1 ? 's' : ''} from the SOS dashboard. `;
  if (critical > 0)  text += `${critical} critical level — priority response required. `;
  if (pending > 0)   text += `${pending} unacknowledged alert${pending !== 1 ? 's' : ''} awaiting dispatch. `;
  if (responding > 0) text += `${responding} incident${responding !== 1 ? 's' : ''} currently being responded to. `;
  text += 'Field teams should stay aligned with barangay communications and active hazard zones.';

  alertsAiSummary.textContent = text;
}

function updateReadinessMetrics() {
  const total      = firestoreAlerts.length;
  const responding = firestoreAlerts.filter(a => a.status === 'Responding').length;
  const resolved   = firestoreAlerts.filter(a => a.status === 'Resolved').length;
  const medical    = firestoreAlerts.filter(a => a.category === 'Medical').length;
  const critical   = alerts.filter(a => a.severity === 'Critical').length;

  // Rescue engagement: % of incidents being actively handled
  const rescueTeams = total > 0 ? Math.min(95, Math.round(((responding + resolved) / total) * 100)) : 90;
  // Medical readiness: inversely proportional to unhandled medical incidents
  const medUnits    = total > 0 ? Math.max(40, Math.min(95, Math.round(100 - (medical / Math.max(1, total)) * 60))) : 88;
  // Evacuation: drops with critical alerts
  const evacReady   = Math.max(30, Math.round(100 - critical * 8));

  const rescueBar = document.getElementById('rescueTeamsBar');
  const rescueVal = document.getElementById('rescueTeamsVal');
  const medBar    = document.getElementById('medicalUnitsBar');
  const medVal    = document.getElementById('medicalUnitsVal');
  const evacBar   = document.getElementById('evacuationReadinessBar');
  const evacVal   = document.getElementById('evacuationReadinessVal');

  const color = v => v >= 70 ? 'bg-blue-600' : v >= 40 ? 'bg-amber-500' : 'bg-red-500';
  if (rescueBar) { rescueBar.style.width = `${rescueTeams}%`; rescueBar.className = `h-full rounded-full ${color(rescueTeams)}`; }
  if (rescueVal) rescueVal.textContent = `${rescueTeams}%`;
  if (medBar)    { medBar.style.width    = `${medUnits}%`;    medBar.className    = `h-full rounded-full ${color(medUnits)}`; }
  if (medVal)    medVal.textContent    = `${medUnits}%`;
  if (evacBar)   { evacBar.style.width   = `${evacReady}%`;   evacBar.className   = `h-full rounded-full ${color(evacReady)}`; }
  if (evacVal)   evacVal.textContent   = `${evacReady}%`;
}

// ── Selection + filter ────────────────────────────────────────────────────────
function selectAlert(index) {
  selectedAlertIndex = index;
  selectedAlertId    = alerts[index]?.firestoreId || alerts[index]?.id || null;
  renderAlertsList();
  renderSelectedAlert();
}

function setFilter(filter) {
  currentFilter = filter;
  filterButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));

  const filtered = getFilteredAlerts();
  if (selectedAlertIndex !== null && !filtered.includes(alerts[selectedAlertIndex])) {
    selectedAlertIndex = null;
    selectedAlertId    = null;
  }

  renderAlertsList();
  renderSelectedAlert();
}

document.addEventListener('click', (e) => {
  const filterBtn = e.target.closest('.alert-filter-btn');
  if (filterBtn) { setFilter(filterBtn.dataset.filter); return; }

  const actionBtn = e.target.closest('.btn-alert-action');
  if (actionBtn && !actionBtn.disabled) { respondToAlert(actionBtn); return; }

  const card = e.target.closest('.alert-card');
  if (card) {
    const idx = Number(card.dataset.index);
    if (!Number.isNaN(idx)) selectAlert(idx);
  }
});

// ── Respond / Resolve actions ─────────────────────────────────────────────────
function normalizePhone(num) {
  let n = (num || '').replace(/[\s\-().+]/g, '');
  if (n.startsWith('0') && n.length === 11) n = '63' + n.slice(1); // 09... → 639...
  return n; // already 639... or +63 stripped to 639...
}

async function respondToAlert(btn) {
  const { fid, action, contact, type, area, name } = btn.dataset;
  btn.disabled = true;
  btn.innerHTML = `<svg class="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"/><path d="M21 12a9 9 0 00-9-9"/></svg>${action === 'respond' ? 'Sending...' : 'Resolving...'}`;

  const newStatus = action === 'respond' ? 'Responding' : 'Resolved';

  try {
    // 1 — Update Firestore status
    await updateDoc(doc(db, 'sosAlerts', fid), {
      status:    newStatus,
      updatedAt: serverTimestamp()
    });

    // 2 — Send SMS only on "respond" and only if contact exists
    if (action === 'respond' && contact) {
      const phone = normalizePhone(contact);
      if (phone) {
        const time = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
        const message =
          `[ARPS RESPONSE CONFIRMED]\n` +
          `Hi ${name}, your ${type} Emergency SOS has been acknowledged.\n` +
          `A response team is now being dispatched to your location.\n\n` +
          `Location: ${area}\n` +
          `Response Time: ${time}\n\n` +
          `Please stay calm and remain where you are. Help is on the way.\n` +
          `- ARPS Emergency Response System`;

        await callPhilSMS(phone, message);
      }
    }

    showToast(action === 'respond' ? 'Response dispatched & SMS sent!' : 'Incident marked as resolved.', 'success');
  } catch (err) {
    showToast(`Action failed: ${err.message}`, 'error');
    btn.disabled = false;
  }
}

function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = `toast ${type === 'success' ? 'toast-success' : 'toast-error'}`;
  t.innerHTML = type === 'success'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>${msg}`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>${msg}`;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
setCurrentDate();

// 1. Subscribe to Firebase SOS alerts (real-time)
const sosQuery = query(collection(db, 'sosAlerts'), orderBy('createdAt', 'desc'), limit(50));
onSnapshot(sosQuery, (snapshot) => {
  firestoreAlerts = snapshot.docs.map(sosToAlert);
  refreshAlerts();
}, (err) => {
  console.error('Alerts snapshot error:', err);
});

// 2. Fetch live weather-based alerts once, then every 10 minutes
fetchWeatherAlerts();
setInterval(fetchWeatherAlerts, 10 * 60 * 1000);
