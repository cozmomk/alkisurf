# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-24

### Added
- **3-Day Outlook** — new WeatherDays component showing high/low temp, wind range, UV peak, precip chance, and best glass windows per day (north + south side shown separately when both exist)
- **Expanded 48-hour forecast cells** — each hourly cell now shows sky emoji, N/S scores with delta vs predicted, wind speed+direction, UV index (color-coded dot), cloud cover %, and precip probability
- **SideCard trend indicator** — ↑ Improving / → Holding / ↓ Worsening based on avg score in the next 3 hours for each side; sky emoji and air temp shown in header
- **UV index** — sourced from Open-Meteo land forecast API, shown per forecast hour and in SideCard current conditions
- **Precipitation probability** — sourced from NWS `probabilityOfPrecipitation`, shown in forecast cells and used to drive rain/storm sky state
- **Vitest test framework** — 58 tests covering score colors, compass labels, UV helpers, sky emoji, computeTrend, skyFromData, and UV data parsing logic

### Fixed
- **Sprite lightning storm bug** — sprite previously showed lightning when it was just windy with clear skies; sky state now driven by NWS forecast text + precip probability, not wind speed
- **Best window label blank** — `makeWindow` now includes a `label` field (e.g., "GLASS", "LIGHT CHOP") so day card windows show condition labels
- **Year-boundary 3-day sort** — `ptDayKey` now uses ISO `YYYY-MM-DD` format so Dec 31 → Jan 1 sorts correctly
- **Stale forecast feeding ConditionsSprite** — sprite now uses the current/next-future forecast hour, not `forecast[0]` which can be 12h stale
- **Midnight sky emoji** — `parseInt("24") % 24` prevents midnight being classified as daytime on some V8 builds
- **Night cloud emoji** — heavy cloud cover (61–80%) at night now returns `☁️` instead of the daytime `🌥`
- **Empty UV reduce** — guarded `uvData.reduce` against empty array to avoid O(n×m) wasted work when UV fetch fails
