import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fetch from 'node-fetch';

import { fetchBuoyData } from './src/fetchers/buoy.js';
import { fetchTideData } from './src/fetchers/tides.js';
import { fetchWeatherForecast } from './src/fetchers/weather.js';
import { fetchMarineData } from './src/fetchers/marine.js';
import { computeGlassScore, findBestWindows } from './src/model/glassScore.js';
import { compassLabel } from './src/model/fetchGeometry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let cache = { data: null, ts: 0 };

async function buildConditions() {
  const [buoy, tides, weatherHours, marineHours] = await Promise.allSettled([
    fetchBuoyData(fetch),
    fetchTideData(fetch),
    fetchWeatherForecast(fetch),
    fetchMarineData(fetch),
  ]);

  const buoyData = buoy.status === 'fulfilled' ? buoy.value : null;
  const tideData = tides.status === 'fulfilled' ? tides.value : null;
  const nwsHours = weatherHours.status === 'fulfilled' ? weatherHours.value : [];
  const marine = marineHours.status === 'fulfilled' ? marineHours.value : [];

  if (buoy.status === 'rejected') console.error('Buoy fetch error:', buoy.reason?.message);
  if (tides.status === 'rejected') console.error('Tides fetch error:', tides.reason?.message);
  if (weatherHours.status === 'rejected') console.error('NWS fetch error:', weatherHours.reason?.message);
  if (marineHours.status === 'rejected') console.error('Marine fetch error:', marineHours.reason?.message);

  const current = buoyData?.current;
  const history = buoyData?.history || [];
  const tideRateFtHr = tideData?.tideRateFtHr || 0;

  // Current glass scores for both sides
  const scoreParams = current ? {
    windSpeedKt: current.speedKt || 0,
    windGustKt: current.gustKt || current.speedKt || 0,
    windDirDeg: current.dirDeg || 0,
    windHistory: history,
    tideRateFtHr,
  } : null;

  const currentScores = scoreParams ? {
    north: computeGlassScore({ ...scoreParams, side: 'north' }),
    south: computeGlassScore({ ...scoreParams, side: 'south' }),
  } : null;

  // Water temp: prefer NOAA measured, fall back to Open-Meteo SST (modeled, °C → °F)
  const now = Date.now();
  const nearestMarineNow = marine.reduce((best, m) =>
    Math.abs(m.ts - now) < Math.abs((best?.ts ?? Infinity) - now) ? m : best, null);
  const sstF = nearestMarineNow?.sstC != null ? nearestMarineNow.sstC * 9/5 + 32 : null;
  const waterTempF = tideData?.waterTempF ?? sstF ?? null;

  // 48hr forecast — merge NWS wind with Open-Meteo marine
  const forecastHours = nwsHours
    .filter(h => h.ts > now && h.ts < now + 49 * 3600 * 1000)
    .map(h => {
      // Find nearest marine data point
      const nearestMarine = marine.reduce((best, m) =>
        Math.abs(m.ts - h.ts) < Math.abs((best?.ts || Infinity) - h.ts) ? m : best, null);

      const sides = {
        north: computeGlassScore({
          windSpeedKt: h.windSpeedKt,
          windGustKt: h.windSpeedKt * 1.3, // NWS doesn't give gusts in hourly
          windDirDeg: h.windDirDeg,
          side: 'north',
          windHistory: [],
          tideRateFtHr: 0,
        }),
        south: computeGlassScore({
          windSpeedKt: h.windSpeedKt,
          windGustKt: h.windSpeedKt * 1.3,
          windDirDeg: h.windDirDeg,
          side: 'south',
          windHistory: [],
          tideRateFtHr: 0,
        }),
      };

      return {
        time: h.ts,
        airTempF: h.airTempF,
        windSpeedKt: h.windSpeedKt,
        windDirDeg: h.windDirDeg,
        windDirLabel: compassLabel(h.windDirDeg),
        skyCover: h.skyCover,
        shortForecast: h.shortForecast,
        waveHeightFt: nearestMarine?.waveHeightM != null ? nearestMarine.waveHeightM * 3.281 : null,
        sides,
      };
    });

  const bestWindows = findBestWindows(forecastHours);

  // Next hi/lo tide events
  const nextHilos = (tideData?.hilos || [])
    .filter(h => h.ts > now)
    .slice(0, 4);

  return {
    updatedAt: now,
    sources: {
      buoy: buoy.status === 'fulfilled',
      tides: tides.status === 'fulfilled',
      nws: weatherHours.status === 'fulfilled',
      marine: marineHours.status === 'fulfilled',
    },
    current: current ? {
      windSpeedKt: current.speedKt,
      windGustKt: current.gustKt,
      windDirDeg: current.dirDeg,
      windDirLabel: compassLabel(current.dirDeg),
      waterTempF,
      airTempF: current.airTempF,
      tideCurrentFt: tideData?.currentFt,
      tideDirection: tideData?.tideDirection,
      tideRateFtHr,
      scores: currentScores,
    } : null,
    forecast: forecastHours,
    bestWindows,
    nextHilos,
  };
}

async function getConditions() {
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }
  const data = await buildConditions();
  cache = { data, ts: Date.now() };
  return data;
}

app.get('/api/conditions', async (req, res) => {
  try {
    const data = await getConditions();
    res.json(data);
  } catch (err) {
    console.error('Conditions error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/refresh', async (req, res) => {
  cache = { data: null, ts: 0 };
  try {
    const data = await getConditions();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webcam proxy — bypasses hotlink protection, caches 30s
let webcamCache = { buf: null, contentType: null, ts: 0 };
app.get('/api/webcam', async (req, res) => {
  try {
    if (webcamCache.buf && Date.now() - webcamCache.ts < 30000) {
      res.set('Content-Type', webcamCache.contentType);
      res.set('Cache-Control', 'public, max-age=30');
      return res.send(webcamCache.buf);
    }
    const img = await fetch('https://www.alkiweather.com/wxalkiwebcam.php', {
      headers: { Referer: 'https://www.alkiweather.com/', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!img.ok) return res.status(502).json({ error: 'Camera unavailable' });
    const contentType = img.headers.get('Content-Type') || 'image/jpeg';
    const buf = Buffer.from(await img.arrayBuffer());
    webcamCache = { buf, contentType, ts: Date.now() };
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=30');
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: 'Camera unavailable' });
  }
});

// Serve built client in production
app.use(express.static(path.join(__dirname, 'client/dist')));
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'client/dist/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(PORT, () => {
  console.log(`alkisurf running on http://localhost:${PORT}`);
});
