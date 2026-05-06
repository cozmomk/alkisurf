import { getFetch } from './fetchGeometry.js';

const G = 9.81; // m/s²

function ktToMps(kt) { return kt / 1.944; }

// SMB significant wave height (fetch-limited)
function smbWaveHeight(windSpeedMps, fetchMeters) {
  if (windSpeedMps < 0.3 || fetchMeters < 200) return 0;
  const gHU2 = 0.0016 * Math.pow((G * fetchMeters) / (windSpeedMps ** 2), 0.5);
  return Math.max(0, gHU2 * (windSpeedMps ** 2) / G);
}

// Seconds for waves to fully develop over given fetch
function fullDevelopmentSeconds(windSpeedMps, fetchMeters) {
  if (windSpeedMps < 0.3) return Infinity;
  return 68.8 * fetchMeters / windSpeedMps;
}

// Labels and colors for glass score value
export function scoreLabel(score) {
  if (score >= 9) return 'GLASS';
  if (score >= 7) return 'LIGHT RIPPLE';
  if (score >= 5) return 'LIGHT CHOP';
  if (score >= 3) return 'CHOPPY';
  if (score >= 1) return 'ROUGH';
  return 'NO GO';
}

export function scoreColor(score) {
  if (score >= 9) return '#00e887';
  if (score >= 7) return '#7dff4f';
  if (score >= 5) return '#ffc300';
  if (score >= 3) return '#ff6b1a';
  return '#ff2b55';
}

/**
 * Compute glass score (0–10) for one side of Alki.
 *
 * @param {object} params
 * @param {number} params.windSpeedKt   - current wind speed in knots
 * @param {number} params.windGustKt    - current gust in knots
 * @param {number} params.windDirDeg    - wind direction in degrees (from)
 * @param {'north'|'south'} params.side
 * @param {Array}  params.windHistory   - [{speedKt, gustKt, dirDeg, ts}] recent hourly obs, oldest first
 * @param {number} params.tideRateFtHr  - tide change rate ft/hr (positive = rising)
 * @returns {object} { score, Hs, label, windEff, fetch }
 */
export function computeGlassScore({ windSpeedKt, windGustKt, windDirDeg, side, windHistory = [], tideRateFtHr = 0 }) {
  const vEffKt = windSpeedKt * 0.65 + windGustKt * 0.35;
  const vEffMps = ktToMps(vEffKt);

  const fetch = getFetch(side, windDirDeg);

  // Fetch-limited Hs for current wind
  const Hs_fetch = smbWaveHeight(vEffMps, fetch);

  // Duration factor — how developed are current waves?
  let durationSeconds = 0;
  const now = Date.now();
  for (const obs of [...windHistory].reverse()) {
    const obsMps = ktToMps(obs.speedKt * 0.65 + (obs.gustKt || obs.speedKt * 1.2) * 0.35);
    const obsAge = (now - obs.ts) / 1000;
    if (obsMps > 0.5 && obsAge < 6 * 3600) {
      durationSeconds += 3600; // each hourly obs represents 1hr of wind
    } else {
      break; // stop at first calm observation working backward
    }
  }
  const tFull = fullDevelopmentSeconds(vEffMps, fetch);
  const devFraction = tFull === Infinity ? 0 : Math.min(1, Math.sqrt(durationSeconds / tFull));
  const Hs_current = Hs_fetch * devFraction;

  // Residual waves — lingering chop from recent wind that has since died
  let Hs_residual = 0;
  for (const obs of windHistory.slice(-8)) {
    const ageMin = (now - obs.ts) / 1000 / 60;
    const obsMps = ktToMps(obs.speedKt);
    const obsFetch = getFetch(side, obs.dirDeg);
    const Hs_past = smbWaveHeight(obsMps, obsFetch);
    const decay = Math.exp(-ageMin / 35); // 35-min decay constant for Puget Sound chop
    Hs_residual = Math.max(Hs_residual, Hs_past * decay);
  }

  // Energy superposition
  let Hs_total = Math.sqrt(Hs_current ** 2 + Hs_residual ** 2);

  // Tidal current penalty — opposing current steepens waves
  if (Math.abs(tideRateFtHr) > 1.5 && vEffKt > 5) {
    Hs_total *= 1.12; // ~12% steeper in strong tidal flow
  }

  // Wind factor: drops sharply above 8kt, zero at 14kt
  const windFactor = Math.max(0, 1 - Math.pow(vEffKt / 14, 1.5));

  // Wave factor: glass threshold 0.08m, no-go at 0.5m (SUP-tuned)
  const waveFactor = Math.max(0, 1 - Hs_total / 0.5);

  const raw = 10 * windFactor * waveFactor;
  const score = Math.round(Math.max(0, Math.min(10, raw)));

  // Wave state for user-facing explanation
  let waveState = 'calm';
  if (vEffKt > 3 && Hs_current > 0.02) {
    if (devFraction < 0.4) waveState = 'building';
    else if (devFraction < 0.85) waveState = 'developing';
    else waveState = 'steady';
  } else if (Hs_residual > 0.03 && Hs_residual > Hs_current) {
    waveState = 'residual';
  }

  return {
    score,
    Hs: Hs_total,
    label: scoreLabel(score),
    windEff: vEffKt,
    fetch,
    waveState,
    windDurHrs: Math.round(durationSeconds / 3600),
    windFactor: Math.round(windFactor * 100) / 100,  // 0.00–1.00
    waveFactor: Math.round(waveFactor * 100) / 100,  // 0.00–1.00
  };
}

/**
 * Find best paddling windows in forecast data.
 * Returns array of {startHour, endHour, side, score, label} blocks.
 */
export function findBestWindows(forecastHours) {
  const windows = [];
  const MIN_SCORE = 7;
  const MIN_DURATION = 2;

  for (const side of ['north', 'south']) {
    let streak = [];
    for (const hour of forecastHours) {
      const entry = hour.sides[side];
      if (entry && entry.score >= MIN_SCORE) {
        streak.push(hour);
      } else {
        if (streak.length >= MIN_DURATION) windows.push(makeWindow(side, streak));
        streak = [];
      }
    }
    if (streak.length >= MIN_DURATION) windows.push(makeWindow(side, streak));
  }

  return windows.sort((a, b) => b.score - a.score || a.start - b.start);
}

function makeWindow(side, streak) {
  const n = streak.length;
  const avg = (fn) => streak.reduce((s, h) => s + fn(h), 0) / n;
  const sideData = (h) => h.sides[side];
  return {
    side,
    start: streak[0].time,
    end: streak[n - 1].time,
    score: Math.round(avg(h => sideData(h).score)),
    label: scoreLabel(Math.round(avg(h => sideData(h).score))),
    airTempF: streak[0].airTempF,
    skyCover: streak[0].skyCover,
    avgWindKt: Math.round(avg(h => h.windSpeedKt || 0)),
    avgWindDir: streak[Math.floor(n / 2)].windDirLabel || '',
    avgFetchKm: parseFloat((avg(h => (sideData(h).fetch || 0) / 1000)).toFixed(1)),
    avgHsFt: parseFloat((avg(h => (sideData(h).Hs || 0) * 3.281)).toFixed(2)),
  };
}
