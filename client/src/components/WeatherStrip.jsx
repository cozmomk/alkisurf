import { useRef, useEffect, useMemo } from 'react'; // useRef for scroll container
import { skyEmoji } from '../utils.js';

const PX_PER_HR = 36;   // horizontal pixels per hour
const H_TOTAL   = 148;  // total SVG height
const H_EMOJI   = 28;   // top zone for sky emoji
const H_LABEL   = 16;   // bottom zone for hour label
const H_PRECIP  = 20;   // bottom zone for precip (stacked below label)
const H_CURVE   = H_TOTAL - H_EMOJI - H_LABEL - H_PRECIP; // middle curve zone
const CURVE_TOP = H_EMOJI;
const CURVE_BOT = H_EMOJI + H_CURVE;
const PAD_LEFT  = 4;
const PAD_RIGHT = 20; // a little trailing space

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

function ptDay(ts) {
  return fmt(ts, { day: 'numeric' });
}

function toX(i) {
  return PAD_LEFT + i * PX_PER_HR + PX_PER_HR / 2;
}

function toY(temp, minTemp, maxTemp) {
  const range = maxTemp - minTemp || 1;
  const frac  = (temp - minTemp) / range;
  // High temp = top of curve zone, low temp = bottom
  return CURVE_BOT - 6 - frac * (H_CURVE - 12);
}

// Smooth path using SVG cubic bezier through hourly points
function buildSmoothPath(pts) {
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

export default function WeatherStrip({ forecast }) {
  const scrollRef = useRef(null);
  const now       = Date.now();

  // 2 h past + 48 h future
  const hours = useMemo(() =>
    (forecast ?? []).filter(h => h.time >= now - 2 * 3600000 && h.time <= now + 48 * 3600000),
    [forecast, now]
  );

  const { pts, minTemp, maxTemp, svgW, nowX } = useMemo(() => {
    if (!hours.length) return {};
    const temps = hours.map(h => h.airTempF).filter(v => v != null);
    if (!temps.length) return {};
    const minTemp = Math.min(...temps) - 3;
    const maxTemp = Math.max(...temps) + 3;
    const pts = hours.map((h, i) => ({
      x:     toX(i),
      y:     toY(h.airTempF ?? (minTemp + maxTemp) / 2, minTemp, maxTemp),
      h,
      i,
      isPast: h.time < now,
    }));
    const svgW    = PAD_LEFT + hours.length * PX_PER_HR + PAD_RIGHT;
    const nowIdx  = hours.findIndex(h => h.time >= now);
    const nowX    = nowIdx >= 0 ? toX(nowIdx) : null;
    return { pts, minTemp, maxTemp, svgW, nowX };
  }, [hours, now]);

  useEffect(() => {
    if (scrollRef.current && nowX != null) {
      scrollRef.current.scrollLeft = Math.max(0, nowX - 20);
    }
  }, [nowX]);

  if (!pts?.length) return (
    <div style={{ padding: '12px 0', textAlign: 'center' }}>
      <span style={{ fontSize: 11, color: '#3a5a70' }}>No forecast data</span>
    </div>
  );

  const linePath = buildSmoothPath(pts);
  const fillPath = linePath
    + ` L${pts[pts.length - 1].x.toFixed(1)},${CURVE_BOT}`
    + ` L${pts[0].x.toFixed(1)},${CURVE_BOT} Z`;

  // Which hours show a time label (every 2 hours, plus NOW boundary)
  const showLabel = (h, i) => {
    const hr = parseInt(fmt(h.time, { hour: 'numeric', hour12: false }));
    return hr % 2 === 0;
  };

  const hasPrecip = hours.some(h => (h.precipProbability ?? 0) >= 10);

  return (
    <div className="scroll-fade" style={{ position: 'relative' }}>
    <div
      ref={scrollRef}
      style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', marginInline: -4 }}
    >
      <svg
        width={svgW}
        height={H_TOTAL}
        viewBox={`0 0 ${svgW} ${H_TOTAL}`}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="wx-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fc3f7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4fc3f7" stopOpacity="0.03" />
          </linearGradient>
          <clipPath id="wx-clip">
            <rect x={PAD_LEFT} y={CURVE_TOP} width={svgW - PAD_LEFT - PAD_RIGHT} height={H_CURVE} />
          </clipPath>
        </defs>

        {/* Curve fill */}
        <path d={fillPath} fill="url(#wx-fill)" clipPath="url(#wx-clip)" />

        {/* Curve line */}
        <path d={linePath} fill="none" stroke="#4fc3f7" strokeWidth="2"
          strokeLinecap="round" clipPath="url(#wx-clip)" />

        {/* NOW marker */}
        {nowX != null && (
          <line
            x1={nowX} y1={CURVE_TOP} x2={nowX} y2={CURVE_BOT}
            stroke="#00e887" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="3,3"
          />
        )}

        {/* Per-hour elements */}
        {pts.map(({ x, y, h, i, isPast }) => {
          const sky    = skyEmoji(h.skyCover, h.time);
          const temp   = h.airTempF != null ? Math.round(h.airTempF) : null;
          const precip = h.precipProbability != null ? Math.round(h.precipProbability) : null;
          const showP  = precip != null && precip >= 10;
          const hr12   = fmt(h.time, { hour: 'numeric', hour12: true });
          const isLabel = showLabel(h, i);
          const isDayDiv = i > 0 && ptDay(h.time) !== ptDay(hours[i - 1].time);

          return (
            <g key={h.time} opacity={isPast ? 0.45 : 1}>

              {/* Day divider */}
              {isDayDiv && (
                <line x1={x - PX_PER_HR / 2} y1={CURVE_TOP} x2={x - PX_PER_HR / 2} y2={CURVE_BOT}
                  stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              )}

              {/* Sky emoji above curve */}
              {sky && (
                <text x={x} y={H_EMOJI - 6} textAnchor="middle"
                  style={{ fontSize: 15, dominantBaseline: 'auto' }}>
                  {sky}
                </text>
              )}

              {/* Dot on curve */}
              <circle cx={x} cy={y} r={2} fill="#4fc3f7" opacity="0.7" />

              {/* Temp label — show at local peaks/troughs and every 2 hours */}
              {isLabel && temp != null && (
                <text x={x} y={y - 6} textAnchor="middle"
                  style={{ fontSize: 10, fill: '#c8dff0', fontWeight: 700 }}>
                  {temp}°
                </text>
              )}

              {/* Hour label */}
              {isLabel && (
                <text x={x} y={CURVE_BOT + H_LABEL - 2} textAnchor="middle"
                  style={{ fontSize: 8.5, fill: isPast ? '#2a4a60' : '#4a6a88', fontWeight: 500 }}>
                  {hr12}
                </text>
              )}

              {/* Precip indicator */}
              {showP && (
                <g>
                  <text x={x} y={CURVE_BOT + H_LABEL + H_PRECIP - 4} textAnchor="middle"
                    style={{
                      fontSize: 9,
                      fill: precip > 60 ? '#7ab8e8' : '#4a8aaa',
                      fontWeight: 700,
                    }}>
                    💧{precip}%
                  </text>
                  {h.precipInPerHr != null && h.precipInPerHr > 0 && (
                    <text x={x} y={CURVE_BOT + H_LABEL + H_PRECIP - 4} textAnchor="middle" dx={28}
                      style={{ fontSize: 8, fill: '#3a6a88' }}>
                      {h.precipInPerHr < 0.01 ? '<.01"' : `${h.precipInPerHr.toFixed(2)}"`}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
    </div>
  );
}
