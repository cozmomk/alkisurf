import { scoreColor, compassLabel, skyEmoji, uvColor, uvLabel, computeTrend } from '../utils.js';

const SCORE_GLOW = {
  GLASS: 'score-glow-glass',
  'LIGHT RIPPLE': 'score-glow-ripple',
  'LIGHT CHOP': 'score-glow-chop',
  CHOPPY: 'score-glow-rough',
  ROUGH: 'score-glow-nogo',
  'NO GO': 'score-glow-nogo',
};

function ScoreRing({ score, color }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 10) * circ;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7"/>
      <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.5s' }}
      />
    </svg>
  );
}

function SwellBar({ Hs }) {
  const htFt = Hs != null ? Hs * 3.281 : 0;
  // thresholds: 0.15, 0.4, 0.7, 1.1 ft
  const filled = htFt < 0.15 ? 0 : htFt < 0.4 ? 1 : htFt < 0.7 ? 2 : htFt < 1.1 ? 3 : 4;
  const segColors = ['#00e887', '#7dff4f', '#ffc300', '#ff6b1a', '#ff2b55'];
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          flex: 1, height: 5, borderRadius: 2,
          background: i <= filled && htFt > 0.01 ? segColors[i] : 'rgba(255,255,255,0.10)',
        }} />
      ))}
    </div>
  );
}

function fetchLabel(fetchM) {
  if (fetchM == null) return '—';
  if (fetchM < 1000) return 'Protected';
  if (fetchM < 4000) return 'Low';
  if (fetchM < 9000) return 'Moderate';
  return 'Exposed';
}

function fetchColor(fetchM) {
  if (fetchM == null) return '#5a7fa0';
  if (fetchM < 1000) return '#00e887';
  if (fetchM < 4000) return '#7dff4f';
  if (fetchM < 9000) return '#ffc300';
  return '#ff6b1a';
}

const WAVE_STATE = {
  calm:      { label: 'Calm',            color: '#00e887' },
  building:  { label: 'Chop building',   color: '#ffc300' },
  developing:{ label: 'Chop developing', color: '#ffc300' },
  steady:    { label: 'Chop steady',     color: '#ff6b1a' },
  residual:  { label: 'Residual chop',   color: '#ff6b1a' },
};


export default function SideCard({ side, data, windDirDeg, forecast, airTempF }) {
  if (!data) return null;
  const { score, label, Hs, windEff, fetch: fetchM, waveState, windDurHrs } = data;
  const color = scoreColor(score);
  const glowClass = SCORE_GLOW[label] || '';
  const htFt = Hs != null ? (Hs * 3.281).toFixed(2) : '—';

  const trend = computeTrend(side, score, forecast);
  const now = Date.now();
  const nextHour = (forecast || []).find(h => h.time > now);
  const sky = skyEmoji(nextHour?.skyCover, nextHour?.time);
  const uv = nextHour?.uvIndex != null ? Math.round(nextHour.uvIndex) : null;

  const trendDir = trend?.direction;
  const trendHrs = trend?.hoursUntil;
  const trendSuffix = trendHrs ? ` in ${trendHrs}h` : '';
  const trendLabel = trendDir === 'up' ? `↑ Improving${trendSuffix}` : trendDir === 'down' ? `↓ Worsening${trendSuffix}` : '→ Holding';
  const trendColor = trendDir === 'up' ? '#00e887' : trendDir === 'down' ? '#ff6b1a' : '#ffc300';

  return (
    <div className="card p-4 flex flex-col gap-3 flex-1 min-w-0">
      {/* Side label */}
      <div>
        <div className="flex items-center justify-between gap-1">
          <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#e2eef7' }}>
            {side === 'north' ? 'North Side' : 'South Side'}
          </div>
          <div className="flex items-center gap-1.5">
            {sky && <span style={{ fontSize: 14 }}>{sky}</span>}
            {airTempF != null && (
              <span className="text-[10px] font-semibold" style={{ color: '#5a7fa0' }}>
                {Math.round(airTempF)}°F
              </span>
            )}
          </div>
        </div>
        <div className="text-[10px]" style={{ color: '#5a7fa0' }}>
          {side === 'north' ? 'Elliott Bay' : 'Open Sound'}
        </div>
      </div>

      {/* Score ring centered */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative" style={{ width: 96, height: 96 }}>
          <ScoreRing score={score} color={color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black leading-none ${glowClass}`} style={{ color }}>
              {score}
            </span>
            <span className="text-[9px] font-bold tracking-widest" style={{ color: '#5a7fa0' }}>/ 10</span>
          </div>
        </div>
        <span className="text-[11px] font-bold tracking-wide text-center leading-tight" style={{ color }}>
          {label}
        </span>
        {trend && (
          <span className="text-[9px] font-semibold" style={{ color: trendColor }}>{trendLabel}</span>
        )}
      </div>

      {/* Swell bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: '#5a7fa0' }}>Swell</span>
          <span className="text-[10px] font-semibold" style={{ color: '#c8dff0' }}>{htFt} ft</span>
        </div>
        <SwellBar Hs={Hs} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* Metrics */}
      <div className="flex flex-col gap-1.5">
        {uv != null && (
          <MetricRow
            label="UV now"
            value={<span style={{ color: uvColor(uv) }}>{uv} · {uvLabel(uv)}</span>}
          />
        )}
        <MetricRow
          label="Exposure"
          value={<span style={{ color: fetchColor(fetchM) }}>{fetchLabel(fetchM)}</span>}
        />
        <MetricRow
          label="Fetch"
          value={fetchM != null ? `${(fetchM / 1000).toFixed(1)} km` : '—'}
        />
        {waveState && (
          <MetricRow
            label="Wave state"
            value={
              <span style={{ color: WAVE_STATE[waveState]?.color ?? '#5a7fa0' }}>
                {WAVE_STATE[waveState]?.label ?? waveState}
                {windDurHrs > 0 && waveState !== 'residual' && waveState !== 'calm'
                  ? ` · ${windDurHrs}h` : ''}
              </span>
            }
          />
        )}
        <MetricRow
          label="Eff wind"
          value={windEff != null ? `${windEff.toFixed(1)} kt` : '—'}
        />
        <MetricRow
          label="Wind dir"
          value={
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 20 20"
                style={{ transform: `rotate(${(windDirDeg || 0) + 180}deg)`, flexShrink: 0 }}>
                <line x1="10" y1="16" x2="10" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                <polyline points="6,8 10,4 14,8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              from {compassLabel(windDirDeg || 0)}
            </span>
          }
        />
      </div>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[10px]" style={{ color: '#5a7fa0' }}>{label}</span>
      <span className="text-[10px] font-semibold" style={{ color: '#c8dff0' }}>{value}</span>
    </div>
  );
}
