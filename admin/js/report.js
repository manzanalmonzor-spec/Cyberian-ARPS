import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../../firebase-config.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimestampMs(raw) {
  if (!raw) return null;
  if (typeof raw.toMillis === "function") return raw.toMillis();
  if (typeof raw === "number") return raw;
  return null;
}

function formatDateTime(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  const time = d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const date = d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return `${time} · ${date}`;
}

function toDateInputValue(ms) {
  // Returns YYYY-MM-DD for an input[type=date]
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}
function endOfDay(ts) {
  const d = new Date(ts); d.setHours(23, 59, 59, 999); return d.getTime();
}
function startOfWeek(ts) {
  const d = new Date(ts); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d.getTime();
}
function startOfMonth(ts) {
  const d = new Date(ts); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime();
}
function monthsAgo(n) {
  const d = new Date(); d.setMonth(d.getMonth() - n); d.setHours(0, 0, 0, 0); return d.getTime();
}
function yearsAgo(n) {
  const d = new Date(); d.setFullYear(d.getFullYear() - n); d.setHours(0, 0, 0, 0); return d.getTime();
}

function periodLabel(p) {
  return { today: "Today", week: "This Week", month: "This Month",
           "3months": "Last 3 Months", "6months": "Last 6 Months",
           year: "Last Year", "5years": "Last 5 Years", all: "All Time",
           custom: "Custom Range" }[p] || p;
}

function periodRange(p) {
  const now = Date.now();
  switch (p) {
    case "today":   return [startOfDay(now),    endOfDay(now)];
    case "week":    return [startOfWeek(now),   now];
    case "month":   return [startOfMonth(now),  now];
    case "3months": return [monthsAgo(3),       now];
    case "6months": return [monthsAgo(6),       now];
    case "year":    return [monthsAgo(12),      now];
    case "5years":  return [yearsAgo(5),        now];
    case "all":     return [0,                  now];
    default:        return null; // custom — handled separately
  }
}

function escapeHtml(str) {
  if (!str) return "—";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── State ─────────────────────────────────────────────────────────────────────

let allRecords   = [];
let activePeriod = "today";
let activeType   = "";
let activeStat   = "";

// ── DOM — main page ───────────────────────────────────────────────────────────

const reportStatsGrid = document.getElementById("reportStatsGrid");
const reportTableBody = document.getElementById("reportTableBody");
const reportCount     = document.getElementById("reportCount");
const currentDateEl   = document.getElementById("currentDate");
const filterTypeSel   = document.getElementById("filterType");
const filterStatSel   = document.getElementById("filterStat");
const btnPrint        = document.getElementById("btnPrint");
const btnExportCSV    = document.getElementById("btnExportCSV");
const printHeader     = document.getElementById("printHeader");
const printSubtitle   = document.getElementById("printSubtitle");

// ── DOM — modal ───────────────────────────────────────────────────────────────

const epOverlay      = document.getElementById("epOverlay");
const epClose        = document.getElementById("epClose");
const epCancel       = document.getElementById("epCancel");
const epTitle        = document.getElementById("epTitle");
const epHeaderIcon   = document.getElementById("epHeaderIcon");
const epActionBtn    = document.getElementById("epActionBtn");
const epDateFrom     = document.getElementById("epDateFrom");
const epDateTo       = document.getElementById("epDateTo");
const epFilterType   = document.getElementById("epFilterType");
const epFilterStatus = document.getElementById("epFilterStatus");
const epInfoBar      = document.getElementById("epInfoBar");
const epInfoText     = document.getElementById("epInfoText");

// ── Date display ──────────────────────────────────────────────────────────────

currentDateEl.textContent = new Date().toLocaleDateString("en-US", {
  weekday: "short", month: "short", day: "numeric", year: "numeric"
});

// ── Main page filter buttons ──────────────────────────────────────────────────

document.querySelectorAll(".report-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".report-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activePeriod = btn.dataset.period;
    render();
  });
});

filterTypeSel.addEventListener("change", () => { activeType = filterTypeSel.value; render(); });
filterStatSel.addEventListener("change", () => { activeStat = filterStatSel.value; render(); });

// ── Main page filter logic ────────────────────────────────────────────────────

function getFiltered() {
  const now = Date.now();
  const range = periodRange(activePeriod);
  const [from, to] = range || [0, now];

  return allRecords.filter((r) => {
    if (r.sortTime < from || r.sortTime > to) return false;
    if (activeType && r.type !== activeType)   return false;
    if (activeStat && r.status !== activeStat) return false;
    return true;
  });
}

// ── Render stats ──────────────────────────────────────────────────────────────

