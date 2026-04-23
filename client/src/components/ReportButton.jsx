import { useState } from 'react';

const RATINGS = [
  { key: 'glass',  label: 'Glass',       emoji: '🪟', color: '#00e887' },
  { key: 'ripple', label: 'Light Ripple', emoji: '〰️', color: '#7dff4f' },
  { key: 'chop',   label: 'Light Chop',  emoji: '🌊', color: '#ffc300' },
  { key: 'rough',  label: 'Choppy',      emoji: '💨', color: '#ff6b1a' },
  { key: 'nogo',   label: 'No Go',       emoji: '❌', color: '#ff2b55' },
];

const SIDES = ['North', 'South', 'Both'];

export default function ReportButton() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(null);
  const [side, setSide] = useState('Both');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(null); // 'sending' | 'done' | 'error'

  async function submit() {
    if (!rating) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, side: side.toLowerCase(), note }),
      });
      setStatus(res.ok ? 'done' : 'error');
      if (res.ok) setTimeout(() => { setOpen(false); reset(); }, 1400);
    } catch {
      setStatus('error');
    }
  }

  function reset() {
    setRating(null); setSide('Both'); setNote(''); setStatus(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#5a7fa0',
          cursor: 'pointer',
        }}>
        <span style={{ fontSize: 14 }}>📋</span> Report conditions
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); reset(); } }}>
          <div className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: '#0d1e30', border: '1px solid rgba(255,255,255,0.08)' }}>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#5a7fa0' }}>
                Report Conditions
              </span>
              <button onClick={() => { setOpen(false); reset(); }}
                style={{ color: '#3a5a70', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            <div>
              <div className="text-[10px] mb-2" style={{ color: '#3a5a70' }}>How were conditions?</div>
              <div className="flex gap-2 flex-wrap">
                {RATINGS.map(r => (
                  <button key={r.key} onClick={() => setRating(r.key)}
                    className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all"
                    style={{
                      background: rating === r.key ? `${r.color}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${rating === r.key ? r.color + '66' : 'rgba(255,255,255,0.07)'}`,
                      cursor: 'pointer',
                    }}>
                    <span style={{ fontSize: 16 }}>{r.emoji}</span>
                    <span className="text-[9px] font-semibold" style={{ color: rating === r.key ? r.color : '#5a7fa0' }}>
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] mb-2" style={{ color: '#3a5a70' }}>Which side?</div>
              <div className="flex gap-2">
                {SIDES.map(s => (
                  <button key={s} onClick={() => setSide(s)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: side === s ? 'rgba(0,232,135,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${side === s ? 'rgba(0,232,135,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      color: side === s ? '#00e887' : '#5a7fa0',
                      cursor: 'pointer',
                    }}>{s}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] mb-2" style={{ color: '#3a5a70' }}>Note (optional)</div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={280}
                placeholder="e.g. wind shifted NW around 10am..."
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-[11px] resize-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#c8dff0',
                  outline: 'none',
                }} />
            </div>

            <button
              onClick={submit}
              disabled={!rating || status === 'sending' || status === 'done'}
              className="w-full py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all"
              style={{
                background: status === 'done' ? 'rgba(0,232,135,0.2)' : rating ? 'rgba(0,232,135,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${status === 'done' ? 'rgba(0,232,135,0.4)' : rating ? 'rgba(0,232,135,0.25)' : 'rgba(255,255,255,0.08)'}`,
                color: status === 'done' ? '#00e887' : rating ? '#00e887' : '#3a5a70',
                cursor: rating && status !== 'done' ? 'pointer' : 'default',
              }}>
              {status === 'sending' ? 'Submitting…' : status === 'done' ? '✓ Submitted' : status === 'error' ? 'Error — try again' : 'Submit report'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
