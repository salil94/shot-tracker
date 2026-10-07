import { describe, it, expect } from 'vitest';
import { COURT, ZONES, classifyZone, isInBounds, isThree } from '../src/court/geometry.js';

const atAngle = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), r * Math.cos(a)];
};

describe('COURT', () => {
  it('puts the corner/arc break 2.99 m from the baseline (FIBA)', () => {
    expect(COURT.breakY - COURT.baselineY).toBeCloseTo(2.99, 2);
  });
  it('lists the five zones', () => {
    expect(ZONES).toEqual(['paint', 'mid', 'corner3', 'wing3', 'top3']);
  });
});

describe('isInBounds', () => {
  it('accepts court edges and rejects beyond them', () => {
    expect(isInBounds(7.5, 12.425)).toBe(true);
    expect(isInBounds(-7.5, -1.575)).toBe(true);
    expect(isInBounds(7.51, 0)).toBe(false);
    expect(isInBounds(0, 12.43)).toBe(false);
    expect(isInBounds(0, -1.58)).toBe(false);
  });
});

describe('isThree', () => {
  it('is false exactly on the line (on the line = two)', () => {
    expect(isThree(0, 6.75)).toBe(false);
    expect(isThree(6.6, 0)).toBe(false);
  });
  it('is true just beyond the line', () => {
    expect(isThree(0, 6.76)).toBe(true);
    expect(isThree(6.61, 0)).toBe(true);
  });
});

describe('classifyZone', () => {
  it.each([
    // paint (edges inclusive)
    [0, 0, 'paint'],
    [2.45, 4.225, 'paint'],
    [-2.45, -1.575, 'paint'],
    // mid-range
    [2.46, 0, 'mid'],
    [0, 4.23, 'mid'],
    [0, 6.75, 'mid'], // exactly on the arc
    [6.6, 0, 'mid'], // exactly on the corner line
    [4.55, 1.6, 'mid'],
    // corner 3 (y <= break)
    [6.61, 0, 'corner3'],
    [-6.61, -1.5, 'corner3'],
    [7.4, 1.41, 'corner3'],
    // above the break, beyond the arc
    [6.7, 1.5, 'wing3'],
    [7.4, 12, 'wing3'],
    // straight on
    [0, 6.76, 'top3'],
    [0, 12, 'top3'],
  ])('(%s, %s) → %s', (x, y, zone) => {
    expect(classifyZone(x, y)).toBe(zone);
  });

  it('splits top/wing at 22.5° from straight-on, both sides', () => {
    expect(classifyZone(...atAngle(22, 8))).toBe('top3');
    expect(classifyZone(...atAngle(-22, 8))).toBe('top3');
    expect(classifyZone(...atAngle(23, 8))).toBe('wing3');
    expect(classifyZone(...atAngle(-23, 8))).toBe('wing3');
  });

  it.each([
    [0, 12.43],
    [7.51, 0],
    [0, -1.58],
    [NaN, 0],
    [0, Infinity],
  ])('returns null outside the court: (%s, %s)', (x, y) => {
    expect(classifyZone(x, y)).toBeNull();
  });
});
