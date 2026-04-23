// NWS api.weather.gov — hourly forecast for Alki Point
// Alki Point coords: 47.5775, -122.4170

const POINTS_URL = 'https://api.weather.gov/points/47.5775,-122.4170';
const HEADERS = { 'User-Agent': 'alkisurf/1.0 (kmkramer@gmail.com)' };

let cachedForecastUrl = null;

export async function fetchWeatherForecast(fetchFn) {
  // Fetch grid endpoint once and cache the forecast URL
  if (!cachedForecastUrl) {
    const res = await fetchFn(POINTS_URL, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`NWS points failed: ${res.status}`);
    const json = await res.json();
    cachedForecastUrl = json.properties?.forecastHourly;
    if (!cachedForecastUrl) throw new Error('No hourly forecast URL from NWS');
  }

  const res = await fetchFn(cachedForecastUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    cachedForecastUrl = null; // reset on error
    throw new Error(`NWS hourly forecast failed: ${res.status}`);
  }
  const json = await res.json();

  return (json.properties?.periods || []).map(p => ({
    ts: new Date(p.startTime).getTime(),
    airTempF: p.temperature, // already in °F
    windSpeedKt: parseWindSpeed(p.windSpeed),
    windDirDeg: compassToDeg(p.windDirection),
    shortForecast: p.shortForecast,
    skyCover: estimateSkyCover(p.shortForecast),
  }));
}

function parseWindSpeed(str) {
  // "10 to 15 mph" → take higher end, convert to kt
  if (!str) return 0;
  const nums = str.match(/\d+/g);
  if (!nums) return 0;
  const mph = parseInt(nums[nums.length - 1]);
  return Math.round(mph * 0.868976);
}

function compassToDeg(dir) {
  const map = { N:0, NNE:22.5, NE:45, ENE:67.5, E:90, ESE:112.5, SE:135, SSE:157.5,
    S:180, SSW:202.5, SW:225, WSW:247.5, W:270, WNW:292.5, NW:315, NNW:337.5 };
  return map[dir] ?? 0;
}

function estimateSkyCover(forecast) {
  if (!forecast) return 50;
  const f = forecast.toLowerCase();
  if (f.includes('sunny') || f.includes('clear')) return 5;
  if (f.includes('mostly sunny') || f.includes('mostly clear')) return 20;
  if (f.includes('partly sunny') || f.includes('partly cloudy')) return 45;
  if (f.includes('mostly cloudy')) return 70;
  if (f.includes('cloudy') || f.includes('overcast')) return 90;
  if (f.includes('rain') || f.includes('shower') || f.includes('drizzle')) return 95;
  return 50;
}
