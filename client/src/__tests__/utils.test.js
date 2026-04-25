import { describe, it, expect } from 'vitest';
import { scoreColor, compassLabel, skyEmoji, uvColor, uvLabel } from '../utils.js';

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
    expect(compassLabel(315)).toBe('NW');
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
  it('returns orange for high UV (7-8)', () => {
    expect(uvColor(8)).toBe('#fb923c');
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
  const DAY_TS = new Date('2025-07-15T19:00:00Z').getTime(); // noon PT
  const NIGHT_TS = new Date('2025-07-16T06:00:00Z').getTime(); // 11pm PT

  it('returns null for null skyCover', () => {
    expect(skyEmoji(null, DAY_TS)).toBeNull();
  });
  it('returns sun for clear daytime sky', () => {
    expect(skyEmoji(10, DAY_TS)).toBe('☀️');
  });
  it('returns moon at night regardless of cloud cover', () => {
    expect(skyEmoji(10, NIGHT_TS)).toBe('🌙');
    expect(skyEmoji(30, NIGHT_TS)).toBe('🌙');
  });
  it('returns partly cloudy for moderate coverage', () => {
    expect(skyEmoji(50, DAY_TS)).toBe('⛅');
  });
  it('returns cloudy for heavy coverage', () => {
    expect(skyEmoji(90, DAY_TS)).toBe('☁️');
  });
});
