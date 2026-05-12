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
import WeatherDays from './components/WeatherDays.jsx';
import WebcamPanel from './components/WebcamPanel.jsx';
import InstallNudge from './components/InstallNudge.jsx';
import ReportButton from './components/ReportButton.jsx';
import ConditionsSprite from './components/ConditionsSprite.jsx';
import InsightsPanel from './components/InsightsPanel.jsx';
import SurfHistory from './components/GlassCalendar.jsx';
import CSOWarning from './components/CSOWarning.jsx';
import { conditionsEmoji, scoreColor } from './utils.js';

const API_URL = import.meta.env.VITE_API_URL || '';
const POLL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_MS = 30 * 60 * 1000; // 30 minutes

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
      style={{ color: ok ? '#00e887' : '#ff2b55', textDecoration: 'none', minHeight: 44, paddingBlock: 6, paddingInline: 4 }}>
      <span style={{ fontSize: 8 }}>{ok ? '●' : '○'}</span>{label}
    </a>
  );
}

function ModelExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card px-4 py-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', minHeight: 44 }}>
        <span className="text-[11px] font-semibold" style={{ color: '#5a7fa0' }}>How is this score calculated?</span>
        <span className="text-[10px]" style={{ color: '#3a5a70' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 mt-3 text-[11px]" style={{ color: '#7a9ab8' }}>
          <p>The glass score combines two factors: <strong style={{color:'#c8dff0'}}>wind</strong> and <strong style={{color:'#c8dff0'}}>waves</strong>, each 0–1, multiplied to give 0–10. Tap <em style={{color:'#5a7fa0'}}>▾ why?</em> on each side card to see the live breakdown for current conditions.</p>
          <div>
            <div className="font-semibold mb-1" style={{color:'#c8dff0'}}>Wind factor</div>
            <p>Effective wind = 65% sustained + 35% gust. Scores drop sharply above 8kt and hit zero at 14kt — above that, the water is too rough regardless of waves.</p>
          </div>
          <div>
            <div className="font-semibold mb-1" style={{color:'#c8dff0'}}>Wave factor (why N vs S differs)</div>
            <p>Waves grow with <em>fetch</em> — the distance wind travels over open water before reaching you. North side is sheltered (Elliott Bay); south side faces open Sound. Same wind, different chop.</p>
          </div>
          <div>
            <div className="font-semibold mb-1" style={{color:'#c8dff0'}}>Duration matters</div>
            <p>Waves don't appear instantly. Fresh wind takes 30–90 min to build fully developed chop over Puget Sound fetch distances. The score reflects this: a new wind gust scores higher than the same wind sustained for 2 hours.</p>
            <p className="mt-1">When wind dies, chop lingers for ~35 min. The score shows "residual chop" during this window.</p>
          </div>
          <p style={{color:'#3a5a70'}}>Data: NDBC buoy WPOW1 (West Point, 1.5mi N) · NWS hourly forecast · Open-Meteo marine · NOAA tides</p>
        </div>
      )}
    </div>
  );
}

// ─── Smart glass window banner ────────────────────────────────────────────────

function findNextGlassWindow(forecast) {
  const now = Date.now();
  const upcoming = (forecast ?? []).filter(h => h.time > now && h.sides?.north != null);
  const hit = upcoming.find(h => Math.max(h.sides.north.score, h.sides.south.score) >= 7);
  if (!hit) return null;
  const side = hit.sides.north.score >= hit.sides.south.score ? 'north' : 'south';
  return {
    ts:            hit.time,
    score:         Math.max(hit.sides.north.score, hit.sides.south.score),
    side,
    airTempF:      hit.airTempF ?? null,
    skyCover:      hit.skyCover ?? null,
    shortForecast: hit.shortForecast ?? null,
  };
}

function formatWindowTime(ts) {
  const timeStr = new Date(ts).toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric', hour12: true,
  });
  const isToday = new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  return isToday ? `${timeStr} today` : `${timeStr} tomorrow`;
}

