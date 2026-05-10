import { useState, useEffect, useRef } from 'react';
import { scoreColor } from '../utils.js';

function ptDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function scoreLabel(score) {
  if (score >= 9) return 'Glass';
  if (score >= 7) return 'Ripple';
  if (score >= 5) return 'Chop';
  if (score >= 3) return 'Rough';
  if (score > 0)  return 'No go';
  return 'No data';
}

function formatHour(h) {
  if (h == null) return null;
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

const TIME_PRESETS = [
  { label: 'All day',   timeStart: 0,  timeEnd: 23 },
  { label: 'Dawn',      timeStart: 5,  timeEnd: 8  },
  { label: 'Morning',   timeStart: 6,  timeEnd: 12 },
  { label: 'Afternoon', timeStart: 12, timeEnd: 18 },
  { label: 'Evening',   timeStart: 16, timeEnd: 20 },
];

const DEFAULT_FILTERS = {
  timeStart: 0,
  timeEnd: 23,
  sunnyOnly: false,
  minAirTempF: 0,
};

function getFilteredScore(row, filters) {
  const hrs = row.hours ?? [];
  if (!hrs.length) return row.bestScore ?? null;

  const passing = hrs.filter(h =>
    h.h >= filters.timeStart &&
    h.h <= filters.timeEnd &&
    (!filters.sunnyOnly || h.uv == null || h.uv >= 1) &&
    (!filters.minAirTempF || h.airTempF == null || h.airTempF >= filters.minAirTempF)
  );
  if (!passing.length) return null;
  return Math.max(...passing.map(h => h.score));
}

function filtersActive(f) {
  return f.timeStart !== 0 || f.timeEnd !== 23 || f.sunnyOnly || f.minAirTempF > 0;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL = 32;

function FilterBar({ filters, onChange }) {
  const activePreset = TIME_PRESETS.find(
    p => p.timeStart === filters.timeStart && p.timeEnd === filters.timeEnd
  );

  const chipBase = {
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#5a7fa0',
    letterSpacing: '0.03em',
  };
  const chipActive = {
    ...chipBase,
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.35)',
    color: 'rgba(255,255,255,0.85)',
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative">
        <select
          value={activePreset?.label ?? 'All day'}
          onChange={e => {
            const p = TIME_PRESETS.find(p => p.label === e.target.value);
            if (p) onChange({ ...filters, timeStart: p.timeStart, timeEnd: p.timeEnd });
          }}
          style={{
            ...chipBase,
            appearance: 'none',
            paddingRight: '22px',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235a7fa0'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 7px center',
          }}>
          {TIME_PRESETS.map(p => (
            <option key={p.label} value={p.label}>{p.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={() => onChange({ ...filters, sunnyOnly: !filters.sunnyOnly })}
        style={filters.sunnyOnly ? chipActive : chipBase}>
        ☀ Sunny only
      </button>

      <button
        onClick={() => onChange({ ...filters, minAirTempF: filters.minAirTempF ? 0 : 60 })}
        style={filters.minAirTempF ? chipActive : chipBase}>
        🌡 60°F+
      </button>

      {filtersActive(filters) && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          style={{ ...chipBase, color: '#ff6b1a', borderColor: 'rgba(255,107,26,0.3)' }}>
          Reset
        </button>
      )}
    </div>
  );
}

function MonthGrid({ year, month, byDate, filters, selected, onSelect, todayStr }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const monthLabel = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ blank: true, key: `blank-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ blank: false, dateStr, day: d });
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <div className="text-[9px] font-semibold uppercase tracking-wider pb-1" style={{ color: '#3a5a70' }}>
        {monthLabel}
      </div>

      <div className="grid gap-[3px] mb-[3px]" style={{ gridTemplateColumns: `repeat(7, ${CELL}px)` }}>
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[8px] font-semibold uppercase"
            style={{ color: '#3a5a70', width: CELL }}>
            {d.slice(0, 1)}
          </div>
        ))}
      </div>

      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(7, ${CELL}px)` }}>
        {cells.map(cell => {
          if (cell.blank) return <div key={cell.key} style={{ width: CELL, height: CELL }} />;

          const { dateStr, day } = cell;
          const data = byDate[dateStr] ?? null;
          const d = ptDate(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = d > new Date();
          const isSelected = selected === dateStr;

          if (!data || isFuture) {
            return (
              <div key={dateStr} style={{
                width: CELL, height: CELL,
                borderRadius: 4,
                background: isToday ? 'rgba(255,255,255,0.1)' : 'transparent',
                outline: isToday ? '2px solid rgba(255,255,255,0.6)' : 'none',
                outlineOffset: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontWeight: 500 }}>{day}</span>
              </div>
            );
          }

          const filteredScore = getFilteredScore(data, filters);
          const filteredOut = filteredScore === null;
          const color = filteredOut ? null : scoreColor(filteredScore);

          return (
            <button
              key={dateStr}
              onClick={() => onSelect(isSelected ? null : dateStr)}
              aria-label={`${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${filteredOut ? 'filtered out' : `score ${filteredScore}`}`}
              style={{
                width: CELL, height: CELL,
                borderRadius: 4,
                background: color ? `${color}b3` : 'rgba(255,255,255,0.05)',
                border: filteredOut
                  ? '1px dashed rgba(255,255,255,0.18)'
                  : isSelected
                    ? `1px solid ${color}`
                    : '1px solid transparent',
                outline: isToday
                  ? '2px solid rgba(255,255,255,0.65)'
                  : isSelected
                    ? '2px solid white'
                    : 'none',
                outlineOffset: 1,
                boxShadow: isSelected && color ? `0 0 8px ${color}66` : 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 1, pointerEvents: 'none',
              }}>{day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SurfHistory() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch('/api/daily-summary')
      .then(r => r.json())
      .then(data => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Scroll to rightmost (most recent month) after data loads
  useEffect(() => {
    if (scrollRef.current && rows.length) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [rows]);

  if (loading) return (
    <div className="flex flex-col gap-3">
      <span className="section-title">Surf History</span>
      <div className="text-[10px] text-center py-4" style={{ color: '#3a5a70' }}>Loading…</div>
    </div>
  );

  if (!rows.length) return (
    <div className="flex flex-col gap-3">
      <span className="section-title">Surf History</span>
      <div className="text-[10px] text-center py-4" style={{ color: '#3a5a70' }}>
        No history yet — check back tomorrow.
      </div>
    </div>
  );

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = Object.fromEntries(sorted.map(r => [r.date, r]));
  const todayStr = new Date().toLocaleDateString('en-CA');

  // Build list of months from first data point through current month
  const firstDate = ptDate(sorted[0].date);
  const today = new Date();
  const months = [];
  const cur = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cur <= endMonth) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="section-title">Surf History</span>

      <FilterBar filters={filters} onChange={setFilters} />

      <div
        ref={scrollRef}
        style={{ overflowX: 'auto', display: 'flex', gap: '20px', paddingBottom: '8px' }}>
        {months.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            byDate={byDate}
            filters={filters}
            selected={selected}
            onSelect={setSelected}
            todayStr={todayStr}
          />
        ))}
      </div>

      {/* Score legend */}
      <div className="flex gap-3 flex-wrap pt-1">
        {[
          { color: '#00e887', label: 'Glass' },
          { color: '#7dff4f', label: 'Ripple' },
          { color: '#ffc300', label: 'Chop' },
          { color: '#ff6b1a', label: 'Rough' },
          { color: '#ff2b55', label: 'No go' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ background: color, opacity: 0.7 }} />
            <span className="text-[8px]" style={{ color: '#5a7fa0' }}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0"
            style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.3)' }} />
          <span className="text-[8px]" style={{ color: '#5a7fa0' }}>Filtered</span>
        </div>
      </div>

      {/* Detail panel */}
      {selected && byDate[selected] && (() => {
        const r = byDate[selected];
        const filteredScore = getFilteredScore(r, filters);
        const displayScore = filteredScore ?? r.bestScore;
        const color = scoreColor(displayScore);
        const d = ptDate(selected);
        const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

        const windowStr = (r.bestWindowStart != null && r.bestWindowEnd != null)
          ? r.bestWindowStart === r.bestWindowEnd
            ? formatHour(r.bestWindowStart)
            : `${formatHour(r.bestWindowStart)}–${formatHour(r.bestWindowEnd)}`
          : null;

        const hrs = r.hours ?? [];
        const passingHrs = filtersActive(filters) && hrs.length
          ? hrs.filter(h =>
              h.h >= filters.timeStart &&
              h.h <= filters.timeEnd &&
              (!filters.sunnyOnly || h.uv == null || h.uv >= 1) &&
              (!filters.minAirTempF || h.airTempF == null || h.airTempF >= filters.minAirTempF)
            )
          : null;

        const filteredGlassHrs = passingHrs
          ? passingHrs.filter(h => h.score >= 7).length
          : r.glassHours;
        const filteredAvg = passingHrs && passingHrs.length
          ? Math.round(passingHrs.reduce((s, h) => s + h.score, 0) / passingHrs.length)
          : r.avgScore;

        return (
          <div className="rounded-xl p-4 flex flex-col gap-2 mt-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex justify-between items-center">
              <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#5a7fa0' }}>
                {label}
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close detail panel"
                style={{ color: '#3a5a70', background: 'none', border: 'none', cursor: 'pointer',
                         fontSize: '16px', lineHeight: 1, padding: '0 0 0 12px' }}>
                ×
              </button>
            </div>

            {filteredScore === null && filtersActive(filters) && (
              <div className="text-[9px]" style={{ color: '#ff6b1a' }}>
                No hours match current filters — showing unfiltered best.
              </div>
            )}

            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Best</span>
                <span className="text-2xl font-bold leading-none" style={{ color }}>{displayScore}</span>
                <span className="text-[9px] mt-0.5" style={{ color }}>{scoreLabel(displayScore)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Avg</span>
                <span className="text-xl font-bold leading-none" style={{ color: '#8aacbf' }}>{filteredAvg}</span>
              </div>
              {windowStr && !filtersActive(filters) && (
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Best window</span>
                  <span className="text-[11px] font-semibold" style={{ color: '#5a7fa0' }}>{windowStr}</span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Glass hrs</span>
                <span className="text-xl font-bold leading-none" style={{ color: filteredGlassHrs > 0 ? '#00e887' : '#3a5a70' }}>
                  {filteredGlassHrs}h
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Readings</span>
                <span className="text-[11px] font-semibold" style={{ color: '#5a7fa0' }}>
                  {passingHrs ? passingHrs.length : r.sampleCount}
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
