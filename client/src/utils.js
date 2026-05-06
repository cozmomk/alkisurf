export function skyEmoji(skyCover, ts) {
  const night = ts != null && (() => {
    const h = parseInt(new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false })) % 24;
    return h >= 20 || h < 6;
  })();
  if (skyCover == null) return null;
  if (skyCover <= 15) return night ? '🌙' : '☀️';
  if (skyCover <= 35) return night ? '🌙' : '🌤';
  if (skyCover <= 60) return night ? '🌤' : '⛅';
  if (skyCover <= 80) return night ? '☁️' : '🌥';
  return '☁️';
}

// Like skyEmoji but fog/smoke/haze from NWS shortForecast text takes priority
export function conditionsEmoji(skyCover, shortForecast, ts) {
  if (shortForecast) {
    const lc = shortForecast.toLowerCase();
    if (lc.includes('fog') || lc.includes('mist'))  return '🌫️';
    if (lc.includes('smoke') || lc.includes('haze')) return '🌫️';
    if (lc.includes('snow') || lc.includes('blizzard')) return '❄️';
    if (lc.includes('thunder') || lc.includes('tstm')) return '⛈️';
    if (lc.includes('rain') || lc.includes('shower') || lc.includes('drizzle')) return '🌧️';
  }
  return skyEmoji(skyCover, ts);
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
  const scores = nextHours.map(h => h.sides?.[side]?.score ?? currentScore);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const delta = avg - currentScore;

  function hoursUntilThreshold(threshold) {
    const idx = scores.findIndex(s => threshold(s));
    if (idx < 0) return null;
    return Math.max(1, Math.round((nextHours[idx].time - now) / 3600000));
  }

  if (delta > 1.2) return { direction: 'up',     hoursUntil: hoursUntilThreshold(s => s > currentScore + 1.2) };
  if (delta < -1.2) return { direction: 'down',   hoursUntil: hoursUntilThreshold(s => s < currentScore - 1.2) };
  return { direction: 'steady', hoursUntil: null };
}

export function compassLabel(deg) {
  if (deg == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}
