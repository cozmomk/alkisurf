export function skyEmoji(skyCover, ts) {
  const night = ts != null && (() => {
    const h = parseInt(new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false })) % 24;
    return h >= 20 || h < 6;
  })();
  if (skyCover == null) return null;
  if (skyCover <= 15) return night ? '🌙' : '☀️';
  if (skyCover <= 35) return night ? '🌙' : '🌤';
  if (skyCover <= 60) return night ? '🌤' : '⛅';
  if (skyCover <= 80) return '🌥';
  return '☁️';
}

export function uvColor(uv) {
  if (uv == null) return '#3a5a70';
  if (uv <= 2) return '#4ade80';
  if (uv <= 4) return '#a3e635';
  if (uv <= 6) return '#facc15';
  if (uv <= 8) return '#fb923c';
  if (uv <= 10) return '#f87171';
  return '#c084fc';
}

export function uvLabel(uv) {
  if (uv == null) return null;
  if (uv <= 2) return 'Low';
  if (uv <= 4) return 'Mod';
  if (uv <= 6) return 'High';
  if (uv <= 8) return 'V.High';
  return 'Extreme';
}

export function scoreColor(score) {
  if (score >= 9) return '#00e887';
  if (score >= 7) return '#7dff4f';
  if (score >= 5) return '#ffc300';
  if (score >= 3) return '#ff6b1a';
  return '#ff2b55';
}

export function computeTrend(side, currentScore, forecast) {
  const now = Date.now();
  const nextHours = (forecast || [])
    .filter(h => h.time > now && h.time <= now + 3 * 3600 * 1000)
    .slice(0, 3);
  if (!nextHours.length) return null;
  const avg = nextHours.reduce((s, h) => s + (h.sides?.[side]?.score ?? currentScore), 0) / nextHours.length;
  const delta = avg - currentScore;
  if (delta > 1.2) return 'up';
  if (delta < -1.2) return 'down';
  return 'steady';
}

export function compassLabel(deg) {
  if (deg == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}
