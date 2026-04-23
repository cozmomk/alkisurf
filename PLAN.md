<!-- /autoplan restore point: /Users/kevinkramer/.gstack/projects/alkisurf/main-autoplan-restore-20260422-210329.md -->
# alkisurf Phase 2 Plan

## Context

alkisurf (alkisurf.kmkramer.app) is a live paddleboard conditions app for Alki Point, West Seattle. Phase 1 shipped:
- Glass score model (SMB wave physics + Alki-specific fetch geometry table for north/south sides of the point)
- 4 live data sources: NDBC WPOW1 buoy (wind), NOAA tides station 9447130, NWS hourly forecast, Open-Meteo Marine API (waves)
- React + Tailwind UI: score rings, 48hr forecast strip, best window detector, source health badges
- Express backend with 10-minute cache, served as static + API monolith
- Railway-ready deployment config (nixpacks.toml)

Primary user: Kevin (SUP paddleboarder, Alki Beach regular). Seeking glass-like mornings, occasional sun, no wind.

**Known gaps from phase 1:**
1. Water temperature shows "—" — WPOW1 doesn't measure it; need another source
2. No webcam — visual proof that conditions are actually glass would be extremely useful before driving out
3. No user feedback loop — model calibration is theoretical; no real-world correction signal
4. Not deployed — still local only, can't check from phone before leaving the house
5. No PWA / home screen install — this is a check-before-you-go app, should be one tap from the iPhone home screen
6. Wind direction arrow on side cards is non-functional (shows raw arrow icon, not direction-aware rendering)

---

## Change 1: Water Temperature

**Problem:** WPOW1 (West Point buoy) doesn't measure water temp. It shows "—" in the UI.

**Source options:**
- Open-Meteo Marine API already returns `sst` (sea surface temperature) at hourly resolution — we're already fetching from this API, just not using SST
- NOAA CO-OPS station 9447130 (Seattle tides) has a water temperature sensor: `product=water_temperature`

**Implementation:**
- Add `water_temperature` to Open-Meteo Marine API vars in `src/fetchers/marine.js`
- Pull `product=water_temperature` from NOAA in `src/fetchers/tides.js` as a parallel fetch
- Prefer NOAA reading (measured in-water at Seattle pier) over Open-Meteo SST (modeled)
- Fall back to Open-Meteo SST if NOAA reading is missing
- Surface in `ConditionsBar` WATER pill (already has the slot, shows "—" today)

**Files:** `src/fetchers/marine.js`, `src/fetchers/tides.js`, `server.js` (merge logic)

---

## Change 2: Webcam Panel

**Problem:** No visual confirmation that conditions are actually glass. The glass score could be wrong; a camera cuts through model uncertainty instantly.

**Available cameras (researched):**
- alkiweather.com webcam — sky-tilted but shows water horizon, Alki Beach location. URL: `https://www.alkiweather.com/wxalkiwebcam.php` for the still frame
- Windy.com webcam #1557288048 — labeled Alki Beach, embedded via their public webcam embed API
- WSDOT Fauntleroy ferry terminal — updates every 5 min, shows the Sound crossing. Not embeddable directly but linkable.

**Implementation:**
- New `WebcamPanel` React component below the Best Windows section
- Embed strategy: use an `<img>` tag with auto-refresh (30s interval) for the alkiweather.com still frame — no CORS issues, just a direct image URL
- Secondary: link out to Windy.com webcam and WSDOT ferry cam
- Add "Last refreshed: Xs ago" counter on the image
- Collapsed by default on mobile (accordion), expanded on desktop
- Label: "Visual check — alkiweather.com looking north over Elliott Bay"

**Files:** `client/src/components/WebcamPanel.jsx` (new), `client/src/App.jsx` (add below BestWindows)

---

## Change 3: Session Feedback Loop

**Problem:** The glass score model uses theoretical fetch geometry and SMB wave physics. No signal from real-world observations to know if the model is systematically wrong.

