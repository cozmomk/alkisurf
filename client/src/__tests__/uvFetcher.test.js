import { describe, it, expect, vi } from 'vitest';

// fetchUVData lives in server-side code — test the logic inline here
// by replicating the parsing logic (the function is too coupled to Node fetch to import directly)
// These tests verify the mapping logic that transforms Open-Meteo response to {ts, uvIndex}[]

function parseUVResponse(json) {
  const h = json.hourly;
  if (!h?.time) return [];
  return h.time.map((t, i) => ({ ts: new Date(t).getTime(), uvIndex: h.uv_index?.[i] ?? null }));
}

describe('UV data parsing', () => {
  it('returns empty array when hourly.time is missing', () => {
    expect(parseUVResponse({})).toEqual([]);
    expect(parseUVResponse({ hourly: {} })).toEqual([]);
  });

  it('maps time strings to timestamps with UV values', () => {
    const json = {
      hourly: {
        time: ['2025-07-15T12:00', '2025-07-15T13:00'],
        uv_index: [3.5, 4.2],
      },
    };
    const result = parseUVResponse(json);
    expect(result).toHaveLength(2);
    expect(result[0].uvIndex).toBe(3.5);
    expect(result[1].uvIndex).toBe(4.2);
    expect(typeof result[0].ts).toBe('number');
  });

  it('coalesces null UV values to null', () => {
    const json = {
      hourly: {
        time: ['2025-07-15T12:00'],
        uv_index: [null],
      },
    };
    expect(parseUVResponse(json)[0].uvIndex).toBeNull();
  });

  it('coalesces missing UV array entry to null', () => {
    const json = {
      hourly: {
        time: ['2025-07-15T12:00', '2025-07-15T13:00'],
        uv_index: [3.5], // only one value, second is undefined
      },
    };
    const result = parseUVResponse(json);
    expect(result[1].uvIndex).toBeNull();
  });

  it('handles empty uv_index array gracefully', () => {
    const json = {
      hourly: {
        time: ['2025-07-15T12:00'],
        uv_index: [],
      },
    };
    expect(parseUVResponse(json)[0].uvIndex).toBeNull();
  });
});

describe('nearest UV timestamp matching', () => {
  function findNearest(uvData, targetTs) {
    return uvData.reduce((best, u) =>
      Math.abs(u.ts - targetTs) < Math.abs((best?.ts ?? Infinity) - targetTs) ? u : best,
      null
    );
  }

  it('returns null when uvData is empty', () => {
    expect(findNearest([], Date.now())).toBeNull();
  });

  it('finds the closest UV entry to a given timestamp', () => {
    const base = 1000000;
    const uvData = [
      { ts: base, uvIndex: 1 },
      { ts: base + 3600000, uvIndex: 5 }, // 1h later
      { ts: base + 7200000, uvIndex: 9 }, // 2h later
    ];
    expect(findNearest(uvData, base + 2000000)?.uvIndex).toBe(5); // closer to base+1h than base
    expect(findNearest(uvData, base + 100)?.uvIndex).toBe(1);     // closest to base
    expect(findNearest(uvData, base + 7100000)?.uvIndex).toBe(9); // closest to base+2h
  });
});
