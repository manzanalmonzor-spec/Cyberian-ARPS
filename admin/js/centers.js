import {
  collection,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from '../../firebase-config.js';

// ── State ─────────────────────────────────────────────────────────────────────
let centers             = [];
let currentFilter       = 'all';
let selectedCenterIndex = null;
let searchTerm          = '';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const centersStatsGrid   = document.getElementById('centersStatsGrid');
const centersTableBody   = document.getElementById('centersTableBody');
const centersAiSummary   = document.getElementById('centersAiSummary');
const currentDate        = document.getElementById('currentDate');
const headerStatusBadge  = document.getElementById('headerStatusBadge');
const filterButtons      = document.querySelectorAll('.center-filter-btn');

const selectedCenterState    = document.getElementById('selectedCenterState');
const emptyCenterState       = document.getElementById('emptyCenterState');
const selectedCenterName     = document.getElementById('selectedCenterName');
const selectedCenterAddress  = document.getElementById('selectedCenterAddress');
const selectedCenterBadge    = document.getElementById('selectedCenterBadge');
const selectedCenterBar      = document.getElementById('selectedCenterBar');
const selectedCenterPercent  = document.getElementById('selectedCenterPercent');
const selectedCenterCapacity = document.getElementById('selectedCenterCapacity');
const selectedCenterOccupants = document.getElementById('selectedCenterOccupants');
const selectedCenterSlots    = document.getElementById('selectedCenterSlots');
const selectedCenterStatus   = document.getElementById('selectedCenterStatus');
const selectedCenterFacilities = document.getElementById('selectedCenterFacilities');
const selectedCenterAction   = document.getElementById('selectedCenterAction');

// ── Status helpers ─────────────────────────────────────────────────────────────
function getOccupancyPercent(center) {
  if (!center.capacity) return 0;
  return Math.min(100, Math.round((center.occupants / center.capacity) * 100));
}

function getCenterStatus(center) {
  const pct = getOccupancyPercent(center);
  if (pct >= 80) return 'Near Full';
  if (pct >= 50) return 'Moderate';
  return 'Available';
}

function getStatusColors(status) {
  if (status === 'Near Full') return { fill: 'bg-red-500',     badge: 'badge-critical' };
  if (status === 'Moderate')  return { fill: 'bg-amber-500',   badge: 'badge-medium'   };
  return                             { fill: 'bg-emerald-500', badge: 'badge-low'      };
}

function badge(label, className) {
  return `<span class="badge ${className}">${label}</span>`;
}

function setCurrentDate() {
  currentDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

// ── Readiness snapshot bars (derived from live data) ──────────────────────────
function updateReadinessSnapshot() {
  const total         = centers.length;
  const totalCapacity = centers.reduce((s, c) => s + (c.capacity  || 0), 0);
  const totalOccupants = centers.reduce((s, c) => s + (c.occupants || 0), 0);

  // Available beds as % of total capacity
  const bedsPercent = total > 0 && totalCapacity > 0
    ? Math.round(((totalCapacity - totalOccupants) / totalCapacity) * 100)
    : 0;

  // Centers that have food supplies
  const foodCount = centers.filter(c =>
    Array.isArray(c.facilities) && c.facilities.some(f => /food/i.test(f))
  ).length;
  const foodPercent = total > 0 ? Math.round((foodCount / total) * 100) : 0;

  // Centers that have medical support
  const medCount = centers.filter(c =>
    Array.isArray(c.facilities) && c.facilities.some(f => /medical/i.test(f))
  ).length;
  const medPercent = total > 0 ? Math.round((medCount / total) * 100) : 0;

  const color = v => v >= 70 ? 'bg-blue-600' : v >= 40 ? 'bg-emerald-600' : 'bg-amber-500';

  const bedsBar = document.getElementById('bedsPreparedBar');
  const bedsVal = document.getElementById('bedsPreparedVal');
  const foodBar = document.getElementById('foodPacksBar');
  const foodVal = document.getElementById('foodPacksVal');
  const medBar  = document.getElementById('medicalSupportBar');
  const medVal  = document.getElementById('medicalSupportVal');

  if (bedsBar) { bedsBar.style.width = `${bedsPercent}%`; bedsBar.className = `h-full rounded-full ${color(bedsPercent)}`; }
  if (bedsVal) bedsVal.textContent = `${bedsPercent}%`;
  if (foodBar) { foodBar.style.width = `${foodPercent}%`; foodBar.className = `h-full rounded-full ${color(foodPercent)}`; }
  if (foodVal) foodVal.textContent = `${foodPercent}%`;
  if (medBar)  { medBar.style.width  = `${medPercent}%`;  medBar.className  = `h-full rounded-full ${color(medPercent)}`; }
  if (medVal)  medVal.textContent = `${medPercent}%`;
}

// ── Render functions ───────────────────────────────────────────────────────────
function renderStats() {
  const nearFull  = centers.filter(c => getCenterStatus(c) === 'Near Full').length;
  const moderate  = centers.filter(c => getCenterStatus(c) === 'Moderate').length;
  const totalCap  = centers.reduce((s, c) => s + (c.capacity  || 0), 0);
  const totalOcc  = centers.reduce((s, c) => s + (c.occupants || 0), 0);
  const overallPct = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;

  const stats = [
    { label: 'Total Centers', value: centers.length, bg: 'bg-blue-100',    stroke: '#2563EB', d: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01' },
    { label: 'Near Full',     value: nearFull,        bg: 'bg-red-100',     stroke: '#DC2626', d: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    { label: 'Moderate',      value: moderate,        bg: 'bg-amber-100',   stroke: '#F59E0B', d: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'Overall Load',  value: `${overallPct}%`, bg: 'bg-emerald-100', stroke: '#059669', d: 'M5 13l4 4L19 7' }
  ];

  centersStatsGrid.innerHTML = stats.map(s => `
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

  headerStatusBadge.textContent = nearFull > 0 ? 'HIGH CAPACITY ALERT' : 'CAPACITY MONITORING';
}

function getFilteredCenters() {
  const term = searchTerm.trim().toLowerCase();
  return centers.filter(c => {
    const matchesFilter = currentFilter === 'all' || getCenterStatus(c) === currentFilter;
    const matchesSearch = !term
      || (c.name    || '').toLowerCase().includes(term)
      || (c.address || '').toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });
}

function renderTable() {
  const filtered = getFilteredCenters();

  if (centers.length === 0) {
    centersTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="py-12 px-4 text-center text-sm text-slate-400">
          <svg class="mx-auto mb-3 opacity-30" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/></svg>
          <p class="font-medium">No evacuation centers found</p>
          <p class="text-xs mt-1">Add centers to the <code class="bg-slate-100 px-1 rounded">centers</code> Firestore collection to see them here.</p>
        </td>
      </tr>
    `;
    return;
  }

  if (filtered.length === 0) {
    centersTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="py-8 px-4 text-center text-sm text-slate-400">No centers match this filter.</td>
      </tr>
    `;
    return;
  }

  centersTableBody.innerHTML = filtered.map(center => {
    const realIndex = centers.indexOf(center);
    const pct       = getOccupancyPercent(center);
    const status    = getCenterStatus(center);
    const colors    = getStatusColors(status);
    const isActive  = realIndex === selectedCenterIndex;

    return `
      <tr class="center-row ${isActive ? 'active' : ''}" data-index="${realIndex}">
        <td class="py-3 px-4 font-semibold text-slate-900">${center.name || '—'}</td>
        <td class="py-3 px-4 text-slate-500">${center.address || '—'}</td>
        <td class="py-3 px-4">
          <div class="capacity-bar-track">
            <div class="capacity-bar-fill ${colors.fill}" style="width:${pct}%"></div>
          </div>
          <span class="text-xs text-slate-400 mt-1 inline-block">${pct}% (${center.occupants || 0}/${center.capacity || 0})</span>
        </td>
        <td class="py-3 px-4">${badge(status, colors.badge)}</td>
      </tr>
    `;
  }).join('');
}

function renderSelectedCenter() {
  if (selectedCenterIndex === null) {
    emptyCenterState.classList.remove('hidden');
    selectedCenterState.classList.add('hidden');
    return;
  }

  const center = centers[selectedCenterIndex];
  if (!center) {
    selectedCenterIndex = null;
    emptyCenterState.classList.remove('hidden');
    selectedCenterState.classList.add('hidden');
    return;
  }

  const pct    = getOccupancyPercent(center);
  const status = getCenterStatus(center);
  const colors = getStatusColors(status);
  const slots  = (center.capacity || 0) - (center.occupants || 0);
// still wara na japon ja khing na taw-an ka proper evac please change the logic boss
  emptyCenterState.classList.add('hidden');
  selectedCenterState.classList.remove('hidden');
  selectedCenterName.textContent      = center.name || '—';
  selectedCenterAddress.textContent   = `${center.address || '—'} • ${center.id || ''}`;
  selectedCenterBadge.innerHTML       = badge(status, colors.badge);
  selectedCenterBar.className         = `h-full rounded-full ${colors.fill}`;
  selectedCenterBar.style.width       = `${pct}%`;
  selectedCenterPercent.textContent   = `${pct}% occupied`;
  selectedCenterCapacity.textContent  = `${center.capacity || 0} people`;
  selectedCenterOccupants.textContent = `${center.occupants || 0} sheltered`;
  selectedCenterSlots.textContent     = `${Math.max(0, slots)} slots`;
  selectedCenterStatus.textContent    = status;
  selectedCenterAction.textContent    = center.action || 'Monitor current capacity and prepare for incoming evacuees.';

  const facilities = Array.isArray(center.facilities) ? center.facilities : [];
  selectedCenterFacilities.innerHTML = facilities.length
    ? facilities.map(f => `<span class="facility-chip">${f}</span>`).join('')
    : '<span class="text-xs text-slate-400">No facilities listed</span>';
}
// still wara na japon ja khing na taw-an ka proper evac please change the logic boss
function renderAiSummary() {
  if (centers.length === 0) {
    centersAiSummary.textContent = 'No evacuation centers are currently registered. Add center data to the Firestore "centers" collection to enable capacity tracking.';
    return;
  }

  const nearFull  = centers.filter(c => getCenterStatus(c) === 'Near Full').length;
  const moderate  = centers.filter(c => getCenterStatus(c) === 'Moderate').length;
  const available = centers.filter(c => getCenterStatus(c) === 'Available').length;
  const totalCap  = centers.reduce((s, c) => s + (c.capacity  || 0), 0);
  const totalOcc  = centers.reduce((s, c) => s + (c.occupants || 0), 0);
  const remaining = totalCap - totalOcc;

  let text = `${centers.length} center${centers.length !== 1 ? 's' : ''} tracked. `;
  if (nearFull > 0)  text += `${nearFull} near capacity — overflow routing may be needed soon. `;
  if (moderate > 0)  text += `${moderate} moderately loaded. `;
  if (available > 0) text += `${available} with open capacity. `;
  text += `${remaining} total shelter slots remain available across the network. `;
  text += nearFull > 0
    ? 'Priority: redistribute incoming evacuees before any site exceeds safe intake capacity.'
    : 'Current capacity is manageable across all active shelters.';

  centersAiSummary.textContent = text;
}

function renderAll() {
  renderStats();
  renderTable();
  renderSelectedCenter();
  renderAiSummary();
  updateReadinessSnapshot();
}

// ── Selection + filter ─────────────────────────────────────────────────────────
function selectCenter(index) {
  selectedCenterIndex = index;
  renderTable();
  renderSelectedCenter();
}

function setFilter(filter) {
  currentFilter = filter;
  filterButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));

  const filtered = getFilteredCenters();
  if (selectedCenterIndex !== null && !filtered.includes(centers[selectedCenterIndex])) {
    selectedCenterIndex = null;
  }

  renderTable();
  renderSelectedCenter();
}

document.addEventListener('click', (e) => {
  const filterBtn = e.target.closest('.center-filter-btn');
  if (filterBtn) { setFilter(filterBtn.dataset.filter); return; }

  const row = e.target.closest('.center-row');
  if (row) {
    const idx = Number(row.dataset.index);
    if (!Number.isNaN(idx)) selectCenter(idx);
  }
});


setCurrentDate();

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById('centerSearch').addEventListener('input', e => {
  searchTerm = e.target.value;
  renderTable();
  renderSelectedCenter();
});

// ── Add Center modal ──────────────────────────────────────────────────────────
const modal      = document.getElementById('addCenterModal');
const modalError = document.getElementById('modalError');
const submitBtn  = document.getElementById('btnSubmitCenter');

document.getElementById('btnAddCenter').addEventListener('click', () => {
  document.getElementById('addCenterForm').reset();
  modalError.classList.add('hidden');
  modal.classList.remove('hidden');
});

document.getElementById('btnCloseModal').addEventListener('click', () => {
  modal.classList.add('hidden');
});

modal.addEventListener('click', e => {
  if (e.target === modal) modal.classList.add('hidden');
});

document.getElementById('addCenterForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form      = e.target;
  const name      = form.name.value.trim();
  const address   = form.address.value.trim();
  const capacity  = parseInt(form.capacity.value, 10);
  const occupants = parseInt(form.occupants.value, 10) || 0;
  const facilities = [...form.querySelectorAll('input[name="facilities"]:checked')]
    .map(cb => cb.value);

  if (!name || !address || !capacity || capacity < 1) {
    modalError.textContent = 'Name, address, and a valid capacity are required.';
    modalError.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';
  modalError.classList.add('hidden');

  try {
    await addDoc(collection(db, 'centers'), {
      name,
      address,
      capacity,
      occupants,
      facilities,
      action: 'Monitor current capacity and prepare for incoming evacuees.',
      createdAt: serverTimestamp()
    });
    modal.classList.add('hidden');
  } catch (err) {
    modalError.textContent = err?.message || 'Failed to save. Check your connection.';
    modalError.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Register Center';
  }
});

const centersQuery = query(collection(db, 'centers'), orderBy('name'));
onSnapshot(centersQuery, (snapshot) => {
  centers = snapshot.docs.map(docSnap => ({
    id:         docSnap.id,
    ...docSnap.data()
  }));
  renderAll();
}, (err) => {
  console.error('Centers snapshot error:', err);
  centersAiSummary.textContent = 'Unable to load centers data. Check Firestore rules and connection.';
});
