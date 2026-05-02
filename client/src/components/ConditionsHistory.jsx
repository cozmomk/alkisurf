import { useState, useEffect, useRef } from 'react';
import { scoreColor, compassLabel } from '../utils.js';

const SLOT_LABELS = ['12a', '6a', '12p', '6p'];

function ptHour(ts) {
  return parseInt(new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false })) % 24;
}

export function formatBlockLabel(block, full = false) {
  const d = new Date(block.ts);
  const day = d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' });
  const slotIdx = Math.floor(ptHour(block.ts) / 6);
  const slot = SLOT_LABELS[slotIdx];
  const slotEnd = SLOT_LABELS[(slotIdx + 1) % 4];
  if (full) {
    const date = d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' });
    return `${day} ${date} · ${slot}–${slotEnd}`;
  }
  return `${day} ${slot}`;
}

export function groupIntoBlocks(entries) {
  const blockMap = {};
  for (const entry of entries) {
    const d = new Date(entry.ts);
    const dateStr = d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
    const blockIdx = Math.floor(ptHour(entry.ts) / 6);
    const key = `${dateStr}-${blockIdx}`;
    if (!blockMap[key]) blockMap[key] = { key, entries: [] };
    blockMap[key].entries.push(entry);
  }

  return Object.values(blockMap).map(({ key, entries }) => {
    let peak = entries[0];
    let peakScore = Math.max(peak.north?.score ?? 0, peak.south?.score ?? 0);
    for (const e of entries.slice(1)) {
      const s = Math.max(e.north?.score ?? 0, e.south?.score ?? 0);
      if (s > peakScore) { peakScore = s; peak = e; }
    }
    return { key, score: peakScore, ...peak };
  }).sort((a, b) => a.ts - b.ts);
}

export default function ConditionsHistory() {
  const [status, setStatus] = useState('loading');
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch('/api/history?n=168')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(history => {
        if (history.length < 6) { setStatus('empty'); return; }
        setBlocks(groupIntoBlocks(history));
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [blocks]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="card p-4">
      <div className="mb-3">
        <span className="section-title">Glass History</span>
      </div>

      {status === 'loading' && (
        <div style={{ overflowX: 'auto', display: 'flex', gap: 4 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ flex: '0 0 40px', height: 48, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-center py-4" style={{ color: '#ff6b1a' }}>
          Unable to load history — try refreshing
        </p>
      )}

      {status === 'empty' && (
        <p className="text-xs text-center py-4" style={{ color: '#5a7fa0' }}>
          Collecting history — check back in a few days
        </p>
      )}

      {status === 'ok' && (
        <div
          ref={scrollRef}
          style={{ overflowX: 'auto', display: 'flex', gap: 4, scrollSnapType: 'x mandatory' }}
        >
          {blocks.map(block => (
            <div
              key={block.key}
              style={{ flex: '0 0 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, scrollSnapAlign: 'start' }}
            >
              <div
                onClick={() => setSelected(block)}
                style={{
                  width: 40,
                  height: 48,
                  borderRadius: 6,
                  background: scoreColor(block.score),
                  cursor: 'pointer',
                  opacity: 0.85,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 10, color: '#5a7fa0', whiteSpace: 'nowrap' }}>
                {formatBlockLabel(block)}
              </span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#0d1f2d', borderRadius: '12px 12px 0 0', padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#5a7fa0', fontSize: 18, cursor: 'pointer' }}
            >
              ✕
            </button>
            <p className="text-sm font-semibold mb-3" style={{ color: '#e2eef7' }}>
              {formatBlockLabel(selected, true)}
            </p>
            <p className="text-sm mb-1" style={{ color: '#c8dff0' }}>
              North: {selected.north?.score ?? '—'} · South: {selected.south?.score ?? '—'}
            </p>
            <p className="text-sm mb-1" style={{ color: '#c8dff0' }}>
              Wind: {selected.windSpeedKt != null ? `${selected.windSpeedKt.toFixed(1)}kt` : '—'} {compassLabel(selected.windDirDeg)}
            </p>
            {selected.waterTempF != null && (
              <p className="text-sm" style={{ color: '#c8dff0' }}>Water: {selected.waterTempF}°F</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
