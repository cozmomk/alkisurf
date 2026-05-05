import { useState } from 'react';
import { compassLabel, uvColor, uvLabel } from '../utils.js';
import TideChart from './TideChart.jsx';
import WeatherStrip from './WeatherStrip.jsx';
import WindChart from './WindChart.jsx';
import UvArc from './UvArc.jsx';

// ─── sub-components ──────────────────────────────────────────────────────────

function TideArrow({ direction }) {
  const arrows = { rising: '↑', falling: '↓', slack: '→' };
  const colors  = { rising: '#4fc3f7', falling: '#ff8a65', slack: '#90a4ae' };
  return (
    <span style={{ color: colors[direction] || '#90a4ae', fontWeight: 700 }}>
      {arrows[direction] || '—'}
    </span>
  );
}

function formatSunTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function daylightStr(sunriseTs, sunsetTs) {
  const mins = Math.round((sunsetTs - sunriseTs) / 60000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ label, value, tappable, active, onClick }) {
  return (
    <button
      onClick={tappable ? onClick : undefined}
      style={{
        background: 'none',
        border: 'none',
        padding: '6px 10px',
        cursor: tappable ? 'pointer' : 'default',
        borderRadius: 8,
        transition: 'background 0.15s',
        backgroundColor: active ? 'rgba(255,255,255,0.07)' : 'transparent',
        WebkitTapHighlightColor: 'transparent',
        minHeight: 44,
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-semibold tracking-widest uppercase flex items-center gap-0.5"
          style={{ color: active ? '#7ab8e8' : '#5a7fa0' }}>
          {label}
          {tappable && (
            <span style={{ fontSize: 7, opacity: 0.6, marginLeft: 1 }}>{active ? '▴' : '▾'}</span>
          )}
        </span>
        <span className="text-sm font-semibold" style={{ color: active ? '#e2eef7' : '#c8dff0' }}>
          {value ?? '—'}
        </span>
      </div>
    </button>
  );
}

// ─── sliding panel wrapper ───────────────────────────────────────────────────

function Panel({ open, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: open ? '1fr' : '0fr',
      transition: 'grid-template-rows 0.28s ease',
    }}>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ paddingTop: 12, paddingBottom: 4 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ConditionsBar({
  current, nextHilos, uvIndex, precipInPerHr, precipProbability,
  sunriseTs, sunsetTs, forecast,
}) {
  const [activePanel, setActivePanel] = useState(null);

  const toggle = (panel) => setActivePanel(p => p === panel ? null : panel);

  if (!current) {
    return (
      <div className="card px-4 py-3 text-center text-xs" style={{ color: '#5a7fa0' }}>
        Loading current conditions…
      </div>
    );
  }

  const nextHilo = nextHilos?.[0];
  const tideStr = current.tideCurrentFt != null ? `${current.tideCurrentFt.toFixed(1)} ft` : '—';

  const windStr = current.windSpeedKt != null
    ? `${Math.round(current.windSpeedKt)} kt ${compassLabel(current.windDirDeg)}`
    : '—';
  const gustStr = current.windGustKt != null && current.windGustKt > current.windSpeedKt + 2
    ? ` G${Math.round(current.windGustKt)}`
    : '';

  const nextTideStr = nextHilo
    ? `${nextHilo.type === 'H' ? '↑' : '↓'} ${nextHilo.ft?.toFixed(1)} ft ${
        new Date(nextHilo.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      }`
    : null;

  const uv = uvIndex != null ? Math.round(uvIndex) : null;

  const sep = <div className="w-px" style={{ height: 36, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />;

  return (
    <div className="card px-2 py-3">

      {/* Pills row */}
      <div className="flex items-center justify-around">

        <Pill
          label="Water"
          value={current.waterTempF != null ? `${Math.round(current.waterTempF)}°F` : '—'}
        />
        {sep}
        <Pill
          label="Air"
          tappable
          active={activePanel === 'air'}
          onClick={() => toggle('air')}
          value={current.airTempF != null ? `${Math.round(current.airTempF)}°F` : '—'}
        />
        {sep}
        {uv != null && (
          <>
            <Pill
              label="UV"
              tappable
              active={activePanel === 'uv'}
              onClick={() => toggle('uv')}
              value={<span style={{ color: uvColor(uv) }}>{uv} · {uvLabel(uv)}</span>}
            />
            {sep}
          </>
        )}
        <Pill
          label="Wind"
          tappable
          active={activePanel === 'wind'}
          onClick={() => toggle('wind')}
          value={<span>{windStr}{gustStr && <span style={{ color: '#ff8a65' }}>{gustStr}</span>}</span>}
        />
        {sep}
        <Pill
          label="Tide"
          tappable
          active={activePanel === 'tide'}
          onClick={() => toggle('tide')}
          value={
            <span>
              {tideStr} <TideArrow direction={current.tideDirection} />
            </span>
          }
        />
      </div>

      {/* Tide sub-label */}
      {nextTideStr && activePanel !== 'tide' && (
        <div className="text-center mt-0.5">
          <span className="text-[10px]" style={{ color: '#3a5a70' }}>{nextTideStr}</span>
        </div>
      )}

      {/* Sunrise / Sunset row */}
      {(sunriseTs || sunsetTs) && (
        <>
          <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.06)', marginTop: 8 }} />
          <div className="flex items-center justify-center gap-5 w-full pt-2">
            {sunriseTs && (
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 13 }}>🌅</span>
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium tracking-widest uppercase" style={{ color: '#5a7fa0' }}>Sunrise</span>
                  <span className="text-[11px] font-semibold" style={{ color: '#e2eef7' }}>{formatSunTime(sunriseTs)}</span>
                </div>
              </div>
            )}
            {sunriseTs && sunsetTs && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-medium tracking-widest uppercase" style={{ color: '#3a5a70' }}>Daylight</span>
                <span className="text-[11px] font-semibold" style={{ color: '#5a7fa0' }}>{daylightStr(sunriseTs, sunsetTs)}</span>
              </div>
            )}
            {sunsetTs && (
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 13 }}>🌇</span>
                <div className="flex flex-col">
                  <span className="text-[9px] font-medium tracking-widest uppercase" style={{ color: '#5a7fa0' }}>Sunset</span>
                  <span className="text-[11px] font-semibold" style={{ color: '#e2eef7' }}>{formatSunTime(sunsetTs)}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Panels ── */}
      <div style={{ paddingInline: 4 }}>

        {/* TIDE */}
        <Panel open={activePanel === 'tide'}>
          <TideChart
            currentFt={current.tideCurrentFt}
            tideDirection={current.tideDirection}
            nextHilos={nextHilos}
          />
        </Panel>

        {/* WIND */}
        <Panel open={activePanel === 'wind'}>
          <WindChart forecast={forecast} />
        </Panel>

        {/* AIR / weather strip */}
        <Panel open={activePanel === 'air'}>
          <WeatherStrip forecast={forecast} />
        </Panel>

        {/* UV arc */}
        <Panel open={activePanel === 'uv'}>
          <UvArc forecast={forecast} sunriseTs={sunriseTs} sunsetTs={sunsetTs} />
        </Panel>

      </div>
    </div>
  );
}
