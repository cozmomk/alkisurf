import { useState, useEffect } from 'react';
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
    (!filters.sunnyOnly || (h.uv ?? 0) >= 1) &&
    (!filters.minAirTempF || (h.airTempF ?? 0) >= filters.minAirTempF)
  );
  if (!passing.length) return null;
  return Math.max(...passing.map(h => h.score));
}

function filtersActive(f) {
  return f.timeStart !== 0 || f.timeEnd !== 23 || f.sunnyOnly || f.minAirTempF > 0;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function FilterBar({ filters, onChange }) {
  const activePreset = TIME_PRESETS.find(
    p => p.timeStart === filters.timeStart && p.timeEnd === filters.timeEnd
  );

  function setTimePreset(preset) {
    onChange({ ...filters, timeStart: preset.timeStart, timeEnd: preset.timeEnd });
  }

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
      {/* Time window dropdown */}
      <div className="relative">
        <select
          value={activePreset?.label ?? 'All day'}
          onChange={e => {
            const p = TIME_PRESETS.find(p => p.label === e.target.value);
            if (p) setTimePreset(p);
          }}
          style={{
            ...chipBase,
            appearance: 'none',
            paddingRight: '22px',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235a7fa0'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 7px center',
            cursor: 'pointer',
          }}>
          {TIME_PRESETS.map(p => (
            <option key={p.label} value={p.label}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Sunny only */}
      <button
        onClick={() => onChange({ ...filters, sunnyOnly: !filters.sunnyOnly })}
        style={filters.sunnyOnly ? chipActive : chipBase}>
        ☀ Sunny only
      </button>

      {/* Min air temp */}
      <button
        onClick={() => onChange({ ...filters, minAirTempF: filters.minAirTempF ? 0 : 60 })}
        style={filters.minAirTempF ? chipActive : chipBase}>
        🌡 60°F+
      </button>

      {/* Reset */}
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

export default function GlassCalendar() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    fetch('/api/daily-summary')
      .then(r => r.json())
      .then(data => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col gap-3">
      <span className="section-title">Glass Calendar</span>
      <div className="text-[10px] text-center py-4" style={{ color: '#3a5a70' }}>Loading…</div>
    </div>
  );

  if (!rows.length) return (
    <div className="flex flex-col gap-3">
      <span className="section-title">Glass Calendar</span>
      <div className="text-[10px] text-center py-4" style={{ color: '#3a5a70' }}>
        No daily history yet — check back tomorrow.
      </div>
    </div>
  );

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = Object.fromEntries(sorted.map(r => [r.date, r]));

  const first = ptDate(sorted[0].date);
  const last  = ptDate(sorted[sorted.length - 1].date);

  const startDay = new Date(first);
  startDay.setDate(startDay.getDate() - startDay.getDay());

  const endDay = new Date(last);
  endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));

  const weeks = [];
  let week = [];
  const cur = new Date(startDay);
  while (cur <= endDay) {
    const dateStr = cur.toLocaleDateString('en-CA');
    week.push({ dateStr, data: byDate[dateStr] ?? null });
    if (week.length === 7) { weeks.push(week); week = []; }
    cur.setDate(cur.getDate() + 1);
  }
  if (week.length) weeks.push(week);

  // Month banners (oldest-first)
  let lastBannerMonth = null;
  const weekBanners = weeks.map(wk => {
    const sun = ptDate(wk[0].dateStr);
    const month = sun.getMonth();
    const year = sun.getFullYear();
    if (month !== lastBannerMonth) {
      lastBannerMonth = month;
      return { month, year };
    }
    return null;
  });

  const todayStr = new Date().toLocaleDateString('en-CA');

  return (
    <div className="flex flex-col gap-3">
      <span className="section-title">Glass Calendar</span>

      <FilterBar filters={filters} onChange={setFilters} />

      {/* DOW header */}
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(7, 24px)' }}>
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[8px] font-semibold uppercase tracking-wider"
            style={{ color: '#3a5a70', width: '24px' }}>{d.slice(0, 1)}</div>
        ))}
      </div>

      {/* Weeks with month banners */}
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {weekBanners[wi] && (
            <div className="text-[9px] font-semibold uppercase tracking-wider pt-1"
              style={{ color: '#3a5a70' }}>
              {new Date(weekBanners[wi].year, weekBanners[wi].month, 1)
                .toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          )}
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(7, 24px)' }}>
            {week.map(({ dateStr, data }) => {
              const d = ptDate(dateStr);
              const isToday = dateStr === todayStr;
              const isFuture = d > new Date();
              const isSelected = selected === dateStr;

              if (!data || isFuture) {
                return (
                  <div key={dateStr}
                    style={{
                      width: '24px', height: '24px',
                      borderRadius: '4px',
                      background: isToday ? 'rgba(255,255,255,0.1)' : 'transparent',
                      outline: isToday ? '2px solid rgba(255,255,255,0.6)' : 'none',
                      outlineOffset: '1px',
                    }}
                  />
                );
              }

              const filteredScore = getFilteredScore(data, filters);
              const filteredOut = filteredScore === null;
              const color = filteredOut ? null : scoreColor(filteredScore);

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelected(isSelected ? null : dateStr)}
                  aria-label={`${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${filteredOut ? 'filtered out' : `score ${filteredScore}`}`}
                  style={{
                    width: '24px', height: '24px',
                    borderRadius: '4px',
                    background: color ? `${color}b3` : 'rgba(255,255,255,0.05)',
                    border: filteredOut
                      ? '1px dashed rgba(255,255,255,0.18)'
                      : isSelected
                        ? `1px solid ${color}`
                        : '1px solid transparent',
                    outline: isToday
                      ? '2px solid rgba(255,255,255,0.65)'
                      : isSelected
                        ? `2px solid white`
                        : 'none',
                    outlineOffset: '1px',
                    boxShadow: isSelected && color ? `0 0 8px ${color}66` : 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Score legend — compact dots */}
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

        // Compute filtered stats from hours[]
        const hrs = r.hours ?? [];
        const passingHrs = filtersActive(filters) && hrs.length
          ? hrs.filter(h =>
              h.h >= filters.timeStart &&
              h.h <= filters.timeEnd &&
              (!filters.sunnyOnly || (h.uv ?? 0) >= 1) &&
              (!filters.minAirTempF || (h.airTempF ?? 0) >= filters.minAirTempF)
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