**Implementation:**
- After Best Windows section: a subtle "How were conditions?" prompt that appears once per day (stored in localStorage with today's date key)
- Three options: "Glass 🪟" / "Choppy 🌊" / "Rough ❌"
- On selection: POST to `/api/feedback` with `{side, actualCondition, modelScore, windSpeedKt, windDirDeg, timestamp}`
- Backend: append to `~/.local/alkisurf-feedback.jsonl` (simple file log, no database needed)
- No auth, no tracking, just a timestamped JSONL for later calibration analysis
- Feedback is optional, dismissable, and doesn't block anything

**Files:** `client/src/components/FeedbackPrompt.jsx` (new), `server.js` (add `/api/feedback` endpoint)

---

## Change 4: Deploy to Railway

**Problem:** App is local only. The entire value proposition is "check before leaving the house" — that requires a public URL.

**Implementation:**
- Add `.gitignore` (node_modules, client/dist, .env)
- Railway deploy: `railway login && railway new alkisurf && railway up`
- Add custom domain `alkisurf.kmkramer.app` in Railway dashboard
- Set DNS CNAME at kmkramer.app registrar pointing to Railway's provided hostname
- Verify health: `curl https://alkisurf.kmkramer.app/api/conditions`

**Notes:**
- nixpacks.toml and railway.toml already written in phase 1
- No env vars needed — all APIs are public/free with no auth
- Build command: `cd client && npm install && npm run build`
- Start command: `node server.js`
- PORT env var respected via `process.env.PORT || 3001`

**Files:** `.gitignore` (new), no code changes — this is a deploy step

---

## Change 5: PWA / Home Screen Install

**Problem:** This is a "grab your phone before heading to the beach" app. Opening Safari, typing a URL, and waiting is friction. Should be one tap from the iPhone home screen.

**Implementation:**
- Add `client/public/manifest.json` with name, short_name ("Alki"), icons, display: standalone, theme_color: #060d1f
- Add `<link rel="manifest">` and `<meta name="apple-mobile-web-app-capable">` to index.html
- Add SVG icon (wave/paddle emoji based) at 192x192 and 512x512
- Service worker for offline fallback: cache the last successful `/api/conditions` response; show "Last updated X min ago" if offline rather than blank
- Add "Add to Home Screen" nudge banner (dismissable, shown once) for iOS users

**Files:** `client/public/manifest.json` (new), `client/public/sw.js` (new), `client/index.html`, `client/src/App.jsx`

---

## Change 6: Wind Direction Arrow Fix

**Problem:** The wind direction arrow on side cards always points the same way — it's a static SVG that takes `deg` prop but the SVG `transform: rotate()` applies to the whole element, not relative to north.

**Root cause:** The arrow SVG uses `style={{ transform: `rotate(${deg}deg)` }}` which should work, but the arrow is drawn pointing UP (north), so rotating by wind direction degrees should be correct... unless the arrow convention is "wind FROM" vs "wind TO". NDBC reports wind direction as "wind FROM" (the direction the wind is coming FROM). So a 180° (S) wind should point DOWN (wind coming from south, blowing north). Currently the arrow likely shows wrong.

**Fix:**
- Clarify convention: arrow should point FROM the wind source (the direction wind is coming FROM)
- An arrow pointing toward the center of the card = "wind from this direction"
- Actually the simplest visual: show compass label (already working: "15 kt S") and add a small compass rose or directional indicator
- Replace the custom WindArrow SVG with a simple text direction indicator or a proper compass needle that's clearly labeled

**Files:** `client/src/components/SideCard.jsx`

---

## Execution Order

1. Deploy (Change 4) — unblocks mobile access immediately, no code changes needed
2. Water temp (Change 1) — quick win, one data source addition
3. Wind arrow fix (Change 6) — bug fix, 20 min
4. Webcam (Change 2) — adds visual proof, medium complexity
5. PWA (Change 5) — polish, adds home screen install
6. Feedback loop (Change 3) — last because it requires a data accumulation period to be useful

---

## NOT in scope (phase 3 ideas)

- Historical conditions charts — needs a time-series database
- Push notifications ("glass right now!") — requires a backend scheduler + device registration
- Community reports / social ("3 paddlers out now") — requires user accounts
- Current speed data — no free public API for Alki Point specifically
- Surf forecast for actual waves — not the use case (SUP not surfing)

---

## GSTACK REVIEW REPORT

### Phase 1 — CEO Review (SELECTIVE EXPANSION)

**Reviewer:** Claude (autoplan pipeline, no Codex available)
**Mode:** SELECTIVE EXPANSION — baseline plan held; expansion opportunities surfaced individually
**Date:** 2026-04-22

---

#### PRE-REVIEW SYSTEM AUDIT

- Single commit in history (`45a002f feat: initial alkisurf build`)
- No open PRs, no stashed changes, no TODOs/FIXMEs in source
- **Critical finding:** `node_modules/` was committed in the initial commit (no `.gitignore` existed). 6,000+ node_modules files are in git history. Railway will still work (nixpacks ignores them), but the repo is bloated and deploys will be slow pulling that history.
- NOAA, NWS, Open-Meteo APIs: all public/free/no-auth. Architecture sound.
- Taste notes: `glassScore.js` is clean, well-structured. `buoy.js` has a subtle "newest-first" quirk already fixed. The `Promise.allSettled` pattern in `server.js` is the right call. Anti-pattern to avoid: the `FETCH_TABLE` compass interpolation in `fetchGeometry.js` is simple and correct — don't over-engineer it.

---

#### PREMISE CHALLENGE

**Change 1 (Water temp):** Premise correct. WPOW1 doesn't measure WTMP. NOAA CO-OPS 9447130 does have a water_temperature product. The two-source approach is right.

**Change 2 (Webcam):** Premise correct. But the alkiweather.com camera URL in the plan (`wxalkiwebcam.php` as an `<img>` src) is almost certainly blocked by hotlink protection. Most weather webcam hosts check the Referer header. The `<img>` embed strategy needs validation before building — or the backend needs to proxy the image.

**Change 3 (Feedback loop):** Premise valid. BUT: **Railway's filesystem is ephemeral.** Files written to `~/.local/alkisurf-feedback.jsonl` are wiped on every deploy (Railway containers don't persist disk between deploys). The plan as written will silently lose all feedback data on the next Railway push. This is a **showstopper** for Change 3 as planned.

