import { useState, useEffect } from 'react';

export default function InstallNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari, not already installed, not dismissed
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('install-nudge-dismissed');
    if (isIOS && !isStandalone && !dismissed) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem('install-nudge-dismissed', '1');
    setShow(false);
  };

  return (
    <div
      className="card px-4 py-3 flex items-center gap-3"
      style={{ background: 'rgba(0, 232, 135, 0.06)', borderColor: 'rgba(0, 232, 135, 0.2)' }}
    >
      <span style={{ fontSize: 20 }}>📲</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: '#e2eef7' }}>Add to Home Screen</p>
        <p className="text-[10px] mt-0.5" style={{ color: '#5a7fa0' }}>
          Tap <span style={{ color: '#e2eef7' }}>Share</span> then <span style={{ color: '#e2eef7' }}>Add to Home Screen</span> for one-tap access
        </p>
      </div>
      <button
        onClick={dismiss}
        style={{ color: '#5a7fa0', fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
      >
        ×
      </button>
    </div>
  );
}
