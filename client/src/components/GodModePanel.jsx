import { useState, useEffect } from 'react';

// ─── constants ────────────────────────────────────────────────────────────────
const DIR_LABELS = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

// 3×3 compass grid (null = center dead zone)
const COMPASS = [
  [315, 'NW'], [0,   'N'],  [45,  'NE'],
  [270, 'W'],  [null, ''],  [90,  'E'],
  [225, 'SW'], [180, 'S'],  [135, 'SE'],
];

const SKY_KEYS = ['sunny', 'partly', 'overcast', 'rain', 'storm', 'snow', 'night'];
const SKY_ICONS = { sunny: '☀️', partly: '⛅', overcast: '☁️', rain: '🌧', storm: '⛈', snow: '🌨', night: '🌙' };

// Maps sky button → ConditionsSprite props that trigger the correct skyFromData() branch
const SKY_MAP = {
  sunny:    { shortForecast: 'Sunny',        skyCover: 5,   precipProbability: 0  },
  partly:   { shortForecast: 'Partly Cloudy',skyCover: 30,  precipProbability: 0  },
  overcast: { shortForecast: 'Overcast',     skyCover: 80,  precipProbability: 0  },
  rain:     { shortForecast: 'Rain Showers', skyCover: 90,  precipProbability: 80 },
  storm:    { shortForecast: 'Thunderstorm', skyCover: 100, precipProbability: 90 },
  snow:     { shortForecast: 'Snow Showers', skyCover: 90,  precipProbability: 70 },
  night:    { shortForecast: 'Night',        skyCover: 0,   precipProbability: 0  },
};

const SCORE_LABELS = ['No Go','','','Rough','','Chop','','Ripple','','Glass','Glass!'];

// ─── records helpers ──────────────────────────────────────────────────────────
function shortDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000 > 1e12 ? ts : ts * 1000)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Build chip presets from the records object.
// Each chip: { label, icon, vals } where vals is a partial overrides to merge into DEFAULT_VALS
function buildChips(records) {
  if (!records) return [];
  const chips = [];

  if (records.windSpeedKt?.max != null) {
    const nearestDir = (deg) => {
      const dirs = [0, 45, 90, 135, 180, 225, 270, 315];
      return dirs.reduce((a, b) => Math.abs(b - deg) < Math.abs(a - deg) ? b : a);
    };
    const windDir = records.windSpeedKt.maxWindDir != null
      ? nearestDir(records.windSpeedKt.maxWindDir)
      : 0;
    chips.push({
      label: `${Math.round(records.windSpeedKt.max)} kt wind`,
      sub: shortDate(records.windSpeedKt.maxTs),
      icon: '💨',
      vals: { windKt: Math.min(30, Math.round(records.windSpeedKt.max)), windDir, skyKey: 'storm' },
    });
  }

  if (records.waterTempF?.max != null) {
    chips.push({
      label: `${Math.round(records.waterTempF.max)}°F water`,
      sub: shortDate(records.waterTempF.maxTs),
      icon: '🌡',
      vals: { waterTempF: Math.round(records.waterTempF.max), skyKey: 'sunny' },
    });
  }

  if (records.waterTempF?.min != null) {
    chips.push({
      label: `${Math.round(records.waterTempF.min)}°F water`,
      sub: shortDate(records.waterTempF.minTs),
      icon: '🥶',
      vals: { waterTempF: Math.round(records.waterTempF.min) },
    });
  }

  if (records.score?.max != null && records.score.max >= 7) {
    chips.push({
      label: `Score ${Math.round(records.score.max * 10) / 10}`,
      sub: shortDate(records.score.maxTs),
      icon: '🪟',
      vals: { score: records.score.max, skyKey: 'sunny', windKt: 1, tidePct: 50 },
    });
  }

  if (records.score?.min != null && records.score.min <= 1) {
    chips.push({
      label: `Score ${Math.round(records.score.min * 10) / 10}`,
      sub: shortDate(records.score.minTs),
      icon: '💀',
      vals: {
        score: records.score.min,
        skyKey: 'storm',
        windKt: Math.min(30, Math.round(records.windSpeedKt?.max ?? 20)),
      },
    });
  }

  return chips;
}

