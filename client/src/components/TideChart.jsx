import { useRef, useEffect, useMemo } from 'react';

const PX_PER_HR = 36;
const H        = 108;
const PAD_TOP  = 28;   // room for high-tide labels above the curve
const PAD_BOT  = 30;   // time label row + lo-tide labels below
const PAD_L    = 4;
const PAD_R    = 20;
const INNER_H  = H - PAD_TOP - PAD_BOT;

function toY(ft, minFt, maxFt) {
  const frac = (ft - minFt) / (maxFt - minFt || 1);
  return PAD_TOP + INNER_H * (1 - frac);
}

function cosineInterp(t1, h1, t2, h2, t) {
  const frac = Math.max(0, Math.min(1, (t - t1) / (t2 - t1)));
  return h1 + (h2 - h1) * (1 - Math.cos(Math.PI * frac)) / 2;
}

function buildPath(hilos, minTs, svgW, minFt, maxFt, steps = 240) {
  const maxTs = minTs + svgW / PX_PER_HR * 3600000 - (PAD_L + PAD_R) / PX_PER_HR * 3600000;
  const pts = [];
  function xOf(ts) { return PAD_L + (ts - minTs) / 3600000 * PX_PER_HR; }
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
    pts.push({ x: xOf(t), y: toY(h, minFt, maxFt) });
  }
  return pts;
}

function ptsToD(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).replace(':00', '').replace(' ', '');
}

function fmtDay(ts) {
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles', weekday: 'short',
  });
}

function fmtTick(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

// ─── demo data ────────────────────────────────────────────────────────────────
function buildDemoHilos() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const h = (hr, min) => base.getTime() + (hr * 60 + min) * 60000;
  return [
    { type: 'H', ft: 6.5, ts: h(5,  52) },
    { type: 'L', ft: 0.4, ts: h(13, 36) },
    { type: 'H', ft: 5.4, ts: h(18, 37) },
    { type: 'L', ft: 1.1, ts: h(23, 50) },
    { type: 'H', ft: 7.1, ts: h(29, 30) },
    { type: 'L', ft: 0.8, ts: h(38, 10) },
  ];
}

