import { describe, it, expect } from 'vitest';
import { pct, zoneStats, totals, formatStat } from '../src/stats.js';

const shot = (zone, made) => ({ x: 0, y: 0, zone, made, t: 0 });

describe('pct', () => {
  it('rounds to a whole percent and is null with no attempts', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(7, 12)).toBe(58);
    expect(pct(0, 0)).toBeNull();
  });
});

describe('zoneStats', () => {
  it('returns every zone empty for no shots', () => {
    const s = zoneStats([]);
    expect(Object.keys(s)).toEqual(['paint', 'mid', 'corner3', 'wing3', 'top3']);
    for (const z of Object.values(s)) expect(z).toEqual({ made: 0, attempts: 0, pct: null });
  });

  it('counts makes and attempts per zone', () => {
    const s = zoneStats([
      shot('paint', true),
      shot('paint', false),
      shot('paint', true),
      shot('top3', true),
    ]);
    expect(s.paint).toEqual({ made: 2, attempts: 3, pct: 67 });
    expect(s.top3).toEqual({ made: 1, attempts: 1, pct: 100 });
    expect(s.mid).toEqual({ made: 0, attempts: 0, pct: null });
  });

  it('ignores shots with an unknown zone', () => {
    const s = zoneStats([shot('bogus', true)]);
    expect(Object.values(s).every((z) => z.attempts === 0)).toBe(true);
  });
});

describe('totals', () => {
  it('sums across all zones', () => {
    expect(totals([shot('paint', true), shot('wing3', false)])).toEqual({ made: 1, attempts: 2, pct: 50 });
    expect(totals([])).toEqual({ made: 0, attempts: 0, pct: null });
  });
});

describe('formatStat', () => {
  it('formats made/attempts · pct%', () => {
    expect(formatStat({ made: 7, attempts: 12, pct: 58 })).toBe('7/12 · 58%');
  });
  it('shows 0/0 with no attempts', () => {
    expect(formatStat({ made: 0, attempts: 0, pct: null })).toBe('0/0');
  });
});
