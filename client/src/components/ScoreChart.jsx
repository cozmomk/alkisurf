import { useRef, useEffect, useMemo } from 'react';
import { scoreColor } from '../utils.js';

const PX_PER_HR = 36;
const H         = 100;
const PAD_T     = 12;   // room for score labels above line
const PAD_B     = 18;   // room for time labels below
const PAD_L     = 28;   // y-axis labels
const PAD_R     = 20;   // trailing space
const INNER_H   = H - PAD_T - PAD_B;

// Forecast uncertainty widens from 0 at NOW to ±2.5 pts at 48 h
// Power < 1 means it grows fast early (realistic: most error in first 12 h)
function uncert(hoursAhead) {
  if (hoursAhead <= 0) return 0;
  return Math.min(2.5, 2.5 * Math.pow(Math.min(1, hoursAhead / 48), 0.6));
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

// Build closed confidence-band path: upper curve forward → lower reversed → Z
function bandPath(futurePts, getUpperY, getLowerY) {
  if (futurePts.length < 2) return '';
  const upper = futurePts.map(p => ({ x: p.x, y: getUpperY(p) }));
  const lower = futurePts.map(p => ({ x: p.x, y: getLowerY(p) })).reverse();
  return smoothPath(upper)
    + ' ' + lower.map((p, i) => `${i === 0 ? 'L' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    + ' Z';
}

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

export default function ScoreChart({ forecast }) {
  const scrollRef = useRef(null);
  const now = Date.now();

  // 2 h of past + 48 h of future
  const startTime = now - 2 * 3600000;
  const endTime   = now + 48 * 3600000;

  function toX(ts) {
    return PAD_L + (ts - startTime) / 3600000 * PX_PER_HR;
  }

  const svgW = Math.round(PAD_L + (endTime - startTime) / 3600000 * PX_PER_HR + PAD_R);
  const nowX = toX(now);
  const yBot = PAD_T + INNER_H;
  const y7   = toY(7);

  const hours = useMemo(() =>
    (forecast ?? []).filter(h =>
      h.time >= startTime - 1800000 &&
      h.time <= endTime + 1800000 &&
      h.sides?.north != null
    ),
    [forecast, now]
  );

  // Scroll to NOW on mount / forecast change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, nowX - PAD_L - 30);
    }
  }, [nowX]);

  const derived = useMemo(() => {
    if (hours.length < 2) return null;

    const northPts = hours.map(h => ({ x: toX(h.time), y: toY(h.sides.north.score), score: h.sides.north.score, ts: h.time }));
    const southPts = hours.map(h => ({ x: toX(h.time), y: toY(h.sides.south.score), score: h.sides.south.score, ts: h.time }));

    // Future points for confidence band
    const futureHours = hours.filter(h => h.time >= now);
    const futurePtsN  = futureHours.map(h => {
      const hrs = (h.time - now) / 3600000;
      return { x: toX(h.time), score: h.sides.north.score, hrs };
    });
    const futurePtsS  = futureHours.map(h => {
      const hrs = (h.time - now) / 3600000;
      return { x: toX(h.time), score: h.sides.south.score, hrs };
    });

    const northBand = bandPath(
      futurePtsN,
      p => toY(Math.min(10, p.score + uncert(p.hrs))),
      p => toY(Math.max(0,  p.score - uncert(p.hrs)))
    );
    const southBand = bandPath(
      futurePtsS,
      p => toY(Math.min(10, p.score + uncert(p.hrs))),
      p => toY(Math.max(0,  p.score - uncert(p.hrs)))
    );

    // Upper/lower dashed boundary lines
    const northUpperPath = smoothPath(futurePtsN.map(p => ({ x: p.x, y: toY(Math.min(10, p.score + uncert(p.hrs))) })));
    const northLowerPath = smoothPath(futurePtsN.map(p => ({ x: p.x, y: toY(Math.max(0,  p.score - uncert(p.hrs))) })));
    const southUpperPath = smoothPath(futurePtsS.map(p => ({ x: p.x, y: toY(Math.min(10, p.score + uncert(p.hrs))) })));
    const southLowerPath = smoothPath(futurePtsS.map(p => ({ x: p.x, y: toY(Math.max(0,  p.score - uncert(p.hrs))) })));

    // Green window bands (best score ≥ 7)
    const windowBands = hours.reduce((acc, h) => {
      const best = Math.max(h.sides.north.score, h.sides.south.score);
      if (best >= 7) {
        const x = toX(h.time);
        const w = PX_PER_HR;
        const last = acc[acc.length - 1];
        if (last && Math.abs(last.x + last.w - x) < 4) {
          last.w = x + w - last.x;
        } else {
          acc.push({ x: x - w / 2, w });
        }
      }
      return acc;
    }, []);

    // Time tick labels every 2 h
    const labelTicks = hours
      .filter(h => {
        const hr = parseInt(fmt(h.time, { hour: 'numeric', hour12: false })) % 24;
        return hr % 2 === 0;
      })
      .map(h => {
        const hr = parseInt(fmt(h.time, { hour: 'numeric', hour12: false })) % 24;
        const isMidnight = hr === 0;
        return {
          x: toX(h.time),
          label: isMidnight
            ? fmt(h.time, { weekday: 'short' })
            : fmt(h.time, { hour: 'numeric', hour12: true }),
          isMidnight,
          ts: h.time,
        };
      });

    // Current scores at NOW
    const nowHour  = hours.find(h => h.time >= now) ?? hours[hours.length - 1];
    const curNorth = nowHour?.sides?.north?.score ?? null;
    const curSouth = nowHour?.sides?.south?.score ?? null;

    return {
      northPts, southPts,
      northBand, southBand,
      northUpperPath, northLowerPath,
      southUpperPath, southLowerPath,
      windowBands, labelTicks,
      curNorth, curSouth,
    };
  }, [hours, now]);

  if (!derived) return null;

  const {
    northPts, southPts,
    northBand, southBand,
    northUpperPath, northLowerPath,
    southUpperPath, southLowerPath,
    windowBands, labelTicks,
    curNorth, curSouth,
  } = derived;

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="section-title" style={{ fontSize: 10 }}>Glass Forecast · 48h</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div style={{ width: 14, height: 2.5, background: '#4fc3f7', borderRadius: 2 }} />
            <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600 }}>N</span>
          </div>
          <div className="flex items-center gap-1">
            <div style={{ width: 14, height: 2.5, background: '#f59e0b', borderRadius: 2 }} />
            <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600 }}>S</span>
          </div>
          <div className="flex items-center gap-1" style={{ opacity: 0.7 }}>
            <div style={{ width: 14, height: 6, borderRadius: 1, background: 'rgba(79,195,247,0.18)', border: '1px dashed rgba(79,195,247,0.4)' }} />
            <span style={{ fontSize: 9, color: '#3a5a70', fontWeight: 600 }}>±range</span>
          </div>
        </div>
      </div>

      <div className="scroll-fade" style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', marginInline: -4 }}
      >
        <svg width={svgW} height={H} viewBox={`0 0 ${svgW} ${H}`} style={{ display: 'block' }}>
          <defs>
            {/* Split past vs future for opacity */}
            <clipPath id="sc-past">
              <rect x={0} y={0} width={nowX} height={H} />
            </clipPath>
            <clipPath id="sc-future">
              <rect x={nowX} y={0} width={svgW} height={H} />
            </clipPath>
          </defs>

          {/* Window bands (score ≥ 7) */}
          {windowBands.map((b, i) => (
            <rect key={i} x={b.x} y={PAD_T} width={b.w} height={INNER_H}
              fill="rgba(0,232,135,0.06)" rx="2" />
          ))}

          {/* Threshold line at 7 */}
          <line x1={PAD_L} y1={y7} x2={svgW - PAD_R} y2={y7}
            stroke="#00e887" strokeWidth="1" strokeOpacity="0.22" strokeDasharray="4,4" />
          <text x={PAD_L - 3} y={y7 + 3.5} textAnchor="end"
            style={{ fontSize: 8, fill: '#00e887', opacity: 0.45, fontWeight: 700 }}>7</text>

          {/* Y-axis labels */}
          {[0, 5, 10].map(s => (
            <text key={s} x={PAD_L - 3} y={toY(s) + 3.5} textAnchor="end"
              style={{ fontSize: 8, fill: '#2a4a60' }}>{s}</text>
          ))}

          {/* ── Confidence bands (future only) ── */}
          {northBand && <path d={northBand} fill="rgba(79,195,247,0.10)" stroke="none" />}
          {southBand && <path d={southBand} fill="rgba(245,158,11,0.10)"  stroke="none" />}

          {/* Band boundary lines (dashed) */}
          {northUpperPath && (
            <path d={northUpperPath} fill="none" stroke="#4fc3f7" strokeWidth="0.8"
              strokeDasharray="3,4" opacity="0.35" />
          )}
          {northLowerPath && (
            <path d={northLowerPath} fill="none" stroke="#4fc3f7" strokeWidth="0.8"
              strokeDasharray="3,4" opacity="0.35" />
          )}
          {southUpperPath && (
            <path d={southUpperPath} fill="none" stroke="#f59e0b" strokeWidth="0.8"
              strokeDasharray="3,4" opacity="0.35" />
          )}
          {southLowerPath && (
            <path d={southLowerPath} fill="none" stroke="#f59e0b" strokeWidth="0.8"
              strokeDasharray="3,4" opacity="0.35" />
          )}

          {/* ── Score lines — past solid / future dimmed ── */}
          {/* South */}
          <path d={smoothPath(southPts)} fill="none" stroke="#f59e0b" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
            clipPath="url(#sc-past)" />
          <path d={smoothPath(southPts)} fill="none" stroke="#f59e0b" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.5"
            clipPath="url(#sc-future)" />

          {/* North */}
          <path d={smoothPath(northPts)} fill="none" stroke="#4fc3f7" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
            clipPath="url(#sc-past)" />
          <path d={smoothPath(northPts)} fill="none" stroke="#4fc3f7" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.55"
            clipPath="url(#sc-future)" />

          {/* NOW line */}
          <line x1={nowX} y1={PAD_T} x2={nowX} y2={yBot}
            stroke="#00e887" strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray="3,3" />

          {/* Score dots at NOW */}
          {curNorth != null && (
            <g>
              <circle cx={nowX} cy={toY(curNorth)} r={4} fill={scoreColor(curNorth)} opacity="0.95" />
              <text x={nowX + 6} y={toY(curNorth) + 3.5}
                style={{ fontSize: 9, fill: scoreColor(curNorth), fontWeight: 800 }}>
                {curNorth}
              </text>
            </g>
          )}
          {curSouth != null && (
            <g>
              <circle cx={nowX} cy={toY(curSouth)} r={4} fill={scoreColor(curSouth)} opacity="0.95" />
              <text x={nowX + 6} y={toY(curSouth) + 3.5}
                style={{ fontSize: 9, fill: scoreColor(curSouth), fontWeight: 800 }}>
                {curSouth}
              </text>
            </g>
          )}

          {/* Time labels */}
          {labelTicks.map(({ x, label, isMidnight, ts }) => (
            <g key={ts}>
              {isMidnight && (
                <line x1={x} y1={PAD_T} x2={x} y2={yBot}
                  stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              )}
              <text x={x} y={H - 2} textAnchor="middle"
                style={{
                  fontSize: isMidnight ? 8.5 : 8,
                  fill: isMidnight ? '#5a7fa0' : '#3a5a70',
                  fontWeight: isMidnight ? 700 : 400,
                }}>
                {label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      </div>
    </div>
  );
}
