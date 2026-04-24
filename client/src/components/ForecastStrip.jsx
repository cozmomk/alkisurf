import { useRef, useEffect } from 'react';
import { scoreColor, compassLabel } from '../utils.js';

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

function ScoreRow({ label, score, delta, showDelta }) {
  const color = scoreColor(score ?? 0);
  return (
    <div className="flex items-center justify-between gap-1.5 w-full">
      <span className="text-[8px] font-bold" style={{ color: '#3a5a70', minWidth: 8 }}>{label}</span>
      <span className="text-base font-black leading-none" style={{ color }}>{score ?? '—'}</span>
      {showDelta && delta !== 0 && (
        <span className="text-[7px] font-bold" style={{
          color: delta > 0 ? '#00e887' : '#ff6b1a',
        }}>{delta > 0 ? `+${delta}` : delta}</span>
      )}
      {showDelta && delta === 0 && (
        <span className="text-[7px]" style={{ color: '#2a4a60' }}>≈</span>
      )}
      {!showDelta && <span style={{ minWidth: 10 }} />}
    </div>
  );
}

function Cell({ hour }) {
  const north = hour.sides?.north;
  const south = hour.sides?.south;
  if (!north && !south) return null;

  const isPast = hour.time < Date.now();
  const actualN = hour.actual?.north?.score ?? null;
  const actualS = hour.actual?.south?.score ?? null;

  const displayN = isPast && actualN != null ? actualN : north?.score;
  const displayS = isPast && actualS != null ? actualS : south?.score;
  const deltaN = isPast && actualN != null ? actualN - (north?.score ?? 0) : 0;
  const deltaS = isPast && actualS != null ? actualS - (south?.score ?? 0) : 0;
  const showDeltaN = isPast && actualN != null;
  const showDeltaS = isPast && actualS != null;

  const bestScore = Math.max(displayN ?? 0, displayS ?? 0);
  const topColor = scoreColor(bestScore);

  const hour12 = fmt(hour.time, { hour: 'numeric', hour12: true });
  const windDir = isPast && hour.actual?.windDirDeg != null
    ? compassLabel(hour.actual.windDirDeg)
    : hour.windDirDeg != null ? compassLabel(hour.windDirDeg) : '';
  const windSpeed = isPast && hour.actual?.windSpeedKt != null
    ? hour.actual.windSpeedKt
    : hour.windSpeedKt;
  const swellFt = hour.waveHeightFt != null ? hour.waveHeightFt.toFixed(1) : null;

  return (
    <div className="forecast-cell card flex flex-col items-center gap-1 p-2"
      style={{
        borderTop: `3px solid ${topColor}`,
        minWidth: 52,
        opacity: isPast ? 0.72 : 1,
        background: isPast ? 'rgba(255,255,255,0.02)' : undefined,
      }}>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: isPast ? '#3a5a70' : '#5a7fa0' }}>
          {hour12}
        </span>
        {isPast && <span className="text-[8px]" style={{ color: '#2a4a60' }}>•</span>}
      </div>
      <div className="flex flex-col gap-0.5 w-full">
        <ScoreRow label="N" score={displayN} delta={deltaN} showDelta={showDeltaN} />
        <ScoreRow label="S" score={displayS} delta={deltaS} showDelta={showDeltaS} />
      </div>
      {windSpeed != null && (
        <span className="text-[9px] whitespace-nowrap" style={{ color: '#4a6a88' }}>
          {Math.round(windSpeed)}kt {windDir}
        </span>
      )}
      {swellFt != null && !isPast && (
        <span className="text-[9px] whitespace-nowrap" style={{ color: '#3a5a70' }}>
          {swellFt}ft
        </span>
      )}
    </div>
  );
}

export default function ForecastStrip({ forecast }) {
  if (!forecast?.length) return null;
  const scrollRef = useRef(null);
  const nowMarkerRef = useRef(null);
  const now = Date.now();

  const hasPast = forecast.some(h => h.time < now && h.actual != null);

  useEffect(() => {
    if (nowMarkerRef.current && scrollRef.current) {
      const el = nowMarkerRef.current;
      const container = scrollRef.current;
      container.scrollLeft = el.offsetLeft - 12;
    }
  }, [forecast]);

  return (
    <div>
      {hasPast && (
        <div className="flex items-center gap-1 mb-1.5 px-0.5">
          <span className="text-[9px]" style={{ color: '#3a5a70' }}>← scroll to see actual vs predicted</span>
        </div>
      )}
      <div ref={scrollRef} className="forecast-strip">
        {forecast.map((h, i) => {
          const isPast = h.time < now;
          const isNowBoundary = !isPast && i > 0 && forecast[i-1].time < now;
          const showDivider = i > 0 && fmt(h.time, { day: 'numeric' }) !== fmt(forecast[i-1].time, { day: 'numeric' });
          return (
            <div key={h.time} className="flex items-end gap-1.5">
              {isNowBoundary && (
                <div ref={nowMarkerRef} className="flex-shrink-0 flex items-center self-stretch">
                  <div className="flex flex-col items-center justify-center gap-0.5 px-1">
                    <div style={{ width: 1.5, height: '100%', minHeight: 40, background: '#00e887', opacity: 0.5 }} />
                    <span style={{ fontSize: 7, color: '#00e887', opacity: 0.7, writingMode: 'vertical-lr', letterSpacing: 1 }}>NOW</span>
                  </div>
                </div>
              )}
              {showDivider && !isNowBoundary && (
                <div className="flex-shrink-0 flex items-center self-stretch">
                  <div style={{ width: 1, height: '100%', minHeight: 40, background: 'rgba(255,255,255,0.10)' }} />
                </div>
              )}
              <Cell hour={h} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
