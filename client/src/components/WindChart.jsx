import { useRef, useEffect, useMemo } from 'react';
import { compassLabel } from '../utils.js';

const PX_PER_HR = 36;
const H         = 98;
const PAD_T     = 8;
const PAD_B     = 36;   // two label rows: direction (upper) + time (lower)
const PAD_L     = 4;
const PAD_R     = 20;
const INNER_H   = H - PAD_T - PAD_B;

function speedColor(kt) {
  if (kt <= 6)  return '#00e887';
  if (kt <= 10) return '#ffc300';
  if (kt <= 14) return '#ff8a65';
  return '#ff2b55';
}

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

export default function WindChart({ forecast }) {
  const scrollRef = useRef(null);
  const now = Date.now();
  const startTime = now - 2 * 3600000;
  const endTime   = now + 48 * 3600000;

  function toX(ts) {
    return PAD_L + (ts - startTime) / 3600000 * PX_PER_HR;
  }

  const svgW = Math.round(PAD_L + (endTime - startTime) / 3600000 * PX_PER_HR + PAD_R);
  const nowX = toX(now);
  const botY = PAD_T + INNER_H;

  const hours = useMemo(() =>
    (forecast ?? []).filter(h => h.time >= startTime - 1800000 && h.time <= endTime + 1800000),
    [forecast, now]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, nowX - 30);
    }
  }, [nowX]);

  const { maxKt, sustainedPath, fillPath, gustSegs, dirLabels, labelTicks } = useMemo(() => {
    if (hours.length < 2) return {};

    const allSpeeds = hours.flatMap(h => [h.windSpeedKt ?? 0, h.windGustKt ?? 0]);
    const maxKt = Math.max(14, ...allSpeeds) * 1.15;

    function toY(kt) {
      return PAD_T + INNER_H * (1 - Math.min(1, kt / maxKt));
    }

    const sustainedPts = hours.map(h => ({
      x: toX(h.time),
      y: toY(h.windSpeedKt ?? 0),
      kt: h.windSpeedKt ?? 0,
      ts: h.time,
    }));

    const sustainedPath = sustainedPts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');

    const fillPath = sustainedPath
      + ` L${sustainedPts[sustainedPts.length - 1].x.toFixed(1)},${botY}`
      + ` L${sustainedPts[0].x.toFixed(1)},${botY} Z`;

    // Gust spikes — show any gust at least 1 kt above sustained
    const gustSegs = hours
      .filter(h => h.windGustKt != null && h.windGustKt > (h.windSpeedKt ?? 0) + 1)
      .map(h => ({
        x: toX(h.time),
        y1: botY,
        y2: toY(h.windGustKt),
        kt: h.windGustKt,
      }));

    // Direction arrows every 2 h
    const dirLabels = hours
      .filter(h => {
        const hr = parseInt(fmt(h.time, { hour: 'numeric', hour12: false })) % 24;
        return hr % 2 === 0 && h.windDirDeg != null;
      })
      .map(h => ({
        x: toX(h.time),
        label: compassLabel(h.windDirDeg),
        ts: h.time,
      }));

    // Time tick labels every 2 h, midnight = day name
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

    return { maxKt, sustainedPath, fillPath, gustSegs, dirLabels, labelTicks };
  }, [hours, now]);

  if (!sustainedPath) return null;

  function toY(kt) {
    return PAD_T + INNER_H * (1 - Math.min(1, kt / maxKt));
  }

  const y8  = toY(8);
  const y14 = toY(14);

  return (
    <div className="flex flex-col gap-1">
      <div className="scroll-fade" style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', marginInline: -4 }}
      >
        <svg width={svgW} height={H} viewBox={`0 0 ${svgW} ${H}`} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="wind-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4fc3f7" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#4fc3f7" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Reference lines */}
          <line x1={PAD_L} y1={y8}  x2={svgW - PAD_R} y2={y8}
            stroke="rgba(255,200,0,0.15)" strokeWidth="1" strokeDasharray="3,4" />
          <line x1={PAD_L} y1={y14} x2={svgW - PAD_R} y2={y14}
            stroke="rgba(255,43,85,0.15)" strokeWidth="1" strokeDasharray="3,4" />
          <text x={svgW - PAD_R - 2} y={y8 - 3} textAnchor="end"
            style={{ fontSize: 8, fill: 'rgba(255,200,0,0.5)' }}>8kt</text>
          <text x={svgW - PAD_R - 2} y={y14 - 3} textAnchor="end"
            style={{ fontSize: 8, fill: 'rgba(255,43,85,0.5)' }}>14kt</text>

          {/* Midnight dividers */}
          {labelTicks.filter(t => t.isMidnight).map(t => (
            <line key={t.ts} x1={t.x} y1={PAD_T} x2={t.x} y2={botY}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          ))}

          {/* Fill */}
          <path d={fillPath} fill="url(#wind-fill)" />

          {/* Gust spikes */}
          {gustSegs.map((g, i) => (
            <line key={i} x1={g.x} y1={g.y1} x2={g.x} y2={g.y2}
              stroke="#ff8a65" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          ))}

          {/* Sustained line */}
          <path d={sustainedPath} fill="none" stroke="#4fc3f7" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* NOW line */}
          <line x1={nowX} y1={PAD_T} x2={nowX} y2={botY}
            stroke="#00e887" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="3,3" />

          {/* Time labels — bottom row */}
          {labelTicks.map(({ x, label, isMidnight, ts }) => (
            <g key={ts}>
              {isMidnight && (
                <line x1={x} y1={PAD_T} x2={x} y2={botY}
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

          {/* Direction labels — row above time labels */}
          {dirLabels.map((d) => (
            <text key={d.ts} x={d.x} y={H - 16} textAnchor="middle"
              style={{ fontSize: 8, fill: '#4a6a88', fontWeight: 600 }}>
              {d.label}
            </text>
          ))}
        </svg>
      </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-1">
          <div style={{ width: 16, height: 2, background: '#4fc3f7', borderRadius: 1 }} />
          <span style={{ fontSize: 8, color: '#3a5a70' }}>sustained</span>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ width: 2, height: 10, background: '#ff8a65', borderRadius: 1 }} />
          <span style={{ fontSize: 8, color: '#3a5a70' }}>gusts</span>
        </div>
      </div>
    </div>
  );
}
