// NOAA Tides & Currents
// Station 9447130 (Seattle): water level + predictions
// Station 9446484 (Tacoma): water temperature (Seattle station has no temp sensor)

const BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const STATION = '9447130';
const WTEMP_STATION = '9446484'; // Tacoma — same body of water, has temp sensor

function params(extra) {
  return new URLSearchParams({
    station: STATION,
    datum: 'MLLW',
    time_zone: 'lst_ldt',
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
    time_zone: 'lst_ldt',
    units: 'english',
    application: 'alkisurf',
    format: 'json',
    product: 'water_temperature',
    date: 'latest',
  }).toString();
}

function nowStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}

// Hours needed from midnight-today to cover now + 48h chart window + 4h buffer.
// range starts at midnight, so we add however many hours have already elapsed today.
function rangeHours() {
  const now = new Date();
  const hoursElapsed = now.getHours() + now.getMinutes() / 60;
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

  // Current water level
  const levelData = levelJson.data?.[0];
  const currentFt = levelData ? parseFloat(levelData.v) : null;

  // Hourly predictions for the next 48h
  const hourly = (predJson.predictions || []).map(p => ({
    ts: new Date(p.t).getTime(),
    ft: parseFloat(p.v),
  }));

  // Hi/lo events
  const hilos = (hiloJson.predictions || []).map(p => ({
    ts: new Date(p.t).getTime(),
    ft: parseFloat(p.v),
    type: p.type, // H or L
  }));

  // Tide rate: ft/hr estimated from adjacent predictions
  let tideRateFtHr = 0;
  if (hourly.length >= 2) {
    tideRateFtHr = hourly[1].ft - hourly[0].ft; // ft per hour
  }

  // Rising or falling
  const tideDirection = tideRateFtHr > 0.05 ? 'rising' : tideRateFtHr < -0.05 ? 'falling' : 'slack';

  // Water temperature (°F, measured at Tacoma station — closest Puget Sound sensor)
  const wtempData = wtempJson.data?.[0];
  const waterTempF = wtempData ? parseFloat(wtempData.v) : null;

  return { currentFt, tideRateFtHr, tideDirection, hourly, hilos, waterTempF };
}
