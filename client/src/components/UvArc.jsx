import { useMemo } from 'react';
import { uvColor, uvLabel } from '../utils.js';

// Arc geometry — all labels fit within viewBox, no overflow:visible needed.
//   viewBox: 0 0 320 110
//   Arc peak (noon) → y = CY - R = 24
//   Arc endpoints   → y = CY = 96
//   Time labels     → y = CY + 12 = 108
const W     = 320;
const H_SVG = 110;
const CX    = W / 2;   // 160
const CY    = 96;      // arc endpoint y
const R     = 72;      // arc radius — peak at y=24

function arcPoint(frac) {
  const angle = Math.PI + frac * Math.PI; // π→2π (left=sunrise → top=noon → right=sunset)
  return {
    x: CX + R * Math.cos(angle),
    y: CY + R * Math.sin(angle),
  };
}

function fmt(ts) {
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function burnMinutes(uv) {
  if (!uv || uv <= 0) return null;
  const eff = uv * 1.5;
  if (eff <= 2)  return '>60';
  if (eff <= 4)  return '~35';
  if (eff <= 6)  return '~20';
  if (eff <= 8)  return '~12';
  if (eff <= 10) return '~8';
  return '<5';
}

function sunscreenTip(uv) {
  if (!uv) return null;
  if (uv <= 2)  return 'Low risk · hat recommended';
  if (uv <= 5)  return 'SPF 30+ · reapply every hour';
  if (uv <= 7)  return 'SPF 50+ · reapply every 45 min';
  if (uv <= 10) return 'SPF 50+ · reapply every 30 min';
  return 'Extreme · limit time on water';
}

export default function UvArc({ forecast, sunriseTs, sunsetTs }) {
  const now = Date.now();

  const derived = useMemo(() => {
    if (!sunriseTs || !sunsetTs || !forecast?.length) return null;
    const span = sunsetTs - sunriseTs;

    // Arc track path
    const steps   = 60;
    const arcPts  = Array.from({ length: steps + 1 }, (_, i) => arcPoint(i / steps));
    const arcPath = arcPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Forecast hours within daylight with UV data
    const dayHours = forecast.filter(h => h.time >= sunriseTs && h.time <= sunsetTs && h.uvIndex != null);

    const uvPoints = dayHours.map(h => {
      const frac = (h.time - sunriseTs) / span;
      return { ...arcPoint(frac), uv: Math.round(h.uvIndex), frac, ts: h.time };
    });

    // Current UV (nearest forecast hour to now)
    const closest   = forecast.reduce((b, h) => Math.abs(h.time - now) < Math.abs(b.time - now) ? h : b, forecast[0]);
    const currentUv = closest?.uvIndex != null ? Math.round(closest.uvIndex) : null;

    // NOW position on arc
    let nowPt = null;
    if (now >= sunriseTs && now <= sunsetTs) {
      const frac = (now - sunriseTs) / span;
      nowPt = { ...arcPoint(frac), frac };
    }

    // Peak UV today
    const peakHour = dayHours.reduce((b, h) => (h.uvIndex > (b?.uvIndex ?? -1) ? h : b), null);
    let peakPt = null;
    if (peakHour) {
      const frac = (peakHour.time - sunriseTs) / span;
      peakPt = { ...arcPoint(frac), uv: Math.round(peakHour.uvIndex), ts: peakHour.time, frac };
    }

    return { arcPath, uvPoints, nowPt, peakPt, currentUv };
  }, [forecast, sunriseTs, sunsetTs, now]);

  if (!derived) return (
    <div className="flex items-center justify-center" style={{ height: 80 }}>
      <span style={{ fontSize: 11, color: '#3a5a70' }}>UV data unavailable</span>
    </div>
  );

  const { arcPath, uvPoints, nowPt, peakPt, currentUv } = derived;

  const srPt = arcPoint(0);
  const ssPt = arcPoint(1);

  const burn   = burnMinutes(currentUv);
  const tip    = sunscreenTip(currentUv);

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>

      {/* ── Arc ── */}
      <svg width="100%" viewBox={`0 0 ${W} ${H_SVG}`} style={{ display: 'block' }}>

        {/* Background track */}
        <path d={arcPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />

        {/* Colored UV segments */}
        {uvPoints.length > 1 && uvPoints.map((pt, i) => {
          if (i === 0) return null;
          const prev  = uvPoints[i - 1];
          const avgUv = (pt.uv + prev.uv) / 2;
          return (
            <line key={i}
              x1={prev.x.toFixed(1)} y1={prev.y.toFixed(1)}
              x2={pt.x.toFixed(1)}  y2={pt.y.toFixed(1)}
              stroke={uvColor(avgUv)} strokeWidth="6" strokeLinecap="round" opacity="0.9"
            />
          );
        })}

        {/* NOW marker — dot only, no floating label */}
        {nowPt && (
          <g>
            <circle cx={nowPt.x} cy={nowPt.y} r={10} fill={uvColor(currentUv ?? 0)} fillOpacity="0.18" />
            <circle cx={nowPt.x} cy={nowPt.y} r={5.5} fill={uvColor(currentUv ?? 0)} />
            <circle cx={nowPt.x} cy={nowPt.y} r={2.2} fill="white" />
          </g>
        )}

        {/* Sunrise / sunset — plain time text, no emoji */}
        <text x={Math.max(4, srPt.x)} y={CY + 12} textAnchor="start"
          style={{ fontSize: 9, fill: '#3a5a70' }}>
          {fmt(sunriseTs)}
        </text>
        <text x={Math.min(W - 4, ssPt.x)} y={CY + 12} textAnchor="end"
          style={{ fontSize: 9, fill: '#3a5a70' }}>
          {fmt(sunsetTs)}
        </text>

      </svg>

      {/* ── Info strip: Now · Peak · Burns ── */}
      <div className="flex items-start px-2" style={{ gap: 0 }}>

        {/* NOW */}
        <div className="flex-1 flex flex-col items-center">
          <span style={{ fontSize: 8, color: '#5a7fa0', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Now</span>
          {currentUv != null ? (
            <>
              <span style={{ fontSize: 22, fontWeight: 900, color: uvColor(currentUv), lineHeight: 1.1 }}>{currentUv}</span>
              <span style={{ fontSize: 9, color: uvColor(currentUv), fontWeight: 600 }}>{uvLabel(currentUv)}</span>
            </>
          ) : (
            <span style={{ fontSize: 16, color: '#3a5a70' }}>—</span>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 44, background: 'rgba(255,255,255,0.08)', alignSelf: 'center' }} />

        {/* PEAK */}
        <div className="flex-1 flex flex-col items-center">
          <span style={{ fontSize: 8, color: '#5a7fa0', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Peak</span>
          {peakPt ? (
            <>
              <span style={{ fontSize: 22, fontWeight: 900, color: uvColor(peakPt.uv), lineHeight: 1.1 }}>{peakPt.uv}</span>
              <span style={{ fontSize: 9, color: '#5a7fa0' }}>{fmt(peakPt.ts)}</span>
            </>
          ) : (
            <span style={{ fontSize: 16, color: '#3a5a70' }}>—</span>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 44, background: 'rgba(255,255,255,0.08)', alignSelf: 'center' }} />

        {/* BURNS */}
        <div className="flex-1 flex flex-col items-center">
          <span style={{ fontSize: 8, color: '#5a7fa0', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Burns</span>
          {burn != null ? (
            <>
              <span style={{ fontSize: 22, fontWeight: 900, color: uvColor((currentUv ?? 0) * 1.5), lineHeight: 1.1 }}>{burn}</span>
              <span style={{ fontSize: 9, color: '#5a7fa0' }}>min on water</span>
            </>
          ) : (
            <span style={{ fontSize: 16, color: '#3a5a70' }}>—</span>
          )}
        </div>

      </div>

      {/* ── Sunscreen tip ── */}
      {tip && (
        <div style={{ fontSize: 9, color: '#3a5a70', textAlign: 'center', paddingBottom: 2 }}>
          {tip}
        </div>
      )}

    </div>
  );
}
