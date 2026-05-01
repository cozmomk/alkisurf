import { useEffect, useRef } from 'react';

// ─── scene constants (mirrors demo-paddler5) ─────────────────────────────────
const CW = 540, CH = 270, CX = 250, BOARD_Y = 225, DRAW_H = 125;
const WAVE_FREQ = 0.015, TIDE_RANGE = 22;
const CROP_PAD_TOP = 28, CROP_PAD_LEFT = 12, CROP_PAD_RIGHT = 2, CROP_PAD_BOTTOM = 12;
const BOARD_SINK = 14;
const GRID_COLS = 5;

// score → [col, row] in paddler-sprites.png
const POSE_SPRITES = [[0,0],[1,0],[2,0],[3,0],[4,0]];
const COLORS = ['#ff2b55','#ff2b55','#ff6b1a','#ff6b1a','#ffc300','#ffc300','#7dff4f','#7dff4f','#00e887','#00e887','#00e887'];

function poseOf(s)     { return s>=9?4:s>=7?3:s>=5?2:s>=3?1:0; }
function scoreToHs(s)  { return [.60,.52,.44,.34,.26,.20,.14,.09,.05,.03,.02][Math.round(s)]; }
function hexRgb(h)     { return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }

// ─── sprite singleton (one load per page) ────────────────────────────────────
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

// ─── wave / tide helpers ─────────────────────────────────────────────────────
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

// ─── sky condition helper (exported — used by tests) ─────────────────────────
function isNightNow() {
  const hour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }));
  return hour >= 20 || hour < 6;
}

export function skyFromData(windSpeedKt, skyCover, shortForecast, precipProbability) {
  if (isNightNow()) return 'night';
  const forecastText = (shortForecast || '').toLowerCase();
  const isRaining = /rain|shower|drizzle/.test(forecastText) || (precipProbability != null && precipProbability > 50);
  const isThunder = /thunder/.test(forecastText);
  if (isThunder) return 'storm';
  if (skyCover == null) return isRaining ? 'rain' : 'sunny';
  if (skyCover <= 15) return 'sunny';
  if (skyCover <= 35) return isRaining ? 'rain' : 'partly';
  if (skyCover <= 70) return isRaining ? 'rain' : 'overcast';
  return isRaining ? 'rain' : 'overcast';
}

const SKY_LABELS = { sunny: 'Sunny', partly: 'Partly cloudy', overcast: 'Overcast', rain: 'Rain', storm: 'Storm', night: 'Night' };

function realTidePct(currentFt, hilos) {
  if (currentFt == null || !hilos?.length) return null;
  const nextH = hilos.find(h => h.type === 'H');
  const nextL = hilos.find(h => h.type === 'L');
  if (!nextH || !nextL) return null;
  const range = nextH.ft - nextL.ft;
  if (range <= 0) return null;
  return Math.max(0, Math.min(1, (currentFt - nextL.ft) / range));
}

// ─── component ────────────────────────────────────────────────────────────────
export default function ConditionsSprite({ score, windSpeedKt = 0, skyCover = null, shortForecast = null, precipProbability = null, tideCurrentFt = null, nextHilos = null }) {
  const canvasRef  = useRef(null);
  const scoreRef   = useRef(score ?? 0);
  const windRef    = useRef(windSpeedKt ?? 0);
  const skyRef     = useRef({ skyCover, shortForecast, precipProbability });
  const tideRef    = useRef({ tideCurrentFt, nextHilos });
  const rafRef     = useRef(null);

  useEffect(() => { scoreRef.current = score ?? 0; }, [score]);
  useEffect(() => { windRef.current = windSpeedKt ?? 0; }, [windSpeedKt]);
  useEffect(() => { skyRef.current = { skyCover, shortForecast, precipProbability }; }, [skyCover, shortForecast, precipProbability]);
  useEffect(() => { tideRef.current = { tideCurrentFt, nextHilos }; }, [tideCurrentFt, nextHilos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let ph1 = Math.random()*Math.PI*2;
    let ph2 = Math.random()*Math.PI*2;
    let ph3 = Math.random()*Math.PI*2;
    let tidePhase = 0;
    let alive = true;

    function tick() {
      if (!alive) return;
      const score   = scoreRef.current;
      const hs      = scoreToHs(score);
      const spd     = .01 + hs * .07;
      ph1 += spd; ph2 += spd*1.13; ph3 += spd*.79;

      // Use real tide data if available; fall back to slow sine animation
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

      // Sky background
      const sk = ctx.createLinearGradient(0, 0, 0, BOARD_Y + tideOffset);
      sk.addColorStop(0, '#0d1b2a');
      sk.addColorStop(1, '#0e2236');
      ctx.fillStyle = sk;
      ctx.fillRect(0, 0, CW, CH);

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

      // Tide gauge
      drawTideGauge(ctx, color, tideLevel);

      // Weather overlay (top-left)
      const wind = windRef.current;
      const { skyCover: sc, shortForecast: sf, precipProbability: pp } = skyRef.current;
      const skyKey = skyFromData(wind, sc, sf, pp);
      const skyLabel = SKY_LABELS[skyKey] || '';
      ctx.save();
      ctx.font = '600 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(200,223,240,0.55)';
      if (skyLabel) ctx.fillText(skyLabel, 14, 20);
      if (wind != null && wind > 0) ctx.fillText(`Wind ${Math.round(wind)} kt`, 14, 37);
      ctx.restore();

      // Sprite figure
      if (_spriteLoaded) {
        const pi = poseOf(score);
        const [col, row] = POSE_SPRITES[pi];
        const { canvas: sprite, w: sw, h: sh } = _colorizeSprite(col, row, color);
        const waterY = wy(CX, ph1, ph2, ph3, waveAmp, tideOffset);
        const scale  = DRAW_H / sh;
        const dw     = sw * scale;
        const SAMPLE = 6;
        const slope  = (wy(CX+SAMPLE, ph1, ph2, ph3, waveAmp, tideOffset) - wy(CX-SAMPLE, ph1, ph2, ph3, waveAmp, tideOffset)) / (2*SAMPLE);
        const MAX_TILT = 18 * Math.PI / 180;
        const angle  = Math.max(-MAX_TILT, Math.min(MAX_TILT, Math.atan(slope)));
        ctx.save();
        ctx.translate(CX, waterY + BOARD_SINK);
        ctx.rotate(angle);
        ctx.drawImage(sprite, -dw/2, -DRAW_H + CROP_PAD_BOTTOM * scale, dw, DRAW_H);
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    ensureSprite(() => {}); // kick off load; sprite check inside tick
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
      style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }}
    />
  );
}
