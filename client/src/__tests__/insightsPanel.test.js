import { describe, it, expect } from 'vitest';
import { maeColor } from '../components/InsightsPanel.jsx';

describe('maeColor', () => {
  it('returns green for mae < 2', () => {
    expect(maeColor(0)).toBe('#00e887');
    expect(maeColor(1.9)).toBe('#00e887');
  });

  it('returns yellow for mae 2.0–3.0', () => {
    expect(maeColor(2)).toBe('#f5a623');
    expect(maeColor(3)).toBe('#f5a623');
  });

  it('returns red for mae > 3', () => {
    expect(maeColor(3.1)).toBe('#ff2b55');
    expect(maeColor(5)).toBe('#ff2b55');
  });
});