**Change 4 (Deploy):** Premise correct. No code changes needed. The `.gitignore` must be added first (node_modules cleanup).

**Change 5 (PWA):** Premise correct. iOS Safari supports service workers and "Add to Home Screen" since iOS 11.3. Background sync and Web Push notifications do NOT work on iOS Safari — so the offline fallback plan is fine, but push notifications are not on the table for iOS users.

**Change 6 (Wind arrow):** Bug confirmed. The SVG arrow draws pointing UP (north). NDBC reports wind direction as "from" (a 180° reading = wind from south, blowing north). Rotating the SVG by 180° = arrow points DOWN = correct "from south" visual. The current code rotates by `windDirDeg` but the transform origin is the element center, which should work. The real bug is likely that the arrow convention was never validated against actual NDBC data.

---

#### DREAM STATE (10x version of this product)

The best version of alkisurf doesn't just show you conditions — it **tells you when to go** without you opening the app. You wake up, your phone already has a notification: "Glass at Alki North Side — 8.5/10, 55°F, 4kt W, high tide at 7am. Go now." You tap it, the app opens, conditions confirmed, you're in the car in 3 minutes.

That's the north star. Everything in Phase 2 either directly enables it (PWA) or closes the information gap (water temp, webcam). The feedback loop enables model calibration over time.

The one missing link: even with PWA + service worker, iOS does not support Web Push. Android does. So the "wake up to a notification" experience is Android-only for now. Worth knowing before building out the notification infrastructure.

---

#### CRITICAL ISSUE: Feedback Storage on Railway

**Problem:** Railway containers are stateless. Files written during runtime are lost on every deploy.

**Options ranked:**
1. **Supabase free tier** — Postgres-backed, free, persistent, has a simple REST API. One table: `{id, side, actualCondition, modelScore, windSpeedKt, windDirDeg, timestamp}`. No auth needed for write-only inserts from a personal app. ~30 min to set up.
2. **Google Sheets via Zapier webhook** — POST JSON to a Zapier webhook → appended to a Sheet. Zero backend code. Free for low volume. But adds a third-party dependency.
3. **Railway Volumes (beta)** — Persistent disk. Works but requires Railway Pro tier.
4. **Drop backend storage, use client-side only** — localStorage is already used for the "shown once per day" gate. Could log to localStorage array and expose a "download feedback" button. No server needed. Data stays on the user's phone. Fine for a 1-person app.

**Recommendation:** Option 4 for now (client localStorage log), upgrade to Option 1 when model calibration becomes a priority. A personal app with one user doesn't need a database for feedback yet.

