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
  // Derive from score color tokens: #ff2b55 (active) and #ff6b1a (recent)
  const accentColor = isActive ? '#ff2b55' : '#ff6b1a';
  const label       = isActive ? 'SEWAGE OVERFLOW ACTIVE' : 'RECENT SEWAGE OVERFLOW';

  const closest = [...alerts].sort((a, b) => a.distMiles - b.distMiles)[0];

  return (
    <div style={{
      background: `${accentColor}14`,
      border: `1px solid ${accentColor}4d`,
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
          background: accentColor,
          boxShadow: `0 0 6px ${accentColor}`,
          animation: isActive ? 'pulse 1.8s ease-in-out infinite' : 'none',
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: accentColor, marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: '#8aacbf', lineHeight: 1.4 }}>
          {closest.name} — {closest.distMiles} mi away
          {alerts.length > 1 && <span style={{ color: '#5a7fa0' }}> + {alerts.length - 1} more outfall{alerts.length > 2 ? 's' : ''}</span>}
        </div>
        <div style={{ fontSize: 9, color: '#3a5a70', marginTop: 4 }}>
          {isActive
            ? 'Avoid swimming and water contact — affects all of Alki Beach.'
            : 'Overflow ended within 48 hrs — bacteria may still be elevated at all of Alki Beach.'}
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
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#3a5a70', fontSize: 16, lineHeight: 1,
          flexShrink: 0, minWidth: 44, minHeight: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0.7,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1}
        onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
        ×
      </button>
    </div>
  );
}
