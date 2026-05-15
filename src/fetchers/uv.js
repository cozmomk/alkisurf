// Open-Meteo land forecast — UV index + cloud cover for Alki (47.58°N, 122.42°W)
// cloud_cover is fetched from the same model so UV and sky context are always consistent.
const BASE = 'https://api.open-meteo.com/v1/forecast';
const LAT = 47.58;
const LON = -122.42;

export async function fetchUVData(fetchFn) {
  const url = `${BASE}?latitude=${LAT}&longitude=${LON}&hourly=uv_index,precipitation,cloud_cover,wind_gusts_10m,weather_code&wind_speed_unit=ms&timezone=UTC&forecast_days=3`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Open-Meteo UV failed: ${res.status}`);
  const json = await res.json();
  const h = json.hourly;
  if (!h?.time) return [];
  return h.time.map((t, i) => ({
    ts: new Date(t + 'Z').getTime(),
    uvIndex: h.uv_index?.[i] ?? null,
    precipMmHr: h.precipitation?.[i] ?? null,       // mm/hr
    cloudCoverPct: h.cloud_cover?.[i] ?? null,       // 0–100 %, same model as uv_index
    windGustKt: h.wind_gusts_10m?.[i] != null        // m/s → kt
      ? Math.round(h.wind_gusts_10m[i] * 1.944)
      : null,
    // WMO weather code: 95–99 = thunderstorm, 80–82 = showers, 61–67 = rain, etc.
    // Separates thunder from rain independently of precipProbability.
    weatherCode: h.weather_code?.[i] ?? null,
  }));
}