---

#### EXPANSION OPPORTUNITIES (SELECTIVE EXPANSION — each is opt-in)

**EXP-A: Web Push notification when conditions are glass**

What: A Railway cron job (or a client-side notification via the Page Visibility API as a soft version) that alerts you when the score is ≥ 8 between 5-10am.

Why now: The PWA change (Change 5) adds the service worker. Adding push subscription support at the same time is ~50% cheaper than adding it later (the SW is already wired). The hard part is the notification trigger — Railway supports cron jobs natively (set a scheduled task in railway.toml).

iOS caveat: Web Push works on iOS 16.4+ via home screen PWA only. Still limited.

Effort (human: ~1-2 days / CC: ~20 min). Completeness: 8/10.

**EXP-B: Shareable one-line text summary**

What: A "copy conditions" button (or auto-copy on tap) that produces: "Alki North: 8/10 Glass · 4kt W · 54°F · Rising tide. Wed Apr 22 6am". Copy to clipboard, paste to iMessage when friends ask.

Why: This is a 20-line addition. Zero backend. Extremely high usefulness for a social beach activity.

Effort (human: 30 min / CC: ~2 min). Completeness: 9/10.

**EXP-C: Webcam image proxy via backend**

What: Instead of `<img src="https://alkiweather.com/..."`, proxy through `/api/webcam` which fetches the image server-side, caches it for 30s, and serves it. This bypasses hotlink protection and gives you a consistent refresh cadence.

Why: Without this, the webcam feature may silently show broken images. The proxy also lets you add image freshness metadata (Last-Modified header).

Effort (human: 2 hrs / CC: ~5 min). Completeness: 9/10.

**EXP-D: Clean git history (remove node_modules)**

What: Rewrite history with `git filter-branch` or BFG Repo Cleaner to remove node_modules from the initial commit.

Why: The repo is currently ~50MB+ because of committed node_modules. This slows Railway's git clone on every deploy.

Trade-off: Destructive history rewrite — fine for a personal single-developer repo, not appropriate for collaborative repos.

Effort (human: 30 min / CC: ~5 min). Completeness: 10/10.

---

#### ALIGNMENT TABLE

| Change | Status | Notes |
|--------|--------|-------|
| 1. Water temp | ✅ Proceed | NOAA CO-OPS + Open-Meteo fallback. Watch for NOAA latency. |
| 2. Webcam | ⚠️ Risky as planned | Verify hotlink protection first. Consider backend proxy (EXP-C). |
| 3. Feedback loop | ❌ Plan broken | Railway filesystem ephemeral. Recommend localStorage-only for now. |
| 4. Deploy | ✅ Proceed | Add .gitignore first. Fix node_modules history if bothered by repo size. |
| 5. PWA | ✅ Proceed | iOS Push caveat noted. Offline fallback is the right core feature. |
| 6. Wind arrow | ✅ Proceed | Bug is real. Add compass label ("Wind from S") alongside arrow. |

---

### Phase 2 — Design Review

**Reviewer:** Claude (autoplan pipeline)
**Date:** 2026-04-22

---

#### VISUAL HIERARCHY & INFORMATION ARCHITECTURE

The Phase 1 UI is well-structured. The Score → Conditions → Forecast → Best Windows hierarchy matches how a paddler thinks: "Is it good now? What are the numbers? When is the best time?" Phase 2 adds Webcam and potentially a Feedback prompt to this flow. Concerns:

1. **Webcam placement:** Below Best Windows (per plan) puts it 4 scrolls down from the top on mobile. A paddler checking from bed wants the camera **near the top** — ideally right below the Score rings (north/south cards), not at the bottom. "Show me visually what the score is describing" is context for the score, not a footer.

2. **Feedback prompt timing:** "How were conditions?" only makes sense after you've been paddling. If shown in the morning (the primary use case), it's asking about yesterday's session. The localStorage gate should check date AND whether the user previously loaded the app that morning (timestamp-based). Don't show the feedback prompt on the morning check — show it in the afternoon/evening.

3. **Water temp placement:** The WATER pill in ConditionsBar is the right slot. No changes needed.

4. **Wind arrow:** The arrow currently sits in the SideCard metric list with no label. The fix should add a text label: "from SW" or "S→N" alongside the arrow so it reads even on a quick glance.

