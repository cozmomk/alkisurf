import { useMemo } from 'react';
import { uvColor, uvLabel } from '../utils.js';

const W = 320;
const H = 90;
const CX = W / 2;
const CY = H + 10; // center below the arc so it's a top-half arc
const R  = H + 5;

function arcPoint(frac) {
  const angle = Math.PI + frac * Math.PI; // π to 2π (left to right)
  return {
    x: CX + R * Math.cos(angle),
    y: CY + R * Math.sin(angle),
  };
}

function fmt(ts) {
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric', hour12: true,
  });
}

export default function UvArc({ forecast, sunriseTs, sunsetTs }) {
  const now = Date.now();

  const { arcPath, uvPoints, nowPt, peakPt, currentUv } = useMemo(() => {
    if (!sunriseTs || !sunsetTs || !forecast?.length) return {};
    const span = sunsetTs - sunriseTs;

    // arc path: sunrise to sunset
    const steps = 60;
    const arcPts = Array.from({ length: steps + 1 }, (_, i) => arcPoint(i / steps));
    const arcPath = arcPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // forecast hours within daylight window
    const dayHours = forecast.filter(h => h.time >= sunriseTs && h.time <= sunsetTs && h.uvIndex != null);

    const uvPoints = dayHours.map(h => {
      const frac = (h.time - sunriseTs) / span;
      const pt = arcPoint(frac);
      const uv = Math.round(h.uvIndex);
      return { ...pt, uv, frac, ts: h.time };
    });

    // current UV
    const closest = forecast.reduce((best, h) =>
      Math.abs(h.time - now) < Math.abs(best.time - now) ? h : best
    , forecast[0]);
    const currentUv = closest?.uvIndex != null ? Math.round(closest.uvIndex) : null;

    // now position on arc
    let nowPt = null;
    if (now >= sunriseTs && now <= sunsetTs) {
      const frac = (now - sunriseTs) / span;
      nowPt = { ...arcPoint(frac), frac };
    }

    // peak
    const peakHour = dayHours.reduce((best, h) => (h.uvIndex > (best?.uvIndex ?? -1) ? h : best), null);
    let peakPt = null;
    if (peakHour) {
      const frac = (peakHour.time - sunriseTs) / span;
      peakPt = { ...arcPoint(frac), uv: Math.round(peakHour.uvIndex), ts: peakHour.time };
    }

    return { arcPath, uvPoints, nowPt, peakPt, currentUv };
  }, [forecast, sunriseTs, sunsetTs, now]);

  if (!arcPath) return (
    <div className="flex items-center justify-center" style={{ height: H }}>
      <span style={{ fontSize: 11, color: '#3a5a70' }}>UV data unavailable</span>
    </div>
  );

  const srPt = arcPoint(0);
  const ssPt = arcPoint(1);

  return (
    <div className="flex flex-col gap-1">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Background arc */}
        <path d={arcPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />

        {/* Colored arc segments */}
        {uvPoints.length > 1 && uvPoints.map((pt, i) => {
          if (i === 0) return null;
          const prev = uvPoints[i - 1];
          const avgUv = (pt.uv + prev.uv) / 2;
          return (
            <line key={i}
              x1={prev.x.toFixed(1)} y1={prev.y.toFixed(1)}
              x2={pt.x.toFixed(1)} y2={pt.y.toFixed(1)}
              stroke={uvColor(avgUv)} strokeWidth="4" strokeLinecap="round" opacity="0.85"
            />
          );
        })}

        {/* Sunrise label */}
        <text x={srPt.x} y={srPt.y + 12} textAnchor="middle"
          style={{ fontSize: 8, fill: '#3a5a70' }}>
          🌅 {fmt(sunriseTs)}
        </text>

        {/* Sunset label */}
        <text x={ssPt.x} y={ssPt.y + 12} textAnchor="middle"
          style={{ fontSize: 8, fill: '#3a5a70' }}>
          🌇 {fmt(sunsetTs)}
        </text>

        {/* Peak UV label */}
        {peakPt && (
          <g>
            <circle cx={peakPt.x} cy={peakPt.y} r={5} fill={uvColor(peakPt.uv)} />
            <text x={peakPt.x} y={peakPt.y - 10} textAnchor="middle"
              style={{ fontSize: 9, fill: uvColor(peakPt.uv), fontWeight: 700 }}>
              Peak {peakPt.uv}
            </text>
          </g>
        )}

        {/* Now marker */}
        {nowPt && (
          <g>
            <circle cx={nowPt.x} cy={nowPt.y} r={7} fill={uvColor(currentUv ?? 0)} fillOpacity="0.2" />
            <circle cx={nowPt.x} cy={nowPt.y} r={4} fill={uvColor(currentUv ?? 0)} />
            <circle cx={nowPt.x} cy={nowPt.y} r={1.5} fill="white" />
          </g>
        )}
      </svg>

      {/* Current UV readout */}
      {currentUv != null && (
        <div className="flex items-center justify-center gap-1.5">
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: uvColor(currentUv) }} />
          <span style={{ fontSize: 11, color: uvColor(currentUv), fontWeight: 700 }}>
            UV {currentUv} · {uvLabel(currentUv)}
          </span>
          <span style={{ fontSize: 10, color: '#3a5a70' }}>now</span>
        </div>
      )}
    </div>
  );
}