// ─── main component ───────────────────────────────────────────────────────────
export default function TideChart({ currentFt, tideDirection, nextHilos, demo = false }) {
  const scrollRef = useRef(null);
  const now = demo
    ? (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() + (14 * 60 + 5) * 60000; })()
    : Date.now();

  const startTime = now - 2 * 3600000;
  const endTime   = now + 48 * 3600000;
  const svgW = Math.round(PAD_L + (endTime - startTime) / 3600000 * PX_PER_HR + PAD_R);
  const nowX = PAD_L + (now - startTime) / 3600000 * PX_PER_HR;

  function toX(ts) { return PAD_L + (ts - startTime) / 3600000 * PX_PER_HR; }

  // Build hilos: use the most-recent past hi-lo as left anchor when available (gives the
  // cosine curve the correct shape), then all future events. Without the past event, the
  // synthetic anchor at startTime compresses a long tidal cycle into a short window and the
  // curve shoots to the wrong value at NOW (e.g. anchor -1.4 ft at 8 AM → 10.9 ft at 10:30 AM
  // makes the curve show ~10 ft at 10 AM even though the actual low was at 3:27 AM).
  const hilos = useMemo(() => {
    if (demo) return buildDemoHilos();
    const all = nextHilos ?? [];
    const future = all.filter(h => h.ts > now).map(h => ({ type: h.type, ft: h.ft, ts: h.ts }));
    const pastEvent = [...all].filter(h => h.ts <= now).sort((a, b) => b.ts - a.ts)[0];
    if (!future.length) return [];
    if (pastEvent) {
      // Use real past hi-lo as left anchor — correct cosine shape across the full cycle
      return [{ type: pastEvent.type, ft: pastEvent.ft, ts: pastEvent.ts }, ...future];
    }
    // No past event: fall back to synthetic anchor at startTime with currentFt
    const anchor = { type: 'anchor', ft: currentFt ?? future[0].ft, ts: startTime };
    return [anchor, ...future];
  }, [nextHilos, currentFt, now, demo]);

  const displayFt  = demo ? 2.3 : (currentFt ?? null);
  const displayDir = demo ? 'rising' : (tideDirection ?? null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, nowX - 30);
    }
  }, [nowX]);

  const { pathD, fillD, curDot, visHilos, minFt, maxFt, timeTicks } = useMemo(() => {
    if (hilos.length < 2) return {};

    const allFt = hilos.map(h => h.ft);
    const minFt = Math.min(...allFt) - 0.4;
    const maxFt = Math.max(...allFt) + 0.4;

    // Build curve over the full window using pixel-based step count
    const steps = 300;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = startTime + (endTime - startTime) * (i / steps);
      let h = hilos[0].ft;
      for (let j = 0; j < hilos.length - 1; j++) {
        if (t >= hilos[j].ts && t <= hilos[j + 1].ts) {
          h = cosineInterp(hilos[j].ts, hilos[j].ft, hilos[j + 1].ts, hilos[j + 1].ft, t);
          break;
        }
        if (t > hilos[hilos.length - 1].ts) h = hilos[hilos.length - 1].ft;
      }
      pts.push({ x: toX(t), y: toY(h, minFt, maxFt) });
    }

    const pathD = ptsToD(pts);
    const botY  = toY(minFt, minFt, maxFt);
    const fillD = pathD
      + ` L${pts[pts.length - 1].x.toFixed(1)},${botY.toFixed(1)}`
      + ` L${pts[0].x.toFixed(1)},${botY.toFixed(1)} Z`;

    // Current dot
    let curH = hilos[0].ft;
    for (let j = 0; j < hilos.length - 1; j++) {
      if (now >= hilos[j].ts && now <= hilos[j + 1].ts) {
        curH = cosineInterp(hilos[j].ts, hilos[j].ft, hilos[j + 1].ts, hilos[j + 1].ft, now);
        break;
      }
    }
    const curDot = {
      x: toX(now),
      y: toY(curH, minFt, maxFt),
      ft: displayFt ?? curH,
    };

    // Hilos in visible window (exclude anchor)
    const visHilos = hilos.filter(h => h.type !== 'anchor' && h.ts >= startTime && h.ts <= endTime);

    // 2-hour time ticks across the window (aligned to Pacific even hours)
    const roundedStart = Math.floor(startTime / 3600000) * 3600000;
    const timeTicks = [];
    for (let ts = roundedStart; ts <= endTime + 3600000; ts += 3600000) {
      const hr = parseInt(fmtTick(ts, { hour: 'numeric', hour12: false })) % 24;
      if (hr % 2 === 0) {
        const isMidnight = hr === 0;
        timeTicks.push({
          x: toX(ts),
          label: isMidnight
            ? fmtTick(ts, { weekday: 'short' })
            : fmtTick(ts, { hour: 'numeric', hour12: true }),
          isMidnight,
          ts,
        });
      }
    }

    return { pathD, fillD, curDot, visHilos, minFt, maxFt, timeTicks };
  }, [hilos, now, displayFt]);

  if (!pathD) return null;

  const botY = toY(minFt, minFt, maxFt);
  const arrowIcon  = displayDir === 'rising' ? '↑' : displayDir === 'falling' ? '↓' : '→';
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

      <div className="scroll-fade" style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', marginInline: -4 }}
      >
        <svg width={svgW} height={H} viewBox={`0 0 ${svgW} ${H}`} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="tide-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4fc3f7" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4fc3f7" stopOpacity="0.04" />
            </linearGradient>
            <clipPath id="tide-clip">
              <rect x={PAD_L} y={0} width={svgW - PAD_L - PAD_R} height={H} />
            </clipPath>
          </defs>

          {/* Fill */}
          <path d={fillD} fill="url(#tide-fill)" clipPath="url(#tide-clip)" />

          {/* Curve */}
          <path d={pathD} fill="none" stroke="#4fc3f7" strokeWidth="2.5"
            strokeLinecap="round" clipPath="url(#tide-clip)" />

          {/* NOW line */}
          <line x1={nowX} y1={0} x2={nowX} y2={botY}
            stroke="#00e887" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="3,3" />

          {/* Midnight dividers */}
          {(timeTicks ?? []).filter(t => t.isMidnight).map(t => (
            <line key={t.ts} x1={t.x} y1={PAD_TOP} x2={t.x} y2={botY}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          ))}

          {/* Time tick labels — bottom row */}
          {(timeTicks ?? []).map(({ x, label, isMidnight, ts }) => (
            <text key={ts} x={x} y={H - 3} textAnchor="middle"
              style={{
                fontSize: isMidnight ? 8.5 : 8,
                fill: isMidnight ? '#5a7fa0' : '#3a5a70',
                fontWeight: isMidnight ? 700 : 400,
              }}>
              {label}
            </text>
          ))}

          {/* Hi/Lo labels */}
          {visHilos.map((hilo, i) => {
            const x = toX(hilo.ts);
            const y = toY(hilo.ft, minFt, maxFt);
            const isHigh = hilo.type === 'H';
            const labelY = isHigh ? y - 14 : y + 22;
            const ftY    = isHigh ? y - 4  : y + 32;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={3.5} fill="#1a3a50" stroke="#4fc3f7" strokeWidth="1.5" />
                <text x={x} y={labelY} textAnchor="middle"
                  style={{ fontSize: 9, fill: '#7a9ab8', fontWeight: 500 }}>
                  {fmtTime(hilo.ts)}
                </text>
                <text x={x} y={ftY} textAnchor="middle"
                  style={{ fontSize: 10, fill: '#c8dff0', fontWeight: 700 }}>
                  {hilo.ft.toFixed(1)}'
                </text>
              </g>
            );
          })}

          {/* Current dot */}
          {curDot && (
            <g>
              <circle cx={curDot.x} cy={curDot.y} r={8} fill="#4fc3f7" fillOpacity="0.15" />
              <circle cx={curDot.x} cy={curDot.y} r={5} fill="#4fc3f7" />
              <circle cx={curDot.x} cy={curDot.y} r={2.5} fill="white" />
            </g>
          )}
        </svg>
      </div>
      </div>
    </div>
  );
}
