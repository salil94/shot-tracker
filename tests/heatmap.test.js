import { describe, it, expect } from 'vitest';
import { heatT, heatTone, zoneTone, TONES } from '../src/heatmap.js';

describe('heatT', () => {
  it('uses 30%→60% anchors for 2pt zones', () => {
    expect(heatT('paint', 0.3)).toBe(0);
    expect(heatT('mid', 0.45)).toBeCloseTo(0.5);
    expect(heatT('paint', 0.6)).toBeCloseTo(1);
  });
  it('uses 20%→45% anchors for 3pt zones', () => {
    expect(heatT('top3', 0.2)).toBe(0);
    expect(heatT('wing3', 0.325)).toBeCloseTo(0.5);
    expect(heatT('corner3', 0.45)).toBeCloseTo(1);
  });
  it('clamps outside the anchors', () => {
    expect(heatT('paint', 0.1)).toBe(0);
    expect(heatT('paint', 0.95)).toBe(1);
    expect(heatT('top3', 0)).toBe(0);
    expect(heatT('top3', 1)).toBe(1);
  });
});

describe('heatTone', () => {
  it('has three cold bins, a neutral midpoint, and three hot bins', () => {
    expect(TONES).toEqual(['c3', 'c2', 'c1', 'n', 'h1', 'h2', 'h3']);
  });
  it('maps anchors to the ends and the midpoint to neutral', () => {
    expect(heatTone('paint', 0.3)).toBe('c3');
    expect(heatTone('mid', 0.45)).toBe('n');
    expect(heatTone('paint', 0.6)).toBe('h3');
    expect(heatTone('top3', 0.2)).toBe('c3');
    expect(heatTone('top3', 0.45)).toBe('h3');
  });
  it('rates 40% from three as hot and 40% in the paint as cold', () => {
    expect(heatTone('top3', 0.4)).toBe('h2');
    expect(heatTone('paint', 0.4)).toBe('c1');
  });
});

describe('zoneTone', () => {
  it('is empty (hatched) with no attempts, never the neutral tone', () => {
    expect(zoneTone('paint', { made: 0, attempts: 0 })).toEqual({ tone: 'empty', lowConfidence: false });
  });
  it('flags low confidence below 3 attempts', () => {
    expect(zoneTone('paint', { made: 1, attempts: 1 })).toEqual({ tone: 'h3', lowConfidence: true });
    expect(zoneTone('paint', { made: 1, attempts: 2 }).lowConfidence).toBe(true);
  });
  it('is confident from 3 attempts', () => {
    expect(zoneTone('top3', { made: 0, attempts: 3 })).toEqual({ tone: 'c3', lowConfidence: false });
  });
});
