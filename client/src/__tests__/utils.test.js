import { describe, it, expect } from 'vitest';
import { scoreColor, compassLabel, skyEmoji, uvColor, uvLabel, computeTrend } from '../utils.js';

describe('scoreColor', () => {
  it('returns green for glass conditions (9-10)', () => {
    expect(scoreColor(10)).toBe('#00e887');
    expect(scoreColor(9)).toBe('#00e887');
  });
  it('returns yellow-green for good conditions (7-8)', () => {
    expect(scoreColor(7)).toBe('#7dff4f');
    expect(scoreColor(8)).toBe('#7dff4f');
  });
  it('returns yellow for marginal conditions (5-6)', () => {
    expect(scoreColor(5)).toBe('#ffc300');
    expect(scoreColor(6)).toBe('#ffc300');
  });
  it('returns orange for rough conditions (3-4)', () => {
    expect(scoreColor(3)).toBe('#ff6b1a');
    expect(scoreColor(4)).toBe('#ff6b1a');
  });
  it('returns red for no-go conditions (0-2)', () => {
    expect(scoreColor(0)).toBe('#ff2b55');
    expect(scoreColor(2)).toBe('#ff2b55');
  });
});

describe('compassLabel', () => {
  it('converts cardinal degrees to labels', () => {
    expect(compassLabel(0)).toBe('N');
    expect(compassLabel(90)).toBe('E');
    expect(compassLabel(180)).toBe('S');
    expect(compassLabel(270)).toBe('W');
  });
  it('handles intercardinal directions', () => {
    expect(compassLabel(45)).toBe('NE');
    expect(compassLabel(135)).toBe('SE');
    expect(compassLabel(225)).toBe('SW');
    expect(compassLabel(315)).toBe('NW');
  });
  it('handles fine-grained compass points', () => {
    expect(compassLabel(22)).toBe('NNE');
    expect(compassLabel(68)).toBe('ENE');
    expect(compassLabel(113)).toBe('ESE');
    expect(compassLabel(158)).toBe('SSE');
    expect(compassLabel(203)).toBe('SSW');
    expect(compassLabel(248)).toBe('WSW');
    expect(compassLabel(293)).toBe('WNW');
    expect(compassLabel(338)).toBe('NNW');
  });
  it('handles wrap-around (360 = N)', () => {
    expect(compassLabel(360)).toBe('N');
    expect(compassLabel(359)).toBe('N');
  });
  it('returns — for null', () => {
    expect(compassLabel(null)).toBe('—');
  });
});

describe('uvColor', () => {
  it('returns green for low UV (0-2)', () => {
    expect(uvColor(0)).toBe('#4ade80');
    expect(uvColor(2)).toBe('#4ade80');
  });
  it('returns yellow-green for moderate UV (3-4)', () => {
    expect(uvColor(3)).toBe('#a3e635');
    expect(uvColor(4)).toBe('#a3e635');
  });
  it('returns yellow for high UV (5-6)', () => {
    expect(uvColor(5)).toBe('#facc15');
    expect(uvColor(6)).toBe('#facc15');
  });
  it('returns orange for very high UV (7-8)', () => {
    expect(uvColor(7)).toBe('#fb923c');
    expect(uvColor(8)).toBe('#fb923c');
  });
  it('returns red for severe UV (9-10)', () => {
    expect(uvColor(9)).toBe('#f87171');
    expect(uvColor(10)).toBe('#f87171');
  });
  it('returns purple for extreme UV (11+)', () => {
    expect(uvColor(11)).toBe('#c084fc');
  });
  it('returns default color for null', () => {
    expect(uvColor(null)).toBe('#3a5a70');
  });
});

describe('uvLabel', () => {
  it('labels UV ranges correctly', () => {
    expect(uvLabel(1)).toBe('Low');
    expect(uvLabel(3)).toBe('Mod');
    expect(uvLabel(5)).toBe('High');
    expect(uvLabel(7)).toBe('V.High');
    expect(uvLabel(11)).toBe('Extreme');
  });
  it('returns null for null input', () => {
    expect(uvLabel(null)).toBeNull();
  });
});

