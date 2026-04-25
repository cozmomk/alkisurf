import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { skyFromData } from '../components/ConditionsSprite.jsx';

// skyFromData calls isNightNow() which checks real system time.
// We freeze time to a known daytime PT hour (2pm = 14:00 PT).
const DAY_TIME = new Date('2025-07-15T21:00:00Z'); // 14:00 PT
const NIGHT_TIME = new Date('2025-07-16T06:30:00Z'); // 23:30 PT

describe('skyFromData (daytime)', () => {
  beforeEach(() => {
    // Override Date.now and new Date() to return 2pm PT
    vi.useFakeTimers();
    vi.setSystemTime(DAY_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns sunny for clear skies', () => {
    expect(skyFromData(5, 10, null, null)).toBe('sunny');
  });
  it('returns partly for moderate cloud cover', () => {
    expect(skyFromData(5, 25, null, null)).toBe('partly');
  });
  it('returns overcast for heavy cloud cover', () => {
    expect(skyFromData(5, 60, null, null)).toBe('overcast');
  });
  it('returns storm for thunder in forecast text', () => {
    expect(skyFromData(5, 20, 'Thunderstorms likely', null)).toBe('storm');
  });
  it('returns rain when forecast text includes rain', () => {
    expect(skyFromData(5, 20, 'Chance of rain showers', null)).toBe('rain');
  });
  it('returns rain when forecast text includes drizzle', () => {
    expect(skyFromData(5, 50, 'Light drizzle', null)).toBe('rain');
  });
  it('returns rain when precipProbability > 50', () => {
    expect(skyFromData(5, 30, null, 60)).toBe('rain');
  });
  it('does NOT return rain when precipProbability <= 50', () => {
    expect(skyFromData(5, 30, null, 50)).toBe('partly');
    expect(skyFromData(5, 30, null, 0)).toBe('partly');
  });
  it('returns sunny when skyCover is null and not raining', () => {
    expect(skyFromData(5, null, null, null)).toBe('sunny');
  });
  it('returns rain when skyCover is null but precipProbability > 50', () => {
    expect(skyFromData(5, null, null, 75)).toBe('rain');
  });
  it('storm takes priority over rain conditions', () => {
    expect(skyFromData(5, 80, 'Thunderstorms with heavy rain', 90)).toBe('storm');
  });
  it('wind speed has no effect on sky state', () => {
    expect(skyFromData(20, 5, null, null)).toBe('sunny');
    expect(skyFromData(30, 5, null, null)).toBe('sunny');
  });
});

describe('skyFromData (nighttime)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NIGHT_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns night regardless of conditions', () => {
    expect(skyFromData(5, 0, null, null)).toBe('night');
    expect(skyFromData(5, 90, 'Thunderstorms', 90)).toBe('night');
  });
});
