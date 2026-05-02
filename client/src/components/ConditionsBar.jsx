import { compassLabel, uvColor, uvLabel } from '../utils.js';

function Pill({ label, value, icon }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3">
      <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#5a7fa0' }}>
        {icon && <span className="mr-1">{icon}</span>}{label}
      </span>
      <span className="text-sm font-semibold" style={{ color: '#e2eef7' }}>{value ?? '—'}</span>
    </div>
  );
}

function TideArrow({ direction }) {
  const arrows = { rising: '↑', falling: '↓', slack: '→' };
  const colors = { rising: '#4fc3f7', falling: '#ff8a65', slack: '#90a4ae' };
  return (
    <span style={{ color: colors[direction] || '#90a4ae', fontWeight: 700 }}>
      {arrows[direction] || '—'}
    </span>
  );
}

function SkyIcon({ skyCover }) {
  if (skyCover == null) return '—';
  if (skyCover <= 15) return '☀️';
  if (skyCover <= 35) return '🌤';
  if (skyCover <= 60) return '⛅';
  if (skyCover <= 80) return '🌥';
  return '☁️';
}

export default function ConditionsBar({ current, nextHilos, uvIndex, precipInPerHr, precipProbability }) {
  if (!current) {
    return (
      <div className="card px-4 py-3 text-center text-xs" style={{ color: '#5a7fa0' }}>
        Loading current conditions…
      </div>
    );
  }

  const nextHilo = nextHilos?.[0];
  const tideStr = current.tideCurrentFt != null
    ? `${current.tideCurrentFt.toFixed(1)} ft`
    : '—';

  const windStr = current.windSpeedKt != null
    ? `${Math.round(current.windSpeedKt)} kt ${compassLabel(current.windDirDeg)}`
    : '—';

  const gustStr = current.windGustKt != null && current.windGustKt > current.windSpeedKt + 2
    ? `G${Math.round(current.windGustKt)}`
    : null;

  const nextTideStr = nextHilo
    ? `${nextHilo.type === 'H' ? 'High' : 'Low'} ${nextHilo.ft?.toFixed(1)} ft at ${
        new Date(nextHilo.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      }`
    : null;

  const uv = uvIndex != null ? Math.round(uvIndex) : null;
  const showPrecip = precipInPerHr != null && precipInPerHr > 0 && precipProbability != null && precipProbability > 20;
  const precipStr = showPrecip
    ? (precipInPerHr < 0.01 ? '< 0.01"/hr' : `${precipInPerHr.toFixed(2)}"/hr`)
    : null;

  const sep = <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.08)' }} />;

  return (
    <div className="card px-2 py-3">
      <div className="flex items-center justify-around flex-wrap gap-y-2">
        <Pill label="Water" value={current.waterTempF != null ? `${Math.round(current.waterTempF)}°F` : '—'} />
        {sep}
        <Pill label="Air" value={current.airTempF != null ? `${Math.round(current.airTempF)}°F` : '—'} />
        {sep}
        {uv != null && (
          <>
            <div className="flex flex-col items-center gap-0.5 px-3">
              <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#5a7fa0' }}>UV</span>
              <span className="text-sm font-semibold" style={{ color: uvColor(uv) }}>{uv} · {uvLabel(uv)}</span>
            </div>
            {sep}
          </>
        )}
        {precipStr && (
          <>
            <div className="flex flex-col items-center gap-0.5 px-3">
              <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#5a7fa0' }}>Rain</span>
              <span className="text-sm font-semibold" style={{ color: '#7ab8e8' }}>{precipStr}</span>
            </div>
            {sep}
          </>
        )}
        <Pill
          label="Wind"
          value={<span>{windStr}{gustStr && <span className="ml-1 text-[11px]" style={{ color: '#ff8a65' }}>{gustStr}</span>}</span>}
        />
        {sep}
        <div className="flex flex-col items-center gap-0.5 px-3">
          <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#5a7fa0' }}>Tide</span>
          <span className="text-sm font-semibold" style={{ color: '#e2eef7' }}>
            {tideStr} <TideArrow direction={current.tideDirection} />
          </span>
          {nextTideStr && (
            <span className="text-[10px]" style={{ color: '#5a7fa0' }}>{nextTideStr}</span>
          )}
        </div>
      </div>
    </div>
  );
}
