# AlkiSurf

Real-time surf and paddling conditions for Alki Beach, West Seattle. Pulls live data from NDBC buoys, NOAA tides, NWS forecasts, and Open-Meteo to compute a 0–10 glass score — updated every 10 minutes, no login required.

---

## Score System

Every score represents how smooth the water is for surfing or paddling on a 0–10 scale:

| Score | Label | Conditions |
|-------|-------|------------|
| 9–10 | **Glass** | Flat water, perfect for prone or SUP |
| 7–8 | **Ripple** | Small texture, still very paddleable |
| 5–6 | **Chop** | Moderate chop, doable but tiring |
| 3–4 | **Rough** | Significant chop, challenging |
| 0–2 | **No go** | Unsuitable for most paddling |

The score multiplies two factors: **wind** (current speed and direction relative to each side) and **waves** (chop buildup model accounting for fetch distance and how long the wind has been blowing). Both sides of the beach — North and South — are scored independently because they're sheltered from different wind directions.

**North side** is protected from southerly winds; **South side** is protected from northerly winds. On a blustery NW day the south end can be glass while the north is choppy.

---

## Features

### Live Conditions Dashboard

- **Glass Score** — live score for North and South sides of Alki, updated every 10 minutes
- **Trend indicator** — ↑ Improving / → Holding / ↓ Worsening based on the next 3 hours of forecast
- **Smart Banner** — prominent alert when current conditions are glass or ripple
- **Wind** — speed (kt), direction (compass), and gust (from NDBC buoy 46087)
- **Water temperature** — from NDBC buoy
- **Air temperature** — from nearest NWS grid point
- **Sky conditions** — cloud cover with appropriate weather emoji (fog, rain, snow, thunder)
- **UV index** — color-coded Low → Extreme from Open-Meteo
- **Score explainer** — tap "▾ why?" on any side card to see the live wind/wave breakdown

### 48-Hour Forecast Strip

Hourly forecast cells showing:
- North and South scores with delta vs model baseline
- Wind speed and direction
- Sky condition emoji
- UV index
- Cloud cover %
- Precipitation probability

### 3-Day Outlook

Day-by-day summary cards for today, tomorrow, and the day after:
- High/low air temperature
- Wind range and peak gust
- Peak UV
- Precipitation probability
- Sunrise and sunset times
- Best glass window per side (the contiguous hours most likely to be ripple or better)

### Glass Calendar (Historical View)

Monthly calendar of every day's conditions since the app started logging, color-coded by best score. Tap any day to see a detailed hourly chart.

**Filters** — narrow the calendar to the conditions you care about:

| Filter | What it does |
|--------|-------------|
| **All day** | Shows the full 24-hour best score |
| **Daylight** | Restricts to hours between sunrise and sunset (computed per date) |
| **Dawn / Morning / Afternoon / Evening** | Fixed time windows |
| **60°F+** | Only counts hours where air temp was at or above 60°F |

When a filter is active, the calendar recalculates best score, average, glass hours, and the best window from only the hours that pass the filter. Days where no hours pass are shown with a dashed border.

**Day detail panel** — tap any calendar cell to expand:
- Best / Avg / Glass hours / Best window stats
- Hourly score chart with cubic bezier smoothing
- Separate North (blue) and South (amber) score lines when available
- Glass window shading (green band for hours ≥ 7)
- Filter scope indicator ("12 of 18 hrs match filters")

### Water Quality Warning (CSO)

A banner appears automatically when King County reports a Combined Sewer Overflow (CSO) event near Alki Beach — raw sewage discharge into the Sound from the combined stormwater/sewer system during heavy rain.

- **Red banner** — overflow is currently active. Avoid all water contact.
- **Orange banner** — overflow ended within the last 48 hours. Bacteria may still be elevated.
- Shows outfall name and distance from the beach
- Links to King County's official CSO status page
- Polls every 10 minutes; dismiss with × if you've seen it

### Webcam

Live snapshot from the Alki weather station camera, updated every 5 minutes.

### Community Reports

Tap the report button to submit a real-world conditions rating (Glass / Ripple / Chop / Rough / No go). Reports are logged and compared against the model score to track forecast accuracy over time.

### Score Accuracy Insights

Shows how well the model score matches submitted community reports — mean absolute error, score distribution breakdown, and total report count. Accessible via the insights panel.

### All-Time Records

Tracked automatically in the background:
- Highest and lowest score ever recorded
- Highest wind speed (with direction)
- Highest and lowest water temperature

### Install as App (PWA)

The site is a Progressive Web App. On iOS, tap Share → Add to Home Screen. On Android, tap the browser menu → Install App. Once installed, it behaves like a native app with a custom icon and no browser chrome.

---

## Data Sources

| Source | What it provides |
|--------|-----------------|
| [NDBC Buoy 46087](https://www.ndbc.noaa.gov/station_page.php?station=46087) | Wind speed, direction, gusts, water temperature |
| [NOAA CO-OPS Tides](https://tidesandcurrents.noaa.gov/) | Tide predictions |
| [NWS Forecast API](https://www.weather.gov/documentation/services-web-api) | Hourly air temp, sky cover, precipitation probability |
| [Open-Meteo](https://open-meteo.com/) | UV index, marine wave height/period/direction |
| [King County CSO](https://kingcounty.gov/en/dept/dnrp/waste-services/wastewater-treatment/sewer-system-services/cso-status) | Sewage overflow alerts |

---

## Running Locally

**Requirements:** Node.js 18+

```bash
git clone https://github.com/cozmomk/alkisurf.git
cd alkisurf

# Install server dependencies
npm install

# Install client dependencies and build
cd client && npm install && npm run build && cd ..

# Start the server (serves both API and built client)
npm start
```

Open `http://localhost:3001`.

**Development mode** (Vite HMR + nodemon):

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend (Vite dev server)
cd client && npm run dev
```

Frontend runs at `http://localhost:5173`, proxying API calls to `:3001`.

---

## Deployment

Deployed on [Railway](https://railway.app) using Nixpacks (no Dockerfile needed). The `railway.toml` and `nixpacks.toml` in the repo root are the complete deployment config.

Persistent data (conditions log, daily summaries, community reports, all-time records) is written to a Railway volume mounted at `/data`.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full version history.
