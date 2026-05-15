import { useEffect, useRef } from 'react';
import { uvLabel } from '../utils.js';

// ─── scene constants ──────────────────────────────────────────────────────────
const CW = 540, CH = 270, CX = 250, BOARD_Y = 225, DRAW_H = 125;
const WAVE_FREQ = 0.015, TIDE_RANGE = 22;
const CROP_PAD_TOP = 28, CROP_PAD_LEFT = 12, CROP_PAD_RIGHT = 2, CROP_PAD_BOTTOM = 12;
const BOARD_SINK = 14;
const GRID_COLS = 5;

// score → column in paddler-sprites.png (row 0 = normal, row 1 = alternate)
const POSE_COLS = [0, 1, 2, 3, 4];
// Alternate pose timing: every ALT_PERIOD seconds, show row-1 for ALT_DURATION seconds
const ALT_PERIOD   = 45;  // total cycle length (seconds)
const ALT_DURATION = 5;   // how long the alternate pose is shown each cycle
// Aligned with scoreColor() in utils.js: 0-2=red, 3-4=orange, 5-6=yellow, 7-8=lime, 9-10=green
const COLORS = ['#ff2b55','#ff2b55','#ff2b55','#ff6b1a','#ff6b1a','#ffc300','#ffc300','#7dff4f','#7dff4f','#00e887','#00e887'];

function poseOf(s)     { return s>=9?4:s>=7?3:s>=5?2:s>=3?1:0; }
function scoreToHs(s)  { return [.60,.52,.44,.34,.26,.20,.14,.09,.05,.03,.02][Math.round(s)]; }
function hexRgb(h)     { return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }

// ─── sprite singleton ─────────────────────────────────────────────────────────
let _spriteImg    = null;
let _spriteLoaded = false;
let _figureCrops  = null;
const _spriteCache   = {};
const _tmpCanvas     = document.createElement('canvas');
const _tmpCtx        = _tmpCanvas.getContext('2d', { willReadFrequently: true });
const _pendingReady  = [];
let   _loadStarted   = false;

function ensureSprite(cb) {
  if (_spriteLoaded) { cb(); return; }
  _pendingReady.push(cb);
  if (_loadStarted) return;
  _loadStarted = true;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    _spriteImg = img; _spriteLoaded = true;
    _detectFigureCrops();
    _pendingReady.splice(0).forEach(fn => fn());
  };
  img.onerror = () => { _loadStarted = false; _pendingReady.splice(0); };
  img.src = '/paddler-sprites.png';
}

function _detectFigureCrops() {
  const img = _spriteImg;
  const W = img.naturalWidth, H = img.naturalHeight;
  const dc = document.createElement('canvas');
  dc.width = W; dc.height = H;
  const dctx = dc.getContext('2d', { willReadFrequently: true });
  dctx.drawImage(img, 0, 0);

  function scanRow(y) {
    const row = dctx.getImageData(0, y, W, 1).data;
    const spans = []; let s = -1;
    for (let x = 0; x < W; x++) {
      const a = row[x*4+3];
      if (a > 10 && s === -1) s = x;
      if (a <= 10 && s !== -1) { spans.push([s, x-1]); s = -1; }
    }
    if (s !== -1) spans.push([s, W-1]);
    const m = [];
    for (const sp of spans) {
      if (m.length && sp[0] - m[m.length-1][1] <= 60) m[m.length-1][1] = sp[1];
      else m.push([...sp]);
    }
    return m;
  }

  let bestGroups = [], bestDiff = Infinity;
  for (let y = Math.round(0.55*H); y <= Math.round(0.82*H); y += 4) {
    const g = scanRow(y);
    const diff = Math.abs(g.length - GRID_COLS);
    if (g.length > 0 && (diff < bestDiff || (diff === bestDiff && g.length > bestGroups.length))) {
      bestGroups = g; bestDiff = diff;
    }
    if (bestDiff === 0) break;
  }
  if (bestGroups.length === 0) return;

  const n = bestGroups.length;
  const zoneBounds = [0];
  for (let i = 0; i < n - 1; i++)
    zoneBounds.push(Math.round((bestGroups[i][1] + bestGroups[i+1][0]) / 2));
  zoneBounds.push(W);

  const fullData = dctx.getImageData(0, 0, W, H).data;

  const rowBoundaries = []; let globalYMin = H, globalYMax = 0;
  for (let i = 0; i < n; i++) {
    const midX = Math.round((bestGroups[i][0] + bestGroups[i][1]) / 2);
    let colYMin = -1, colYMax = 0, gapStart = -1, gapMid = -1, inFig = false;
    for (let y = 0; y < H; y++) {
      const a = fullData[(y * W + midX) * 4 + 3] > 10;
      if (a && colYMin === -1) colYMin = y;
      if (a) colYMax = y;
      if (inFig && !a) gapStart = y;
      if (!inFig && a && gapStart !== -1 && y - gapStart > 20) { gapMid = Math.round((gapStart + y) / 2); gapStart = -1; }
      inFig = a;
    }
    if (colYMin !== -1) { if (colYMin < globalYMin) globalYMin = colYMin; if (colYMax > globalYMax) globalYMax = colYMax; }
    if (gapMid !== -1) rowBoundaries.push(gapMid);
  }
  const hasRows  = rowBoundaries.length > 0;
  const rowSplit = hasRows ? rowBoundaries.sort((a,b)=>a-b)[Math.floor(rowBoundaries.length/2)] : null;
  const yRanges  = hasRows ? [[globalYMin, rowSplit],[rowSplit, globalYMax]] : [[globalYMin, globalYMax]];

  _figureCrops = [[], []];
  for (let i = 0; i < n; i++) {
    const xL = zoneBounds[i], xR = zoneBounds[i+1];
    yRanges.forEach(([y0, y1], rowIdx) => {
      let xMin = W, xMax = 0, yMin = H, yMax = 0;
      const y0c = Math.max(0, y0), y1c = Math.min(H, y1);
      for (let y = y0c; y < y1c; y++)
        for (let x = xL; x < xR; x++)
          if (fullData[(y*W+x)*4+3] > 10) {
            if (x < xMin) xMin = x; if (x > xMax) xMax = x;
            if (y < yMin) yMin = y; if (y > yMax) yMax = y;
          }

      if (xMax >= xMin) {
        const MIN_COL = 10;
        for (let x = xMax; x > xMin; x--) {
          let k = 0;
          for (let y = y0c; y < y1c; y++) if (fullData[(y*W+x)*4+3] > 10 && ++k >= MIN_COL) break;
          if (k >= MIN_COL) { xMax = x; break; }
        }
        for (let x = xMin; x < xMax; x++) {
          let k = 0;
          for (let y = y0c; y < y1c; y++) if (fullData[(y*W+x)*4+3] > 10 && ++k >= MIN_COL) break;
          if (k >= MIN_COL) { xMin = x; break; }
        }
        let yMinF = H, yMaxF = 0;
        for (let y = y0c; y < y1c; y++)
          for (let x = xMin; x <= xMax; x++)
            if (fullData[(y*W+x)*4+3] > 10) { if (y < yMinF) yMinF = y; if (y > yMaxF) yMaxF = y; }
        if (yMaxF >= yMinF) { yMin = yMinF; yMax = yMaxF; }

        const sx = Math.max(0, xMin - CROP_PAD_LEFT);
        const sy = Math.max(0, yMin - CROP_PAD_TOP);
        _figureCrops[rowIdx].push({ sx, sy,
          sw: Math.min(xR, xMax + CROP_PAD_RIGHT) - sx,
          sh: Math.min(H,  yMax + CROP_PAD_BOTTOM) - sy,
        });
      } else {
        _figureCrops[rowIdx].push({ sx: xL, sy: y0, sw: xR - xL, sh: y1 - y0 });
      }
    });
    if (!hasRows) _figureCrops[1].push(_figureCrops[0][i]);
  }
}

