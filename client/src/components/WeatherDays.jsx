import { scoreColor, skyEmoji, uvColor, uvLabel, compassLabel } from '../utils.js';

function ptDayKey(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function ptHour(ts) {
  return parseInt(new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false,
  }));
}

function groupByDay(forecast) {
  const days = new Map();
  const now = Date.now();
  for (const h of forecast) {
    if (h.time < now - 3600000) continue;
    const key = ptDayKey(h.time);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(h);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 3);
}

function summarizeDay(dayKey, hours, bestWindows) {
  const temps = hours.map(h => h.airTempF).filter(v => v != null);
  const winds = hours.map(h => h.windSpeedKt).filter(v => v != null);
  const uvs = hours.map(h => h.uvIndex).filter(v => v != null);
  const precips = hours.map(h => h.precipProbability).filter(v => v != null);

  // Take midday hour for representative sky/wind direction
  const dayHours = hours.filter(h => { const hr = ptHour(h.time); return hr >= 6 && hr <= 20; });
  const noonHour = (dayHours.length ? dayHours : hours).reduce((best, h) =>
    Math.abs(ptHour(h.time) - 12) < Math.abs(ptHour(best.time) - 12) ? h : best
  );

  // Best window for this day
  const now = Date.now();
  const dayWindows = (bestWindows || []).filter(w =>
    ptDayKey(w.start) === dayKey && w.end > now
  );
  // Pair N+S windows that overlap
  const northWin = dayWindows.filter(w => w.side === 'north').sort((a, b) => b.score - a.score)[0];
  const southWin = dayWindows.filter(w => w.side === 'south').sort((a, b) => b.score - a.score)[0];
  const bestWin = dayWindows.sort((a, b) => b.score - a.score)[0] ?? null;

  return {
    dayKey,
    highF: temps.length ? Math.round(Math.max(...temps)) : null,
    lowF: temps.length ? Math.round(Math.min(...temps)) : null,
    windMin: winds.length ? Math.round(Math.min(...winds)) : null,
    windMax: winds.length ? Math.round(Math.max(...winds)) : null,
    windDir: compassLabel(noonHour?.windDirDeg),
    uvPeak: uvs.length ? Math.round(Math.max(...uvs)) : null,
    precipMax: precips.length ? Math.round(Math.max(...precips)) : null,
    skyCover: noonHour?.skyCover ?? null,
    ts: noonHour?.time ?? hours[0]?.time,
    bestWin,
    northWin,
    southWin,
  };
}

function fmt(ts, opts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...opts });
}

function DayCard({ summary, isFirst, isSecond }) {
  const { highF, lowF, windMin, windMax, windDir, uvPeak, precipMax, skyCover, ts, bestWin, northWin, southWin } = summary;
  const sky = skyEmoji(skyCover, ts);
  const hasWindow = bestWin != null;
  const label = isFirst ? 'Today' : isSecond ? 'Tomorrow' : fmt(ts, { weekday: 'short' });
  const dateStr = fmt(ts, { month: 'short', day: 'numeric' });

  return (
    <div className="card p-3 flex flex-col gap-2 flex-1 min-w-0"
      style={hasWindow ? { borderColor: 'rgba(0,232,135,0.18)' } : {}}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold" style={{ color: '#e2eef7' }}>{label}</div>
          <div className="text-[9px]" style={{ color: '#3a5a70' }}>{dateStr}</div>
        </div>
        {sky && <span style={{ fontSize: 18 }}>{sky}</span>}
      </div>

      {/* Temp */}
      {highF != null && (
        <div className="flex items-baseline gap-1">
          <span className="text-base font-black" style={{ color: '#c8dff0' }}>{highF}°</span>
          <span className="text-[9px]" style={{ color: '#3a5a70' }}>/ {lowF}°F</span>
        </div>
      )}

      {/* Wind */}
      {windMax != null && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px]" style={{ color: '#3a5a70' }}>Wind</span>
          <span className="text-[10px] font-semibold" style={{ color: '#c8dff0' }}>
            {windMin === windMax ? `${windMax}kt` : `${windMin}–${windMax}kt`} {windDir}
          </span>
        </div>
      )}

      {/* UV */}
      {uvPeak != null && (
        <div className="flex items-center gap-1">
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: uvColor(uvPeak), flexShrink: 0 }} />
          <span className="text-[9px] font-semibold" style={{ color: uvColor(uvPeak) }}>
            UV {uvPeak} · {uvLabel(uvPeak)}
          </span>
        </div>
      )}

      {/* Precip */}
      {precipMax != null && precipMax > 5 && (
        <div className="flex items-center justify-between">
          <span className="text-[8px]" style={{ color: '#3a5a70' }}>Rain</span>
          <span className="text-[9px] font-semibold" style={{ color: precipMax > 50 ? '#7ab8e8' : '#4a6a88' }}>
            {precipMax}%
          </span>
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* Best window */}
      {hasWindow ? (
        <BestWindowSection northWin={northWin} southWin={southWin} bestWin={bestWin} />
      ) : (
        <div className="flex items-center gap-1">
          <span style={{ color: '#ff2b55', fontSize: 10 }}>✕</span>
          <span className="text-[9px]" style={{ color: '#3a5a70' }}>No windows ≥7</span>
        </div>
      )}
    </div>
  );
}

function BestWindowSection({ northWin, southWin, bestWin }) {
  const hasBoth = northWin && southWin;

  if (hasBoth) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[8px]" style={{ color: '#3a5a70' }}>Best windows</span>
        <WindowRow w={northWin} sideLabel="N" />
        <WindowRow w={southWin} sideLabel="S" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px]" style={{ color: '#3a5a70' }}>Best window · {bestWin.side === 'north' ? 'N' : 'S'} side</span>
      <div className="flex items-center gap-1.5">
        <span className="text-lg font-black leading-none" style={{ color: scoreColor(bestWin.score) }}>
          {bestWin.score}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] font-bold truncate" style={{ color: scoreColor(bestWin.score) }}>
            {bestWin.label}
          </span>
          <span className="text-[8px]" style={{ color: '#5a7fa0' }}>
            {fmtWindow(bestWin.start, bestWin.end)}
          </span>
        </div>
      </div>
    </div>
  );
}

function WindowRow({ w, sideLabel }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] font-bold w-3" style={{ color: '#3a5a70' }}>{sideLabel}</span>
      <span className="text-sm font-black leading-none" style={{ color: scoreColor(w.score) }}>{w.score}</span>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[8px] font-bold truncate" style={{ color: scoreColor(w.score) }}>{w.label}</span>
        <span className="text-[8px]" style={{ color: '#5a7fa0' }}>{fmtWindow(w.start, w.end)}</span>
      </div>
    </div>
  );
}

function fmtWindow(start, end) {
  const s = new Date(start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: true });
  const e = new Date(end).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: true });
  return `${s} – ${e}`;
}

export default function WeatherDays({ forecast, bestWindows }) {
  if (!forecast?.length) return null;
  const days = groupByDay(forecast);
  if (!days.length) return null;

  const summaries = days.map(([key, hours]) => summarizeDay(key, hours, bestWindows));

  return (
    <div className="card p-4 flex flex-col gap-3">
      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#5a7fa0' }}>
        3-Day Outlook
      </span>
      <div className="flex gap-2">
        {summaries.map((s, i) => (
          <DayCard key={s.dayKey} summary={s} isFirst={i === 0} isSecond={i === 1} />
        ))}
      </div>
    </div>
  );
}
