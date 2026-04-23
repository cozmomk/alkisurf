import { useState, useEffect } from 'react';

const OPTIONS = [
  { key: 'glass', label: 'Glass', emoji: '🪟' },
  { key: 'choppy', label: 'Choppy', emoji: '🌊' },
  { key: 'rough', label: 'Rough', emoji: '❌' },
];

export default function FeedbackPrompt({ current }) {
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const alreadyFiled = localStorage.getItem('feedback-date') === today;
    // Only show 12pm–8pm (post-session window)
    if (!alreadyFiled && hour >= 12 && hour < 20) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const submit = (key) => {
    setSelected(key);
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('feedback-date', today);

    // Log to localStorage history for later review
    const entry = {
      date: today,
      ts: Date.now(),
      actualCondition: key,
      modelScore: current?.scores
        ? Math.max(current.scores.north?.score ?? 0, current.scores.south?.score ?? 0)
        : null,
      windSpeedKt: current?.windSpeedKt ?? null,
      windDirDeg: current?.windDirDeg ?? null,
    };
    const history = JSON.parse(localStorage.getItem('feedback-history') || '[]');
    history.push(entry);
    localStorage.setItem('feedback-history', JSON.stringify(history.slice(-90))); // keep 90 days

    setTimeout(() => setShow(false), 1500);
  };

  return (
    <div className="card px-4 py-3 flex flex-col gap-2">
      <span className="text-xs font-semibold" style={{ color: '#5a7fa0' }}>
        How were conditions today?
      </span>
      <div className="flex gap-2">
        {OPTIONS.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => submit(key)}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all"
            style={{
              background: selected === key ? 'rgba(0, 232, 135, 0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${selected === key ? 'rgba(0, 232, 135, 0.4)' : 'rgba(255,255,255,0.08)'}`,
              cursor: selected ? 'default' : 'pointer',
            }}
          >
            <span style={{ fontSize: 18 }}>{emoji}</span>
            <span className="text-[10px] font-semibold" style={{ color: selected === key ? '#00e887' : '#5a7fa0' }}>
              {label}
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <span className="text-[10px] text-center" style={{ color: '#00e887' }}>
          Thanks — logged for model calibration
        </span>
      )}
    </div>
  );
}
