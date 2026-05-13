import { useState } from 'react';
import { compassLabel, uvColor, uvLabel, conditionsEmoji, scoreColor } from '../utils.js';
import TideChart from './TideChart.jsx';
import WeatherStrip from './WeatherStrip.jsx';
import WindChart from './WindChart.jsx';
import UvArc from './UvArc.jsx';
import ScoreChart from './ScoreChart.jsx';

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

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ label, value, detail, tappable, active, onClick }) {
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
        {detail && (
          <span style={{ fontSize: 8, color: '#3a5a70', lineHeight: 1.2, marginTop: 1 }}>
            {detail}
          </span>
        )}
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

// ─── Glass score breakdown panel ─────────────────────────────────────────────

function GlassPanel({ scores }) {
  if (!scores) return (
    <div style={{ padding: '8px 4px', color: '#3a5a70', fontSize: 11, textAlign: 'center' }}>
      No score data
    </div>
  );

  return (
    <div className="flex gap-3 px-1">
      {['north', 'south'].map(side => {
        const d = scores[side];
        if (!d) return null;
        const windPct  = d.windFactor  != null ? Math.round(d.windFactor * 100)  : null;
        const wavePct  = d.waveFactor  != null ? Math.round(d.waveFactor * 100)  : null;
        const label    = side === 'north' ? 'North' : 'South';
        return (
          <div key={side} className="flex-1 rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#5a7fa0' }}>{label}</span>
              <span className="text-base font-black" style={{ color: scoreColor(d.score) }}>{d.score}</span>
            </div>
            <div className="flex flex-col gap-1">
              {windPct != null && (
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 10, color: '#3a5a70', width: 28 }}>Wind</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${windPct}%`, height: '100%', background: '#4fc3f7', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#7ab8e8', width: 28, textAlign: 'right' }}>{windPct}%</span>
                </div>
              )}
              {wavePct != null && (
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 10, color: '#3a5a70', width: 28 }}>Wave</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${wavePct}%`, height: '100%', background: '#f59e0b', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#f59e0b', width: 28, textAlign: 'right' }}>{wavePct}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ConditionsBar({
  current, nextHilos, uvIndex, precipInPerHr, precipProbability,
  sunriseTs, sunsetTs, forecast, scores,
  skyCover, shortForecast,
}) {
  const [activePanel, setActivePanel] = useState('glass');

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

  // Glass pill — best side score
  const bestScore = scores
    ? Math.max(scores.north?.score ?? 0, scores.south?.score ?? 0)
    : null;

  // Conditions pill — weather icon + temp
  const wxEmoji = conditionsEmoji(skyCover, shortForecast, Date.now());
  const condStr = current.airTempF != null
    ? `${wxEmoji ?? '—'} ${Math.round(current.airTempF)}°`
    : (wxEmoji ?? '—');

  const sep = <div className="w-px" style={{ height: 36, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />;

  return (
    <div className="card px-2 py-3" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>

      {/* Pills row */}
      <div className="flex items-center justify-around">

        <Pill
          label="Glass"
          tappable
          active={activePanel === 'glass'}
          onClick={() => toggle('glass')}
          value={bestScore != null
            ? <span style={{ color: scoreColor(bestScore) }}>{bestScore}/10</span>
            : '—'}
        />
        {sep}
        <Pill
          label="Conditions"
          tappable
          active={activePanel === 'air'}
          onClick={() => toggle('air')}
          value={condStr}
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
          detail={nextTideStr ?? undefined}
        />
      </div>

      {/* ── Panels ── */}
      <div style={{ paddingInline: 4 }}>

        {/* GLASS */}
        <Panel open={activePanel === 'glass'}>
          <ScoreChart forecast={forecast} liveScores={scores} />
        </Panel>

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

        {/* CONDITIONS / weather strip */}
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