function _getCropRect(col, row) {
  if (_figureCrops?.[row]?.[col]) return _figureCrops[row][col];
  const colW = _spriteImg.naturalWidth  / GRID_COLS;
  const rowH = _spriteImg.naturalHeight / 2;
  return { sx: col * colW, sy: row * rowH, sw: colW, sh: rowH };
}

function _colorizeSprite(col, row, hexColor) {
  const key = `${col},${row},${hexColor}`;
  if (_spriteCache[key]) return _spriteCache[key];
  const { sx, sy, sw, sh } = _getCropRect(col, row);
  _tmpCanvas.width = sw; _tmpCanvas.height = sh;
  _tmpCtx.clearRect(0, 0, sw, sh);
  _tmpCtx.drawImage(_spriteImg, sx, sy, sw, sh, 0, 0, sw, sh);
  const id = _tmpCtx.getImageData(0, 0, sw, sh);
  const d  = id.data;
  const [r, g, b] = hexRgb(hexColor);
  for (let i = 0; i < d.length; i += 4) {
    const brightness = (d[i] + d[i+1] + d[i+2]) / 3;
    const srcAlpha   = d[i+3] / 255;
    d[i] = r; d[i+1] = g; d[i+2] = b;
    d[i+3] = Math.max(0, Math.round((255 - brightness) * srcAlpha));
  }
  _tmpCtx.putImageData(id, 0, 0);
  const out = document.createElement('canvas');
  out.width = sw; out.height = sh;
  out.getContext('2d').drawImage(_tmpCanvas, 0, 0);
  const result = { canvas: out, w: sw, h: sh };
  _spriteCache[key] = result;
  return result;
}

// ─── wave / tide helpers ──────────────────────────────────────────────────────
function wy(x, ph1, ph2, ph3, waveAmp, tideOffset) {
  const p2 = waveAmp * (Math.sin(x*WAVE_FREQ+ph1) - .22*Math.sin(2*x*WAVE_FREQ+2*ph1));
  const s2 = waveAmp * .30 * Math.sin(x*WAVE_FREQ*1.63+ph2);
  const t2 = waveAmp * .13 * Math.sin(x*WAVE_FREQ*2.71+ph3);
  const gv = .78 + .22 * Math.sin(x*WAVE_FREQ*.28+ph1*.11);
  return BOARD_Y + tideOffset + gv*(p2+s2+t2);
}

function drawTideGauge(ctx, color, tideLevel) {
  const [r, g, b] = hexRgb(color);
  const gx = CW - 18, gy = 14, gw = 8, gh = CH - 28;
  const fill = gh * tideLevel;

  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 4); ctx.fill();

  const gg = ctx.createLinearGradient(0, gy + gh, 0, gy);
  gg.addColorStop(0, `rgba(${r},${g},${b},.12)`);
  gg.addColorStop(1, `rgba(${r},${g},${b},.55)`);
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.roundRect(gx, gy + gh - fill, gw, fill, [0,0,4,4]); ctx.fill();

  const ly = gy + gh - fill;
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = .9;
  ctx.beginPath(); ctx.moveTo(gx - 2, ly); ctx.lineTo(gx + gw + 2, ly); ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.font = '600 7px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(${r},${g},${b},.7)`;  ctx.fillText('HT', gx + gw/2, gy - 3);
  ctx.fillStyle = 'rgba(200,223,240,.3)';       ctx.fillText('LT', gx + gw/2, gy + gh + 9);
  ctx.fillStyle = `rgba(${r},${g},${b},.85)`;
  ctx.font = '700 8px system-ui';
  ctx.fillText(Math.round(tideLevel * 100) + '%', gx + gw/2, ly - 4);
  ctx.textAlign = 'left';
}

// ─── moon phase ───────────────────────────────────────────────────────────────
function moonPhase(date = new Date()) {
  const ref = new Date('2000-01-06T18:14:00Z');
  const days = (date - ref) / 86400000;
  return ((days % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853;
}

// ─── sky draw helpers ─────────────────────────────────────────────────────────
function drawSun(ctx, x, y, r, t) {
  const pulse = 1 + .04 * Math.sin(t * .8);
  const glow = ctx.createRadialGradient(x, y, r * .3, x, y, r * 3.5);
  glow.addColorStop(0, 'rgba(255,220,80,.25)');
  glow.addColorStop(.5, 'rgba(255,180,40,.08)');
  glow.addColorStop(1, 'rgba(255,130,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, r * 3.5 * pulse, 0, Math.PI * 2); ctx.fill();

  ctx.save(); ctx.translate(x, y); ctx.rotate(t * .3);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = (i % 2 === 0 ? 1.6 : 1.2) * r;
    ctx.strokeStyle = `rgba(255,220,80,${.45 * (1 + .1 * Math.sin(t * 1.2 + i))})`;
    ctx.lineWidth = i % 2 === 0 ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3));
    ctx.lineTo(Math.cos(a) * (r + 3 + len), Math.sin(a) * (r + 3 + len));
    ctx.stroke();
  }
  ctx.restore();

  const core = ctx.createRadialGradient(x - r * .25, y - r * .2, 0, x, y, r);
  core.addColorStop(0, '#fff9d0'); core.addColorStop(.5, '#ffe566'); core.addColorStop(1, '#ffb020');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI * 2); ctx.fill();
}

