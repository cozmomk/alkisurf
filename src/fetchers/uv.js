// Open-Meteo land forecast — UV index for Alki (47.58°N, 122.42°W)
const BASE = 'https://api.open-meteo.com/v1/forecast';
const LAT = 47.58;
const LON = -122.42;

export async function fetchUVData(fetchFn) {
  const url = `${BASE}?latitude=${LAT}&longitude=${LON}&hourly=uv_index&timezone=America%2FLos_Angeles&forecast_days=3`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Open-Meteo UV failed: ${res.status}`);
  const json = await res.json();
  const h = json.hourly;
  if (!h?.time) return [];
  return h.time.map((t, i) => ({
    ts: new Date(t).getTime(),
    uvIndex: h.uv_index?.[i] ?? null,
  }));
}
