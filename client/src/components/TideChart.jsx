import { useMemo } from 'react';

// ─── geometry ───────────────────────────────────────────────────────────────
const W = 320;
const H = 96;
const PAD_X = 4;
const PAD_TOP = 28;   // room for high-tide labels above the curve
const PAD_BOT = 18;   // room for low-tide labels below the curve
const INNER_H = H - PAD_TOP - PAD_BOT;

function toY(ft, minFt, maxFt) {
  const frac = (ft - minFt) / (maxFt - minFt || 1);
  return PAD_TOP + INNER_H * (1 - frac); // SVG y=0 at top
}

function toX(ts, minTs, maxTs) {
  return PAD_X + (W - 2 * PAD_X) * (ts - minTs) / (maxTs - minTs || 1);
}

function cosineInterp(t1, h1, t2, h2, t) {
  const frac = Math.max(0, Math.min(1, (t - t1) / (t2 - t1)));
  return h1 + (h2 - h1) * (1 - Math.cos(Math.PI * frac)) / 2;
}

function buildPath(hilos, minTs, maxTs, minFt, maxFt, steps = 160) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = minTs + (maxTs - minTs) * (i / steps);
    let h = hilos[0].ft;
    for (let j = 0; j < hilos.length - 1; j++) {
      if (t >= hilos[j].ts && t <= hilos[j + 1].ts) {
        h = cosineInterp(hilos[j].ts, hilos[j].ft, hilos[j + 1].ts, hilos[j + 1].ft, t);
        break;
      }
      if (t > hilos[hilos.length - 1].ts) h = hilos[hilos.length - 1].ft;
    }
    pts.push({ x: toX(t, minTs, maxTs), y: toY(h, minFt, maxFt) });
  }
  return pts;
}

function ptsToD(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(':00', '').replace(' ', '');
}

// ─── demo data (matches screenshot feel, set "now" mid-rise) ────────────────
function buildDemoHilos() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const h = (hr, min) => base.getTime() + (hr * 60 + min) * 60000;
  return [
    { type: 'H', ft: 6.5, ts: h(5, 52) },
    { type: 'L', ft: 0.4, ts: h(13, 36) },
    { type: 'H', ft: 5.4, ts: h(18, 37) },
    { type: 'L', ft: 1.1, ts: h(23, 50) },
  ];
}

