# alkisurf — Claude instructions

## When shipping features

Before committing any new feature or fix that a user would notice:

1. **Update README.md** — add the feature to the relevant Features section (or create a new section if needed). Keep the table style and heading structure consistent.
2. **Update CHANGELOG.md** — add an entry under `## [Unreleased]` or bump the version following semver. Use the existing format: `### Added / Fixed / Changed` with one-line bullets.

The README describes what the app does for end users. If a new feature isn't in the README, it doesn't exist to anyone who finds the repo.

## Deploy procedure

```bash
# Kill any existing server on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Build client
cd client && npm run build && cd ..

# Start server (Railway uses npm start)
npm start
```

Note: `pkill node` silently fails if no node process exists — use `lsof -ti:PORT | xargs kill -9` instead.

## Access

- Local dev: http://localhost:3001 (server) / http://localhost:5173 (Vite HMR)
- Production: Railway deployment (see railway.toml)

## Architecture notes

- Single Express server (`server.js`) serves both API and built React client
- All external data fetched server-side; client gets clean JSON
- `h` field in daily summary hours[] is Pacific local time (not UTC) — must stay in sync with `sunriseSunset()` in `client/src/utils.js` which also uses Pacific time
- Data persists to Railway volume at `/data` (conditions log, daily summaries, reports, records)