function SmartBanner({ scores, forecast }) {
  if (!scores) return null;

  const maxScore  = Math.max(scores.north.score, scores.south.score);
  const gap       = Math.abs(scores.north.score - scores.south.score);
  const bestSide  = scores.north.score >= scores.south.score ? 'north' : 'south';
  const sideLabel = bestSide === 'north' ? 'North' : 'South';

  // ── GLASS NOW — bold celebratory state ───────────────────────────────────
  if (maxScore >= 7) {
    const bothGlass = gap === 0;
    return (
      <div className="card px-4 py-3"
        style={{ background: 'rgba(0, 232, 135, 0.09)', borderColor: 'rgba(0, 232, 135, 0.35)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 22 }}>🪟</span>
          <div className="flex flex-col">
            <span className="font-black" style={{ color: '#00e887', fontSize: 18, lineHeight: 1.1 }}>
              {bothGlass ? 'Both sides glass' : `${sideLabel} side glass`}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold" style={{ color: scoreColor(maxScore) }}>
                {maxScore}/10
              </span>
              {!bothGlass && gap > 0 && (
                <span className="text-[10px]" style={{ color: '#5a7fa0' }}>{gap} pt gap</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── BOTH ROUGH — no windows coming ───────────────────────────────────────
  if (maxScore === 0) {
    const win = findNextGlassWindow(forecast);
    if (!win) return (
      <div className="card px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'rgba(255, 43, 85, 0.06)', borderColor: 'rgba(255, 43, 85, 0.2)' }}>
        <span style={{ color: '#ff2b55', fontSize: 16 }}>✕</span>
        <span className="text-sm font-semibold" style={{ color: '#e2eef7' }}>Both sides rough — not a paddling day</span>
      </div>
    );
  }

  // ── GLASS LATER — compact informational state ─────────────────────────────
  const win = findNextGlassWindow(forecast);
  if (!win) return null;

  const wxEmoji  = conditionsEmoji(win.skyCover, win.shortForecast, win.ts);
  const tempStr  = win.airTempF != null ? ` · ${wxEmoji ?? ''} ${Math.round(win.airTempF)}°F` : (wxEmoji ? ` · ${wxEmoji}` : '');
  const winLabel = win.side === 'north' ? 'N' : 'S';
  const timeStr  = formatWindowTime(win.ts);

  return (
    <div className="card px-4 py-2.5 flex items-center gap-2"
      style={{ background: 'rgba(0, 232, 135, 0.04)', borderColor: 'rgba(0, 232, 135, 0.15)' }}>
      <span style={{ color: '#5a7fa0', fontSize: 16 }}>◷</span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold" style={{ color: '#e2eef7' }}>
          Glass at {timeStr}
        </span>
        <span className="text-[10px]" style={{ color: '#5a7fa0' }}>
          {win.score}/10 {winLabel}{tempStr}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [godMode, setGodMode] = useState(false);

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

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const current         = data?.current;
  const windDirDeg      = current?.windDirDeg ?? 0;
  const scores          = current?.scores;
  const currentForecast = data?.forecast?.find(h => h.time >= Date.now()) ?? data?.forecast?.[0] ?? null;

  const todayPT  = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const todaySun = data?.sunTimes?.find(s => s.date === todayPT) ?? null;
  const sunriseTs = todaySun?.sunriseTs ?? null;
  const sunsetTs  = todaySun?.sunsetTs  ?? null;

  // Stale data detection
  const isStale = data?.updatedAt && (Date.now() - data.updatedAt) > STALE_MS;
  const staleAgo = data?.updatedAt ? timeAgo(data.updatedAt) : null;

  return (
    <>
      <div className="wave-bg" />
      <div className="content min-h-screen px-4 pt-5 pb-10 max-w-lg mx-auto flex flex-col gap-4">

        {/* Header */}
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black tracking-tight" style={{ color: '#e2eef7', fontFamily: "'Barlow Condensed', system-ui", fontSize: 28, letterSpacing: '0.04em' }}>
                ALKI
              </h1>
              <span className="font-light" style={{ color: '#5a7fa0', fontFamily: "'Barlow Condensed', system-ui", fontSize: 28, letterSpacing: '0.08em' }}>surf</span>
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
              <span className="text-[11px]" style={{ color: '#7a9ab8' }}>
                Updated {timeAgo(data.updatedAt)}
              </span>
            )}
          </div>
        </header>

        {/* iOS install nudge */}
        <InstallNudge />

        {/* Stale data warning */}
        {isStale && (
          <div className="card px-4 py-2.5 flex items-center gap-2"
            style={{ background: 'rgba(255, 195, 0, 0.07)', borderColor: 'rgba(255, 195, 0, 0.25)' }}>
            <span style={{ color: '#ffc300', fontSize: 14 }}>⚠</span>
            <span className="text-xs" style={{ color: '#ffc300' }}>
              Showing cached data from {staleAgo} — refresh when online
            </span>
          </div>
        )}

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

        {/* CSO water quality warning */}
        <CSOWarning />

        {/* Smart banner — bold when glass now, compact when glass later */}
        {scores && (
          <SmartBanner scores={scores} forecast={data?.forecast ?? []} />
        )}

        {/* Sprite + ConditionsBar fused — no gap between them (D8) */}
        {scores && (
          <div className="flex flex-col" style={{ gap: 0 }}>
            <ConditionsSprite
              score={Math.max(scores.north.score, scores.south.score)}
              windSpeedKt={current?.windSpeedKt}
              windDirDeg={windDirDeg}
              windDirLabel={current?.windDirLabel ?? null}
              windGustKt={current?.windGustKt ?? currentForecast?.windGustKt ?? null}
              skyCover={currentForecast?.skyCover ?? null}
              shortForecast={currentForecast?.shortForecast ?? null}
              precipProbability={currentForecast?.precipProbability ?? null}
              uvIndex={currentForecast?.uvIndex ?? null}
              precipInPerHr={currentForecast?.precipInPerHr ?? null}
              waterTempF={current?.waterTempF ?? null}
              tideCurrentFt={current?.tideCurrentFt ?? null}
              nextHilos={data?.nextHilos ?? null}
              airTempF={current?.airTempF ?? null}
              sunriseTs={sunriseTs}
              sunsetTs={sunsetTs}
              godMode={godMode}
              onTripleTap={() => setGodMode(g => !g)}
            />
            <ConditionsBar
              current={current}
              nextHilos={data?.nextHilos}
              uvIndex={currentForecast?.uvIndex ?? null}
              precipInPerHr={currentForecast?.precipInPerHr ?? null}
              precipProbability={currentForecast?.precipProbability ?? null}
              sunriseTs={sunriseTs}
              sunsetTs={sunsetTs}
              forecast={data?.forecast ?? []}
              scores={scores}
              skyCover={currentForecast?.skyCover ?? null}
              shortForecast={currentForecast?.shortForecast ?? null}
            />
          </div>
        )}

        {/* Side cards */}
        {scores && (
          <div className="flex gap-3">
            <SideCard side="north" data={scores.north} windDirDeg={windDirDeg}
              forecast={data?.forecast} airTempF={current?.airTempF}
              windGustKt={current?.windGustKt ?? null}
              waterTempF={current?.waterTempF ?? null} />
            <SideCard side="south" data={scores.south} windDirDeg={windDirDeg}
              forecast={data?.forecast} airTempF={current?.airTempF}
              windGustKt={current?.windGustKt ?? null}
              waterTempF={current?.waterTempF ?? null} />
          </div>
        )}

        {/* Model explainer */}
        {scores && <ModelExplainer />}

        {/* "Looking ahead" section divider */}
        {data?.forecast?.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#3a5a70' }}>
              Looking ahead
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>
        )}

        {/* 3-day outlook + best windows */}
        {data?.forecast?.length > 0 && (
          <WeatherDays forecast={data.forecast} bestWindows={data.bestWindows} sunTimes={data.sunTimes ?? []} />
        )}

        {/* Webcam visual check */}
        <WebcamPanel />

        {/* Report conditions — moved above history */}
        <ReportButton />

        {/* Glass calendar — daily UV-filtered best scores */}
        <SurfHistory />

        {/* Model calibration */}
        <InsightsPanel />

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

        <p className="text-[10px] text-center px-4" style={{ color: '#2a4a60' }}>
          Glass score uses SMB wave model + Alki fetch geometry. Buoy at West Point (~1.5mi N). Validate before paddling.
        </p>
      </div>
    </>
  );
}
