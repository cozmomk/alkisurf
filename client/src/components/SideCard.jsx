import { useState } from 'react';
import { scoreColor, compassLabel, skyEmoji, uvColor, uvLabel, computeTrend } from '../utils.js';

// Solve for effective wind speed needed to hit a target score given current waveFactor
function windForScore(target, waveFactor) {
  if (waveFactor == null || waveFactor <= 0) return null;
  const neededWF = (target / 10) / waveFactor;
  if (neededWF >= 1) return null; // already achievable at any wind
  const ratio = 1 - neededWF;
  if (ratio <= 0) return null;
  return Math.round(14 * Math.pow(ratio, 2 / 3));
}

function FactorBar({ label, pct, color, detail, isBottleneck }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-medium" style={{ color: isBottleneck ? color : '#5a7fa0' }}>
          {label}{isBottleneck ? ' ⚠' : ''}
        </span>
        <span className="text-[8px] font-semibold" style={{ color }}>{detail}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 2,
          background: color, transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

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
        transform="rotate(-90 48 48)"
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


export default function SideCard({ side, data, windDirDeg, forecast, airTempF, windGustKt, waterTempF }) {
  if (!data) return null;
  const { score, label, Hs, windEff, fetch: fetchM, waveState, windDurHrs } = data;
  const color = scoreColor(score);
  const glowClass = SCORE_GLOW[label] || '';
  const htFt = Hs != null ? (Hs * 3.281).toFixed(2) : '—';

  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Score factor decomposition
  const windFactor = windEff != null ? Math.max(0, 1 - Math.pow(windEff / 14, 1.5)) : null;
  const waveFactor = Hs != null ? Math.max(0, 1 - Hs / 0.5) : null;
  const windPct = windFactor != null ? Math.round(windFactor * 100) : null;
  const wavePct = waveFactor != null ? Math.round(waveFactor * 100) : null;

  // Which factor is limiting (threshold: 8 percentage-point gap)
  const isWindLimited = windFactor != null && waveFactor != null && windFactor < waveFactor - 0.08;
  const isWaveLimited = windFactor != null && waveFactor != null && waveFactor < windFactor - 0.08;

  // Bottleneck line + gap hint
  let bottleneckLine = null;
  if (score < 9 && windFactor != null) {
    if (isWindLimited) {
      const targetScore = score < 7 ? 7 : 9;
      const kt = windForScore(targetScore, waveFactor);
      bottleneckLine = kt != null
        ? `Wind limiting · for ${targetScore}/10: drop to ~${kt}kt eff`
        : 'Wind is the limiting factor';
    } else if (isWaveLimited) {
      const waveMsg =
        waveState === 'residual'  ? 'Residual chop — settling ~20–35 min' :
        waveState === 'building'  ? `Building ${windDurHrs}h — worsening` :
        waveState === 'developing'? 'Still developing — near peak' :
        waveState === 'steady'    ? `Steady on ${(fetchM / 1000).toFixed(1)}km fetch` :
        'Waves limiting';
      bottleneckLine = `Waves limiting · ${waveMsg}`;
    } else if (windFactor < 0.95 || waveFactor < 0.95) {
      bottleneckLine = 'Wind & waves both limiting';
    }
  }

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
        {windPct != null && (
          <button
            onClick={() => setBreakdownOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', minHeight: 28 }}
          >
            <span className="text-[8px]" style={{ color: '#3a5a70' }}>
              {breakdownOpen ? '▲ less' : '▾ why?'}
            </span>
          </button>
        )}
      </div>

      {/* Score breakdown panel */}
      {breakdownOpen && windPct != null && (
        <div className="flex flex-col gap-1.5 w-full"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
          <FactorBar
            label="Wind"
            pct={windPct}
            color={scoreColor(Math.round(windFactor * 10))}
            detail={`${windPct}% · ${windEff.toFixed(1)}kt`}
            isBottleneck={isWindLimited}
          />
          <FactorBar
            label="Wave"
            pct={wavePct}
            color={scoreColor(Math.round(waveFactor * 10))}
            detail={`${wavePct}% · ${(Hs * 3.281).toFixed(1)}ft`}
            isBottleneck={isWaveLimited}
          />
          {bottleneckLine && (
            <span className="text-[8px] leading-tight" style={{ color: '#ff8a65', marginTop: 2 }}>
              {bottleneckLine}
            </span>
          )}
        </div>
      )}

      {/* Swell bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: '#5a7fa0' }}>Swell</span>
          <span className="text-[10px] font-semibold" style={{ color: '#c8dff0' }}>{htFt} ft</span>
        </div>
        <SwellBar Hs={Hs} />
      </div>

      {/* Water temp */}
      {waterTempF != null && (
        <MetricRow
          label="Water temp"
          value={`${Math.round(waterTempF)}°F`}
        />
      )}

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
          value={windEff != null
            ? (windGustKt != null && windGustKt > (data.windSpeedKt ?? 0) + 3
              ? <span>{windEff.toFixed(1)} kt <span style={{ color: '#ff8a65' }}>G{Math.round(windGustKt)}</span></span>
              : `${windEff.toFixed(1)} kt`)
            : '—'}
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
