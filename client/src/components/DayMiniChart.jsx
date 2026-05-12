import { useMemo } from 'react';
import { scoreColor } from '../utils.js';

const H      = 88;
const PAD_T  = 10;
const PAD_B  = 20;
const PAD_L  = 22;
const PAD_R  = 8;
const INNER_H = H - PAD_T - PAD_B;

function toY(score) {
  return PAD_T + INNER_H * (1 - Math.max(0, Math.min(10, score ?? 0)) / 10);
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

function formatHour(h) {
  if (h === 0)  return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export default function DayMiniChart({ hours, bestScore, avgScore, glassHours, bestWindowStart, bestWindowEnd }) {
  const pts = useMemo(() => {
    if (!hours?.length) return null;
    const sorted = [...hours].sort((a, b) => a.h - b.h);

    const hMin = sorted[0].h;
    const hMax = sorted[sorted.length - 1].h;
    const span = Math.max(hMax - hMin, 1);
    const svgW = 400; // internal coordinate space — scales with viewBox

    function toX(h) {
      return PAD_L + ((h - hMin) / span) * (svgW - PAD_L - PAD_R);
    }

    const hasNS = sorted.some(h => h.north != null && h.south != null);

    const northPts = hasNS
      ? sorted.filter(h => h.north != null).map(h => ({ x: toX(h.h), y: toY(h.north), score: h.north }))
      : null;
    const southPts = hasNS
      ? sorted.filter(h => h.south != null).map(h => ({ x: toX(h.h), y: toY(h.south), score: h.south }))
      : null;
    const scorePts = sorted.map(h => ({ x: toX(h.h), y: toY(h.score), score: h.score }));

    // Glass window bands (score ≥ 7)
    const pxPerHr = (svgW - PAD_L - PAD_R) / span;
    const windowBands = sorted.reduce((acc, h) => {
      if (h.score >= 7) {
        const x = toX(h.h);
        const last = acc[acc.length - 1];
        if (last && x - (last.x + last.w) < pxPerHr * 1.5) {
          last.w = x + pxPerHr - last.x;
        } else {
          acc.push({ x: x - pxPerHr / 2, w: pxPerHr });
        }
      }
      return acc;
    }, []);

    // Time tick labels every 2 hours across the full range (independent of data point positions)
    const firstTick = Math.ceil(hMin / 2) * 2;
    const ticks = [];
    for (let h = firstTick; h <= hMax; h += 2) {
      ticks.push({ x: toX(h), label: formatHour(h) });
    }

    // Best score dot
    const bestHour = sorted.reduce((best, h) => h.score > (best?.score ?? -1) ? h : best, null);

    return { sorted, northPts, southPts, scorePts, windowBands, ticks, toX, svgW, hasNS, bestHour, hMin, hMax };
  }, [hours]);

  if (!pts) return null;

  const { northPts, southPts, scorePts, windowBands, ticks, svgW, hasNS, bestHour, toX } = pts;
  const y7   = toY(7);
  const yBot = PAD_T + INNER_H;
  const color = scoreColor(bestScore);

  // Best window string
  const windowStr = bestWindowStart != null && bestWindowEnd != null
    ? bestWindowStart === bestWindowEnd
      ? formatHour(bestWindowStart)
      : `${formatHour(bestWindowStart)}–${formatHour(bestWindowEnd)}`
    : null;

  return (
    <div>
      {/* Stats row */}
      <div className="flex gap-5 items-end mb-2">
        <div className="flex flex-col">
          <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Best</span>
          <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color }}>{bestScore}</span>
        </div>
        <div className="flex flex-col">
          <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Avg</span>
          <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: '#8aacbf' }}>{avgScore}</span>
        </div>
        <div className="flex flex-col">
          <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Glass</span>
          <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: glassHours > 0 ? '#00e887' : '#3a5a70' }}>{glassHours}h</span>
        </div>
        {windowStr && (
          <div className="flex flex-col">
            <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Window</span>
            <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.4, color: '#5a7fa0' }}>{windowStr}</span>
          </div>
        )}
        {hasNS && (
          <div className="flex items-center gap-2 ml-auto pb-0.5">
            <div className="flex items-center gap-1">
              <div style={{ width: 10, height: 2, background: '#4fc3f7', borderRadius: 1 }} />
              <span style={{ fontSize: 8, color: '#3a5a70', fontWeight: 600 }}>N</span>
            </div>
            <div className="flex items-center gap-1">
              <div style={{ width: 10, height: 2, background: '#f59e0b', borderRadius: 1 }} />
              <span style={{ fontSize: 8, color: '#3a5a70', fontWeight: 600 }}>S</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${svgW} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Glass window bands */}
        {windowBands.map((b, i) => (
          <rect key={i} x={b.x} y={PAD_T} width={b.w} height={INNER_H}
            fill="rgba(0,232,135,0.07)" rx="2" />
        ))}

        {/* Threshold at 7 */}
        <line x1={PAD_L} y1={y7} x2={svgW - PAD_R} y2={y7}
          stroke="#00e887" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="4,4" />
        <text x={PAD_L - 3} y={y7 + 3.5} textAnchor="end"
          style={{ fontSize: 8, fill: '#00e887', opacity: 0.4, fontWeight: 700 }}>7</text>

        {/* Y labels */}
        {[0, 5, 10].map(s => (
          <text key={s} x={PAD_L - 3} y={toY(s) + 3.5} textAnchor="end"
            style={{ fontSize: 7.5, fill: '#2a4a60' }}>{s}</text>
        ))}

        {/* Score lines */}
        {hasNS && southPts?.length >= 2 && (
          <path d={smoothPath(southPts)} fill="none" stroke="#f59e0b" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        )}
        {hasNS && northPts?.length >= 2 && (
          <path d={smoothPath(northPts)} fill="none" stroke="#4fc3f7" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        )}
        {!hasNS && scorePts.length >= 2 && (
          <path d={smoothPath(scorePts)} fill="none" stroke={color} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        )}

        {/* Best score dot — position at visual peak, label/color from daytime bestScore prop */}
        {bestHour && (
          <g>
            <circle cx={toX(bestHour.h)} cy={toY(bestScore)} r={4}
              fill={color} opacity="0.95" />
            <text x={toX(bestHour.h) + 6} y={toY(bestScore) + 3.5}
              style={{ fontSize: 9, fill: color, fontWeight: 800 }}>
              {bestScore}
            </text>
          </g>
        )}

        {/* Hour labels */}
        {ticks.map(({ x, label }) => (
          <text key={label} x={x} y={H - 2} textAnchor="middle"
            style={{ fontSize: 8, fill: '#3a5a70' }}>
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
