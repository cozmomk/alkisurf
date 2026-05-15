# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] → 1.3.0

### Added
- **Google Analytics 4** — GA4 tracking via `VITE_GA_ID` Railway env var; fires `page_view` (with north/south/best scores) on first load, `conditions_loaded` on each refresh, `report_opened` and `report_submitted` (with rating + side) on user reports; no-ops gracefully when GA is blocked or the env var is absent
- **Rain animation intensity** — ConditionsSprite rain/storm drop count, opacity, and streak length now scale with live `precipInPerHr` data; light drizzle shows ~20 sparse faint streaks, heavy rain shows up to 110 dense bright streaks (0.25 in/hr = max scale for PNW)
- **CSO water quality warning** — real-time banner when King County reports a Combined Sewer Overflow near Alki Beach; red for active overflow, orange for overflow within last 48 hours; shows outfall name and distance; polls every 10 minutes; links to King County's official status page
- **DayMiniChart** — hourly score chart in the calendar detail panel replacing static stat cards; cubic bezier smooth lines, separate North (blue) and South (amber) lines when available, glass window shading (green bands for score ≥ 7), 2-hour tick grid, glass window legend
- **Daylight filter** — replaces the previous "Sunny Only (UV ≥ 1)" toggle; sunrise/sunset computed per date using NOAA solar position algorithm, accurate to ~10 minutes; uses PDT/PST automatically
- **Filter scope indicator** — detail panel shows "12 of 18 hrs match filters" and a fallback notice when no hours pass the active filters
- **Historical air temp backfill** — on server startup, any daily summary missing `airTempF` or `uv` data is patched from the Open-Meteo ERA5 reanalysis archive (free, ~2-day lag)

### Fixed
- **Rainy days missing from calendar** — Open-Meteo returns UV=0 (not null) on fully overcast/rainy days; the UV≥1 daylight filter produced an empty set and the day was silently skipped; now falls back to Pacific hour 6 AM–9 PM as daylight proxy when all UV values are 0
- **Daily summary midnight scheduler timezone bug** — scheduler fired at UTC midnight (= 5 PM Pacific), at which point the Pacific date hadn't rolled over, so the "skip today" guard skipped yesterday's summary every night; now fires at 09:00 UTC (= 2 AM PDT / 1 AM PST), always past Pacific midnight
- **Daylight filter timezone mismatch** — daily summary was storing hour field (`h`) as UTC (Railway container clock) while the client daylight filter compared against Pacific local sunrise/sunset; all three server callsites now use `toLocaleString('America/Los_Angeles')` to match `sunriseSunset()` in utils.js
- **Daily summary date grouping** — date bucketing used UTC midnight, causing late-Pacific-evening hours to land on the wrong calendar day; now uses explicit Pacific timezone throughout
- **Partial daily summary recovery** — server restart mid-day would write an incomplete summary (only UTC hours 0–N logged so far) and permanently lock out a rebuild; startup now detects entries with < 6 hours logged, drops them, and rebuilds on next cycle; a "skip today" guard prevents today's in-progress summary from being written prematurely
- **Forecast dots off lines** — the NOW-marker dots on the 48h forecast chart used the next forecast hour's score at the exact current-time X position; the bezier curve there is interpolated between two data points, so the dots floated above or below the line; dots now use linearly interpolated scores at exact now-time so they land on the line
- **60°F+ filter includes hours with missing temperature** — null `airTempF` was treated as passing the ≥60°F check, so overnight glass hours with no recorded temperature were included while daytime hours with actual sub-60°F readings were excluded; null-temp hours are now excluded when the temperature filter is active
- **Chart tick grid** — hour labels now generated at fixed 2-hour intervals across the full time range, not pinned to data point positions (which caused uneven spacing)
- **Null UV/airTemp treated as zero** — calendar Daylight filter now treats missing UV data as unknown rather than 0, preventing days with no UV data from being incorrectly excluded
- **Rain icons at low probability** — `conditionsEmoji` now uses NWS text qualifiers to gate rain/shower/drizzle icons: "Slight Chance" (10–20%) and "Chance" (30–50%) fall back to the cloud-cover emoji; only definitive text ("Rain", "Showers") or "Likely" (60–70%) earns 🌧️; mirrors the qualifier-aware logic already applied to thunder icons

