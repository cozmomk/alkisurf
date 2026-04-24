import { useState, useEffect, useCallback, Component } from 'react';

export class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 24, color: '#ff6b1a', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
        App error: {this.state.err.message}{'\n'}{this.state.err.stack}
      </div>
    );
    return this.props.children;
  }
}
import SideCard from './components/SideCard.jsx';
import ConditionsBar from './components/ConditionsBar.jsx';
import ForecastStrip from './components/ForecastStrip.jsx';
import BestWindows from './components/BestWindows.jsx';
import WebcamPanel from './components/WebcamPanel.jsx';
import InstallNudge from './components/InstallNudge.jsx';
import ReportButton from './components/ReportButton.jsx';
import ConditionsSprite from './components/ConditionsSprite.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';
const POLL_MS = 5 * 60 * 1000; // 5 minutes

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const SOURCE_URLS = {
  'NDBC buoy':    'https://www.ndbc.noaa.gov/station_page.php?station=wpow1',
  'NOAA tides':   'https://tidesandcurrents.noaa.gov/stationhome.html?id=9447130',
  'NWS forecast': 'https://marine.weather.gov/MapClick.php?zoneid=PZZ131',
  'Open-Meteo':   'https://open-meteo.com/en/docs/marine-weather-api',
};

function SourceBadge({ ok, label }) {
  const href = SOURCE_URLS[label];
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 text-[10px] transition-opacity hover:opacity-70"
      style={{ color: ok ? '#00e887' : '#ff2b55', textDecoration: 'none' }}>
      <span style={{ fontSize: 8 }}>{ok ? '●' : '○'}</span>{label}
    </a>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/conditions`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  // Update "N min ago" display
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const current = data?.current;
  const windDirDeg = current?.windDirDeg ?? 0;
  const scores = current?.scores;

  // Determine overall best side right now
  const bestSide = scores
    ? (scores.north.score >= scores.south.score ? 'north' : 'south')
    : null;

  return (
    <>
      <div className="wave-bg" />
      <div className="content min-h-screen px-4 pt-5 pb-10 max-w-lg mx-auto flex flex-col gap-4">

        {/* Header */}
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight" style={{ color: '#e2eef7' }}>
                ALKI
              </h1>
              <span className="text-2xl font-light" style={{ color: '#5a7fa0' }}>surf</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#5a7fa0' }}>
              West Seattle · Puget Sound conditions
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <div className="live-dot" />
              <span className="text-[10px] font-semibold" style={{ color: '#00e887' }}>LIVE</span>
            </div>
            {data?.updatedAt && (
              <span className="text-[10px]" style={{ color: '#5a7fa0' }}>
                Updated {timeAgo(data.updatedAt)}
              </span>
            )}
          </div>
        </header>

        {/* iOS install nudge */}
        <InstallNudge />

        {/* Error state */}
        {error && (
          <div className="card px-4 py-3 text-sm" style={{ color: '#ff6b1a', borderColor: '#ff6b1a44' }}>
            ⚠ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="card px-4 py-8 flex items-center justify-center">
            <span className="text-sm" style={{ color: '#5a7fa0' }}>Fetching Alki conditions…</span>
          </div>
        )}

        {/* Best side banner */}
        {scores && (() => {
          const gap = Math.abs(scores.north.score - scores.south.score);
          const maxScore = Math.max(scores.north.score, scores.south.score);
          if (maxScore === 0) return (
            <div className="card px-4 py-2.5 flex items-center gap-2"
              style={{ background: 'rgba(255, 43, 85, 0.06)', borderColor: 'rgba(255, 43, 85, 0.2)' }}>
              <span style={{ color: '#ff2b55', fontSize: 16 }}>✕</span>
              <span className="text-sm font-semibold" style={{ color: '#e2eef7' }}>Both sides rough — not a paddling day</span>
            </div>
          );
          if (gap === 0) return null;
          return (
            <div className="card px-4 py-2.5 flex items-center gap-2"
              style={{ background: 'rgba(0, 232, 135, 0.06)', borderColor: 'rgba(0, 232, 135, 0.2)' }}>
              <span style={{ color: '#00e887', fontSize: 16 }}>▶</span>
              <span className="text-sm font-semibold" style={{ color: '#e2eef7' }}>
                {bestSide === 'north' ? 'North Side' : 'South Side'} is better right now
              </span>
              <span className="ml-auto text-xs" style={{ color: '#5a7fa0' }}>{gap} pt gap</span>
            </div>
          );
        })()}

        {/* Conditions bar */}
        <ConditionsBar current={current} nextHilos={data?.nextHilos} />

        {/* Animated conditions sprite */}
        {scores && (
          <ConditionsSprite
            score={Math.max(scores.north.score, scores.south.score)}
            windSpeedKt={current?.windSpeedKt}
            skyCover={data?.forecast?.[0]?.skyCover ?? null}
          />
        )}

        {/* Side cards */}
        {scores && (
          <div className="flex gap-3">
            <SideCard side="north" data={scores.north} windDirDeg={windDirDeg} />
            <SideCard side="south" data={scores.south} windDirDeg={windDirDeg} />
          </div>
        )}

        {/* Webcam visual check */}
        <WebcamPanel />

        {/* Forecast strip */}
        {data?.forecast?.length > 0 && (
          <div className="card p-4">
            <div className="mb-3">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#5a7fa0' }}>
                48-Hour Forecast
              </span>
            </div>
            <ForecastStrip forecast={data.forecast} />
          </div>
        )}

        {/* Best windows */}
        {data?.bestWindows?.length > 0 && (
          <BestWindows windows={data.bestWindows} />
        )}

        {/* Report button */}
        <ReportButton />

        {/* Data sources footer */}
        {data?.sources && (
          <div className="flex items-center gap-3 flex-wrap px-1">
            <span className="text-[10px]" style={{ color: '#3a5a70' }}>Sources:</span>
            <SourceBadge ok={data.sources.buoy} label="NDBC buoy" />
            <SourceBadge ok={data.sources.tides} label="NOAA tides" />
            <SourceBadge ok={data.sources.nws} label="NWS forecast" />
            <SourceBadge ok={data.sources.marine} label="Open-Meteo" />
          </div>
        )}

        {/* Model disclaimer */}
        <p className="text-[10px] text-center px-4" style={{ color: '#2a4a60' }}>
          Glass score uses SMB wave model + Alki fetch geometry. Buoy at West Point (~1.5mi N). Validate before paddling.
        </p>
      </div>
    </>
  );
}
