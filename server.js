import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

import { fetchBuoyData } from './src/fetchers/buoy.js';
import { fetchTideData } from './src/fetchers/tides.js';
import { fetchWeatherForecast } from './src/fetchers/weather.js';
import { fetchMarineData } from './src/fetchers/marine.js';
import { computeGlassScore, findBestWindows } from './src/model/glassScore.js';
import { compassLabel } from './src/model/fetchGeometry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3001;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Persistent data dir — Railway volume at /data, fallback to local
const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '.data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const CONDITIONS_LOG = path.join(DATA_DIR, 'conditions-log.jsonl');
const REPORTS_LOG    = path.join(DATA_DIR, 'reports.jsonl');

function appendJsonl(file, obj) {
  try { fs.appendFileSync(file, JSON.stringify(obj) + '\n'); } catch (e) { console.error('appendJsonl', e.message); }
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// Slim entries older than 30 days: drop derived fields, keep validation essentials
function slimEntry(entry) {
  const { ts, windSpeedKt, windDirDeg, waterTempF } = entry;
  const slim = { ts, windSpeedKt, windDirDeg, waterTempF };
  for (const side of ['north', 'south']) {
    if (entry[side]) slim[side] = { score: entry[side].score };
  }
  return slim;
}

function runRetentionPass() {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = readJsonl(CONDITIONS_LOG);
    const slimmed = rows.map(r => r.ts < cutoff ? slimEntry(r) : r);
    fs.writeFileSync(CONDITIONS_LOG, slimmed.map(r => JSON.stringify(r)).join('\n') + '\n');
    const kb = (fs.statSync(CONDITIONS_LOG).size / 1024).toFixed(1);
    const rkb = fs.existsSync(REPORTS_LOG) ? (fs.statSync(REPORTS_LOG).size / 1024).toFixed(1) : '0';
    console.log(`[retention] conditions: ${kb} KB (${slimmed.length} entries), reports: ${rkb} KB`);
  } catch (e) { console.error('[retention]', e.message); }
}

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

// GET /api/insights — model accuracy from user reports vs predicted scores
app.get('/api/insights', (req, res) => {
  try {
    const reports = readJsonl(REPORTS_LOG);
    if (!reports.length) return res.json({ totalReports: 0, accuracy: null });

    const RATING_SCORE = { glass: 9, ripple: 7, chop: 5, rough: 3, nogo: 0 };
    const buckets = {}; // predicted score bucket → { reported, count }

    for (const r of reports) {
      const north = r.conditions?.scores?.north?.score;
      const south = r.conditions?.scores?.south?.score;
      const predicted = r.side === 'north' ? north : r.side === 'south' ? south : (north != null && south != null ? Math.round((north + south) / 2) : null);
      if (predicted == null || RATING_SCORE[r.rating] == null) continue;
      const bucket = Math.floor(predicted / 2) * 2; // group into 0,2,4,6,8,10
      if (!buckets[bucket]) buckets[bucket] = { predicted: bucket, reported: [], count: 0 };
      buckets[bucket].reported.push(RATING_SCORE[r.rating]);
      buckets[bucket].count++;
    }

    const breakdown = Object.values(buckets).map(b => ({
      predictedBucket: b.predicted,
      avgReported: Math.round(b.reported.reduce((a, v) => a + v, 0) / b.count),
      count: b.count,
    })).sort((a, b) => a.predictedBucket - b.predictedBucket);

    const errors = breakdown.map(b => Math.abs(b.predictedBucket - b.avgReported));
    const mae = errors.length ? (errors.reduce((a, v) => a + v, 0) / errors.length).toFixed(1) : null;

    res.json({ totalReports: reports.length, meanAbsoluteError: mae, breakdown });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/report — user-submitted condition report
app.post('/api/report', (req, res) => {
  const { rating, side, note } = req.body || {};
  if (!rating) return res.status(400).json({ error: 'rating required' });
  const entry = {
    ts: Date.now(),
    rating,           // 'glass' | 'ripple' | 'chop' | 'rough' | 'nogo'
    side: side || 'both',
    note: (note || '').slice(0, 280),
    conditions: cache.data?.current ?? null,
  };
  appendJsonl(REPORTS_LOG, entry);
  res.json({ ok: true });
});

// GET /api/history — last N logged snapshots
app.get('/api/history', (req, res) => {
  try {
    const n = Math.min(parseInt(req.query.n) || 48, 200);
    if (!fs.existsSync(CONDITIONS_LOG)) return res.json([]);
    const lines = fs.readFileSync(CONDITIONS_LOG, 'utf8').trim().split('\n').filter(Boolean);
    const rows = lines.slice(-n).map(l => JSON.parse(l));
    res.json(rows);
  } catch { res.json([]); }
});

// Hourly conditions snapshot
function logConditionsSnapshot() {
  if (!cache.data) return;
  const { updatedAt, current } = cache.data;
  if (!current) return;
  appendJsonl(CONDITIONS_LOG, {
    ts: updatedAt,
    windSpeedKt: current.windSpeedKt,
    windDirDeg: current.windDirDeg,
    waterTempF: current.waterTempF,
    north: current.scores?.north ?? null,
    south: current.scores?.south ?? null,
  });
}
setInterval(logConditionsSnapshot, 60 * 60 * 1000); // every hour

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
  console.log(`[data] storing logs in ${DATA_DIR}`);
  // Run retention on boot, then weekly
  runRetentionPass();
  setInterval(runRetentionPass, 7 * 24 * 60 * 60 * 1000);
});