---

#### COMPONENT DESIGN

**WebcamPanel (new):**
- Use `aspect-ratio: 4/3` container so layout doesn't shift when image loads
- Add a skeleton loader (same style as the loading state in App.jsx — use `opacity: 0.3`)
- The 30-second auto-refresh should use `setInterval` in a `useEffect`, not `key` rotation (avoid full re-mount)
- Error state: if `<img>` `onError` fires, show "Camera unavailable" with a link-out to the live camera page
- Don't add the accordion collapse on mobile — just show it. The camera is a key feature, not a drawer.

**FeedbackPrompt (new):**
- Make it subtle: a horizontal strip with 3 emoji-buttons, not a modal
- Show ONLY if: `localStorage.getItem('feedback-date') !== today` AND current time is between 12pm-8pm (afternoon/evening, post-session)
- On select: immediate visual confirmation (button turns green/active), then POST in background. Don't block UI.

**PWA manifest:**
- `display: "standalone"` removes browser chrome — correct
- Set `background_color: "#060d1f"` to match the app's dark bg (prevents white flash on startup)
- iOS requires `apple-touch-icon` in `<head>` — not just manifest icons. Add `<link rel="apple-touch-icon" href="/icon-192.png">` to index.html.

---

#### MOBILE-FIRST CONCERNS

- The forecast strip uses horizontal scroll with snap — correct for mobile, but test that the webcam image doesn't overflow on narrow screens (min-width: 320px)
- "Add to Home Screen" nudge banner: show only on iOS Safari (detect via `navigator.userAgent`), dismiss via `localStorage`. Don't show if already installed (`window.matchMedia('(display-mode: standalone)').matches`)
- Wind arrow in SideCard: at 20x20px it's almost invisible on retina displays. Consider 28x28px.

---

#### DESIGN VERDICT

Changes 1, 4, 5, 6 are clean. Change 2 (webcam) needs repositioning — it belongs closer to the score cards, not at the bottom. Change 3 (feedback) needs time-gating logic to avoid showing in the morning.

---

### Phase 3 — Engineering Review

**Reviewer:** Claude (autoplan pipeline)
**Date:** 2026-04-22

---

#### ARCHITECTURE & DATA FLOWS

**Change 1: Water temp**

```
/api/conditions
    ├── buoy.js (wind, gusts, wind history)
    ├── tides.js (current level, rate, hilos)
    │     └── [NEW] parallel fetch: water_temperature product
    ├── weather.js (NWS hourly)
    └── marine.js (wave height/dir/period)
          └── [NEW] add water_temperature to vars list

server.js merge:
    waterTempF = noaaWaterTemp ?? openMeteoSST ?? null
```

Latency risk: NOAA CO-OPS `product=water_temperature` can be slow (1-3s). Since `tides.js` already does parallel fetches inside `Promise.allSettled`, the new water_temperature fetch should run in parallel with the existing tides fetch, not sequentially. Otherwise you add 1-3s to every response.

```javascript
// In tides.js — run in parallel
const [waterLevel, hourly, hilos, waterTemp] = await Promise.all([
  fetchWaterLevel(),
  fetchHourlyPredictions(),
  fetchHiLo(),
  fetchWaterTemperature(),
]);
```

Fallback chain: if NOAA waterTemp is null/stale (>2 hours old), use Open-Meteo SST. If both null, show "—".

**Change 2: Webcam**

If hotlink protection is an issue, the backend proxy is:

```javascript
// server.js new route
app.get('/api/webcam', async (req, res) => {
  const img = await fetch('https://www.alkiweather.com/wxalkiwebcam.php', {
    headers: { Referer: 'https://www.alkiweather.com/' }
  });
  res.set('Content-Type', img.headers.get('Content-Type'));
  res.set('Cache-Control', 'public, max-age=30');
  img.body.pipe(res);
});
```

The 10-minute cache in server.js should NOT apply to this route — images need 30s freshness.

**Change 3: Feedback (revised to localStorage-only)**

```javascript
// client/src/components/FeedbackPrompt.jsx
const today = new Date().toISOString().split('T')[0];
const hour = new Date().getHours();
const alreadyFiled = localStorage.getItem('feedback-date') === today;
const inWindow = hour >= 12 && hour < 20; // 12pm-8pm only

if (alreadyFiled || !inWindow) return null;
```

