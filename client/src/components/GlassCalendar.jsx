import { useState, useEffect } from 'react';
import { scoreColor } from '../utils.js';

function ptDate(dateStr) {
  // dateStr is YYYY-MM-DD; treat as local PT date
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

export default function GlassCalendar() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/daily-summary')
      .then(r => r.json())
      .then(data => {
        setRows(data.sort((a, b) => b.date.localeCompare(a.date)));
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

  // Build calendar weeks — pad to full weeks
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = Object.fromEntries(sorted.map(r => [r.date, r]));

  const first = ptDate(sorted[0].date);
  const last  = ptDate(sorted[sorted.length - 1].date);

  // Extend first back to Sunday
  const startDay = new Date(first);
  startDay.setDate(startDay.getDate() - startDay.getDay());

  // Extend last forward to Saturday
  const endDay = new Date(last);
  endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));

  const weeks = [];
  let week = [];
  const cur = new Date(startDay);
  while (cur <= endDay) {
    const dateStr = cur.toLocaleDateString('en-CA'); // YYYY-MM-DD
    week.push({ dateStr, data: byDate[dateStr] ?? null });
    if (week.length === 7) { weeks.push(week); week = []; }
    cur.setDate(cur.getDate() + 1);
  }
  if (week.length) weeks.push(week);

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col gap-3">
      <span className="section-title">Glass Calendar</span>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: '#3a5a70' }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {[...weeks].reverse().map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1">
          {week.map(({ dateStr, data }) => {
            const d = ptDate(dateStr);
            const isToday = dateStr === new Date().toLocaleDateString('en-CA');
            const isFuture = d > new Date();
            const isSelected = selected === dateStr;
            const score = data?.bestScore ?? null;
            const color = score != null ? scoreColor(score) : null;

            return (
              <button
                key={dateStr}
                onClick={() => data && setSelected(isSelected ? null : dateStr)}
                disabled={!data || isFuture}
                className="flex flex-col items-center justify-center rounded-lg aspect-square transition-all"
                style={{
                  background: color ? `${color}22` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? (color ?? 'rgba(255,255,255,0.15)') : color ? `${color}44` : 'rgba(255,255,255,0.06)'}`,
                  cursor: data && !isFuture ? 'pointer' : 'default',
                  outline: isToday ? `2px solid rgba(255,255,255,0.25)` : 'none',
                  outlineOffset: '1px',
                }}>
                <span className="text-[9px] font-semibold" style={{ color: '#3a5a70' }}>
                  {d.getDate()}
                </span>
                {score != null && (
                  <span className="text-[11px] font-bold leading-none" style={{ color }}>
                    {score}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      {/* Detail panel */}
      {selected && byDate[selected] && (() => {
        const r = byDate[selected];
        const color = scoreColor(r.bestScore);
        const d = ptDate(selected);
        const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        return (
          <div className="rounded-xl p-4 flex flex-col gap-2 mt-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#5a7fa0' }}>
              {label}
            </div>
            <div className="flex gap-4 items-end">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Best</span>
                <span className="text-2xl font-bold leading-none" style={{ color }}>{r.bestScore}</span>
                <span className="text-[9px] mt-0.5" style={{ color }}>{scoreLabel(r.bestScore)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Avg</span>
                <span className="text-xl font-bold leading-none" style={{ color: scoreColor(r.avgScore) }}>{r.avgScore}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Glass hrs</span>
                <span className="text-xl font-bold leading-none" style={{ color: r.glassHours > 0 ? '#00e887' : '#3a5a70' }}>
                  {r.glassHours}h
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#3a5a70' }}>Sampled</span>
                <span className="text-[11px] font-semibold" style={{ color: '#5a7fa0' }}>{r.sampleCount} hrs</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
