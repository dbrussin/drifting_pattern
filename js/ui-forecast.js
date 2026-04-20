// ── Full 96-hour forecast modal ───────────────────────────────────────────────
// Lazy-loaded: data is fetched only when the modal is first opened.
// Cached in memory for FORECAST_CACHE_MS to avoid redundant API calls.

const FORECAST_CACHE_MS = 30 * 60 * 1000;

let _fcCache = null; // { lat, lng, ts, rawData }

// ── Public: open / close ──────────────────────────────────────────────────────

function openForecastModal() {
  const modal = document.getElementById('forecast-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  if (!state.target) {
    _setFcStatus('No landing point set.');
    return;
  }

  const { lat, lng } = state.target;
  const now = Date.now();
  if (_fcCache && _fcCache.lat === lat && _fcCache.lng === lng && now - _fcCache.ts < FORECAST_CACHE_MS) {
    _renderForecastTable(_fcCache.rawData, state.fieldElevFt, _fcCache.ts);
    return;
  }

  _setFcStatus('Loading forecast…');
  document.getElementById('forecast-table-wrap').innerHTML = '';
  _fetchFullForecast(lat, lng);
}

function closeForecastModal() {
  const modal = document.getElementById('forecast-modal');
  if (modal) modal.style.display = 'none';
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function _fetchFullForecast(lat, lng) {
  try {
    const plWindVars = PRESSURE_LEVELS.flatMap(p => [`windspeed_${p}hPa`, `winddirection_${p}hPa`]).join(',');
    const plHgtVars  = PRESSURE_LEVELS.map(p => `geopotential_height_${p}hPa`).join(',');
    const ccVars     = PRESSURE_LEVELS.map(p => `cloud_cover_${p}hPa`).join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=${plWindVars},${plHgtVars},${ccVars}` +
      `&wind_speed_unit=kn&forecast_days=4&timezone=auto`;

    const rawData = await (await fetch(url)).json();
    if (!rawData?.hourly?.time?.length) {
      _setFcStatus('Forecast data unavailable for this location.');
      return;
    }

    _fcCache = { lat, lng, ts: Date.now(), rawData };
    _renderForecastTable(rawData, state.fieldElevFt, _fcCache.ts);
  } catch(e) {
    _setFcStatus(`Fetch failed: ${e.message}`);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function _renderForecastTable(rawData, fieldElevFt, ts) {
  const ageMin = Math.round((Date.now() - ts) / 60000);
  const ageStr = ageMin < 1 ? 'just now' : `${ageMin}m ago`;
  _setFcStatus(`Loaded ${ageStr}`);

  const h    = rawData.hourly;
  const utcOff = rawData.utc_offset_seconds || 0;
  const times  = h.time; // ISO strings, up to 96

  // Use first hour's geopotential heights to determine which pressure levels
  // are ≤ 18,000 ft MSL and above ground.
  const rows = [];
  for (const p of PRESSURE_LEVELS) {
    const hgtKey = `geopotential_height_${p}hPa`;
    const hgtArr = h[hgtKey];
    if (!hgtArr) continue;
    const altMslFt = (hgtArr[0] ?? 0) * 3.28084;
    const altAglFt = Math.round(altMslFt - fieldElevFt);
    if (altAglFt < 0) continue;
    if (altMslFt > 18500) continue;
    rows.push({ p, altAglFt, hgtKey });
  }
  // Sort surface → top
  rows.sort((a, b) => a.altAglFt - b.altAglFt);

  // Build table HTML
  const thead = _buildFcThead(times, utcOff);
  const tbody = _buildFcTbody(rows, times, h);

  const wrap = document.getElementById('forecast-table-wrap');
  wrap.innerHTML = `<table class="forecast-table">${thead}${tbody}</table>`;
}

function _buildFcThead(times, utcOff) {
  // Group hours by local date for the day-header row
  const days = []; // [{label, span}]
  let curDay = '', curSpan = 0;
  for (const iso of times) {
    const d = _localDay(iso, utcOff);
    if (d === curDay) { curSpan++; }
    else { if (curDay) days.push({ label: curDay, span: curSpan }); curDay = d; curSpan = 1; }
  }
  if (curDay) days.push({ label: curDay, span: curSpan });

  let dayRow = '<tr><th class="ft-row-hdr ft-day-hdr"></th>';
  for (const d of days) dayRow += `<th class="ft-day-hdr" colspan="${d.span}">${d.label}</th>`;
  dayRow += '</tr>';

  let hrRow = '<tr><th class="ft-row-hdr">Alt AGL</th>';
  for (const iso of times) hrRow += `<th>${_localHour(iso, utcOff)}</th>`;
  hrRow += '</tr>';

  return `<thead>${dayRow}${hrRow}</thead>`;
}

function _buildFcTbody(rows, times, h) {
  let tbody = '<tbody>';
  for (const row of rows) {
    const label = row.altAglFt < 1000
      ? `${row.altAglFt}ft`
      : `${(row.altAglFt / 1000).toFixed(1)}k`;

    tbody += `<tr><td class="ft-row-hdr">${label}</td>`;
    for (let i = 0; i < times.length; i++) {
      const spd = h[`windspeed_${row.p}hPa`]?.[i];
      const dir = h[`winddirection_${row.p}hPa`]?.[i];
      const cc  = h[`cloud_cover_${row.p}hPa`]?.[i];
      if (spd == null && dir == null) {
        tbody += `<td class="ft-cell--empty">—</td>`;
      } else {
        const cloudy = cc != null && cc >= 50;
        tbody += `<td${cloudy ? ' class="ft-cell--cloudy"' : ''}>` +
          `<span class="ft-cell-speed">${Math.round(spd ?? 0)}kt</span>` +
          `<span class="ft-cell-dir">${Math.round(dir ?? 0)}°</span>` +
          (cc != null ? `<span class="ft-cell-cloud">☁${Math.round(cc)}%</span>` : '') +
          `</td>`;
      }
    }
    tbody += '</tr>';
  }
  return tbody + '</tbody>';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _setFcStatus(msg) {
  const el = document.getElementById('forecast-modal-status');
  if (el) el.textContent = msg;
}

function _localDay(isoStr, utcOffSec) {
  const ms  = Date.parse(isoStr) + utcOffSec * 1000;
  const d   = new Date(ms);
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
  return `${dow} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function _localHour(isoStr, utcOffSec) {
  const ms = Date.parse(isoStr) + utcOffSec * 1000;
  return String(new Date(ms).getUTCHours()).padStart(2, '0');
}
