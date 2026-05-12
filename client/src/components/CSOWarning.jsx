import { useState, useEffect } from 'react';

export default function CSOWarning() {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const r = await fetch('/api/cso-status');
        const data = await r.json();
        setAlerts(data.alerts ?? []);
      } catch {}
    }
    check();
    const id = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!alerts.length || dismissed) return null;

  const isActive = alerts.some(a => a.status === 'CurrentlyOverflowing');
  const borderColor = isActive ? 'rgba(255,43,85,0.5)' : 'rgba(255,107,26,0.4)';
  const bgColor     = isActive ? 'rgba(255,43,85,0.08)' : 'rgba(255,107,26,0.07)';
  const dotColor    = isActive ? '#ff2b55' : '#ff6b1a';
  const label       = isActive ? 'SEWAGE OVERFLOW ACTIVE' : 'RECENT SEWAGE OVERFLOW';

  const closest = [...alerts].sort((a, b) => a.distMiles - b.distMiles)[0];

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: '10px 14px',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      {/* Pulsing dot */}
      <div style={{ paddingTop: 2, flexShrink: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
          animation: isActive ? 'pulse 1.8s ease-in-out infinite' : 'none',
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: dotColor, marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: '#8aacbf', lineHeight: 1.4 }}>
          {closest.name} — {closest.distMiles} mi away
          {alerts.length > 1 && <span style={{ color: '#5a7fa0' }}> + {alerts.length - 1} more outfall{alerts.length > 2 ? 's' : ''}</span>}
        </div>
        <div style={{ fontSize: 9, color: '#3a5a70', marginTop: 4 }}>
          {isActive
            ? 'Avoid swimming and water contact near Alki Beach until overflow stops.'
            : 'Overflow ended within 48 hrs. Bacteria may still be elevated.'}
          {' '}
          <a
            href="https://kingcounty.gov/en/dept/dnrp/waste-services/wastewater-treatment/sewer-system-services/cso-status"
            target="_blank" rel="noopener noreferrer"
            style={{ color: '#5a7fa0', textDecoration: 'underline' }}>
            King County CSO status ↗
          </a>
        </div>
      </div>

      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss water quality warning"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a5a70', fontSize: 16, lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>
        ×
      </button>
    </div>
  );
}
