// Province of Antique, Philippines — default fallback coordinates
const DEFAULT_LAT  = 11.3683;
const DEFAULT_LNG  = 122.0643;
const DEFAULT_AREA = 'Province of Antique';

// ── Live weather state ───────────────────────────────────────────────────────
let wx = {
  tempC: null, feelsLikeC: null,
  windKmh: null, gustKmh: null,
  precipMm: null,
  humidityPct: null,
  pressureHpa: null,
  visibilityM: null,
  cloudPct: null,
  wmoCode: 0,
  area: DEFAULT_AREA,
  hourlyTimes: [], hourlyTempsC: [], hourlyWmoCodes: []
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const weatherStatsGrid    = document.getElementById('weatherStatsGrid');
const weatherStatusPill   = document.getElementById('weatherStatusPill');
const currentDate         = document.getElementById('currentDate');
const weatherAiSummary    = document.getElementById('weatherAiSummary');
const forecastGrid        = document.getElementById('forecastGrid');
const hazardGrid          = document.getElementById('hazardGrid');
const locationSubtitle    = document.getElementById('locationSubtitle');
const filterButtons       = document.querySelectorAll('.weather-filter-btn');
const weatherOverviewView = document.getElementById('weatherOverviewView');
const weatherForecastView = document.getElementById('weatherForecastView');

// ── WMO weather code helpers ─────────────────────────────────────────────────
function wmoInfo(code) {
  if (code === 0)           return { desc: 'Clear sky',       icon: 'sun'     };
  if (code <= 3)            return { desc: 'Partly cloudy',   icon: 'cloud'   };
  if (code <= 48)           return { desc: 'Foggy',           icon: 'cloud'   };
  if (code <= 57)           return { desc: 'Drizzle',         icon: 'rain'    };
  if (code <= 67)           return { desc: 'Rain',            icon: 'rain'    };
  if (code <= 77)           return { desc: 'Snow/sleet',      icon: 'cloud'   };
  if (code <= 82)           return { desc: 'Rain showers',    icon: 'rain'    };
  if (code <= 94)           return { desc: 'Heavy showers',   icon: 'rain'    };
  return                           { desc: 'Thunderstorm',    icon: 'thunder' };
}

// ── PAGASA wind signal ───────────────────────────────────────────────────────
function getPagasaSignal(gustKmh) {
  if (gustKmh >= 185) return { num: 4, label: 'SIGNAL #4 ACTIVE', severity: 'Critical' };
  if (gustKmh >= 100) return { num: 3, label: 'SIGNAL #3 ACTIVE', severity: 'Critical' };
  if (gustKmh >= 60)  return { num: 2, label: 'SIGNAL #2 ACTIVE', severity: 'High'     };
  if (gustKmh >= 30)  return { num: 1, label: 'SIGNAL #1 ACTIVE', severity: 'Medium'   };
  return                     { num: 0, label: 'NO WIND SIGNAL',   severity: 'Low'      };
}

// ── Hazard helpers ───────────────────────────────────────────────────────────
function hazardLevel(value, t) {
  if (value >= t[2]) return 'Critical';
  if (value >= t[1]) return 'High';
  if (value >= t[0]) return 'Medium';
  return 'Low';
}

function hazardClass(level) {
  return { Critical: 'hazard-critical', High: 'hazard-high', Medium: 'hazard-medium', Low: 'hazard-low' }[level] || 'hazard-low';
}

function badge(label) {
  // Map "Medium" to "Medium/Warning" or "Moderate"
  const lbl = label === 'Medium' || label === 'Moderate' ? 'medium' : label.toLowerCase();
  return `<span class="risk-badge risk-${lbl}">${label}</span>`;
}

// ── Forecast icon SVGs ───────────────────────────────────────────────────────
function forecastIcon(code) {
  const { icon } = wmoInfo(code);
  if (icon === 'sun') {
    return `<svg class="mx-auto drop-shadow-sm" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  }
  if (icon === 'thunder') {
    return `<svg class="mx-auto drop-shadow-sm" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15"/><path d="M13 10l-2 5h4l-2 5"/></svg>`;
  }
  if (icon === 'cloud') {
    return `<svg class="mx-auto drop-shadow-sm" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15"/></svg>`;
  }
  // rain
  return `<svg class="mx-auto drop-shadow-sm" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>`;
}

// ── Render helpers ───────────────────────────────────────────────────────────
function setCurrentDate() {
  currentDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function renderStats() {
  const gust = wx.gustKmh != null ? `${Math.round(wx.gustKmh)} km/h` : '--';
  const stats = [
    { label: 'Air Temperature', value: wx.tempC != null ? `${Math.round(wx.tempC)}°C` : '--',  iconClass: 'text-amber-500 bg-amber-50', stroke: 'currentColor', d: 'M14 14.76V3.5a2 2 0 10-4 0v11.26a4 4 0 104 0z' },
    { label: 'Peak Wind Gust',  value: gust,                                                   iconClass: 'text-blue-500 bg-blue-50', stroke: 'currentColor', d: 'M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2' },
    { label: '24H Rainfall',    value: wx.precipMm != null ? `${wx.precipMm.toFixed(1)} mm` : '--', iconClass: 'text-sky-500 bg-sky-50', stroke: 'currentColor', d: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15' },
    { label: 'Surface Humidity',value: wx.humidityPct != null ? `${wx.humidityPct}%` : '--',   iconClass: 'text-emerald-500 bg-emerald-50', stroke: 'currentColor', d: 'M12 21c3.5 0 6-2.5 6-6.2C18 11 12 3 12 3S6 11 6 14.8C6 18.5 8.5 21 12 21z' }
  ];

  weatherStatsGrid.innerHTML = stats.map(s => `
    <div class="bg-white/70 backdrop-blur-2xl rounded-[2rem] p-6 border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-500">
      <div class="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-current to-transparent opacity-[0.04] rounded-full group-hover:scale-150 transition-transform duration-700 ${s.iconClass.split(' ')[0]}"></div>
      <div class="flex justify-between items-start">
        <div class="z-10">
          <p class="text-[11px] text-slate-500 font-bold tracking-[0.2em] uppercase mb-2">${s.label}</p>
          <p class="text-4xl font-black text-slate-800 tracking-tighter">${s.value}</p>
        </div>
        <div class="p-3.5 rounded-[1.25rem] shadow-sm flex items-center justify-center border border-white/50 z-10 w-14 h-14 ${s.iconClass}">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${s.stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${s.d}"/></svg>
        </div>
      </div>
    </div>
  `).join('');
}

function renderOverviewValues() {
  const temp  = wx.tempC != null ? `${Math.round(wx.tempC)}°C` : '--';
  const feels = wx.feelsLikeC != null ? `Feels like ${Math.round(wx.feelsLikeC)}°C` : '--';
  const wind  = wx.windKmh != null ? `${Math.round(wx.windKmh)} km/h` : '--';
  const gust  = wx.gustKmh != null ? `Gusts up to ${Math.round(wx.gustKmh)} km/h` : '--';
  const mm    = wx.precipMm != null ? `${wx.precipMm.toFixed(1)} mm` : '--';
  const rainRisk = wx.precipMm == null ? '--' : wx.precipMm >= 20 ? 'Heavy — flooding risk' : wx.precipMm >= 5 ? 'Moderate rainfall' : 'Light / No rain';
  const humid = wx.humidityPct != null ? `${wx.humidityPct}%` : '--';
  const humidText = wx.humidityPct == null ? '--' : wx.humidityPct >= 80 ? 'Very high humidity' : wx.humidityPct >= 60 ? 'High humidity' : 'Moderate levels';

  document.getElementById('temperatureValue').textContent = temp;
  document.getElementById('temperatureSub').textContent   = feels;
  document.getElementById('windValue').textContent        = wind;
  document.getElementById('windSub').textContent          = gust;
  document.getElementById('rainfallValue').textContent    = mm;
  document.getElementById('rainfallSub').textContent      = rainRisk;
  document.getElementById('humidityValue').textContent    = humid;
  document.getElementById('humiditySub').textContent      = humidText;
  document.getElementById('pressureValue').textContent    = wx.pressureHpa != null ? `${Math.round(wx.pressureHpa)} hPa` : '--';
  document.getElementById('visibilityValue').textContent  = wx.visibilityM != null ? (wx.visibilityM >= 1000 ? `${(wx.visibilityM / 1000).toFixed(1)} km` : `${Math.round(wx.visibilityM)} m`) : '--';
  document.getElementById('cloudValue').textContent       = wx.cloudPct != null ? `${wx.cloudPct}%` : '--';

  // Apply conditional styles to warnings
  if(wx.precipMm >= 20) {
    document.getElementById('rainfallSub').className = 'text-[11px] font-bold text-red-600 mt-1.5 truncate flex items-center justify-center gap-1';
    document.getElementById('rainfallSub').innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg> ' + rainRisk;
  } else if(wx.precipMm >= 5) {
    document.getElementById('rainfallSub').className = 'text-[11px] font-bold text-amber-600 mt-1.5 truncate flex items-center justify-center';
    document.getElementById('rainfallSub').textContent = rainRisk;
  } else {
    document.getElementById('rainfallSub').className = 'text-[11px] font-semibold text-slate-500 mt-1.5 truncate flex items-center justify-center';
    document.getElementById('rainfallSub').textContent = rainRisk;
  }

  if(wx.gustKmh >= 60) {
    document.getElementById('windSub').className = 'text-[13px] font-bold text-red-700/90 mt-3 bg-red-200/40 backdrop-blur-sm px-4 py-1.5 rounded-xl z-10 shadow-sm border border-red-200/50 flex items-center justify-center gap-1.5 mx-auto';
    document.getElementById('windSub').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg> ' + gust;
  } else if(wx.gustKmh >= 30) {
    document.getElementById('windSub').className = 'text-[13px] font-bold text-amber-700/90 mt-3 bg-amber-200/40 backdrop-blur-sm px-4 py-1.5 rounded-xl z-10 shadow-sm border border-amber-200/50 flex items-center justify-center mx-auto';
    document.getElementById('windSub').textContent = gust;
  } else {
    document.getElementById('windSub').className = 'text-[13px] font-bold text-blue-700/90 mt-3 bg-blue-200/40 backdrop-blur-sm px-4 py-1.5 rounded-xl z-10 shadow-sm border border-blue-200/50 flex items-center justify-center mx-auto';
    document.getElementById('windSub').textContent = gust;
  }
}

function renderForecast() {
  const times = wx.hourlyTimes;
  if (!times.length) {
    forecastGrid.innerHTML = '<p class="text-[11px] font-bold tracking-widest uppercase text-slate-400 col-span-5 text-center py-6">Telemetric sequence loading…</p>';
    return;
  }

  const nowHour = new Date().getHours();
  let startIdx = times.findIndex(t => parseInt(t.split('T')[1]) >= nowHour);
  if (startIdx === -1) startIdx = 0;

  const slots = [];
  for (let i = 0; i < 5; i++) {
    const idx = (startIdx + i * 3) % times.length;
    const hr  = parseInt(times[idx].split('T')[1]);
    const label = i === 0 ? 'Now' : (hr === 0 ? '12 AM' : hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`);
    slots.push({ label, temp: `${Math.round(wx.hourlyTempsC[idx])}°C`, code: wx.hourlyWmoCodes[idx] });
  }

  forecastGrid.innerHTML = slots.map((s, idx) => `
    <div class="bg-white/60 backdrop-blur-sm border border-white/80 hover:bg-white hover:border-slate-200 hover:shadow-lg transition-all duration-500 rounded-[1.5rem] p-5 text-center group flex flex-col items-center justify-between h-full" style="animation-delay: ${idx * 0.1}s">
      <p class="text-[12px] font-bold uppercase tracking-[0.15em] text-slate-500 group-hover:text-blue-600 transition-colors">${s.label}</p>
      <div class="my-4 transform group-hover:scale-125 group-hover:-translate-y-1 transition-all duration-500 filter drop-shadow-md">${forecastIcon(s.code)}</div>
      <div>
        <p class="text-3xl font-black text-slate-800 tracking-tight">${s.temp}</p>
        <p class="text-[11px] font-semibold text-slate-500 mt-1.5 leading-tight">${wmoInfo(s.code).desc}</p>
      </div>
    </div>
  `).join('');
}

function renderHazards() {
  const precip = wx.precipMm  || 0;
  const gust   = wx.gustKmh   || 0;
  const visKm  = Math.min(10, (wx.visibilityM || 10000) / 1000);
  const humid  = wx.humidityPct || 50;

  const floodLevel     = hazardLevel(precip, [5, 20, 50]);
  const windLevel      = hazardLevel(gust,   [30, 60, 100]);
  const roadLevel      = hazardLevel(10 - visKm, [3, 6, 8]);
  const landslideScore = precip * 0.5 + (humid > 80 ? precip * 0.5 : 0);
  const landLevel      = hazardLevel(landslideScore, [5, 15, 30]);

  const floodDesc = precip >= 50 ? 'Severe flooding likely in low-lying and riverside communities.' :
    precip >= 20 ? 'Moderate flooding risk in flood-prone areas and drainage hotspots.' :
    precip >= 5  ? 'Minor flooding possible; monitor low-elevation barangays.' :
    'Current conditions do not indicate significant flood risk.';

  const windDesc = gust >= 100 ? 'Destructive gusts. Evacuate exposed shelters and secure loose structures.' :
    gust >= 60 ? 'Strong gusts may damage temporary shelters, power lines, and trees.' :
    gust >= 30 ? 'Elevated winds may affect field mobility and light structures.' :
    'Wind conditions are within normal operational limits.';

  const roadDesc = visKm < 1 ? 'Very low visibility. Field dispatch and emergency transport severely limited.' :
    visKm < 4 ? 'Reduced visibility slowing dispatch and response route safety.' :
    visKm < 8 ? 'Moderate visibility; standard caution for field teams on roads.' :
    'Visibility is adequate for normal emergency response operations.';

  const landDesc = landslideScore >= 30 ? 'High slope instability risk. Evacuate hillside communities immediately.' :
    landslideScore >= 15 ? 'Elevated landslide probability in saturated elevated zones.' :
    landslideScore >= 5  ? 'Monitor hillside areas for early signs of slope movement.' :
    'Soil conditions do not indicate significant slope instability.';

  const hazards = [
    { label: 'Flood Risk',     level: floodLevel, sub: floodDesc },
    { label: 'Wind Impact',    level: windLevel,  sub: windDesc  },
    { label: 'Route Safety',   level: roadLevel,  sub: roadDesc  },
    { label: 'Landslide Risk', level: landLevel,  sub: landDesc  }
  ];

  hazardGrid.innerHTML = hazards.map(h => `
    <div class="hazard-card ${hazardClass(h.level)} group">
      <div class="hazard-info-wrapper">
        <p class="hazard-label">${h.label}</p>
        <p class="hazard-value">${h.level}</p>
        <p class="hazard-sub">${h.sub}</p>
      </div>
    </div>
  `).join('');
}

function renderAdvisory() {
  const gust   = wx.gustKmh  || 0;
  const precip = wx.precipMm || 0;
  const sig    = getPagasaSignal(gust);
  const cond   = wmoInfo(wx.wmoCode).desc;
  const tempStr = wx.tempC != null ? `${Math.round(wx.tempC)}°C` : '--';
  const gustStr = gust ? `${Math.round(gust)} km/h` : '--';
  const windStr = wx.windKmh != null ? `${Math.round(wx.windKmh)} km/h` : '--';
  const mmStr   = precip ? `${precip.toFixed(1)} mm` : '0 mm';

  let title, summary, action, risk, trend, severity;

  if (sig.num >= 2) {
    title    = `PAGASA Wind ${sig.label.replace(' ACTIVE', '')}`;
    summary  = `Destructive winds with gusts reaching ${gustStr} are affecting ${wx.area}. Immediate protective actions are required.`;
    action   = sig.num >= 3 ? 'Activate full evacuation protocols. Suspend all field operations immediately and position rescue assets.' : 'Pre-position rescue assets, monitor low-lying barangays, and prepare evacuation centers for activation.';
    risk     = 'Critical';
    trend    = 'Deteriorating';
    severity = 'Critical';
  } else if (precip >= 20) {
    title    = `Heavy Rainfall Warning`;
    summary  = `${mmStr} of precipitation recorded. Heavy rainfall increases flood risk across low-lying and drainage-sensitive zones of ${wx.area}.`;
    action   = 'Alert flood-prone barangays, inspect drainage hotspots, and pre-position flood response teams.';
    risk     = 'High';
    trend    = 'Elevated';
    severity = 'High';
  } else if (sig.num === 1 || precip >= 5) {
    title    = `Weather Advisory`;
    summary  = `${cond} conditions with ${sig.num === 1 ? `gusty winds (${gustStr})` : `${mmStr} of rainfall`} affecting parts of ${wx.area}.`;
    action   = 'Maintain monitoring posture. Alert field teams to current conditions and check drainage-prone areas.';
    risk     = 'Medium';
    trend    = 'Monitoring';
    severity = 'Medium';
  } else {
    title    = `Weather Update`;
    summary  = `Current conditions: ${cond} with temperature at ${tempStr} and winds at ${windStr}. Situation is within normal parameters.`;
    action   = 'Maintain standard monitoring posture. No immediate escalation required at this time.';
    risk     = 'Low';
    trend    = 'Stable';
    severity = 'Low';
  }

  document.getElementById('advisoryTitle').textContent     = title;
  document.getElementById('advisoryIssued').textContent    = `Issued ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  document.getElementById('advisorySeverityBadge').innerHTML = badge(severity);
  document.getElementById('advisoryCondition').textContent = cond;
  document.getElementById('advisoryArea').textContent      = wx.area;
  document.getElementById('advisoryRisk').textContent      = risk;
  document.getElementById('advisoryTrend').textContent     = trend;
  document.getElementById('advisorySummary').textContent   = summary;
  
  // Clean up formatting
  document.getElementById('advisoryAction').textContent    = action;
}

function renderResponseImpact() {
  const gust   = wx.gustKmh   || 0;
  const precip = wx.precipMm  || 0;
  const visKm  = Math.min(10, (wx.visibilityM || 10000) / 1000);

  const roadAccess = Math.max(10, Math.round(100 - Math.min(90, gust * 0.4 + precip * 1.5)));
  const fieldVis   = Math.max(10, Math.round(visKm * 10));
  const dispatch   = Math.max(10, Math.round(100 - Math.min(90, gust * 0.5 + precip)));

  const barColor = (v) => v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const valColor = (v) => v >= 70 ? 'text-emerald-700 bg-emerald-100' : v >= 40 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';

  const roadBar = document.getElementById('roadAccessBar');
  const roadVal = document.getElementById('roadAccessVal');
  const visBar  = document.getElementById('fieldVisibilityBar');
  const visVal  = document.getElementById('fieldVisibilityVal');
  const dispBar = document.getElementById('dispatchStabilityBar');
  const dispVal = document.getElementById('dispatchStabilityVal');

  if (roadBar) { roadBar.style.width = `${roadAccess}%`; roadBar.className = `h-full rounded-full ${barColor(roadAccess)} transition-all duration-1000 ease-out`; }
  if (roadVal) { roadVal.textContent = `${roadAccess}%`; roadVal.className = `text-xs font-bold ${valColor(roadAccess)} px-2 py-0.5 rounded-md`; }
  
  if (visBar)  { visBar.style.width  = `${fieldVis}%`;   visBar.className  = `h-full rounded-full ${barColor(fieldVis)} transition-all duration-1000 ease-out delay-100`; }
  if (visVal)  { visVal.textContent  = `${fieldVis}%`;   visVal.className  = `text-xs font-bold ${valColor(fieldVis)} px-2 py-0.5 rounded-md`; }
  
  if (dispBar) { dispBar.style.width = `${dispatch}%`;   dispBar.className = `h-full rounded-full ${barColor(dispatch)} transition-all duration-1000 ease-out delay-200`; }
  if (dispVal) { dispVal.textContent = `${dispatch}%`;   dispVal.className = `text-xs font-bold ${valColor(dispatch)} px-2 py-0.5 rounded-md`; }
}

function renderAiSummary() {
  const gust   = wx.gustKmh  || 0;
  const precip = wx.precipMm || 0;
  const visKm  = Math.min(10, (wx.visibilityM || 10000) / 1000);
  const sig    = getPagasaSignal(gust);
  const cond   = wmoInfo(wx.wmoCode).desc;
  const tempStr = wx.tempC != null ? `${Math.round(wx.tempC)}°C` : '--';
  const gustStr = gust ? `${Math.round(gust)} km/h gusts` : 'calm winds';

  let text = `Live weather data analysis for ${wx.area} indicates <strong>${cond.toLowerCase()}</strong> conditions at <strong>${tempStr}</strong> with <strong>${gustStr}</strong>. `;
  
  if (sig.num > 0)    text += `<br><br><span class="text-red-600 font-bold">⚠️ ${sig.label}</span> is in effect, presenting elevated wind hazards for field operations. `;
  if (precip >= 10)   text += `<br><br><span class="text-blue-600 font-bold">💧 Precipitation (${precip.toFixed(1)} mm)</span> raises flood risk across low-lying zones. `;
  if (visKm < 5)      text += `<br><br><span class="text-amber-600 font-bold">🌫️ Low visibility (${visKm.toFixed(1)} km)</span> is detected, limiting response route safety. `;
  
  if (sig.num === 0 && precip < 10 && visKm >= 5)
                      text += '<br><br><span class="text-emerald-600 font-bold">✓ Status Nominal:</span> All atmospheric conditions are currently within optimal operational parameters.';
                      
  text += '<br><br><em class="text-slate-500 text-[11px] block mt-2 pt-2 border-t border-slate-200/50">Response teams should align readiness with the active hazard matrix above. Generated by continuous telemetry.</em>';

  weatherAiSummary.innerHTML = text;
}

function renderStatusPill() {
  const gust   = wx.gustKmh  || 0;
  const precip = wx.precipMm || 0;
  const sig    = getPagasaSignal(gust);

  let statusText = 'NOMINAL CONDITIONS';
  let dotColor = 'bg-emerald-500';
  let pillBg = 'bg-emerald-100';
  let textColor = 'text-emerald-900';

  if (sig.num >= 2 || precip >= 20) {
    statusText = sig.num >= 2 ? sig.label : 'HEAVY RAINFALL WARNING';
    dotColor = 'bg-red-500';
    pillBg = 'bg-red-100';
    textColor = 'text-red-900';
  } else if (sig.num === 1 || precip >= 5) {
    statusText = sig.num === 1 ? 'WIND SIGNAL #1' : 'RAINFALL ADVISORY';
    dotColor = 'bg-amber-500';
    pillBg = 'bg-amber-100';
    textColor = 'text-amber-900';
  } else {
    statusText = 'MONITORING SYSTEM ACTIVE';
    dotColor = 'bg-emerald-500';
    pillBg = 'bg-emerald-100';
    textColor = 'text-emerald-900';
  }

  const pillContainer = weatherStatusPill.parentElement;
  
  pillContainer.className = `flex items-center gap-1.5 ${pillBg} px-3.5 py-2 rounded-[10px]`;
  
  pillContainer.innerHTML = `
    <span class="relative flex h-2 w-2">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 ${dotColor}"></span>
    </span>
    <span class="text-xs font-semibold ${textColor}" id="weatherStatusPill">${statusText}</span>
  `;
}

function renderAll() {
  renderStats();
  renderOverviewValues();
  renderForecast();
  renderHazards();
  renderAdvisory();
  renderAiSummary();
  renderStatusPill();
  renderResponseImpact();
  if (locationSubtitle) {
    locationSubtitle.textContent = wx.area;
  }
}

// ── API helpers ──────────────────────────────────────────────────────────────
async function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, area: DEFAULT_AREA });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Try to get municipality name via reverse geocoding (free Nominatim)
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          .then(r => r.json())
          .then(d => {
            const addr = d.address || {};
            const area = addr.county || addr.state_district || addr.city || addr.town || addr.village || 'Sensed Location';
            resolve({ lat, lng, area });
          })
          .catch(() => resolve({ lat, lng, area: 'Sensed Location' }));
      },
      () => resolve({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, area: DEFAULT_AREA }),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

async function fetchWeather(lat, lng) {
  const params = [
    `latitude=${lat}`, `longitude=${lng}`,
    'current=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,precipitation,relative_humidity_2m,surface_pressure,cloud_cover,visibility,weather_code',
    'hourly=temperature_2m,weather_code',
    'timezone=Asia/Manila',
    'forecast_days=1'
  ].join('&');
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  return res.json();
}

function applyWeatherData(data, area) {
  const c = data.current;
  const h = data.hourly;
  wx.tempC       = c.temperature_2m;
  wx.feelsLikeC  = c.apparent_temperature;
  wx.windKmh     = c.wind_speed_10m;
  wx.gustKmh     = c.wind_gusts_10m;
  wx.precipMm    = c.precipitation;
  wx.humidityPct = c.relative_humidity_2m;
  wx.pressureHpa = c.surface_pressure;
  wx.visibilityM = c.visibility;
  wx.cloudPct    = c.cloud_cover;
  wx.wmoCode     = c.weather_code;
  wx.area        = area;
  wx.hourlyTimes  = h.time;
  wx.hourlyTempsC = h.temperature_2m;
  wx.hourlyWmoCodes = h.weather_code;
}

// ── View toggle ──────────────────────────────────────────────────────────────
function setView(view) {
  filterButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  weatherOverviewView.classList.toggle('hidden', view === 'forecast');
  weatherForecastView.classList.toggle('hidden', view === 'overview');
  
  if(view === 'forecast') {
    weatherForecastView.classList.remove('animate-[fadeInUp_0.4s_ease-out]');
    void weatherForecastView.offsetWidth; // trigger reflow
    weatherForecastView.classList.add('animate-[fadeInUp_0.4s_ease-out]');
  } else {
    weatherOverviewView.classList.remove('animate-[fadeInUp_0.4s_ease-out]');
    void weatherOverviewView.offsetWidth; // trigger reflow
    weatherOverviewView.classList.add('animate-[fadeInUp_0.4s_ease-out]');
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.weather-filter-btn');
  if (btn) setView(btn.dataset.view);
});

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  setCurrentDate();
  weatherAiSummary.innerHTML = '<span class="animate-pulse">Loading live telemetric weather data for your sector…</span>';

  const { lat, lng, area } = await getLocation();

  try {
    const data = await fetchWeather(lat, lng);
    applyWeatherData(data, area);
  } catch (err) {
    wx.area = area;
    weatherAiSummary.innerHTML = `<span class="text-red-500 font-bold">Connection Terminated.</span> Weather data temporarily unavailable. Check uplink and try refreshing. (${area})`;
  }

  renderAll();

  // Refresh data every 10 mins
  setInterval(async () => {
    try {
      const { lat: l, lng: g, area: a } = await getLocation();
      const data = await fetchWeather(l, g);
      applyWeatherData(data, a);
      renderAll();
    } catch (_) {}
  }, 10 * 60 * 1000);
}

init();
