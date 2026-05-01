import { describe, it, expect } from 'vitest';
import { groupIntoBlocks, formatBlockLabel } from '../components/ConditionsHistory.jsx';

const makeEntry = (ts, northScore, southScore, overrides = {}) => ({
  ts,
  windSpeedKt: 5,
  windDirDeg: 270,
  waterTempF: 52,
  north: { score: northScore },
  south: { score: southScore },
  ...overrides,
});

// 2026-04-30 06:30 PT
const JUN7_6A = new Date('2026-04-30T13:30:00Z').getTime();
// 2026-04-30 07:45 PT
const JUN7_7A = new Date('2026-04-30T14:45:00Z').getTime();
// 2026-04-30 12:15 PT
const JUN7_12P = new Date('2026-04-30T19:15:00Z').getTime();
// 2026-05-01 06:30 PT (next day, same slot)
const JUN8_6A = new Date('2026-05-01T13:30:00Z').getTime();
// 2026-04-30 00:30 PT (midnight slot)
const JUN7_12A = new Date('2026-04-30T07:30:00Z').getTime();

describe('groupIntoBlocks', () => {
  it('groups two entries in the same 6h slot into one block', () => {
    const entries = [makeEntry(JUN7_6A, 7, 6), makeEntry(JUN7_7A, 8, 5)];
    expect(groupIntoBlocks(entries)).toHaveLength(1);
  });

  it('keeps entries from different slots in separate blocks', () => {
    const entries = [makeEntry(JUN7_6A, 7, 6), makeEntry(JUN7_12P, 8, 5)];
    expect(groupIntoBlocks(entries)).toHaveLength(2);
  });

  it('keeps same 6h slot on different dates in separate blocks', () => {
    const entries = [makeEntry(JUN7_6A, 7, 6), makeEntry(JUN8_6A, 8, 5)];
    expect(groupIntoBlocks(entries)).toHaveLength(2);
  });

  it('block score = max(north, south) from peak entry', () => {
    const entries = [makeEntry(JUN7_6A, 7, 6), makeEntry(JUN7_7A, 5, 9)];
    const [block] = groupIntoBlocks(entries);
    expect(block.score).toBe(9);
  });

  it('peak entry fields come from the entry with the highest score', () => {
    const low = makeEntry(JUN7_6A, 3, 3, { windSpeedKt: 10 });
    const high = makeEntry(JUN7_7A, 8, 8, { windSpeedKt: 2 });
    const [block] = groupIntoBlocks([low, high]);
    expect(block.windSpeedKt).toBe(2);
  });

  it('returns blocks sorted chronologically', () => {
    const entries = [makeEntry(JUN7_12P, 5, 5), makeEntry(JUN7_6A, 7, 7)];
    const blocks = groupIntoBlocks(entries);
    expect(blocks[0].ts).toBe(JUN7_6A);
    expect(blocks[1].ts).toBe(JUN7_12P);
  });

  it('handles a single-entry block (partial)', () => {
    const [block] = groupIntoBlocks([makeEntry(JUN7_6A, 6, 4)]);
    expect(block.score).toBe(6);
  });
});

describe('formatBlockLabel', () => {
  it('short label shows day + slot start for 6a slot', () => {
    expect(formatBlockLabel({ ts: JUN7_6A })).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) 6a$/);
  });

  it('noon slot shows 12p', () => {
    expect(formatBlockLabel({ ts: JUN7_12P })).toMatch(/12p$/);
  });

  it('midnight slot shows 12a', () => {
    expect(formatBlockLabel({ ts: JUN7_12A })).toMatch(/12a$/);
  });

  it('full label includes · separator and time range', () => {
    const label = formatBlockLabel({ ts: JUN7_6A }, true);
    expect(label).toMatch(/·/);
    expect(label).toMatch(/6a.+12p/);
  });

  it('full label includes month and numeric day', () => {
    const label = formatBlockLabel({ ts: JUN7_6A }, true);
    expect(label).toMatch(/\w{3} \d+/); // e.g. "Apr 30"
  });
});