export const DEFAULT_VALS = {
  score: 5, windKt: 8, windDir: 270, skyKey: 'partly',
  tidePct: 50, uvIndex: 3, waterTempF: 55, precipProbability: 0,
};

// ─── helpers ──────────────────────────────────────────────────────────────────
export function valsToOverrides(v) {
  return {
    score:             v.score,
    windSpeedKt:       v.windKt,
    windGustKt:        v.windKt > 5 ? v.windKt + 3 : null,
    windDirDeg:        v.windDir,
    windDirLabel:      DIR_LABELS[v.windDir] ?? 'W',
    ...SKY_MAP[v.skyKey],
    precipProbability: v.precipProbability,
    tideCurrentFt:     (v.tidePct / 100) * 14,
    nextHilos: [
      { type: 'H', ft: 14, t: Date.now() + 3_600_000 },
      { type: 'L', ft: 0,  t: Date.now() + 7_200_000 },
    ],
    uvIndex:    v.uvIndex,
    waterTempF: v.waterTempF,
    // Synthetic air temp: below freezing for snow to pass the temp-gate, mild otherwise
    airTempF:   v.skyKey === 'snow' ? 30 : 62,
  };
}

export function valsFromUrl() {
  const p = new URLSearchParams(window.location.search);
  if (!p.get('god')) return null;
  return {
    score:             Number(p.get('score')  ?? DEFAULT_VALS.score),
    windKt:            Number(p.get('wind')   ?? DEFAULT_VALS.windKt),
    windDir:           Number(p.get('dir')    ?? DEFAULT_VALS.windDir),
    skyKey:            p.get('sky')           ?? DEFAULT_VALS.skyKey,
    tidePct:           Number(p.get('tide')   ?? DEFAULT_VALS.tidePct),
    uvIndex:           Number(p.get('uv')     ?? DEFAULT_VALS.uvIndex),
    waterTempF:        Number(p.get('water')  ?? DEFAULT_VALS.waterTempF),
    precipProbability: Number(p.get('precip') ?? DEFAULT_VALS.precipProbability),
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────
function GodSlider({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px]" style={{ color: '#5a7fa0' }}>{label}</span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#c8dff0' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#00e887', cursor: 'pointer' }}
      />
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function GodModePanel({ onOverridesChange, onClose, initialVals, records = null }) {
  const [vals, setVals] = useState(initialVals ?? DEFAULT_VALS);
  const chips = buildChips(records);
  const [copied, setCopied] = useState(false);

  // Push overrides to parent on every change
  useEffect(() => {
    onOverridesChange(valsToOverrides(vals));
  }, [vals]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setVals(v => ({ ...v, [key]: value }));
  }

  function copyLink() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('god',    'true');
    url.searchParams.set('score',  vals.score);
    url.searchParams.set('wind',   vals.windKt);
    url.searchParams.set('dir',    vals.windDir);
    url.searchParams.set('sky',    vals.skyKey);
    url.searchParams.set('tide',   vals.tidePct);
    url.searchParams.set('uv',     vals.uvIndex);
    url.searchParams.set('water',  vals.waterTempF);
    url.searchParams.set('precip', vals.precipProbability);
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const scoreLabel = SCORE_LABELS[Math.round(vals.score)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
        style={{
          background: '#0d1e30',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#00e887' }}>
            ⚡ God Mode
          </span>
          <button
            onClick={onClose}
            style={{ color: '#3a5a70', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
          >×</button>
        </div>

        {/* Records chips */}
        {chips.length > 0 && (
          <div>
            <div className="text-[10px] mb-2" style={{ color: '#3a5a70' }}>All-time records</div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip, i) => (
                <button key={i}
                  onClick={() => setVals(v => ({ ...v, ...chip.vals }))}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 12 }}>{chip.icon}</span>
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-semibold" style={{ color: '#c8dff0' }}>{chip.label}</span>
                    {chip.sub && <span className="text-[8px]" style={{ color: '#3a5a70' }}>{chip.sub}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sky condition */}
        <div>
          <div className="text-[10px] mb-2" style={{ color: '#3a5a70' }}>Sky condition</div>
          <div className="flex gap-1.5 flex-wrap">
            {SKY_KEYS.map(k => (
              <button key={k} onClick={() => set('skyKey', k)}
                className="flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-all"
                style={{
                  background: vals.skyKey === k ? 'rgba(0,232,135,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${vals.skyKey === k ? 'rgba(0,232,135,0.30)' : 'rgba(255,255,255,0.07)'}`,
                  color: vals.skyKey === k ? '#00e887' : '#5a7fa0',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 13 }}>{SKY_ICONS[k]}</span>
                <span className="text-[9px] font-semibold">{k}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Score */}
        <GodSlider
          label={`Score${scoreLabel ? ` — ${scoreLabel}` : ''}`}
          value={vals.score} min={0} max={10} step={0.5}
          onChange={v => set('score', v)}
        />

        {/* Wind speed */}
        <GodSlider
          label="Wind speed"
          value={vals.windKt} min={0} max={30} unit=" kt"
          onChange={v => set('windKt', v)}
        />

        {/* Wind direction compass */}
        <div>
          <div className="text-[10px] mb-2" style={{ color: '#3a5a70' }}>
            Wind direction (from) — <span style={{ color: '#c8dff0' }}>{DIR_LABELS[vals.windDir] ?? '—'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gap: 4 }}>
            {COMPASS.map(([deg, lbl], i) =>
              deg === null ? (
                <div key={i} style={{ height: 32 }} />
              ) : (
                <button key={i} onClick={() => set('windDir', deg)}
                  className="rounded-lg text-[10px] font-bold transition-all"
                  style={{
                    height: 32,
                    background: vals.windDir === deg ? 'rgba(0,232,135,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${vals.windDir === deg ? 'rgba(0,232,135,0.30)' : 'rgba(255,255,255,0.07)'}`,
                    color: vals.windDir === deg ? '#00e887' : '#5a7fa0',
                    cursor: 'pointer',
                  }}
                >{lbl}</button>
              )
            )}
          </div>
        </div>

        {/* Tide */}
        <GodSlider
          label="Tide level"
          value={vals.tidePct} min={0} max={100} unit="%"
          onChange={v => set('tidePct', v)}
        />

        {/* UV */}
        <GodSlider
          label="UV index"
          value={vals.uvIndex} min={0} max={12}
          onChange={v => set('uvIndex', v)}
        />

        {/* Water temp */}
        <GodSlider
          label="Water temp"
          value={vals.waterTempF} min={40} max={75} unit="°F"
          onChange={v => set('waterTempF', v)}
        />

        {/* Precip % */}
        <GodSlider
          label="Precip probability"
          value={vals.precipProbability} min={0} max={100} unit="%"
          onChange={v => set('precipProbability', v)}
        />

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={copyLink}
            className="flex-1 py-2.5 rounded-lg text-[10px] font-semibold transition-all"
            style={{
              background: copied ? 'rgba(0,232,135,0.15)' : 'rgba(0,232,135,0.07)',
              border: '1px solid rgba(0,232,135,0.20)',
              color: '#00e887', cursor: 'pointer',
            }}
          >{copied ? '✓ Copied!' : '📋 Copy link'}</button>

          <button onClick={() => setVals(DEFAULT_VALS)}
            className="flex-1 py-2.5 rounded-lg text-[10px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#5a7fa0', cursor: 'pointer',
            }}
          >↺ Reset</button>

          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[10px] font-semibold transition-all"
            style={{
              background: 'rgba(255,43,85,0.07)',
              border: '1px solid rgba(255,43,85,0.18)',
              color: '#ff2b55', cursor: 'pointer',
            }}
          >✕ Exit</button>
        </div>
      </div>
    </div>
  );
}
