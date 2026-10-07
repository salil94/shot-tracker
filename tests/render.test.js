// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createCourt, zonePaths, LABEL_ANCHORS } from '../src/court/render.js';
import { ZONES, classifyZone } from '../src/court/geometry.js';
import { zoneStats } from '../src/stats.js';

const shot = (x, y, zone, made) => ({ x, y, zone, made, t: 0 });

describe('zonePaths', () => {
  it('has well-formed path data for every zone', () => {
    const paths = zonePaths();
    expect(Object.keys(paths)).toEqual(ZONES);
    for (const d of Object.values(paths)) {
      expect(d).toMatch(/^M /);
      expect(d).not.toMatch(/NaN|undefined/);
    }
  });
});

describe('LABEL_ANCHORS', () => {
  it('places every label inside its own zone', () => {
    for (const zone of ZONES) {
      for (const { x, y } of LABEL_ANCHORS[zone]) expect(classifyZone(x, y)).toBe(zone);
    }
  });
});

describe('createCourt', () => {
  let container;
  let court;
  const zoneEl = (z) => court.svg.querySelector(`[data-zone="${z}"]`);

  beforeEach(() => {
    document.body.innerHTML = '<main id="court"></main>';
    container = document.getElementById('court');
    court = createCourt(container);
  });

  it('renders one svg with a path per zone and a no-data pattern', () => {
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(court.svg.getAttribute('viewBox')).toBe('-7.5 -1.575 15 14');
    const zones = [...court.svg.querySelectorAll('[data-zone]')].map((n) => n.getAttribute('data-zone'));
    expect(zones).toEqual(ZONES);
    expect(court.svg.querySelector('pattern#no-data')).not.toBeNull();
  });

  it('tags zones with tone and confidence from stats', () => {
    court.setZones(
      zoneStats([
        shot(0, 0, 'paint', true),
        shot(0, 0, 'paint', true),
        shot(0, 0, 'paint', true),
        shot(4.5, 1.6, 'mid', false),
      ]),
    );
    expect(zoneEl('paint').getAttribute('data-tone')).toBe('h3');
    expect(zoneEl('paint').hasAttribute('data-low')).toBe(false);
    expect(zoneEl('mid').getAttribute('data-tone')).toBe('c3');
    expect(zoneEl('mid').hasAttribute('data-low')).toBe(true);
    expect(zoneEl('top3').getAttribute('data-tone')).toBe('empty');
    const labels = [...court.svg.querySelectorAll('.labels text')].map((t) => t.textContent);
    expect(labels).toContain('3/3 · 100%');
  });

  it('clears low confidence once a zone reaches 3 attempts', () => {
    court.setZones(zoneStats([shot(0, 0, 'paint', true)]));
    court.setZones(zoneStats([shot(0, 0, 'paint', true), shot(0, 0, 'paint', true), shot(0, 0, 'paint', true)]));
    expect(zoneEl('paint').hasAttribute('data-low')).toBe(false);
  });

  it('draws makes as dots and misses as crosses, and clears them', () => {
    court.setDots([shot(0, 0, 'paint', true), shot(0, 8, 'top3', false)]);
    expect(court.svg.querySelectorAll('circle.dot.made')).toHaveLength(1);
    const miss = court.svg.querySelectorAll('g.dot.miss');
    expect(miss).toHaveLength(1);
    expect(miss[0].querySelectorAll('path')).toHaveLength(2);
    court.setDots([]);
    expect(court.svg.querySelectorAll('.dot')).toHaveLength(0);
  });

  it('shows and hides the ghost dot', () => {
    const ghost = court.svg.querySelector('.ghost');
    court.setGhost({ x: 1, y: 2 });
    expect(ghost.getAttribute('visibility')).toBe('visible');
    expect(ghost.getAttribute('cx')).toBe('1');
    court.setGhost(null);
    expect(ghost.getAttribute('visibility')).toBe('hidden');
  });
});
