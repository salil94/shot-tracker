// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createCourt, zonePaths, zoneLabel, LABEL_ANCHORS } from '../src/court/render.js';
import { ZONES, classifyZone } from '../src/court/geometry.js';
import { zoneStats } from '../src/stats.js';

const shot = (x, y, zone, made) => ({ x, y, zone, made, t: 0 });

describe('zonePaths', () => {
  it('has well-formed path data for all 14 zones', () => {
    const paths = zonePaths();
    expect(Object.keys(paths)).toEqual(ZONES);
    for (const d of Object.values(paths)) {
      expect(d).toMatch(/^M /);
      expect(d).not.toMatch(/NaN|undefined/);
    }
  });

  it('mirrors left and right paths (same magnitudes, opposite arc sweeps)', () => {
    const paths = zonePaths();
    const sweeps = (d) => [...d.matchAll(/ A \S+ \S+ 0 [01] ([01]) /g)].map((m) => Number(m[1]));
    const shape = (d) => d.replace(/ A (\S+) (\S+) 0 ([01]) [01] /g, ' A $1 $2 0 $3 S ').replace(/-/g, '');
    for (const side of ['Corner3', 'Wing3', 'Elbow', 'Baseline', 'Short']) {
      const l = paths[`left${side}`];
      const r = paths[`right${side}`];
      expect(shape(l)).toBe(shape(r));
      expect(sweeps(l).map((s, i) => s + sweeps(r)[i])).toEqual(sweeps(l).map(() => 1));
    }
  });
});

describe('LABEL_ANCHORS', () => {
  it('places every zone label inside its own zone', () => {
    expect(Object.keys(LABEL_ANCHORS)).toEqual(ZONES);
    for (const zone of ZONES) {
      const { x, y } = LABEL_ANCHORS[zone];
      expect(classifyZone(x, y)).toBe(zone);
    }
  });
});

describe('zoneLabel', () => {
  it('shows FG% over made/attempts, and nothing for an empty zone', () => {
    expect(zoneLabel({ made: 7, attempts: 12, pct: 58 })).toEqual({ pct: '58%', count: '7/12' });
    expect(zoneLabel({ made: 0, attempts: 0, pct: null })).toEqual({ pct: '', count: '' });
  });
});

describe('createCourt', () => {
  let container;
  let court;
  const zoneEl = (z) => court.svg.querySelector(`[data-zone="${z}"]`);
  const label = (z) => court.svg.querySelector(`.labels text[data-zone="${z}"]`);

  beforeEach(() => {
    document.body.innerHTML = '<main id="court"></main>';
    container = document.getElementById('court');
    court = createCourt(container);
  });

  it('renders one svg with a path and a label per zone and a no-data pattern', () => {
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(court.svg.getAttribute('viewBox')).toBe('-7.5 -1.575 15 14');
    const zones = [...court.svg.querySelectorAll('path[data-zone]')].map((n) => n.getAttribute('data-zone'));
    expect(zones).toEqual(ZONES);
    expect(court.svg.querySelectorAll('.labels text')).toHaveLength(14);
    expect(court.svg.querySelector('pattern#no-data')).not.toBeNull();
  });

  it('tags each zone with its own tone, confidence and label', () => {
    court.setZones(
      zoneStats([
        shot(0, 0, 'restricted', true),
        shot(0, 0, 'restricted', true),
        shot(0, 0, 'restricted', true),
        shot(0, 5.5, 'straightaway', false),
      ]),
    );
    expect(zoneEl('restricted').getAttribute('data-tone')).toBe('h3');
    expect(zoneEl('restricted').hasAttribute('data-low')).toBe(false);
    expect(zoneEl('straightaway').getAttribute('data-tone')).toBe('c3');
    expect(zoneEl('straightaway').hasAttribute('data-low')).toBe(true);
    expect(zoneEl('top3').getAttribute('data-tone')).toBe('empty');
    expect(label('restricted').querySelector('.pct').textContent).toBe('100%');
    expect(label('restricted').querySelector('.count').textContent).toBe('3/3');
    expect(label('top3').textContent).toBe('');
  });

  it('fills left and right zones independently', () => {
    court.setZones(zoneStats([shot(-7, 0, 'leftCorner3', true), shot(7, 0, 'rightCorner3', false)]));
    expect(zoneEl('leftCorner3').getAttribute('data-tone')).toBe('h3');
    expect(zoneEl('rightCorner3').getAttribute('data-tone')).toBe('c3');
    expect(label('leftCorner3').querySelector('.pct').textContent).toBe('100%');
    expect(label('rightCorner3').querySelector('.pct').textContent).toBe('0%');
  });

  it('clears low confidence once a zone reaches 3 attempts', () => {
    court.setZones(zoneStats([shot(0, 0, 'restricted', true)]));
    court.setZones(
      zoneStats([shot(0, 0, 'restricted', true), shot(0, 0, 'restricted', true), shot(0, 0, 'restricted', true)]),
    );
    expect(zoneEl('restricted').hasAttribute('data-low')).toBe(false);
  });

  it('draws makes as dots and misses as crosses, and clears them', () => {
    court.setDots([shot(0, 0, 'restricted', true), shot(0, 8, 'top3', false)]);
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
