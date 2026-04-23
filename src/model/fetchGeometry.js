// Fetch distances in meters for each Alki side at 16 compass points (every 22.5°)
// Based on actual Alki Point geography — north side faces Elliott Bay, south faces open Puget Sound

const FETCH_TABLE = {
  north: {
    0:     5500,  // N   — up Elliott Bay toward downtown
    22.5:  4500,  // NNE — across toward Harbor Island north
    45:    3500,  // NE  — across Elliott Bay
    67.5:  1800,  // ENE
    90:    900,   // E   — Harbor Island, very protected
    112.5: 700,   // ESE
    135:   600,   // SE  — protected by Alki beach arm
    157.5: 300,   // SSE — nearly blocked
    180:   200,   // S   — land blocks
    202.5: 200,   // SSW — land blocks
    225:   200,   // SW  — blocked by Alki peninsula
    247.5: 500,   // WSW — slight opening
    270:   2000,  // W   — partial opening to sound entrance
    292.5: 3200,  // WNW
    315:   4200,  // NW  — sound entrance
    337.5: 5000,  // NNW
  },
  south: {
    0:     500,   // N   — blocked by Alki land mass
    22.5:  800,   // NNE — mostly blocked
    45:    1500,  // NE  — partially blocked by West Seattle hills
    67.5:  1200,  // ENE
    90:    1200,  // E   — protected
    112.5: 3500,  // ESE — opening toward Rainier Beach
    135:   8000,  // SE  — Vashon Strait, significant fetch
    157.5: 12000, // SSE — down the sound
    180:   16000, // S   — long fetch toward Tacoma Narrows
    202.5: 14000, // SSW
    225:   13000, // SW  — THE dominant exposure, Vashon gap
    247.5: 10000, // WSW — across toward Southworth
    270:   7000,  // W   — across to Bainbridge
    292.5: 5500,  // WNW — partial Kitsap protection
    315:   4500,  // NW  — partial protection
    337.5: 2500,  // NNW — mostly blocked
  }
};

const DIRECTIONS = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];

export function getFetch(side, windDirDeg) {
  const dir = ((windDirDeg % 360) + 360) % 360;
  const table = FETCH_TABLE[side];
  const step = 22.5;

  const lowerIdx = Math.floor(dir / step);
  const lowerDir = DIRECTIONS[lowerIdx % 16];
  const upperDir = DIRECTIONS[(lowerIdx + 1) % 16];
  const frac = (dir - lowerDir) / step;

  const lowerFetch = table[lowerDir];
  const upperFetch = table[upperDir];
  return lowerFetch + (upperFetch - lowerFetch) * frac;
}

// Direction name from degrees
export function compassLabel(deg) {
  if (deg == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}
