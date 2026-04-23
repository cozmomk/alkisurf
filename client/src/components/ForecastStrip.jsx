import { scoreColor } from '../utils.js';

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
  const { score } = sideData;
  const color = scoreColor(score);
  const hour12 = fmt(hour.time, { hour: 'numeric', hour12: true });

  return (
    <div className="forecast-cell card flex flex-col items-center gap-1.5 p-2"
      style={{ borderTop: `3px solid ${color}` }}>
      <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: '#5a7fa0' }}>
        {hour12}
      </span>
      <span className="text-xl font-black leading-none" style={{ color }}>
        {score}
      </span>
      <span className="text-[9px] font-semibold tracking-wide text-center leading-tight"
        style={{ color: '#5a7fa0' }}>
        {sideData.label?.split(' ')[0]}
      </span>
      {hour.windSpeedKt != null && (
        <span className="text-[10px]" style={{ color: '#4a6a88' }}>
          {Math.round(hour.windSpeedKt)}kt
        </span>
      )}
    </div>
  );
}

export default function ForecastStrip({ forecast, side }) {
  if (!forecast?.length) return null;

  // Group by day for dividers
  let prevTs = null;
  const now = Date.now();

  return (
    <div>
      <div className="forecast-strip">
        {forecast.map((h, i) => {
          const showDivider = i > 0 && fmt(h.time, { day: 'numeric' }) !== fmt(forecast[i-1].time, { day: 'numeric' });
          return (
            <div key={h.time} className="flex items-end gap-1.5">
              {showDivider && (
                <div className="flex-shrink-0 flex items-center self-stretch">
                  <div className="flex flex-col items-center justify-center gap-1 px-1">
                    <div style={{ width: 1, height: '100%', minHeight: 40, background: 'rgba(255,255,255,0.10)' }} />
                  </div>
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
