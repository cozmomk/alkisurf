// NOAA Tides & Currents
// Station 9447130 (Seattle): water level + predictions
// Station 9446484 (Tacoma): water temperature (Seattle station has no temp sensor)

const BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const STATION = '9447130';
const WTEMP_STATION = '9446484'; // Tacoma — same body of water, has temp sensor

// ─── IMPORTANT: use time_zone:'gmt' so NOAA returns UTC timestamps ──────────
// NOAA returns times as "YYYY-MM-DD HH:MM" with no timezone indicator.
// If we request lst_ldt (Pacific local), new Date("2026-05-15 10:30") is
// parsed as LOCAL time by JS — correct on a Pacific dev machine, but 7 hours
// wrong on Railway's UTC server. Requesting gmt gives UTC times, which we
// then parse with an explicit 'Z' suffix so they're unambiguous on any host.
function params(extra) {
  return new URLSearchParams({
    station: STATION,
    datum: 'MLLW',
    time_zone: 'gmt',   // ← UTC timestamps — safe to parse on any server
    units: 'english',
    application: 'alkisurf',
    format: 'json',
    ...extra,
  }).toString();
}

function wtempParams() {
  return new URLSearchParams({
    station: WTEMP_STATION,
    datum: 'MLLW',
    time_zone: 'gmt',
    units: 'english',
    application: 'alkisurf',
    format: 'json',
    product: 'water_temperature',
    date: 'latest',
  }).toString();
}

// Parse a NOAA UTC timestamp string ("YYYY-MM-DD HH:MM") to a Unix ms value.
// Appending 'Z' forces UTC interpretation regardless of the host's local timezone.
function parseNoaaTs(t) {
  return new Date(t.replace(' ', 'T') + 'Z').getTime();
}

function nowStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  // Use UTC date to match the gmt time_zone — begin_date is a UTC calendar date.
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}`;
}

// Hours needed from UTC midnight-today to cover now + 48h chart window + 4h buffer.
function rangeHours() {
  const now = new Date();
  // UTC hours elapsed since UTC midnight (matches gmt begin_date)
  const hoursElapsed = now.getUTCHours() + now.getUTCMinutes() / 60;
  return Math.ceil(hoursElapsed + 52); // 48h chart + 4h buffer
}

export async function fetchTideData(fetchFn) {
  const [levelRes, predRes, hiloRes, wtempRes] = await Promise.all([
    fetchFn(`${BASE}?${params({ product: 'water_level', date: 'latest' })}`, { signal: AbortSignal.timeout(8000) }),
    fetchFn(`${BASE}?${params({ product: 'predictions', begin_date: nowStr(), range: rangeHours(), interval: 'h' })}`, { signal: AbortSignal.timeout(8000) }),
    fetchFn(`${BASE}?${params({ product: 'predictions', begin_date: nowStr(), range: rangeHours(), interval: 'hilo' })}`, { signal: AbortSignal.timeout(8000) }),
    fetchFn(`${BASE}?${wtempParams()}`, { signal: AbortSignal.timeout(8000) }),
  ]);

  const [levelJson, predJson, hiloJson, wtempJson] = await Promise.all([
    levelRes.json(), predRes.json(), hiloRes.json(), wtempRes.json()
  ]);

  // Current water level (the .v value is independent of timezone — just feet)
  const levelData = levelJson.data?.[0];
  const currentFt = levelData ? parseFloat(levelData.v) : null;

  // Hourly predictions for the next 48h
  const hourly = (predJson.predictions || []).map(p => ({
    ts: parseNoaaTs(p.t),   // UTC timestamp, unambiguous on any host
    ft: parseFloat(p.v),
  }));

  // Hi/lo events
  const hilos = (hiloJson.predictions || []).map(p => ({
    ts: parseNoaaTs(p.t),   // UTC timestamp, unambiguous on any host
    ft: parseFloat(p.v),
    type: p.type, // H or L
  }));

  // Tide rate: ft/hr at current time, using the two hourly predictions that bracket NOW.
  // (Don't use hourly[0]→hourly[1] which is the UTC-midnight-to-1am rate, not current.)
  let tideRateFtHr = 0;
  if (hourly.length >= 2) {
    const now = Date.now();
    const before = [...hourly].filter(p => p.ts <= now).sort((a, b) => b.ts - a.ts)[0];
    const after  = [...hourly].filter(p => p.ts >  now).sort((a, b) => a.ts - b.ts)[0];
    if (before && after) {
      tideRateFtHr = (after.ft - before.ft) / ((after.ts - before.ts) / 3600000);
    } else {
      tideRateFtHr = hourly[1].ft - hourly[0].ft;
    }
  }

  // Rising or falling
  const tideDirection = tideRateFtHr > 0.05 ? 'rising' : tideRateFtHr < -0.05 ? 'falling' : 'slack';

  // Water temperature (°F, measured at Tacoma station — closest Puget Sound sensor)
  const wtempData = wtempJson.data?.[0];
  const waterTempF = wtempData ? parseFloat(wtempData.v) : null;

  return { currentFt, tideRateFtHr, tideDirection, hourly, hilos, waterTempF };
}