// ─── main component ──────────────────────────────────────────────────────────
export default function TideChart({ currentFt, tideDirection, nextHilos, demo = false }) {
  const now = demo
    ? (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() + (14 * 60 + 5) * 60000; })()
    : Date.now();

  // Build hilos array: anchor at "now" using currentFt, then nextHilos forward
  const hilos = useMemo(() => {
    if (demo) return buildDemoHilos();
    const upcoming = (nextHilos ?? []).filter(h => h.ts > now - 3600000);
    if (!upcoming.length) return [];
    // Synthesize a current anchor so the curve starts from real current height
    const anchor = { type: 'anchor', ft: currentFt ?? upcoming[0].ft, ts: now - 3600000 };
    return [anchor, ...upcoming.map(h => ({ type: h.type, ft: h.ft, ts: h.ts }))];
  }, [nextHilos, currentFt, now, demo]);

  const displayFt  = demo ? 2.3 : (currentFt ?? null);
  const displayDir = demo ? 'rising' : (tideDirection ?? null);

  const { pathD, fillD, curDot, visHilos, minTs, maxTs, minFt, maxFt } = useMemo(() => {
    if (hilos.length < 2) return {};

    // show window: 2 h before now → 8 h after now
    const minTs = now - 2 * 3600000;
    const maxTs = now + 8 * 3600000;
    const allFt = hilos.map(h => h.ft);
    const minFt = Math.min(...allFt) - 0.3;
    const maxFt = Math.max(...allFt) + 0.3;

    const pts = buildPath(hilos, minTs, maxTs, minFt, maxFt);
    const pathD = ptsToD(pts);

    // fill path (close to bottom)
    const botY = toY(minFt, minFt, maxFt);
    const fillD = pathD + ` L${pts[pts.length - 1].x.toFixed(1)},${botY.toFixed(1)} L${pts[0].x.toFixed(1)},${botY.toFixed(1)} Z`;

    // current dot position — interpolate height from hilos
    let curH = hilos[0].ft;
    for (let j = 0; j < hilos.length - 1; j++) {
      if (now >= hilos[j].ts && now <= hilos[j + 1].ts) {
        curH = cosineInterp(hilos[j].ts, hilos[j].ft, hilos[j + 1].ts, hilos[j + 1].ft, now);
        break;
      }
    }
    const curDot = {
      x: toX(now, minTs, maxTs),
      y: toY(curH, minFt, maxFt),
      ft: displayFt ?? curH,
    };

    // which hilos fall in the visible window
    const visHilos = hilos.filter(h => h.ts >= minTs && h.ts <= maxTs);

    return { pathD, fillD, curDot, visHilos, minTs, maxTs, minFt, maxFt };
  }, [hilos, now, displayFt]);

  if (!pathD) return null;

  const arrowIcon = displayDir === 'rising' ? '↑' : displayDir === 'falling' ? '↓' : '→';
  const arrowColor = displayDir === 'rising' ? '#4fc3f7' : displayDir === 'falling' ? '#ff8a65' : '#90a4ae';

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontSize: 22, fontWeight: 900, color: '#e2eef7', lineHeight: 1 }}>
          {displayFt != null ? `${displayFt.toFixed(1)}'` : '—'}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: arrowColor }}>
          {arrowIcon} {displayDir}
        </span>
      </div>

      {/* SVG chart */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="tide-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fc3f7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4fc3f7" stopOpacity="0.04" />
          </linearGradient>
          <clipPath id="tide-clip">
            <rect x={PAD_X} y={0} width={W - 2 * PAD_X} height={H} />
          </clipPath>
        </defs>

        {/* Fill */}
        <path d={fillD} fill="url(#tide-fill)" clipPath="url(#tide-clip)" />

        {/* Curve line */}
        <path d={pathD} fill="none" stroke="#4fc3f7" strokeWidth="2.5"
          strokeLinecap="round" clipPath="url(#tide-clip)" />

        {/* Hi/Lo labels */}
        {visHilos.map((hilo, i) => {
          const x = toX(hilo.ts, minTs, maxTs);
          const y = toY(hilo.ft, minFt, maxFt);
          const isHigh = hilo.type === 'H';
          const labelY = isHigh ? y - 14 : y + 22;
          const ftY    = isHigh ? y - 4  : y + 32;
          return (
            <g key={i}>
              {/* dot on curve */}
              <circle cx={x} cy={y} r={3.5} fill="#1a3a50" stroke="#4fc3f7" strokeWidth="1.5" />
              {/* time */}
              <text x={x} y={labelY} textAnchor="middle"
                style={{ fontSize: 9, fill: '#7a9ab8', fontWeight: 500 }}>
                {fmtTime(hilo.ts)}
              </text>
              {/* height */}
              <text x={x} y={ftY} textAnchor="middle"
                style={{ fontSize: 10, fill: '#c8dff0', fontWeight: 700 }}>
                {hilo.ft.toFixed(1)}'
              </text>
            </g>
          );
        })}

        {/* Current position dot */}
        {curDot && (
          <g>
            {/* glow ring */}
            <circle cx={curDot.x} cy={curDot.y} r={8} fill="#4fc3f7" fillOpacity="0.15" />
            <circle cx={curDot.x} cy={curDot.y} r={5} fill="#4fc3f7" />
            <circle cx={curDot.x} cy={curDot.y} r={2.5} fill="white" />
          </g>
        )}
      </svg>
    </div>
  );
}