describe('skyEmoji', () => {
  const DAY_TS = new Date('2025-07-15T19:00:00Z').getTime(); // noon PT (12:00)
  const NIGHT_TS = new Date('2025-07-16T06:00:00Z').getTime(); // 11pm PT (23:00)

  it('returns null for null skyCover', () => {
    expect(skyEmoji(null, DAY_TS)).toBeNull();
  });
  it('returns sun for clear daytime sky (≤15%)', () => {
    expect(skyEmoji(0, DAY_TS)).toBe('☀️');
    expect(skyEmoji(15, DAY_TS)).toBe('☀️');
  });
  it('returns mostly sunny for slightly cloudy day (16-35%)', () => {
    expect(skyEmoji(20, DAY_TS)).toBe('🌤');
    expect(skyEmoji(35, DAY_TS)).toBe('🌤');
  });
  it('returns partly cloudy for moderate coverage (36-60%)', () => {
    expect(skyEmoji(50, DAY_TS)).toBe('⛅');
  });
  it('returns mostly cloudy for heavy coverage (61-80%)', () => {
    expect(skyEmoji(70, DAY_TS)).toBe('🌥');
  });
  it('returns overcast for full cloud cover (81%+)', () => {
    expect(skyEmoji(90, DAY_TS)).toBe('☁️');
    expect(skyEmoji(100, DAY_TS)).toBe('☁️');
  });
  it('returns moon at night for clear sky', () => {
    expect(skyEmoji(10, NIGHT_TS)).toBe('🌙');
  });
  it('returns moon at night for partly cloudy', () => {
    expect(skyEmoji(30, NIGHT_TS)).toBe('🌙');
  });
  it('returns partly cloudy moon for moderate night clouds (36-60%)', () => {
    expect(skyEmoji(50, NIGHT_TS)).toBe('🌤');
  });
});

describe('computeTrend', () => {
  const now = Date.now();
  const h1 = now + 1 * 3600 * 1000;
  const h2 = now + 2 * 3600 * 1000;
  const h3 = now + 3 * 3600 * 1000;
  const h4 = now + 4 * 3600 * 1000; // outside 3h window

  it('returns null for null forecast', () => {
    expect(computeTrend('north', 5, null)).toBeNull();
  });
  it('returns null for empty forecast', () => {
    expect(computeTrend('north', 5, [])).toBeNull();
  });
  it('returns null when no hours are in the next 3h window', () => {
    const stale = [{ time: now - 1000, sides: { north: { score: 8 } } }];
    expect(computeTrend('north', 5, stale)).toBeNull();
  });
  it('returns null when next hours are beyond 3h window', () => {
    const far = [{ time: h4, sides: { north: { score: 8 } } }];
    expect(computeTrend('north', 5, far)).toBeNull();
  });
  it('returns up when avg score is >1.2 above current', () => {
    const forecast = [
      { time: h1, sides: { north: { score: 8 } } },
      { time: h2, sides: { north: { score: 9 } } },
    ];
    expect(computeTrend('north', 5, forecast)).toBe('up');
  });
  it('returns down when avg score is >1.2 below current', () => {
    const forecast = [
      { time: h1, sides: { north: { score: 2 } } },
      { time: h2, sides: { north: { score: 1 } } },
    ];
    expect(computeTrend('north', 5, forecast)).toBe('down');
  });
  it('returns steady when delta is within ±1.2', () => {
    const forecast = [
      { time: h1, sides: { north: { score: 5 } } },
      { time: h2, sides: { north: { score: 6 } } },
    ];
    expect(computeTrend('north', 5, forecast)).toBe('steady');
  });
  it('uses currentScore when side data is missing from a forecast hour', () => {
    const forecast = [
      { time: h1, sides: {} }, // missing north
      { time: h2, sides: { north: { score: 9 } } },
    ];
    // avg = (5 + 9) / 2 = 7, delta = 7 - 5 = 2 > 1.2
    expect(computeTrend('north', 5, forecast)).toBe('up');
  });
  it('limits to next 3 hours only', () => {
    const forecast = [
      { time: h1, sides: { north: { score: 9 } } },
      { time: h2, sides: { north: { score: 9 } } },
      { time: h3, sides: { north: { score: 9 } } },
      { time: h4, sides: { north: { score: 0 } } }, // should be ignored
    ];
    expect(computeTrend('north', 5, forecast)).toBe('up');
  });
  it('works for south side', () => {
    const forecast = [{ time: h1, sides: { south: { score: 1 } } }];
    expect(computeTrend('south', 5, forecast)).toBe('down');
  });
});
