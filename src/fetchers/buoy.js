// NDBC WPOW1 — West Point Lighthouse, Elliott Bay entrance, ~1.5mi from Alki
// Data: wind speed/direction/gusts, air temp (no water temp at this station)
// Format: space-separated text newest-first, MM = missing

const BUOY_URL = 'https://www.ndbc.noaa.gov/data/realtime2/WPOW1.txt';

function parseFloat_(s) {
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

function mpsToKt(mps) { return mps !== null ? mps * 1.944 : null; }
function cToF(c) { return c !== null ? c * 9/5 + 32 : null; }

export async function fetchBuoyData(fetchFn) {
  const res = await fetchFn(BUOY_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Buoy fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');

  // Lines 0-1 are headers, data starts at line 2, newest at bottom
  const dataLines = lines.slice(2).filter(l => l.trim());
  if (dataLines.length === 0) throw new Error('No buoy data');

  const parseRow = (line) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 15) return null;
    const [yr, mo, dy, hr, mn, wdir, wspd, gst, , , , , , atmp, wtmp] = parts;
    const ts = new Date(`${yr}-${mo}-${dy}T${hr}:${mn}:00Z`).getTime();
    if (isNaN(ts)) return null;
    return {
      ts,
      dirDeg: wdir === 'MM' ? null : parseFloat_(wdir),
      speedKt: mpsToKt(wspd === 'MM' ? null : parseFloat_(wspd)),
      gustKt: mpsToKt(gst === 'MM' ? null : parseFloat_(gst)),
      airTempF: cToF(atmp === 'MM' ? null : parseFloat_(atmp)),
      waterTempF: cToF(wtmp === 'MM' ? null : parseFloat_(wtmp)),
    };
  };

  const all = dataLines.map(parseRow).filter(Boolean);
  if (all.length === 0) throw new Error('Failed to parse buoy data');

  // File is newest-first — most recent is all[0]
  const current = all.find(r => r.speedKt !== null && r.dirDeg !== null);

  // Last 8 hours of hourly obs for wind history (for glass score duration calc)
  const eightHoursAgo = Date.now() - 8 * 3600 * 1000;
  const history = [...all]
    .reverse()
    .filter(r => r.ts >= eightHoursAgo && r.speedKt !== null)
    .slice(0, 10);

  // Last 24h deduplicated to one obs per hour — for forecast vs actual comparison
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const hourlyMap = new Map();
  for (const r of all) {
    if (r.ts < dayAgo || r.speedKt === null || r.dirDeg === null) continue;
    const hourKey = Math.floor(r.ts / 3600000); // truncate to hour
    if (!hourlyMap.has(hourKey)) hourlyMap.set(hourKey, r); // file is newest-first, keep first = most recent in hour
  }
  const recentHourly = [...hourlyMap.values()].sort((a, b) => a.ts - b.ts);

  return { current, history, recentHourly };
}
