import { scoreColor } from '../utils.js';

const SCORE_GLOW = {
  GLASS: 'score-glow-glass',
  'LIGHT RIPPLE': 'score-glow-ripple',
  'LIGHT CHOP': 'score-glow-chop',
  CHOPPY: 'score-glow-rough',
  ROUGH: 'score-glow-nogo',
  'NO GO': 'score-glow-nogo',
};

function WindArrow({ deg }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ transform: `rotate(${deg}deg)` }}>
      <line x1="10" y1="16" x2="10" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <polyline points="6,8 10,4 14,8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ScoreRing({ score, color }) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 10) * circ;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8"/>
      <circle
        cx="70" cy="70" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.5s' }}
      />
    </svg>
  );
}

export default function SideCard({ side, data, windDirDeg }) {
  if (!data) return null;
  const { score, label, Hs } = data;
  const color = scoreColor(score);
  const glowClass = SCORE_GLOW[label] || '';
  const htFt = Hs != null ? (Hs * 3.281).toFixed(1) : '—';

  return (
    <div className="card p-5 flex flex-col gap-3 flex-1 min-w-0">
      {/* Side label */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold tracking-widest uppercase whitespace-nowrap" style={{ color: '#e2eef7' }}>
          {side === 'north' ? 'North Side' : 'South Side'}
        </span>
        <span className="text-[10px]" style={{ color: '#5a7fa0' }}>
          {side === 'north' ? 'Elliott Bay' : 'Open Sound'}
        </span>
      </div>

      {/* Score ring + number */}
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
          <ScoreRing score={score} color={color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-5xl font-black leading-none ${glowClass}`}
              style={{ color }}
            >
              {score}
            </span>
            <span className="text-[10px] font-bold tracking-widest mt-1" style={{ color: '#5a7fa0' }}>
              / 10
            </span>
          </div>
        </div>

        {/* Label + metrics */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <span className="text-base font-bold tracking-wide" style={{ color }}>
            {label}
          </span>
          <div className="flex flex-col gap-1.5">
            <Metric label="Wave ht" value={`${htFt} ft`} />
            <Metric label="Wind dir" value={
              <span className="flex items-center gap-1">
                <WindArrow deg={windDirDeg || 0} />
              </span>
            } />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs" style={{ color: '#5a7fa0' }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: '#c8dff0' }}>{value}</span>
    </div>
  );
}
