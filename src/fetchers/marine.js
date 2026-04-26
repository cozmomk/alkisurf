// Open-Meteo Marine API — wave forecasts for Alki (~47.58°N, 122.42°W)
// Free, no auth, 5km resolution, 16-day forecast

const BASE = 'https://marine-api.open-meteo.com/v1/marine';
const LAT = 47.58;
const LON = -122.42;

const VARS = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wind_wave_height',
  'wind_wave_direction',
  'sea_surface_temperature',
].join(',');

export async function fetchMarineData(fetchFn) {
  const url = `${BASE}?latitude=${LAT}&longitude=${LON}&hourly=${VARS}&timezone=UTC&forecast_days=3`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Open-Meteo marine failed: ${res.status}`);
  const json = await res.json();

  const h = json.hourly;
  if (!h || !h.time) return [];

  return h.time.map((t, i) => ({
    ts: new Date(t + 'Z').getTime(),
    waveHeightM: h.wave_height?.[i] ?? null,
    waveDirDeg: h.wave_direction?.[i] ?? null,
    wavePeriodS: h.wave_period?.[i] ?? null,
    windWaveHeightM: h.wind_wave_height?.[i] ?? null,
    windWaveDirDeg: h.wind_wave_direction?.[i] ?? null,
    sstC: h.sea_surface_temperature?.[i] ?? null,
  }));
}
