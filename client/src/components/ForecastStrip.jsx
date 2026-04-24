import { useRef, useEffect } from 'react';
import { scoreColor, compassLabel } from '../utils.js';

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

function DayDivider({ ts, prev }) {
  const day = fmt(ts, { weekday: 'short', month: 'short', day: 'numeric' });
  const prevDay = prev ? fmt(prev, { weekday: 'short' }) : null;
  if (prevDay === fmt(ts, { weekday: 'short' })) return null;
  return (
    <div className="flex items-center gap-2 flex-shrink-0 self-center">
      <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }} />
      <span className="text-[10px] font-bold tracking-widest uppercase whitespace-nowrap"
        style={{ color: '#5a7fa0', writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: 70 }}>
        {day}
      </span>
    </div>
  );
}

function Cell({ hour, side }) {
  const sideData = hour.sides?.[side];
  if (!sideData) return null;
  const isPast = hour.time < Date.now();
  const actualScore = hour.actual?.[side]?.score ?? null;

  // Past cells: show actual score; future: show forecast score
  const displayScore = isPast && actualScore != null ? actualScore : sideData.score;
  const forecastScore = sideData.score;
  const color = scoreColor(displayScore);
  const hour12 = fmt(hour.time, { hour: 'numeric', hour12: true });
  const windDir = isPast && hour.actual?.windDirDeg != null
    ? compassLabel(hour.actual.windDirDeg)
    : hour.windDirDeg != null ? compassLabel(hour.windDirDeg) : '';
  const windSpeed = isPast && hour.actual?.windSpeedKt != null
    ? hour.actual.windSpeedKt
    : hour.windSpeedKt;
  const swellFt = hour.waveHeightFt != null ? hour.waveHeightFt.toFixed(1) : null;
  const showDelta = isPast && actualScore != null;
  const delta = showDelta ? actualScore - forecastScore : 0;

  return (
    <div className="forecast-cell card flex flex-col items-center gap-1 p-2"
      style={{
        borderTop: `3px solid ${color}`,
        minWidth: 56,
        opacity: isPast ? 0.72 : 1,
        background: isPast ? 'rgba(255,255,255,0.02)' : undefined,
      }}>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: isPast ? '#3a5a70' : '#5a7fa0' }}>
          {hour12}
        </span>
        {isPast && <span className="text-[8px]" style={{ color: '#2a4a60' }}>•</span>}
      </div>
      <span className="text-xl font-black leading-none" style={{ color }}>
        {displayScore}
      </span>
      {/* Delta badge for past cells */}
      {showDelta && delta !== 0 && (
        <span className="text-[8px] font-bold px-1 rounded" style={{
          color: delta > 0 ? '#00e887' : '#ff6b1a',
          background: delta > 0 ? 'rgba(0,232,135,0.1)' : 'rgba(255,107,26,0.1)',
        }}>
          {delta > 0 ? `+${delta}` : delta} fcst
        </span>
      )}
      {showDelta && delta === 0 && (
        <span className="text-[8px]" style={{ color: '#2a4a60' }}>≈ fcst</span>
      )}
      {!isPast && (
        <span className="text-[9px] font-semibold tracking-wide text-center leading-tight"
          style={{ color: '#5a7fa0' }}>
          {sideData.label?.split(' ')[0]}
        </span>
      )}
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

export default function ForecastStrip({ forecast, side }) {
  if (!forecast?.length) return null;
  const scrollRef = useRef(null);
  const nowMarkerRef = useRef(null);
  const now = Date.now();

  const hasPast = forecast.some(h => h.time < now && h.actual != null);

  // Scroll so "now" is near the left edge on mount
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
            <Cell hour={h} side={side} />
          </div>
        );
      })}
    </div>
    </div>
  );
}