function renderStats(filtered) {
  const total      = filtered.length;
  const pending    = filtered.filter((r) => r.status === "Pending").length;
  const responding = filtered.filter((r) => r.status === "Responding").length;
  const resolved   = filtered.filter((r) => r.status === "Resolved").length;

  const stats = [
    {
      label: `Total SOS (${periodLabel(activePeriod)})`,
      value: total, bg: "bg-red-50",
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
    },
    {
      label: "Pending", value: pending, bg: "bg-amber-50",
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    },
    {
      label: "Responding", value: responding, bg: "bg-blue-50",
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`
    },
    {
      label: "Resolved", value: resolved, bg: "bg-emerald-50",
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>`
    }
  ];

  reportStatsGrid.innerHTML = stats.map((s) => `
    <div class="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-[12px] text-slate-500 font-semibold tracking-wide uppercase leading-tight">${s.label}</p>
          <p class="text-4xl font-black text-slate-900 mt-2.5 tracking-tight">${s.value}</p>
        </div>
        <div class="w-11 h-11 rounded-[13px] ${s.bg} flex items-center justify-center shrink-0">${s.icon}</div>
      </div>
    </div>
  `).join("");
}

// ── Type / Severity / Status badges ──────────────────────────────────────────

const typeClasses = {
  Flood: "type-flood", Medical: "type-medical", Fire: "type-fire",
  Earthquake: "type-earthquake", Typhoon: "type-typhoon", SOS: "type-sos"
};
const typeIcons = {
  Flood:      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 21c3.5 0 6-2.5 6-6.2C18 11 12 3 12 3S6 11 6 14.8C6 18.5 8.5 21 12 21z"/></svg>`,
  Medical:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>`,
  Fire:       `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
  Earthquake: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
  Typhoon:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>`,
  SOS:        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
};

function typeBadge(type) {
  const cls  = typeClasses[type]  || "type-sos";
  const icon = typeIcons[type]    || typeIcons.SOS;
  return `<span class="type-badge ${cls}">${icon}${type || "SOS"}</span>`;
}

const severityColors = {
  Critical: { bg: "#FEF2F2", text: "#DC2626" }, High: { bg: "#FFF7ED", text: "#EA580C" },
  Medium:   { bg: "#EFF6FF", text: "#1D4ED8" }, Low:  { bg: "#F0FDF4", text: "#16A34A" }
};
function severityBadge(severity) {
  const c = severityColors[severity] || severityColors.Medium;
  return `<span style="background:${c.bg};color:${c.text};" class="type-badge">${severity || "—"}</span>`;
}

const statusCls = { Pending: "status-pending", Responding: "status-responding", Resolved: "status-resolved" };
const statusDot = { Pending: "#F59E0B", Responding: "#1D4ED8", Resolved: "#10B981" };
function statusPill(status) {
  const cls = statusCls[status] || "status-pending";
  const dot = statusDot[status] || "#F59E0B";
  return `<span class="status-pill ${cls}"><span style="width:6px;height:6px;border-radius:50%;background:${dot};display:inline-block;"></span>${status || "Pending"}</span>`;
}

// ── Render table ──────────────────────────────────────────────────────────────

function renderTable(filtered) {
  if (filtered.length === 0) {
    reportTableBody.innerHTML = `
      <div class="py-16 flex flex-col items-center gap-3 text-center">
        <svg class="text-slate-200" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 17v-2m3 2v-4m3 4v-6M5 20h14a2 2 0 002-2V7l-5-5H5a2 2 0 00-2 2v13a2 2 0 002 2z"/>
        </svg>
        <p class="text-slate-400 text-sm font-semibold">No SOS incidents found for this period.</p>
        <p class="text-slate-300 text-xs">Try a different filter or time range.</p>
      </div>`;
    reportCount.textContent = "0 records";
    return;
  }

  reportTableBody.innerHTML = filtered.map((r) => `
    <div class="report-table-row">
      <div>
        <p class="text-[13px] font-semibold text-slate-900 leading-tight">${escapeHtml(r.name)}</p>
        ${r.locationLabel ? `<p class="text-[10px] text-slate-400 mt-0.5 leading-tight">${escapeHtml(r.locationLabel)}</p>` : ""}
      </div>
      <p class="text-[12px] text-slate-600 font-medium">${escapeHtml(r.contact)}</p>
      ${typeBadge(r.type)}
      ${severityBadge(r.severity)}
      ${statusPill(r.status)}
      <p class="text-[11px] text-slate-500 font-medium leading-relaxed">${r.timeFormatted}</p>
    </div>
  `).join("");

  const s = filtered.length === 1 ? "" : "s";
  reportCount.textContent = `${filtered.length} record${s}`;
}

// ── Main render ───────────────────────────────────────────────────────────────

function render() {
  const filtered = getFiltered();
  renderStats(filtered);
  renderTable(filtered);
}

// ── Firestore mapper ──────────────────────────────────────────────────────────

function mapDoc(snap) {
  const d = snap.data();
  const ms = getTimestampMs(d.createdAt) || d.createdAtMs || null;
  return {
    id:            snap.id,
    name:          d.name          || "Resident",
    contact:       d.contact       || "Not provided",
    type:          d.type          || "SOS",
    severity:      d.severity      || "Critical",
    status:        d.status        || "Pending",
    locationLabel: d.locationLabel || null,
    sortTime:      ms || 0,
    timeFormatted: formatDateTime(ms)
  };
}

// ── Firebase listener ─────────────────────────────────────────────────────────

onSnapshot(
  collection(db, "sosAlerts"),
  (snapshot) => {
    allRecords = snapshot.docs.map(mapDoc).sort((a, b) => b.sortTime - a.sortTime);
    render();
    epUpdatePreview(); // refresh modal preview if open
  },
  (err) => {
    console.error("Firestore error:", err);
    reportTableBody.innerHTML = `
      <div class="py-12 text-center">
        <p class="text-red-500 text-sm font-semibold">Failed to load data from Firebase.</p>
        <p class="text-slate-400 text-xs mt-1">Check your Firestore rules and connection.</p>
      </div>`;
    reportStatsGrid.innerHTML = "";
    reportCount.textContent = "Error loading data";
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT / PRINT MODAL
// ══════════════════════════════════════════════════════════════════════════════

let epMode           = "csv";   // "csv" | "print"
let epSelectedPeriod = "month"; // selected quick period in modal
let epIsCustom       = false;   // true when user typed into date inputs

// ── Modal filter helper ───────────────────────────────────────────────────────

function epGetFiltered() {
  let from = 0, to = Date.now();

  if (epIsCustom) {
    const f = epDateFrom.value ? new Date(epDateFrom.value).setHours(0, 0, 0, 0)       : 0;
    const t = epDateTo.value   ? new Date(epDateTo.value).setHours(23, 59, 59, 999)    : Date.now();
    from = f; to = t;
  } else {
    const range = periodRange(epSelectedPeriod);
    if (range) { [from, to] = range; }
  }

  const typ = epFilterType.value;
  const sta = epFilterStatus.value;

  return allRecords.filter((r) => {
    if (r.sortTime < from || r.sortTime > to) return false;
    if (typ && r.type   !== typ) return false;
    if (sta && r.status !== sta) return false;
    return true;
  });
}

// ── Update preview count ──────────────────────────────────────────────────────

function epUpdatePreview() {
  if (!epOverlay.classList.contains("open")) return;
  const count = epGetFiltered().length;
  if (count === 0) {
    epInfoBar.className = "ep-info-bar warn";
    epInfoText.textContent = "No records match this selection — try widening the range.";
  } else {
    epInfoBar.className = "ep-info-bar";
    const s = count === 1 ? "" : "s";
    epInfoText.textContent = `${count} record${s} will be ${epMode === "csv" ? "exported" : "printed"}.`;
  }
}

// ── Select quick period ───────────────────────────────────────────────────────

function epSelectPeriod(p) {
  epSelectedPeriod = p;
  epIsCustom = false;

  // highlight the active button
  document.querySelectorAll("[data-ep-period]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.epPeriod === p);
  });

  // fill date inputs with computed range for transparency
  const range = periodRange(p);
  if (range) {
    epDateFrom.value = toDateInputValue(range[0] || Date.now());
    epDateTo.value   = toDateInputValue(range[1]);
  } else {
    epDateFrom.value = "";
    epDateTo.value   = "";
  }

  epDateFrom.classList.remove("active-custom");
  epDateTo.classList.remove("active-custom");
  epUpdatePreview();
}

// ── Open modal ────────────────────────────────────────────────────────────────

const CSV_ICON  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const PRINT_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;

const CSV_ACTION_ICON  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const PRINT_ACTION_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;

function openModal(mode) {
  epMode = mode;

  if (mode === "csv") {
    epTitle.textContent = "Export CSV";
    epHeaderIcon.style.background = "#EFF6FF";
    epHeaderIcon.innerHTML = CSV_ICON;
    epActionBtn.className = "ep-action-btn csv";
    epActionBtn.innerHTML = CSV_ACTION_ICON + `<span>Export CSV</span>`;
  } else {
    epTitle.textContent = "Print Report";
    epHeaderIcon.style.background = "#F8FAFC";
    epHeaderIcon.innerHTML = PRINT_ICON;
    epActionBtn.className = "ep-action-btn print";
    epActionBtn.innerHTML = PRINT_ACTION_ICON + `<span>Print Report</span>`;
  }

  // Sync modal filters to main page filters
  epFilterType.value   = activeType;
  epFilterStatus.value = activeStat;

  // Default to current main period, but map to modal's quick options
  const mainToEp = { today: "today", week: "week", month: "month", all: "all" };
  epSelectPeriod(mainToEp[activePeriod] || "month");

  // Set today as max for date inputs
  const todayStr = toDateInputValue(Date.now());
  epDateFrom.max = todayStr;
  epDateTo.max   = todayStr;

  epOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  epOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ── Modal events ──────────────────────────────────────────────────────────────

epClose.addEventListener("click", closeModal);
epCancel.addEventListener("click", closeModal);

epOverlay.addEventListener("click", (e) => {
  if (e.target === epOverlay) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && epOverlay.classList.contains("open")) closeModal();
});

// Quick period buttons
document.querySelectorAll("[data-ep-period]").forEach((btn) => {
  btn.addEventListener("click", () => {
    epIsCustom = false;
    epSelectPeriod(btn.dataset.epPeriod);
  });
});

// Custom date inputs — when user types, deselect quick buttons
function onCustomDateChange() {
  epIsCustom = true;
  document.querySelectorAll("[data-ep-period]").forEach((b) => b.classList.remove("selected"));
  epDateFrom.classList.add("active-custom");
  epDateTo.classList.add("active-custom");
  epUpdatePreview();
}

epDateFrom.addEventListener("change", onCustomDateChange);
epDateTo.addEventListener("change",   onCustomDateChange);

// Filter dropdowns inside modal
epFilterType.addEventListener("change",   epUpdatePreview);
epFilterStatus.addEventListener("change", epUpdatePreview);

// Action button (inside modal)
epActionBtn.addEventListener("click", () => {
  const filtered = epGetFiltered();
  if (filtered.length === 0) return;

  if (epMode === "csv") {
    doExportCSV(filtered);
  } else {
    doPrint(filtered);
  }
  closeModal();
});

// Open modal from header buttons
btnExportCSV.addEventListener("click", () => openModal("csv"));
btnPrint.addEventListener("click",     () => openModal("print"));

// ── CSV Export ────────────────────────────────────────────────────────────────

function doExportCSV(filtered) {
  const headers = ["Name", "Contact", "Emergency Type", "Severity", "Status", "Date & Time", "Location"];
  const rows = filtered.map((r) => [
    r.name, r.contact, r.type, r.severity, r.status,
    r.timeFormatted, r.locationLabel || ""
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");

  let rangePart;
  if (epIsCustom) {
    rangePart = `${epDateFrom.value || "start"}_to_${epDateTo.value || "end"}`;
  } else {
    rangePart = { today: "Today", week: "Week", month: "Month",
                  "3months": "3Months", "6months": "6Months",
                  year: "1Year", "5years": "5Years", all: "AllTime" }[epSelectedPeriod] || "Range";
  }

  a.href     = url;
  a.download = `ARPS_SOS_Report_${rangePart}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Print ─────────────────────────────────────────────────────────────────────

function doPrint(filtered) {
  // Build a label for the subtitle
  let rangeStr;
  if (epIsCustom) {
    const fromStr = epDateFrom.value
      ? new Date(epDateFrom.value).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
      : "—";
    const toStr = epDateTo.value
      ? new Date(epDateTo.value).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
      : "—";
    rangeStr = `${fromStr} – ${toStr}`;
  } else {
    rangeStr = periodLabel(epSelectedPeriod);
  }

  const typ = epFilterType.value   ? ` · Type: ${epFilterType.value}`   : "";
  const sta = epFilterStatus.value ? ` · Status: ${epFilterStatus.value}` : "";
  const now = new Date().toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

  printSubtitle.textContent = `${rangeStr}${typ}${sta} · Generated ${now} · ${filtered.length} record${filtered.length === 1 ? "" : "s"}`;

  // Temporarily replace table body with filtered result for printing
  const originalHTML = reportTableBody.innerHTML;
  reportTableBody.innerHTML = filtered.map((r) => `
    <div class="report-table-row">
      <div>
        <p style="font-size:13px;font-weight:600;color:#0F172A;">${escapeHtml(r.name)}</p>
        ${r.locationLabel ? `<p style="font-size:10px;color:#94A3B8;">${escapeHtml(r.locationLabel)}</p>` : ""}
      </div>
      <p style="font-size:12px;color:#475569;">${escapeHtml(r.contact)}</p>
      <span>${escapeHtml(r.type)}</span>
      <span>${escapeHtml(r.severity)}</span>
      <span>${escapeHtml(r.status)}</span>
      <p style="font-size:11px;color:#64748B;">${r.timeFormatted}</p>
    </div>
  `).join("");

  printHeader.style.display = "block";
  window.print();
  printHeader.style.display = "none";

  // Restore original table
  reportTableBody.innerHTML = originalHTML;
  // Re-render to restore badges
  render();
}
