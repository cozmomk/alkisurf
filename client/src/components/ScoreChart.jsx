import { useMemo } from 'react';
import { scoreColor } from '../utils.js';

const W        = 320;
const H        = 88;
const PAD_T    = 10;   // top padding (room for score labels)
const PAD_B    = 16;   // bottom padding (time labels)
const PAD_L    = 28;   // left (Y-axis labels)
const PAD_R    = 8;
const INNER_H  = H - PAD_T - PAD_B;
const INNER_W  = W - PAD_L - PAD_R;

function toX(i, total) {
  return PAD_L + (i / (total - 1)) * INNER_W;
}

function toY(score) {
  return PAD_T + INNER_H * (1 - Math.max(0, Math.min(10, score)) / 10);
}

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpX  = (prev.x + curr.x) / 2;
    d += ` C${cpX.toFixed(1)},${prev.y.toFixed(1)} ${cpX.toFixed(1)},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }
  return d;
}

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

export default function ScoreChart({ forecast }) {
  const now = Date.now();

  const hours = useMemo(() =>
    (forecast ?? []).filter(h =>
      h.time >= now - 1800000 &&
      h.time <= now + 36 * 3600000 &&
      h.sides?.north != null
    ),
    [forecast, now]
  );

  const { northPts, southPts, nowX, windowBands, labelHours } = useMemo(() => {
    if (hours.length < 2) return {};
    const total = hours.length;

    const northPts = hours.map((h, i) => ({
      x: toX(i, total),
      y: toY(h.sides.north.score),
      score: h.sides.north.score,
    }));
    const southPts = hours.map((h, i) => ({
      x: toX(i, total),
      y: toY(h.sides.south.score),
      score: h.sides.south.score,
    }));

    // NOW marker position
    const nowIdx = hours.findIndex(h => h.time >= now);
    const nowX   = nowIdx >= 0 ? toX(nowIdx, total) : null;

    // Green window bands — columns where best score >= 7
    const windowBands = hours.reduce((acc, h, i) => {
      const best = Math.max(h.sides.north.score, h.sides.south.score);
      if (best >= 7) {
        const x   = toX(i, total);
        const w   = INNER_W / (total - 1);
        const last = acc[acc.length - 1];
        if (last && Math.abs(last.x + last.w - x) < 2) {
          last.w += w; // extend existing band
        } else {
          acc.push({ x: x - w / 2, w });
        }
      }
      return acc;
    }, []);

    // Time labels every 4 hours
    const labelHours = hours
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => {
        const hr = parseInt(fmt(h.time, { hour: 'numeric', hour12: false }));
        return hr % 4 === 0;
      });

    return { northPts, southPts, nowX, windowBands, labelHours };
  }, [hours, now]);

  if (!northPts?.length) return null;

  const northPath = smoothPath(northPts);
  const southPath = smoothPath(southPts);
  const y7        = toY(7);
  const yBot      = PAD_T + INNER_H;

  // Current scores (first point at/after now)
  const nowIdx   = hours.findIndex(h => h.time >= now);
  const nowHour  = nowIdx >= 0 ? hours[nowIdx] : hours[0];
  const curNorth = nowHour?.sides?.north?.score ?? null;
  const curSouth = nowHour?.sides?.south?.score ?? null;

  return (
    <div className="card px-3 py-3">
      {/* Legend */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="section-title">Glass Forecast · 36h</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div style={{ width: 14, height: 2.5, background: '#4fc3f7', borderRadius: 2 }} />
            <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600 }}>N</span>
          </div>
          <div className="flex items-center gap-1">
            <div style={{ width: 14, height: 2.5, background: '#f59e0b', borderRadius: 2 }} />
            <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600 }}>S</span>
          </div>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        {/* Window bands (score ≥ 7) */}
        {windowBands.map((b, i) => (
          <rect key={i}
            x={b.x} y={PAD_T} width={b.w} height={INNER_H}
            fill="rgba(0,232,135,0.07)" rx="2"
          />
        ))}

        {/* Score threshold line at 7 */}
        <line x1={PAD_L} y1={y7} x2={W - PAD_R} y2={y7}
          stroke="#00e887" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4,4" />
        <text x={PAD_L - 3} y={y7 + 3.5} textAnchor="end"
          style={{ fontSize: 8, fill: '#00e887', opacity: 0.5, fontWeight: 700 }}>7</text>

        {/* Y-axis labels */}
        {[0, 5, 10].map(s => (
          <text key={s} x={PAD_L - 3} y={toY(s) + 3.5} textAnchor="end"
            style={{ fontSize: 7.5, fill: '#2a4a60' }}>
            {s}
          </text>
        ))}

        {/* South line */}
        <path d={southPath} fill="none" stroke="#f59e0b" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />

        {/* North line */}
        <path d={northPath} fill="none" stroke="#4fc3f7" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* NOW marker */}
        {nowX != null && (
          <line x1={nowX} y1={PAD_T} x2={nowX} y2={yBot}
            stroke="#00e887" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="3,3" />
        )}

        {/* Current score dots */}
        {nowX != null && curNorth != null && (
          <g>
            <circle cx={nowX} cy={toY(curNorth)} r={4}
              fill={scoreColor(curNorth)} opacity="0.9" />
            <text x={nowX + 6} y={toY(curNorth) + 3.5}
              style={{ fontSize: 9, fill: scoreColor(curNorth), fontWeight: 800 }}>
              {curNorth}
            </text>
          </g>
        )}
        {nowX != null && curSouth != null && (
          <g>
            <circle cx={nowX} cy={toY(curSouth)} r={4}
              fill={scoreColor(curSouth)} opacity="0.9" />
            <text x={nowX + 6} y={toY(curSouth) + 3.5}
              style={{ fontSize: 9, fill: scoreColor(curSouth), fontWeight: 800 }}>
              {curSouth}
            </text>
          </g>
        )}

        {/* Time labels */}
        {labelHours.map(({ h, i }) => {
          const x    = toX(i, hours.length);
          const hr12 = fmt(h.time, { hour: 'numeric', hour12: true });
          const isDay = i > 0 && fmt(h.time, { day: 'numeric' }) !== fmt(hours[i - 1]?.time, { day: 'numeric' });
          return (
            <g key={h.time}>
              {isDay && (
                <line x1={x} y1={PAD_T} x2={x} y2={yBot}
                  stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              )}
              <text x={x} y={H - 2} textAnchor="middle"
                style={{ fontSize: 8, fill: '#3a5a70' }}>
                {hr12}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
