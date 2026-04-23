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

function ScoreBubble({ score }) {
  if (score == null) return (
    <div className="flex items-center justify-center rounded-full"
      style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
      <span className="text-xs" style={{ color: '#3a5a70' }}>—</span>
    </div>
  );
  const color = scoreColor(score);
  return (
    <div className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: 40, height: 40, background: `${color}18`, border: `1.5px solid ${color}55` }}>
      <span className="text-base font-black" style={{ color }}>{score}</span>
    </div>
  );
}

// Pair windows where a north and south window overlap in time (within 3hr start diff)
function pairWindows(windows) {
  const pairs = [];
  const used = new Set();

  // Sort by start time
  const sorted = [...windows].sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const w = sorted[i];
    // Find overlapping window on the opposite side
    let matchIdx = -1;
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      const w2 = sorted[j];
      if (w2.side === w.side) continue;
      // Overlap check
      const overlaps = w2.start < w.end && w2.end > w.start;
      const nearStart = Math.abs(w2.start - w.start) < 3 * 3600 * 1000;
      if (overlaps || nearStart) {
        matchIdx = j;
        break;
      }
    }

    if (matchIdx !== -1) {
      const w2 = sorted[matchIdx];
      pairs.push({
        north: w.side === 'north' ? w : w2,
        south: w.side === 'south' ? w : w2,
        start: Math.min(w.start, w2.start),
      });
      used.add(i);
      used.add(matchIdx);
    } else {
      pairs.push({
        north: w.side === 'north' ? w : null,
        south: w.side === 'south' ? w : null,
        start: w.start,
      });
      used.add(i);
    }
  }

  return pairs.sort((a, b) => a.start - b.start);
}

function WindowPair({ north, south }) {
  const ref = north || south;
  if (!ref) return null;

  const startStr = fmt(ref.start, { weekday: 'short', hour: 'numeric', hour12: true });
  const endStr = fmt(ref.end, { hour: 'numeric', hour12: true });
  const isToday = fmt(ref.start, { day: 'numeric' }) === fmt(Date.now(), { day: 'numeric' });
  const isTomorrow = fmt(ref.start, { day: 'numeric' }) === fmt(Date.now() + 86400000, { day: 'numeric' });

  const betterSide = north && south
    ? (north.score >= south.score ? 'north' : 'south')
    : north ? 'north' : 'south';

  return (
    <div className="card px-4 py-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        {(isToday || isTomorrow) && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#5a7fa0' }}>
            {isToday ? 'TODAY' : 'TOMORROW'}
          </span>
        )}
        <span className="text-sm font-semibold" style={{ color: '#e2eef7' }}>
          {startStr} – {endStr}
        </span>
        <SkyEmoji skyCover={ref.skyCover} />
        {ref.airTempF && (
          <span className="text-xs ml-auto" style={{ color: '#4a6a88' }}>
            {Math.round(ref.airTempF)}°F
          </span>
        )}
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'North', sub: 'Elliott Bay', w: north },
          { label: 'South', sub: 'Open Sound', w: south },
        ].map(({ label, sub, w }) => {
          const isBetter = (label === 'North' ? 'north' : 'south') === betterSide && north && south;
          return (
            <div key={label} className="flex items-center gap-2 rounded-lg p-2"
              style={{
                background: isBetter ? 'rgba(0, 232, 135, 0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isBetter ? 'rgba(0, 232, 135, 0.18)' : 'rgba(255,255,255,0.05)'}`,
              }}>
              <ScoreBubble score={w?.score ?? null} />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold" style={{ color: '#e2eef7' }}>{label}</span>
                  {isBetter && <span style={{ color: '#00e887', fontSize: 9 }}>▲</span>}
                </div>
                <span className="text-[9px]" style={{ color: '#5a7fa0' }}>{sub}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BestWindows({ windows }) {
  if (!windows?.length) return null;

  const upcoming = windows.filter(w => w.end > Date.now());
  if (!upcoming.length) return null;

  const pairs = pairWindows(upcoming).slice(0, 4);

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
        {pairs.map((pair, i) => (
          <WindowPair key={i} north={pair.north} south={pair.south} />
        ))}
      </div>
    </div>
  );
}