function drawCloud(ctx, cx, cy, scale, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = '#d8e8f4';
  const puffs = [[0,0,28],[-26,10,22],[26,10,22],[-14,16,18],[14,16,18],[0,20,20]];
  ctx.beginPath();
  for (const [ox, oy, r] of puffs) {
    ctx.moveTo(cx + ox * scale + r * scale, cy + oy * scale);
    ctx.arc(cx + ox * scale, cy + oy * scale, r * scale, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

function drawStars(ctx, stars, t) {
  for (const s of stars) {
    const a = s.base * (.55 + .45 * Math.sin(t * s.tw + s.ph));
    ctx.fillStyle = `rgba(215,230,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMoon(ctx, x, y, r, phase, t) {
  void t;
  const glow = ctx.createRadialGradient(x, y, r * .2, x, y, r * 2.6);
  glow.addColorStop(0, 'rgba(215,225,255,.20)');
  glow.addColorStop(1, 'rgba(180,200,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();

  ctx.fillStyle = '#09141f';
  ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);

  if (phase < 0.02 || phase > 0.98) { ctx.restore(); return; }

  ctx.fillStyle = '#dde7ff';
  ctx.beginPath();
  const K = 0.5523;
  const waxing = phase < 0.5;
  const xscale = waxing
    ? Math.cos(Math.PI * 2 * phase)
    : -Math.cos(Math.PI * 2 * phase);

  if (waxing) {
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
    const cpx = x + xscale * r * K;
    ctx.bezierCurveTo(cpx, y + r, cpx, y - r, x, y - r);
  } else {
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, true);
    const cpx = x + xscale * r * K;
    ctx.bezierCurveTo(cpx, y + r, cpx, y - r, x, y - r);
  }
  ctx.fill();

  ctx.globalAlpha = .18;
  ctx.fillStyle = '#8898bb';
  for (const [ox, oy, cr] of [[-.25, -.3, .12], [.3, .1, .09], [-.1, .35, .07]]) {
    ctx.beginPath(); ctx.arc(x + ox * r, y + oy * r, cr * r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawRainLines(ctx, drops, t, speed = 1, heavy = false, leanX = -1, speedMult = 1, alphaScale = 1, lenScale = 1) {
  for (const d of drops) {
    const y = ((d.y + t * d.speed * speed * speedMult) % BOARD_Y + BOARD_Y) % BOARD_Y;
    const x = d.x + Math.sin(t * .45) * 5;
    const baseA = heavy ? .3 + .2 * Math.sin(d.phase + t) : .45;
    const a = Math.min(1, baseA * alphaScale);
    ctx.strokeStyle = `rgba(150,195,235,${a})`;
    ctx.lineWidth = heavy && d.heavy ? 1.4 : .85;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + leanX * lenScale, y + d.len * lenScale); ctx.stroke();
  }
}

function drawSnow(ctx, drops, t, windLeanX = 0) {
  for (const d of drops) {
    const y = ((d.y + t * d.speed) % BOARD_Y + BOARD_Y) % BOARD_Y;
    const x = d.x + Math.sin(t * 0.7 + d.phase) * d.flutter + windLeanX * 6;
    ctx.fillStyle = 'rgba(220,235,255,0.72)';
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLightning(ctx, bolt, t) {
  if (!bolt.active || bolt.startT === null) return;
  const age = t - bolt.startT;
  if (age > bolt.dur) { bolt.active = false; return; }
  const a = age < .08 ? age / .08 : Math.max(0, 1 - (age - .08) / (bolt.dur - .08));
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,220,${a * .9})`;
  ctx.shadowColor = 'rgba(200,220,255,.85)'; ctx.shadowBlur = 14;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let bx = bolt.x, by = 8;
  for (const [dx, dy] of bolt.segs) {
    ctx.moveTo(bx, by); bx += dx; by += dy; ctx.lineTo(bx, by);
  }
  ctx.stroke(); ctx.restore();
  if (a > .02) {
    ctx.fillStyle = `rgba(200,220,255,${a * .08})`;
    ctx.fillRect(0, 0, CW, BOARD_Y);
  }
}

function makeBolt() {
  const x = 60 + Math.random() * (CW - 120);
  const segs = []; let cy = 8;
  while (cy < BOARD_Y - 20) {
    const dy = 18 + Math.random() * 22, dx = (Math.random() - .5) * 38;
    segs.push([dx, dy]); cy += dy;
  }
  return { active: false, x, segs, startT: null, dur: .22 + Math.random() * .18 };
}

// ─── sky palettes ─────────────────────────────────────────────────────────────
const SKY_TOPS = { sunny: '#0d2035', partly: '#0d1e30', overcast: '#0c1925', rain: '#09141f', storm: '#060e12', night: '#04090f', snow: '#0b1520' };
const SKY_BOTS = { sunny: '#0e3550', partly: '#0e2d44', overcast: '#0d2030', rain: '#0a1c2a', storm: '#07141a', night: '#060d18', snow: '#0d1e2e' };

// ─── sky condition helper ─────────────────────────────────────────────────────
function isNightNow(sunriseTs, sunsetTs) {
  const now = Date.now();
  if (sunriseTs && sunsetTs) return now < sunriseTs || now > sunsetTs;
  // Fallback when no astronomical data: static window
  const hour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }));
  return hour >= 20 || hour < 6;
}

export function skyFromData(windSpeedKt, skyCover, shortForecast, precipProbability, airTempF, sunriseTs, sunsetTs, weatherCode) {
  if (isNightNow(sunriseTs, sunsetTs)) return 'night';
  const forecastText = (shortForecast || '').toLowerCase();
  // God Mode can force night by setting shortForecast to exactly "Night"
  if (forecastText === 'night') return 'night';
  const isRaining = /rain|shower|drizzle/.test(forecastText) || (precipProbability != null && precipProbability > 50);
  const isSnowing = /snow|flurr|blizzard|sleet|wintry/.test(forecastText)
    || (airTempF != null && airTempF < 34 && isRaining);

  // Thunder detection — two independent signals, either is sufficient:
  // 1. Open-Meteo WMO weather code 95–99 = thunderstorm (separate from rain probability)
  //    95: slight/moderate, 96: with slight hail, 99: with heavy hail
  // 2. NWS shortForecast text logic (when weatherCode unavailable):
  //    - Low-probability qualifiers ("Chance", "Slight Chance", "Isolated") → require precipProbability > 50%
  //      because NWS precipProbability bundles rain + thunder and can't separate them
  //    - Definitive text ("Thunderstorms", "Thunderstorms Likely") → show storm regardless of precipProbability
  //      because the forecaster is committing to the event, not hedging
  const thunderByCode = weatherCode != null && weatherCode >= 95;
  const hasThunderText = /thunder/.test(forecastText);
  const hasLowProbQualifier = /chance|slight|isolated/.test(forecastText); // NWS hedging words
  const thunderByText = hasThunderText && (
    hasLowProbQualifier
      ? (precipProbability != null && precipProbability > 50) // gated: prob must be high
      : true                                                  // definitive forecast: always storm
  );
  const isThunder = thunderByCode || thunderByText;

  if (isThunder) return 'storm';
  if (isSnowing) return 'snow';
  if (skyCover == null) return isRaining ? 'rain' : 'sunny';
  if (skyCover <= 15) return 'sunny';
  if (skyCover <= 35) return isRaining ? 'rain' : 'partly';
  if (skyCover <= 70) return isRaining ? 'rain' : 'overcast';
  return isRaining ? 'rain' : 'overcast';
}

const SKY_LABELS = { sunny: 'Sunny', partly: 'Partly cloudy', overcast: 'Overcast', rain: 'Rain', storm: 'Storm', night: 'Night', snow: 'Snowing' };

function realTidePct(currentFt, hilos) {
  if (currentFt == null || !hilos?.length) return null;
  const now = Date.now();
  // Find the hi-lo events bracketing now: most-recent past + soonest future
  const past   = [...hilos].filter(h => h.ts <= now).sort((a, b) => b.ts - a.ts)[0]; // last past
  const future = [...hilos].filter(h => h.ts > now).sort((a, b) => a.ts - b.ts)[0];  // next future
  if (!past || !future) return null;
  const range = Math.abs(future.ft - past.ft);
  if (range <= 0) return null;
  // Linear interpolation: 0 at the lower bound, 1 at the upper bound
  const lo = Math.min(past.ft, future.ft);
  const hi = Math.max(past.ft, future.ft);
  return Math.max(0, Math.min(1, (currentFt - lo) / (hi - lo)));
}

// ─── cloud scroll helper ──────────────────────────────────────────────────────
function cloudX(ox, spd, t) {
  return ((ox + t * spd) % (CW + 200) + CW + 200) % (CW + 200) - 100;
}

// ─── component ────────────────────────────────────────────────────────────────
const SKY_CYCLE = ['sunny', 'partly', 'overcast', 'rain', 'storm', 'snow', 'night'];

export default function ConditionsSprite({ score, windSpeedKt = 0, windDirDeg = 0, windDirLabel = null, windGustKt = null, skyCover = null, shortForecast = null, precipProbability = null, weatherCode = null, uvIndex = null, precipInPerHr = null, waterTempF = null, tideCurrentFt = null, nextHilos = null, airTempF = null, sunriseTs = null, sunsetTs = null, godMode = false, onTripleTap = null }) {
  const canvasRef    = useRef(null);
  const scoreRef     = useRef(score ?? 0);
  const windRef      = useRef(windSpeedKt ?? 0);
  const windDirRef   = useRef(windDirDeg ?? 0);
  const skyRef       = useRef({ skyCover, shortForecast, precipProbability, weatherCode, airTempF, sunriseTs, sunsetTs });
  const tideRef      = useRef({ tideCurrentFt, nextHilos });
  const overlayRef   = useRef({ windDirLabel, windGustKt, uvIndex, precipInPerHr, waterTempF });
  const rafRef       = useRef(null);

  useEffect(() => { scoreRef.current = score ?? 0; }, [score]);
  useEffect(() => { windRef.current = windSpeedKt ?? 0; }, [windSpeedKt]);
  useEffect(() => { windDirRef.current = windDirDeg ?? 0; }, [windDirDeg]);
  useEffect(() => { skyRef.current = { skyCover, shortForecast, precipProbability, weatherCode, airTempF, sunriseTs, sunsetTs }; }, [skyCover, shortForecast, precipProbability, weatherCode, airTempF, sunriseTs, sunsetTs]);
  useEffect(() => { tideRef.current = { tideCurrentFt, nextHilos }; }, [tideCurrentFt, nextHilos]);
  useEffect(() => { overlayRef.current = { windDirLabel, windGustKt, uvIndex, precipInPerHr, waterTempF }; }, [windDirLabel, windGustKt, uvIndex, precipInPerHr, waterTempF]);

  // ── God Mode state ────────────────���───────────────────────────────────────
  const godModeRef  = useRef(false);
  const godStateRef = useRef(null); // { skyKey, score, paddlerX, windKt, wobbleTs, boltTs, activatedAt }

  // Snapshot live values when god mode activates
  useEffect(() => {
    const wasActive = godModeRef.current;
    godModeRef.current = !!godMode;
    if (!wasActive && godMode) {
      const { skyCover: sc, shortForecast: sf, precipProbability: pp, weatherCode: wc, airTempF: atf } = skyRef.current;
      godStateRef.current = {
        skyKey:      skyFromData(windRef.current, sc, sf, pp, atf, undefined, undefined, wc),
        score:       scoreRef.current,
        paddlerX:    CX,
        windKt:      windRef.current,
        wobbleTs:    null,
        boltTs:      null,
        activatedAt: Date.now(),
      };
    }
  }, [godMode]);

  // Pointer interactions — attached only while god mode is active
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!godMode || !canvas) return;

    function canvasCoords(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (CW / rect.width),
        y: (clientY - rect.top)  * (CH / rect.height),
      };
    }

    const gesture = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, mode: null, moved: false };
    let lastTapMs = 0;

    function onDown(e) {
      e.preventDefault();
      const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const { x, y } = canvasCoords(cx, cy);
      const gs = godStateRef.current;
      if (!gs) return;
      const nearPaddler = Math.abs(x - gs.paddlerX) < 55 && y > BOARD_Y - 75;
      const inSky       = y < BOARD_Y - 50;
      gesture.active = true;
      gesture.startX = gesture.lastX = x;
      gesture.startY = gesture.lastY = y;
      gesture.moved  = false;
      gesture.mode   = nearPaddler ? 'paddler' : inSky ? 'sky' : 'wave';
      canvas.setPointerCapture?.(e.pointerId);
    }

    function onMove(e) {
      if (!gesture.active) return;
      e.preventDefault();
      const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const { x, y } = canvasCoords(cx, cy);
      const dx = x - gesture.lastX;
      const dy = y - gesture.lastY;
      const gs = godStateRef.current;
      if (!gs) return;

      if (gesture.mode === 'paddler') {
        gs.paddlerX = Math.max(40, Math.min(CW - 40, gs.paddlerX + dx));
      } else if (gesture.mode === 'wave') {
        // drag up = more chop (lower score), drag down = glassier (higher score)
        gs.score = Math.max(0, Math.min(10, gs.score - dy * 0.055));
      } else if (gesture.mode === 'sky') {
        // horizontal drag = wind speed
        gs.windKt = Math.max(0, Math.min(30, gs.windKt + dx * 0.07));
      }

      gesture.lastX = x;
      gesture.lastY = y;
      if (Math.abs(x - gesture.startX) > 8 || Math.abs(y - gesture.startY) > 8) gesture.moved = true;
    }

    function onUp(e) {
      if (!gesture.active) return;
      gesture.active = false;
      if (gesture.moved) return; // drag, not tap

      const cx = e.clientX ?? e.changedTouches?.[0]?.clientX ?? gesture.startX;
      const cy = e.clientY ?? e.changedTouches?.[0]?.clientY ?? gesture.startY;
      // Recalculate using stored start if clientX isn't available
      const { x, y } = canvasCoords(cx, cy);

      const gs = godStateRef.current;
      if (!gs) return;

      const now = Date.now();
      const nearPaddler = Math.abs(x - gs.paddlerX) < 55 && y > BOARD_Y - 75;
      const inSky       = y < BOARD_Y - 50;

      if (nearPaddler) {
        gs.wobbleTs = now;
      } else if (inSky) {
        if (now - lastTapMs < 380) {
          // Double-tap → lightning bolt
          gs.boltTs  = now;
          lastTapMs  = 0;
        } else {
          // Single tap → cycle sky
          const idx  = SKY_CYCLE.indexOf(gs.skyKey);
          gs.skyKey  = SKY_CYCLE[(idx + 1) % SKY_CYCLE.length];
          lastTapMs  = now;
        }
      }
    }

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup',   onUp);
    canvas.style.cursor = 'pointer';

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup',   onUp);
      canvas.style.cursor = 'default';
    };
  }, [godMode]);

  // ── Triple-tap (enter/exit god mode) ─────────────────────────────────────
  const tripleTapCbRef = useRef(onTripleTap);
  useEffect(() => { tripleTapCbRef.current = onTripleTap; }, [onTripleTap]);
  const tapStateRef = useRef({ count: 0, timer: null });
  function handleTap() {
    if (godModeRef.current) return; // god mode uses its own pointer handlers
    tapStateRef.current.count++;
    clearTimeout(tapStateRef.current.timer);
    tapStateRef.current.timer = setTimeout(() => { tapStateRef.current.count = 0; }, 600);
    if (tapStateRef.current.count >= 3) {
      tapStateRef.current.count = 0;
      tripleTapCbRef.current?.();
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Wave state
    let ph1 = Math.random() * Math.PI * 2;
    let ph2 = Math.random() * Math.PI * 2;
    let ph3 = Math.random() * Math.PI * 2;
    let tidePhase = 0;
    let alive = true;

    // Sky state (initialized once per mount)
    const phase = moonPhase();

    const stars = Array.from({ length: 85 }, () => ({
      x: Math.random() * CW, y: Math.random() * (BOARD_Y - 10),
      r: .5 + Math.random() * 1.3, base: .3 + Math.random() * .65,
      tw: .4 + Math.random() * 1.1, ph: Math.random() * Math.PI * 2,
    }));

    const partlyClouds = [
      { x: 0,   oy: 0,  baseSpd: 7,  sc: 1.2, a: .90 },
      { x: 170, oy: 20, baseSpd: 4,  sc: .85, a: .70 },
      { x: 350, oy: 5,  baseSpd: 10, sc: .95, a: .80 },
      { x: -70, oy: 32, baseSpd: 6,  sc: .65, a: .55 },
    ];

    const overcastHi = Array.from({ length: 9 }, (_, i) => ({
      x: i * (CW / 9) - 30 + Math.random() * 40, oy: Math.random() * 20,
      baseSpd: 2 + Math.random() * 3, sc: .8 + Math.random() * .5, a: .55 + Math.random() * .25,
    }));
    const overcastLo = Array.from({ length: 5 }, (_, i) => ({
      x: i * (CW / 5) - 20 + Math.random() * 40, oy: 38 + Math.random() * 20,
      baseSpd: 1 + Math.random() * 2, sc: 1 + Math.random() * .4, a: .35 + Math.random() * .15,
    }));

    const rainClouds = [
      { x: 0,   oy: -5, baseSpd: 3,   sc: 1.1, a: .70 },
      { x: 120, oy: 8,  baseSpd: 5,   sc: .90, a: .65 },
      { x: 260, oy: -2, baseSpd: 4,   sc: 1.2, a: .70 },
      { x: 380, oy: 10, baseSpd: 3.5, sc: 1.0, a: .60 },
      { x: -60, oy: 5,  baseSpd: 4.5, sc: .85, a: .65 },
      { x: 480, oy: -3, baseSpd: 3.8, sc: 1.05, a: .63 },
    ];
    const rainDrops = Array.from({ length: 110 }, () => ({
      x: Math.random() * CW, y: Math.random() * BOARD_Y,
      speed: 85 + Math.random() * 55, len: 8 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2, heavy: false,
    }));

    const stormClouds = [
      { x: 0,   oy: 0,  baseSpd: 5,   sc: 1.2, a: .80 },
      { x: 110, oy: 5,  baseSpd: 7,   sc: 1.0, a: .75 },
      { x: 240, oy: -3, baseSpd: 6,   sc: 1.3, a: .80 },
      { x: 370, oy: 8,  baseSpd: 5.5, sc: 1.1, a: .75 },
      { x: -50, oy: 3,  baseSpd: 6,   sc: .90, a: .70 },
      { x: 490, oy: 1,  baseSpd: 5.8, sc: 1.0, a: .72 },
      { x: 600, oy: 6,  baseSpd: 6.5, sc: 1.15, a: .76 },
    ];
    const stormDrops = Array.from({ length: 190 }, () => ({
      x: Math.random() * CW, y: Math.random() * BOARD_Y,
      speed: 115 + Math.random() * 75, len: 9 + Math.random() * 13,
      phase: Math.random() * Math.PI * 2, heavy: Math.random() > .45,
    }));
    const bolt = makeBolt();
    let nextBoltT = 1.8 + Math.random() * 2;

    const snowDrops = Array.from({ length: 80 }, () => ({
      x:       Math.random() * CW,
      y:       Math.random() * BOARD_Y,
      speed:   22 + Math.random() * 18,    // slow drift vs rain's 85–140
      r:       1.5 + Math.random() * 2,    // circles not lines
      flutter: 18 + Math.random() * 22,    // wide horizontal sine
      phase:   Math.random() * Math.PI * 2,
    }));

    // Wind streaks — 42 particles scattered across the sky
    const windStreaks = Array.from({ length: 42 }, () => ({
      x:       Math.random() * CW,
      y:       8 + Math.random() * (BOARD_Y - 26),
      baseLen: 14 + Math.random() * 34,
      speed:   55 + Math.random() * 110,
      alpha:   0.10 + Math.random() * 0.18,
    }));

    let startTime = null;
    let lastTime  = null;

    function tick(now) {
      if (!alive) return;
      if (!startTime) startTime = now;
      const t  = (now - startTime) / 1000;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
      lastTime = now;

      // God mode overrides — read from interactive god state when active
      const gs = godModeRef.current ? godStateRef.current : null;

      const score   = gs ? gs.score : scoreRef.current;
      const hs      = scoreToHs(score);
      const spd     = .01 + hs * .07;
      ph1 += spd; ph2 += spd * 1.13; ph3 += spd * .79;

      const { tideCurrentFt, nextHilos } = tideRef.current;
      const realPct = realTidePct(tideCurrentFt, nextHilos);
      let tideLevel, tideOffset;
      if (realPct != null) {
        tideLevel = realPct;
      } else {
        tidePhase += (2 * Math.PI) / 5400;
        tideLevel = 0.5 + 0.5 * Math.sin(tidePhase);
      }
      tideOffset = TIDE_RANGE * (0.5 - tideLevel);

      const waveAmp = Math.max(hs * 45 * .5, 0.6);
      const color   = COLORS[Math.round(score)];
      const [r, g, b] = hexRgb(color);

      // Sky condition (god mode overrides skyFromData entirely)
      const wind = gs ? gs.windKt : windRef.current;
      const { skyCover: sc, shortForecast: sf, precipProbability: pp, weatherCode: wc, airTempF: atf, sunriseTs: srTs, sunsetTs: ssTs } = skyRef.current;
      const skyKey = gs?.skyKey ?? skyFromData(wind, sc, sf, pp, atf, srTs, ssTs, wc);

      // Shared wind variables — used by clouds, rain, and streaks
      const windKt     = gs ? gs.windKt : windRef.current;
      const dirX       = -Math.sin(windDirRef.current * Math.PI / 180);
      const windFactor = Math.min(1, Math.max(0, (windKt - 3) / 11)); // 0 at ≤3 kt, 1 at ≥14 kt
      // Rain lean: base -1 (slight left), scales with wind direction and speed (±16 px)
      const leanX         = dirX * windFactor * 16 - 1;
      const rainSpeedMult = 0.7 + windFactor * 0.6; // 0.7× calm → 1.3× full wind

      // Rain intensity from precipInPerHr (0.25 in/hr = heavy PNW rain = max scale)
      const precipRate = overlayRef.current.precipInPerHr ?? null;
      const rainIntensity = precipRate != null ? Math.min(1, Math.max(0.1, precipRate / 0.25)) : 0.5;
      const rainDropCount  = Math.round(20 + rainIntensity * 90);   // 20–110 drops
      const rainAlphaScale = 0.4 + rainIntensity * 0.6;             // 0.4–1.0
      const rainLenScale   = 0.7 + rainIntensity * 0.6;             // 0.7–1.3

      // Move all cloud banks with wind (dt-based so frame-rate independent)
      if (dt > 0) {
        const moveCloud = (c) => {
          c.x += dirX * c.baseSpd * (0.3 + windFactor * 2.2) * dt;
          // Wrap: clouds that exit one edge re-enter from the other
          if (dirX >= 0 && c.x > CW + 100) c.x -= CW + 200;
          else if (dirX <= 0 && c.x < -100)  c.x += CW + 200;
        };
        partlyClouds.forEach(moveCloud);
        overcastHi.forEach(moveCloud);
        overcastLo.forEach(moveCloud);
        rainClouds.forEach(moveCloud);
        stormClouds.forEach(moveCloud);
        // snow reuses overcastHi/Lo clouds — already moved above
      }

      // Sky background gradient
      const skyTop = SKY_TOPS[skyKey] || '#0d1b2a';
      const skyBot = SKY_BOTS[skyKey] || '#0e2236';
      const sk = ctx.createLinearGradient(0, 0, 0, BOARD_Y + tideOffset);
      sk.addColorStop(0, skyTop);
      sk.addColorStop(1, skyBot);
      ctx.fillStyle = sk;
      ctx.fillRect(0, 0, CW, CH);

      // Animated sky elements
      if (skyKey === 'sunny') {
        const haze = ctx.createLinearGradient(0, BOARD_Y - 50, 0, BOARD_Y + tideOffset);
        haze.addColorStop(0, 'rgba(255,160,40,0)');
        haze.addColorStop(1, 'rgba(255,140,20,.07)');
        ctx.fillStyle = haze;
        ctx.fillRect(0, BOARD_Y - 50, CW, 50 + Math.max(0, tideOffset));
        drawSun(ctx, 68, 46, 21, t);

      } else if (skyKey === 'partly') {
        const sunX = 68, sunY = 46;
        const covered = partlyClouds.some(c => Math.hypot(c.x - sunX, c.oy + 30 - sunY) < 55);
        if (!covered) {
          drawSun(ctx, sunX, sunY, 19, t);
        } else {
          const eg = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 52);
          eg.addColorStop(0, 'rgba(255,210,70,.3)');
          eg.addColorStop(1, 'rgba(255,170,0,0)');
          ctx.fillStyle = eg;
          ctx.beginPath(); ctx.arc(sunX, sunY, 52, 0, Math.PI * 2); ctx.fill();
        }
        for (const c of partlyClouds) drawCloud(ctx, c.x, c.oy + 28, c.sc, c.a);

      } else if (skyKey === 'overcast') {
        for (const c of overcastHi) drawCloud(ctx, c.x, c.oy + 8,  c.sc, c.a);
        for (const c of overcastLo) drawCloud(ctx, c.x, c.oy + 18, c.sc, c.a * .75);
        const ceil = ctx.createLinearGradient(0, 0, 0, 75);
        ceil.addColorStop(0, 'rgba(160,180,200,.16)');
        ceil.addColorStop(1, 'rgba(140,160,185,0)');
        ctx.fillStyle = ceil;
        ctx.fillRect(0, 0, CW, 75);

      } else if (skyKey === 'rain') {
        for (const c of rainClouds) drawCloud(ctx, c.x, c.oy + 8, c.sc, c.a);
        drawRainLines(ctx, rainDrops.slice(0, rainDropCount), t, 1, false, leanX, rainSpeedMult, rainAlphaScale, rainLenScale);
        const mist = ctx.createLinearGradient(0, BOARD_Y - 28, 0, BOARD_Y + tideOffset);
        mist.addColorStop(0, 'rgba(100,145,185,0)');
        mist.addColorStop(1, 'rgba(90,130,170,.1)');
        ctx.fillStyle = mist;
        ctx.fillRect(0, BOARD_Y - 28, CW, 28 + Math.max(0, tideOffset));

      } else if (skyKey === 'storm') {
        for (const c of stormClouds) drawCloud(ctx, c.x, c.oy + 4, c.sc, c.a);
        drawRainLines(ctx, stormDrops.slice(0, Math.round(rainDropCount * 1.7)), t, 1.5, true, leanX, rainSpeedMult, rainAlphaScale, rainLenScale);
        if (!bolt.active && t > nextBoltT) {
          Object.assign(bolt, makeBolt());
          bolt.active = true; bolt.startT = t;
          nextBoltT = t + 2.5 + Math.random() * 4;
        }
        drawLightning(ctx, bolt, t);

      } else if (skyKey === 'night') {
        drawStars(ctx, stars, t);
        drawMoon(ctx, CW - 68, 52, 28, phase, t);

      } else if (skyKey === 'snow') {
        // Overcast low ceiling — reuse overcastHi/Lo for a dark grey blanket
        for (const c of overcastHi) drawCloud(ctx, c.x, c.oy + 8,  c.sc, c.a * 0.85);
        for (const c of overcastLo) drawCloud(ctx, c.x, c.oy + 18, c.sc, c.a * 0.70);
        const snowCeil = ctx.createLinearGradient(0, 0, 0, 80);
        snowCeil.addColorStop(0, 'rgba(130,155,185,.18)');
        snowCeil.addColorStop(1, 'rgba(110,140,170,0)');
        ctx.fillStyle = snowCeil;
        ctx.fillRect(0, 0, CW, 80);
        // Snowflake particles
        drawSnow(ctx, snowDrops, t, dirX * windFactor);
        // Cold ground mist near waterline
        const snowMist = ctx.createLinearGradient(0, BOARD_Y - 20, 0, BOARD_Y + tideOffset);
        snowMist.addColorStop(0, 'rgba(180,210,235,0)');
        snowMist.addColorStop(1, 'rgba(160,195,225,.07)');
        ctx.fillStyle = snowMist;
        ctx.fillRect(0, BOARD_Y - 20, CW, 20 + Math.max(0, tideOffset));
      }

      // Wind streaks — scale 0 at ≤3 kt, full at ≥14 kt (uses shared windFactor/dirX)
      if (windFactor > 0 && dt > 0) {
        ctx.save();
        ctx.lineWidth = 0.8;
        for (const s of windStreaks) {
          s.x += dirX * s.speed * windFactor * dt;
          const len = s.baseLen * windFactor;
          if (dirX >= 0 && s.x - len > CW) s.x = -len;
          if (dirX <= 0 && s.x + len < 0)  s.x = CW + len;
          ctx.strokeStyle = `rgba(200,218,235,${s.alpha * windFactor})`;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + dirX * len, s.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Wave fill
      ctx.beginPath();
      ctx.moveTo(0, CH);
      for (let x = 0; x <= CW; x += 2) ctx.lineTo(x, wy(x, ph1, ph2, ph3, waveAmp, tideOffset));
      ctx.lineTo(CW, CH);
      ctx.closePath();
      const wg = ctx.createLinearGradient(0, BOARD_Y + tideOffset, 0, CH);
      wg.addColorStop(0, `rgba(${r},${g},${b},.22)`);
      wg.addColorStop(1, `rgba(${r},${g},${b},.07)`);
      ctx.fillStyle = wg; ctx.fill();

      // Wave line
      ctx.beginPath();
      for (let x = 0; x <= CW; x += 2) {
        x === 0 ? ctx.moveTo(x, wy(x, ph1, ph2, ph3, waveAmp, tideOffset))
                : ctx.lineTo(x, wy(x, ph1, ph2, ph3, waveAmp, tideOffset));
      }
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = .55;
      ctx.stroke(); ctx.globalAlpha = 1;

      // Whitecaps — appear on wave crests at ≥7 kt, dense at ≥15 kt (uses shared windKt)
      {
        const wcFactor = Math.min(1, Math.max(0, (windKt - 7) / 8));
        if (wcFactor > 0) {
          ctx.save();
          const STEP = 18;
          for (let wx = STEP; wx < CW - STEP; wx += STEP) {
            const yC = wy(wx,        ph1, ph2, ph3, waveAmp, tideOffset);
            const yL = wy(wx - STEP, ph1, ph2, ph3, waveAmp, tideOffset);
            const yR = wy(wx + STEP, ph1, ph2, ph3, waveAmp, tideOffset);
            // Local minimum in screen Y = wave crest
            if (yC < yL && yC < yR) {
              // Pseudo-random per-crest visibility that animates slowly
              const rand = (Math.sin(wx * 5.7 + t * 0.9) * 0.5 + 0.5) *
                           (Math.sin(wx * 2.1 + t * 0.35) * 0.5 + 0.5);
              if (rand < wcFactor * 0.68) {
                const a = wcFactor * (0.22 + rand * 0.38);
                // Primary foam ellipse
                ctx.fillStyle = `rgba(255,255,255,${a})`;
                ctx.beginPath();
                ctx.ellipse(wx, yC - 1, 5 + rand * 10, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                // Secondary wisp for texture
                ctx.fillStyle = `rgba(255,255,255,${a * 0.45})`;
                ctx.beginPath();
                ctx.ellipse(wx + (rand - 0.5) * 10, yC + 1.5, 3 + rand * 6, 1.3, 0, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
          ctx.restore();
        }
      }

      // God lightning — double-tap sky fires a bolt regardless of weather
      if (gs?.boltTs != null) {
        const age = (Date.now() - gs.boltTs) / 1000;
        if (age < 0.45) {
          // Reuse the bolt object but override timing with wall-clock age
          const fakeBolt = { ...bolt, active: true, startT: t - age, dur: 0.32 };
          drawLightning(ctx, fakeBolt, t);
          if (age < 0.06) {
            ctx.fillStyle = `rgba(200,220,255,${(0.06 - age) / 0.06 * 0.12})`;
            ctx.fillRect(0, 0, CW, BOARD_Y);
          }
        }
      }

      // Snow accumulation — thin white dusting on wave crests when snowing
      if (skyKey === 'snow') {
        ctx.save();
        const STEP = 18;
        for (let wx = STEP; wx < CW - STEP; wx += STEP) {
          const yC = wy(wx, ph1, ph2, ph3, waveAmp, tideOffset);
          const yL = wy(wx - STEP, ph1, ph2, ph3, waveAmp, tideOffset);
          const yR = wy(wx + STEP, ph1, ph2, ph3, waveAmp, tideOffset);
          if (yC < yL && yC < yR) {
            ctx.fillStyle = 'rgba(210,228,248,0.22)';
            ctx.beginPath();
            ctx.ellipse(wx, yC - 0.5, 7 + Math.sin(wx * 3.1) * 2, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Tide gauge
      drawTideGauge(ctx, color, tideLevel);

      // Sprite figure
      if (_spriteLoaded) {
        const paddlerX = gs ? gs.paddlerX : CX;
        const pi  = poseOf(score);
        const col = POSE_COLS[pi];
        // Periodically show row-1 alternate poses (every ALT_PERIOD s, for ALT_DURATION s)
        const cyclePos = t % ALT_PERIOD;
        const row = cyclePos > (ALT_PERIOD - ALT_DURATION) ? 1 : 0;
        const { canvas: sprite, w: sw, h: sh } = _colorizeSprite(col, row, color);
        const waterY = wy(paddlerX, ph1, ph2, ph3, waveAmp, tideOffset);
        const scale  = DRAW_H / sh;
        const dw     = sw * scale;
        const SAMPLE = 6;
        const slope  = (wy(paddlerX+SAMPLE, ph1, ph2, ph3, waveAmp, tideOffset) - wy(paddlerX-SAMPLE, ph1, ph2, ph3, waveAmp, tideOffset)) / (2*SAMPLE);
        const MAX_TILT = 18 * Math.PI / 180;
        const angle  = Math.max(-MAX_TILT, Math.min(MAX_TILT, Math.atan(slope)));
        // God mode: wobble animation when paddler is tapped
        let godWobble = 0;
        if (gs?.wobbleTs != null) {
          const age = (Date.now() - gs.wobbleTs) / 1000;
          if (age < 0.9) {
            godWobble = Math.sin(age * 22) * Math.exp(-age * 5) * (14 * Math.PI / 180);
          }
        }
        ctx.save();
        ctx.translate(paddlerX, waterY + BOARD_SINK);
        ctx.rotate(angle + godWobble);
        ctx.drawImage(sprite, -dw/2, -DRAW_H + CROP_PAD_BOTTOM * scale, dw, DRAW_H);
        ctx.restore();
      }

      // Weather text overlay — bottom-left, 3 lines, drawn last
      const skyLabel = SKY_LABELS[skyKey] || '';
      const { windDirLabel: wdl, windGustKt: gust, uvIndex: uv, precipInPerHr: pih, waterTempF: wtf } = overlayRef.current;

      // Line 2: wind speed + direction (+ gust if >3 kt above sustained)
      let windLine = null;
      if (wind != null && wind > 0) {
        let ws = `Wind ${Math.round(wind)} kt`;
        if (wdl) ws += ` ${wdl}`;
        if (gust != null && gust > wind + 3) ws += ` (g${Math.round(gust)})`;
        windLine = ws;
      }

      // Line 3: condition-specific detail
      let detailLine = null;
      if (skyKey === 'sunny' || skyKey === 'partly') {
        if (uv != null && !isNightNow(srTs, ssTs)) {
          detailLine = `UV ${Math.round(uv)} · ${uvLabel(Math.round(uv))}`;
        } else if (wtf != null) {
          detailLine = `Water ${Math.round(wtf)}°F`;
        }
      } else if (skyKey === 'overcast') {
        if (skyCover != null) detailLine = `${Math.round(skyCover)}% cloud cover`;
        else if (wtf != null) detailLine = `Water ${Math.round(wtf)}°F`;
      } else if (skyKey === 'rain' || skyKey === 'storm') {
        const pct  = skyRef.current.precipProbability;
        const amt  = pih != null && pih > 0
          ? (pih < 0.01 ? '< 0.01"' : `${pih.toFixed(2)}"`) + '/hr'
          : null;
        if (pct != null && amt) detailLine = `${Math.round(pct)}% · ${amt}`;
        else if (pct != null)   detailLine = `${Math.round(pct)}% chance`;
        else if (amt)           detailLine = amt;
      } else if (skyKey === 'snow') {
        const tempStr = atf != null ? `${Math.round(atf)}°F air` : null;
        const pct = skyRef.current.precipProbability;
        if (tempStr && pct != null) detailLine = `${Math.round(pct)}% · ${tempStr}`;
        else if (tempStr)           detailLine = tempStr;
        else if (pct != null)       detailLine = `${Math.round(pct)}% chance`;
      }

      ctx.save();
      ctx.font = '600 11px system-ui';
      ctx.textAlign = 'left';
      const lineH = 15;
      let lineY = CH - 10;

      if (gs) {
        // God mode HUD — sky label replaced with ⚡ badge
        // Hint text fades in immediately and out after 3s
        const hintAge = gs.activatedAt ? (Date.now() - gs.activatedAt) / 1000 : 999;
        if (hintAge < 4.5) {
          const hintAlpha = hintAge < 0.4 ? hintAge / 0.4 : hintAge > 3.5 ? Math.max(0, 1 - (hintAge - 3.5)) : 1;
          ctx.fillStyle = `rgba(0,232,135,${hintAlpha * 0.55})`;
          ctx.font = '500 10px system-ui';
          ctx.fillText('tap sky · drag paddler · swipe waves · ✕✕✕ exit', 14, CH - 10);
          lineY -= lineH;
        }
        if (windLine) {
          ctx.fillStyle = 'rgba(200,223,240,0.55)';
          ctx.font = '600 11px system-ui';
          ctx.fillText(windLine, 14, lineY);
          lineY -= lineH;
        }
        ctx.fillStyle = 'rgba(0,232,135,0.75)';
        ctx.font = '700 11px system-ui';
        ctx.fillText('⚡ GOD MODE', 14, lineY);
      } else {
        ctx.fillStyle = 'rgba(200,223,240,0.55)';
        if (detailLine) { ctx.fillText(detailLine, 14, lineY); lineY -= lineH; }
        if (windLine)   { ctx.fillText(windLine, 14, lineY);   lineY -= lineH; }
        if (skyLabel)     ctx.fillText(skyLabel, 14, lineY);
      }
      ctx.restore();

      rafRef.current = requestAnimationFrame(tick);
    }

    ensureSprite(() => {});
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      onClick={handleTap}
      style={{ width: '100%', height: 'auto', borderRadius: '12px 12px 0 0', display: 'block', cursor: 'default' }}
    />
  );
}
