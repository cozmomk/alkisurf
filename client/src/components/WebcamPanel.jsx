const CAMS = [
  {
    label: 'alkiweather.com',
    desc: 'Beach cam, looking north over Elliott Bay',
    href: 'https://www.alkiweather.com/wxalkiwebcam.php',
    icon: '📷',
  },
  {
    label: 'Windy.com',
    desc: 'Alki Beach webcam player',
    href: 'https://www.windy.com/webcams/1557288048',
    icon: '🌬',
  },
  {
    label: 'WSDOT ferry cam',
    desc: 'Fauntleroy–Vashon crossing view',
    href: 'https://wsdot.wa.gov/ferries/cameras/',
    icon: '⛴',
  },
];

export default function WebcamPanel() {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <span className="section-title">Visual Check</span>
      <div className="flex flex-col gap-2">
        {CAMS.map(({ label, desc, href, icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none' }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold" style={{ color: '#c8dff0' }}>{label}</div>
              <div className="text-[10px]" style={{ color: '#5a7fa0' }}>{desc}</div>
            </div>
            <span style={{ color: '#5a7fa0', fontSize: 14 }}>↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