On submit: `localStorage.setItem('feedback-date', today)`. No backend needed. If you later want backend: add the `/api/feedback` route with Railway persistent volume or Supabase.

**Change 4: Deploy + .gitignore**

`.gitignore` must be:
```
node_modules/
client/dist/
.env
*.log
```

For node_modules history cleanup (optional but recommended):
```bash
git filter-repo --path node_modules --invert-paths
# Then force push (safe for personal single-dev repo)
git push origin main --force
```

**Change 5: PWA + Service Worker**

Service worker cache strategy:

```javascript
// client/public/sw.js
const CACHE = 'alkisurf-v1';
const API_CACHE = 'alkisurf-api-v1';

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/api/conditions') {
    // Network-first with cache fallback
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(API_CACHE).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for static assets
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});
```

The "Last updated X min ago" offline indicator is already in App.jsx via `timeAgo(data.updatedAt)`. If the SW serves a cached response, `updatedAt` will be the timestamp of the last successful fetch — so this works automatically.

**Change 6: Wind arrow fix**

```javascript
// SideCard.jsx — replace WindArrow with:
function WindArrow({ deg }) {
  return (
    <span className="flex items-center gap-1">
      <svg
        width="18" height="18" viewBox="0 0 20 20"
        style={{ transform: `rotate(${deg}deg)`, flexShrink: 0 }}
      >
        <line x1="10" y1="16" x2="10" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="6,8 10,4 14,8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontSize: 10, color: '#5a7fa0' }}>
        {compassLabel(deg)}
      </span>
    </span>
  );
}
```

Import `compassLabel` from `../../model/fetchGeometry.js` (already exists, already exported). The NDBC convention: `windDirDeg` is "wind FROM" direction. Arrow pointing UP = north. Rotating by `windDirDeg` = arrow points toward source. That's correct for a "from" indicator. No convention change needed — the existing `rotate(${deg}deg)` is right. Just add the text label.

---

#### FAILURE MODES

| Failure | Symptom | Mitigation |
|---------|---------|-----------|
| NOAA waterTemp timeout | Extra 3s latency on `/api/conditions` | Parallel fetch with 5s timeout, default null |
| alkiweather.com camera 403 | Broken image in WebcamPanel | `onError` → "Camera unavailable" + link-out |
| SW not registered (first visit) | No offline fallback | Expected — SW registers on second visit per spec |
| Railway cold start | 1-2s delay on first request | healthcheckPath already set — Railway warms before routing traffic |
| Open-Meteo Marine API down | No wave forecast | `Promise.allSettled` already handles this — shows "—" |
| node_modules in git | Slow Railway clone | Fix with .gitignore + filter-repo (or live with it) |

---

#### IMPLEMENTATION ORDER (revised)

1. **Deploy + .gitignore** (Change 4) — no code changes, just housekeeping + deploy
2. **Water temp** (Change 1) — parallel fetch in tides.js, merge in server.js, surface in ConditionsBar
3. **Wind arrow fix** (Change 6) — 15 min, import compassLabel, add text label
4. **Webcam + proxy** (Change 2 + EXP-C) — backend proxy route, WebcamPanel component. Move panel up (below score cards, not below Best Windows).
5. **PWA** (Change 5) — manifest, SW, apple-touch-icon, install nudge banner
6. **Feedback prompt** (Change 3, revised) — localStorage-only, afternoon time gate

---

#### ENGINEERING VERDICT

Plan is sound. Two changes to the plan:
- Change 3 feedback: use localStorage-only (no JSONL file, Railway filesystem is ephemeral)
- Change 2 webcam: add backend proxy route alongside the frontend component

Estimated CC time for all 6 changes: ~45 minutes of CC execution.

---

### Autoplan Summary

| Review | Verdict | Key Finding |
|--------|---------|------------|
| CEO | DONE_WITH_CONCERNS | Feedback JSONL breaks on Railway (ephemeral FS). Webcam hotlink risk. |
| Design | DONE | Webcam should move higher in layout. Feedback prompt needs time-gating. |
| Eng | DONE | Parallel NOAA water_temp fetch. Backend webcam proxy. SW cache strategy detailed. |

**Ready to implement.** Run Changes 1-6 in the order above. Start with deploy.
