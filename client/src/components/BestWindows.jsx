import { scoreColor } from '../utils.js';

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

function SkyEmoji({ skyCover }) {
  if (skyCover == null) return null;
  if (skyCover <= 15) return '☀️';
  if (skyCover <= 35) return '🌤';
  if (skyCover <= 60) return '⛅';
  return '☁️';
}

export default function BestWindows({ windows }) {
  if (!windows?.length) return null;

  const upcoming = windows.filter(w => w.end > Date.now()).slice(0, 4);
  if (!upcoming.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#5a7fa0' }}>
          Best Windows
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: 'rgba(0, 232, 135, 0.12)', color: '#00e887' }}>
          SUP-optimized
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {upcoming.map((w, i) => {
          const color = scoreColor(w.score);
          const startStr = fmt(w.start, { weekday: 'short', hour: 'numeric', hour12: true });
          const endStr = fmt(w.end, { hour: 'numeric', hour12: true });
          const isToday = fmt(w.start, { day: 'numeric' }) === fmt(Date.now(), { day: 'numeric' });

          return (
            <div key={i} className="card px-4 py-3 flex items-center gap-4">
              {/* Score bubble */}
              <div className="flex-shrink-0 flex items-center justify-center rounded-full"
                style={{ width: 44, height: 44, background: `${color}18`, border: `1.5px solid ${color}55` }}>
                <span className="text-lg font-black" style={{ color }}>{w.score}</span>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isToday && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.08)', color: '#5a7fa0' }}>TODAY</span>
                  )}
                  <span className="text-sm font-semibold" style={{ color: '#e2eef7' }}>
                    {startStr} – {endStr}
                  </span>
                  <SkyEmoji skyCover={w.skyCover} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-medium capitalize" style={{ color: '#5a7fa0' }}>
                    {w.side === 'north' ? 'North Side (Elliott Bay)' : 'South Side (Open Sound)'}
                  </span>
                  {w.airTempF && (
                    <span className="text-xs" style={{ color: '#4a6a88' }}>
                      {Math.round(w.airTempF)}°F
                    </span>
                  )}
                </div>
              </div>

              {/* Right arrow */}
              <span style={{ color: '#5a7fa0' }}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
