import { describe, it, expect } from 'vitest';
import { COURT, ZONES, THREE_POINT_ZONES, classifyZone, isInBounds, isThree } from '../src/court/geometry.js';

// Point at distance r from the basket, deg from straight-on (negative = shooter's left).
const atAngle = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), r * Math.cos(a)];
};

describe('COURT', () => {
  it('puts the corner/arc break 2.99 m from the baseline (FIBA)', () => {
    expect(COURT.breakY - COURT.baselineY).toBeCloseTo(2.99, 2);
  });
  it('lists the 14 hot zones: 3PT, mid-range, close', () => {
    expect(ZONES).toEqual([
      'leftCorner3', 'leftWing3', 'top3', 'rightWing3', 'rightCorner3',
      'leftBaseline', 'leftElbow', 'straightaway', 'rightElbow', 'rightBaseline',
      'restricted', 'leftShort', 'shortCenter', 'rightShort',
    ]);
  });
  it('marks exactly the five 3PT zones as threes', () => {
    expect([...THREE_POINT_ZONES]).toEqual(['leftCorner3', 'leftWing3', 'top3', 'rightWing3', 'rightCorner3']);
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
    // close: restricted area (r <= 1.25, edge inclusive), behind the basket too
    [0, 0, 'restricted'],
    [0, 1.25, 'restricted'],
    [0, -1.2, 'restricted'],
    // close: short center (within 22.5°, up to the FT line)
    [0, 1.26, 'shortCenter'],
    [0, 4.225, 'shortCenter'],
    // close: left/right short (rest of the paint, edges inclusive)
    [2.45, 4.225, 'rightShort'],
    [-2.45, 4.225, 'leftShort'],
    [-2.45, -1.575, 'leftShort'],
    [1.5, 0, 'rightShort'],
    [0.1, -1.4, 'rightShort'], // behind the basket, outside the restricted area
    // mid-range: straightaway (above the FT line, within 22.5°)
    [0, 4.23, 'straightaway'],
    [0, 6.75, 'straightaway'], // exactly on the arc
    // mid-range: elbows and baselines
    [2.46, 4, 'rightElbow'],
    [-3.6, 4.4, 'leftElbow'],
    [4.6, 0.3, 'rightBaseline'],
    [-6.6, 0, 'leftBaseline'], // exactly on the corner line
    [-4, -1.5, 'leftBaseline'], // behind the basket, outside the paint
    // 3PT
    [6.61, 0, 'rightCorner3'],
    [-6.61, -1.5, 'leftCorner3'],
    [-7.4, 1.41, 'leftCorner3'],
    [6.7, 1.5, 'rightWing3'],
    [-7.4, 12, 'leftWing3'],
    [0, 6.76, 'top3'],
    [0, 12, 'top3'],
  ])('(%s, %s) → %s', (x, y, zone) => {
    expect(classifyZone(x, y)).toBe(zone);
  });

  it('splits center/side wedges at 22.5° in every ring, mirrored', () => {
    // 3PT
    expect(classifyZone(...atAngle(22, 8))).toBe('top3');
    expect(classifyZone(...atAngle(23, 8))).toBe('rightWing3');
    expect(classifyZone(...atAngle(-23, 8))).toBe('leftWing3');
    // mid-range
    expect(classifyZone(...atAngle(-22, 5.5))).toBe('straightaway');
    expect(classifyZone(...atAngle(23, 5.5))).toBe('rightElbow');
    expect(classifyZone(...atAngle(-23, 5.5))).toBe('leftElbow');
    // close
    expect(classifyZone(...atAngle(22, 3))).toBe('shortCenter');
    expect(classifyZone(...atAngle(23, 3))).toBe('rightShort');
    expect(classifyZone(...atAngle(-23, 3))).toBe('leftShort');
  });

  it('splits mid-range elbow/baseline at 67.5°, mirrored', () => {
    expect(classifyZone(...atAngle(67, 5))).toBe('rightElbow');
    expect(classifyZone(...atAngle(68, 5))).toBe('rightBaseline');
    expect(classifyZone(...atAngle(-67, 5))).toBe('leftElbow');
    expect(classifyZone(...atAngle(-68, 5))).toBe('leftBaseline');
  });

  it('mirrors every zone left/right', () => {
    const mirror = (z) => z.replace(/^left/, 'RIGHT').replace(/^right/, 'left').replace(/^RIGHT/, 'right');
    for (let x = 0.3; x <= 7.4; x += 0.35) {
      for (let y = -1.5; y <= 12.4; y += 0.35) {
        expect(classifyZone(-x, y)).toBe(mirror(classifyZone(x, y)));
      }
    }
  });

  it('reaches all 14 zones', () => {
    const seen = new Set();
    for (let x = -7.45; x <= 7.45; x += 0.1) {
      for (let y = -1.55; y <= 12.4; y += 0.1) seen.add(classifyZone(x, y));
    }
    expect([...seen].sort()).toEqual([...ZONES].sort());
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
