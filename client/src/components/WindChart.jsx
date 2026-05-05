import { useMemo } from 'react';
import { compassLabel } from '../utils.js';

const W = 320;
const H = 80;
const PAD_X = 4;
const PAD_TOP = 8;
const PAD_BOT = 18; // space for direction labels

const INNER_H = H - PAD_TOP - PAD_BOT;

function speedColor(kt) {
  if (kt <= 6)  return '#00e887';
  if (kt <= 10) return '#ffc300';
  if (kt <= 14) return '#ff8a65';
  return '#ff2b55';
}

function toY(kt, maxKt) {
  const frac = Math.min(1, kt / (maxKt || 1));
  return PAD_TOP + INNER_H * (1 - frac);
}

function toX(ts, minTs, maxTs) {
  return PAD_X + (W - 2 * PAD_X) * (ts - minTs) / (maxTs - minTs || 1);
}

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

export default function WindChart({ forecast }) {
  const now = Date.now();
  const hours = (forecast ?? []).filter(h => h.time >= now - 1800000 && h.time <= now + 24 * 3600000);

  const { sustainedPath, gustPath, fillPath, dirLabels, maxKt, minTs, maxTs, nowX } = useMemo(() => {
    if (hours.length < 2) return {};
    const minTs = hours[0].time;
    const maxTs = hours[hours.length - 1].time;
    const allSpeeds = hours.flatMap(h => [h.windSpeedKt ?? 0, h.windGustKt ?? 0]);
    const maxKt = Math.max(14, ...allSpeeds) * 1.15;

    const sustainedPts = hours.map(h => ({
      x: toX(h.time, minTs, maxTs),
      y: toY(h.windSpeedKt ?? 0, maxKt),
      kt: h.windSpeedKt ?? 0,
    }));

    const gustPts = hours
      .filter(h => h.windGustKt != null && h.windGustKt > (h.windSpeedKt ?? 0) + 2)
      .map(h => ({ x: toX(h.time, minTs, maxTs), y: toY(h.windGustKt, maxKt), kt: h.windGustKt }));

    const botY = PAD_TOP + INNER_H;
    const sustainedPath = sustainedPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const fillPath = sustainedPath
      + ` L${sustainedPts[sustainedPts.length - 1].x.toFixed(1)},${botY}`
      + ` L${sustainedPts[0].x.toFixed(1)},${botY} Z`;

    // gust spikes: vertical lines from sustained level to gust level
    const gustPath = gustPts.map(p => `M${p.x.toFixed(1)},${botY} L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // direction labels every 4 hours
    const dirLabels = hours.filter((h, i) => i % 4 === 0 && h.windDirDeg != null).map(h => ({
      x: toX(h.time, minTs, maxTs),
      label: compassLabel(h.windDirDeg),
      deg: h.windDirDeg,
    }));

    const nowX = toX(now, minTs, maxTs);

    return { sustainedPath, gustPath, fillPath, dirLabels, maxKt, minTs, maxTs, nowX };
  }, [hours, now]);

  if (!sustainedPath) return null;

  // y-axis reference lines at 8kt and 14kt
  const y8  = toY(8,  maxKt);
  const y14 = toY(14, maxKt);
  const botY = PAD_TOP + INNER_H;

  return (
    <div className="flex flex-col gap-1">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="wind-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fc3f7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4fc3f7" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Reference lines */}
        <line x1={PAD_X} y1={y8}  x2={W - PAD_X} y2={y8}
          stroke="rgba(255,200,0,0.15)" strokeWidth="1" strokeDasharray="3,4" />
        <line x1={PAD_X} y1={y14} x2={W - PAD_X} y2={y14}
          stroke="rgba(255,43,85,0.15)" strokeWidth="1" strokeDasharray="3,4" />
        <text x={W - PAD_X - 2} y={y8 - 3} textAnchor="end"
          style={{ fontSize: 7, fill: 'rgba(255,200,0,0.5)' }}>8kt</text>
        <text x={W - PAD_X - 2} y={y14 - 3} textAnchor="end"
          style={{ fontSize: 7, fill: 'rgba(255,43,85,0.5)' }}>14kt</text>

        {/* Fill */}
        <path d={fillPath} fill="url(#wind-fill)" />

        {/* Gust spikes */}
        {gustPath && (
          <path d={gustPath} fill="none" stroke="#ff8a65" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        )}

        {/* Sustained line */}
        <path d={sustainedPath} fill="none" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Now line */}
        <line x1={nowX} y1={PAD_TOP} x2={nowX} y2={botY}
          stroke="#00e887" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="3,3" />

        {/* Direction labels */}
        {dirLabels.map((d, i) => (
          <text key={i} x={d.x} y={H - 3} textAnchor="middle"
            style={{ fontSize: 8, fill: '#4a6a88', fontWeight: 600 }}>
            {d.label}
          </text>
        ))}
      </svg>

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