### Changed
- **Design system pass** — CSOWarning banner colors derived from score color tokens (#ff2b55 active, #ff6b1a recent) rather than hardcoded values; dismiss button meets 44px touch target; advisory text updated to match King County guidance
- **Accessibility** — DayMiniChart SVG gets `role="img"` and `aria-label`; GlassCalendar close button gets `aria-label`; 60°F+ filter chip removes emoji decoration (DESIGN.md prohibits emoji as decoration)
- **CSO fetch reliability** — `AbortSignal.timeout(12000)` added to prevent indefinite hang if King County server is slow
- **3-Day Outlook sunrise/sunset** — decorative 🌅🌇 emoji replaced with compact "SR"/"SS" text labels per design system (no emoji as decoration)
- **Forecast vs. actual visibility** — when the live buoy-based score differs from the NWS forecast score by ≥1 point, an outlined ring at the live score position appears to the left of the NOW line on the 48h chart, making the forecast/actual gap visible

---

## [1.2.1] - 2026-05-05

### Changed
- **Horizontal month-grid calendar** — calendar cells now laid out in a proper Mon–Sun weekly grid with month name banners between months; replaces the previous vertical list layout

---

## [1.2.0] - 2026-05-09

### Added
- **Compact Glass Calendar** — replaced 44px score-number cells with 24px pure color-coded squares; multi-month view with month banners, oldest-to-newest order
- **Client-side calendar filters** — time window presets (All day / Dawn / Morning / Afternoon / Evening), Sunny only (UV ≥ 1), and 60°F+ air temp toggle; filtered-out days show dashed border
- **Per-hour data in daily summary** — `hours[]` array logged per day `{h, score, uv, airTempF, waterTempF}` enabling client-side filter recomputation without refetching raw data
- **Air temp logging** — `airTempF` captured from nearest NWS forecast hour in hourly conditions snapshot
- **Best window in detail panel** — best contiguous hour range (glass/ripple preferred) shown when detail is open; falls back to entire glass window when no long consecutive run exists
- **Detail panel close button** — × button to dismiss selected day

### Fixed
- **North side westerly fetch severely underestimated** — W/WNW/NW/NNW fetch distances corrected (W: 2000m→5500m, NW: 4200m→6500m) based on actual Alki Beach geometry facing Bainbridge Island
- **Daily summary rebuilt on startup** — if existing summary rows are missing the `hours[]` field (pre-1.2.0 rows), the server rebuilds them automatically from the conditions log on next start

### Changed
- **AVG score in detail panel** — displayed in neutral `#8aacbf` instead of the score color; the average is rarely "glass" so coloring it green was misleading

---

## [1.1.0] - 2026-04-24

### Added
- **3-Day Outlook** — WeatherDays component showing high/low temp, wind range, UV peak, precip chance, and best glass windows per day (North and South shown separately)
- **Expanded 48-hour forecast cells** — each hourly cell now shows sky emoji, N/S scores with delta vs predicted, wind speed+direction, UV index (color-coded dot), cloud cover %, and precip probability
- **Air temperature in forecast cells** — sourced from nearest NWS grid point
- **SideCard trend indicator** — ↑ Improving / → Holding / ↓ Worsening with timing ("Improving in 2h") based on avg score across the next 3 forecast hours; sky emoji and air temp shown in header
- **UV index** — sourced from Open-Meteo land forecast API; shown per forecast hour and in SideCard current conditions; color-coded Low → Extreme
- **Precipitation probability** — sourced from NWS `probabilityOfPrecipitation`; shown in forecast cells and drives rain/storm sky state in the sprite
- **Vitest test framework** — 58 tests covering score colors, compass labels, UV helpers, sky emoji, computeTrend, skyFromData, and UV data parsing logic

### Fixed
- **Sprite lightning storm bug** — sprite showed lightning during high wind with clear skies; sky state now driven by NWS forecast text + precip probability, not wind speed
- **Best window label blank** — `makeWindow` now includes a `label` field so day card windows show the condition label (e.g. "GLASS")
- **Year-boundary 3-day sort** — `ptDayKey` now uses ISO `YYYY-MM-DD` so Dec 31 → Jan 1 sorts correctly
- **Stale forecast feeding ConditionsSprite** — sprite now uses current/next-future forecast hour, not `forecast[0]` which can be 12h stale
- **Midnight sky emoji** — `parseInt("24") % 24` prevents midnight being classified as daytime on some V8 builds
- **Night heavy cloud emoji** — 61–80% cloud cover at night now returns `☁️` instead of daytime `🌥`
- **Empty UV reduce** — guarded `uvData.reduce` against empty array to avoid runtime error when UV fetch fails

---

## [1.0.0] - 2026-04-10

### Added
- **Glass score model** — 0–10 score combining wind factor and wave factor; separate North and South side scores based on each side's fetch geometry and wind exposure
- **Live conditions dashboard** — wind speed/direction/gust (NDBC buoy 46087), water temperature, air temperature, sky conditions
- **SmartBanner** — prominent alert when current conditions are glass or ripple
- **Score explainer** — live wind/wave factor breakdown accessible via "▾ why?" accordion on each SideCard
- **Wave state indicator** — shows whether chop is building, peak, or decaying based on time since wind onset/end
- **48-hour forecast strip** — hourly cells with N/S scores, wind, sky
- **Animated ConditionsSprite** — canvas paddler figure with weather overlay; wind streaks and whitecaps respond to live wind speed; clouds and rain respond to wind speed and direction; alternate paddler poses cycle every 45 seconds; snow sky condition
- **God Mode** — long-press easter egg giving Pocket God-style controls over the canvas weather simulation (wind, rain, waves, snow)
- **Pill-tap detail panels** — TIDE, WIND, AIR, UV chart drawers accessible by tapping the ConditionsBar pills
- **36-hour forecast score chart** — scrollable chart showing predicted glass score across the next day and a half
- **All-time records** — highest/lowest score, highest wind speed, highest/lowest water temperature; persisted to Railway volume and bootstrapped from the conditions log on first deploy
- **Glass History** → **Glass Calendar** — UV-filtered daily history grid; later replaced with compact color-coded calendar
- **Model calibration panel** — shows mean absolute error and score distribution breakdown comparing model output to community reports
- **Community reports** — tap to submit a real-world conditions rating; logged and compared against model score
- **Hourly conditions log** — all conditions snapshots written to `/data/conditions-log.jsonl` on Railway volume for historical analysis
- **Data retention** — log pruned to 90 days on startup
- **Webcam panel** — live snapshot from Alki weather station camera, cached 5 minutes server-side
- **Source badges** — shows which data sources (buoy, tides, NWS, Open-Meteo) are live vs failed
- **PWA** — installable as a home screen app; service worker for offline/cache support
- **Sun times** — sunrise and sunset from NOAA solar position algorithm, shown in 3-day outlook

### Fixed
- **Tide gauge wired to real NOAA data** — tide chart was previously using placeholder values
- **Score ring arc** — 10/10 score now draws a complete circle instead of stopping just short
- **Wind direction arrow** — arrow now points downwind (direction wind is blowing toward), not upwind
- **Moon at night** — clear sky at night now shows 🌙 instead of sunny emoji
- **Open-Meteo timestamps** — UTC suffix added to prevent local timezone ambiguity on Railway
- **Wave animation** — trochoidal shaping with independent harmonics for realistic wave motion
- **Realistic wave physics** — wind history fed to near-term forecast scores so fresh gusts score correctly

### Security
- Removed `/api/refresh` endpoint (no auth, could be abused to trigger costly upstream fetches)
- Redacted detailed error messages from 500 responses
- Webcam cache extended to 5 minutes to reduce proxy load

### Design
- **Barlow Condensed** — brand header and section titles switched from generic Inter to Barlow Condensed for nautical character
- **Section title hierarchy** — `.section-title` class establishes clear visual hierarchy between page sections and in-card labels
- **Touch targets** — all accordion triggers, source badge links, and the Report button expanded to 44px minimum
- **Keyboard accessibility** — `:focus-visible` rings added throughout for keyboard navigation
- **ConditionsBar pill labels** — bumped from 10px to 11px for legibility
- **Webcam links** — hover and active states added; timestamp label bumped to 11px
