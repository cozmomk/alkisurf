// Open-Meteo — daily sunrise/sunset for Alki Beach (47.58°N, 122.42°W)
// Free, no auth. Returns UTC timestamps so the client can format in any TZ.
const BASE = 'https://api.open-meteo.com/v1/forecast';
const LAT  = 47.58;
const LON  = -122.42;

export async function fetchSunTimes(fetchFn) {
  const url = `${BASE}?latitude=${LAT}&longitude=${LON}&daily=sunrise,sunset&timezone=UTC&forecast_days=4`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Open-Meteo sun failed: ${res.status}`);
  const json = await res.json();
  const d = json.daily;
  if (!d?.time) return [];
  // Open-Meteo returns times like "2024-07-15T12:30" in the requested timezone (UTC here).
  // Appending 'Z' makes them unambiguous epoch milliseconds.
  return d.time.map((dateStr, i) => ({
    date:      dateStr,
    sunriseTs: d.sunrise?.[i] ? new Date(d.sunrise[i] + 'Z').getTime() : null,
    sunsetTs:  d.sunset?.[i]  ? new Date(d.sunset[i]  + 'Z').getTime() : null,
  }));
}
