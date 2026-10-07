import { COURT, ZONES } from './geometry.js';
import { zoneTone } from '../heatmap.js';
import { formatStat } from '../stats.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const r4 = (n) => Number(n.toFixed(4));
const MISS_ARM = 0.2; // half-length of each stroke in the miss ×, metres

// Where each zone's stat label sits (court metres). Corner labels run vertically
// along the sideline because the corner strip is only 0.9 m wide.
export const LABEL_ANCHORS = {
  paint: [{ x: 0, y: 2.6 }],
  mid: [{ x: -4.55, y: 1.6 }, { x: 4.55, y: 1.6 }],
  corner3: [{ x: -7.05, y: 0, rotate: -90 }, { x: 7.05, y: 0, rotate: 90 }],
  wing3: [{ x: -5.6, y: 6 }, { x: 5.6, y: 6 }],
  top3: [{ x: 0, y: 9 }],
};

export function zonePaths() {
  const { halfWidth: W, baselineY: B, halfCourtY: H, paintHalfWidth: P, paintTopY: PT, threeRadius: R, cornerX: CX } = COURT;
  const a = (COURT.topAngleDeg * Math.PI) / 180;
  const by = r4(COURT.breakY);
  const ax = r4(R * Math.sin(a)); // top/wing boundary meets the arc
  const ay = r4(R * Math.cos(a));
  const hx = r4(H * Math.tan(a)); // top/wing boundary meets half-court
  const paintRect = `M ${-P} ${B} H ${P} V ${PT} H ${-P} Z`;
  return {
    paint: paintRect,
    mid: `M ${-CX} ${B} H ${CX} V ${by} A ${R} ${R} 0 0 1 ${-CX} ${by} Z ${paintRect}`,
    corner3: `M ${-W} ${B} H ${-CX} V ${by} H ${-W} Z M ${CX} ${B} H ${W} V ${by} H ${CX} Z`,
    wing3:
      `M ${CX} ${by} H ${W} V ${H} H ${hx} L ${ax} ${ay} A ${R} ${R} 0 0 0 ${CX} ${by} Z ` +
      `M ${-CX} ${by} H ${-W} V ${H} H ${-hx} L ${-ax} ${ay} A ${R} ${R} 0 0 1 ${-CX} ${by} Z`,
    top3: `M ${ax} ${ay} L ${hx} ${H} H ${-hx} L ${-ax} ${ay} A ${R} ${R} 0 0 0 ${ax} ${ay} Z`,
  };
}

export function courtLinePaths() {
  const { halfWidth: W, baselineY: B, halfCourtY: H, paintHalfWidth: P, paintTopY: PT, threeRadius: R, cornerX: CX } = COURT;
  const by = r4(COURT.breakY);
  const bb = COURT.backboardHalfWidth;
  return [
    `M ${-W} ${B} H ${W} V ${H} H ${-W} Z`, // boundary
    `M ${-P} ${B} V ${PT} H ${P} V ${B}`, // paint
    `M ${-CX} ${B} V ${by} A ${R} ${R} 0 0 0 ${CX} ${by} V ${B}`, // 3pt line
    `M ${-bb} ${COURT.backboardY} H ${bb}`, // backboard
  ];
}

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null && v !== '') node.setAttribute(k, String(v));
  }
  return node;
}

// Diagonal hatch = "no shots yet". Kept distinct from the neutral midpoint tone.
function noDataPattern() {
  const pattern = el('pattern', {
    id: 'no-data',
    width: 0.35,
    height: 0.35,
    patternUnits: 'userSpaceOnUse',
    patternTransform: 'rotate(45)',
  });
  pattern.append(
    el('rect', { width: 0.35, height: 0.35, class: 'hatch-bg' }),
    el('line', { x1: 0, y1: 0, x2: 0, y2: 0.35, class: 'hatch-line' }),
  );
  return pattern;
}

function shotMark(s) {
  if (s.made) return el('circle', { cx: s.x, cy: s.y, r: 0.2, class: 'dot made' });
  const k = MISS_ARM;
  const d = `M ${s.x - k} ${s.y - k} L ${s.x + k} ${s.y + k} M ${s.x + k} ${s.y - k} L ${s.x - k} ${s.y + k}`;
  const g = el('g', { class: 'dot miss' });
  g.append(el('path', { d, class: 'halo' }), el('path', { d, class: 'ink' }));
  return g;
}

export function createCourt(container) {
  const { halfWidth: W, baselineY: B, halfCourtY: H } = COURT;
  const svg = el('svg', {
    viewBox: `${-W} ${B} ${2 * W} ${H - B}`,
    class: 'court-svg',
    role: 'img',
    'aria-label': 'Half court. Tap where the shot was taken.',
  });
  const defs = el('defs');
  defs.append(noDataPattern());
  const zonesG = el('g', { class: 'zones' });
  const linesG = el('g', { class: 'lines' });
  const labelsG = el('g', { class: 'labels' });
  const dotsG = el('g', { class: 'dots' });
  const ghost = el('circle', { class: 'ghost', r: 0.3, visibility: 'hidden' });

  const paths = zonePaths();
  const zoneEls = {};
  const labelEls = {};
  for (const zone of ZONES) {
    zoneEls[zone] = el('path', {
      d: paths[zone],
      class: 'zone',
      'fill-rule': 'evenodd',
      'data-zone': zone,
      'data-tone': 'empty',
    });
    zonesG.append(zoneEls[zone]);
    labelEls[zone] = LABEL_ANCHORS[zone].map(({ x, y, rotate }) => {
      const text = el('text', {
        x,
        y,
        'font-size': zone === 'corner3' ? 0.4 : 0.5,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        transform: rotate ? `rotate(${rotate} ${x} ${y})` : '',
      });
      labelsG.append(text);
      return text;
    });
  }

  for (const d of courtLinePaths()) linesG.append(el('path', { d }));
  linesG.append(
    el('circle', { cx: 0, cy: COURT.paintTopY, r: COURT.ftCircleRadius }),
    el('circle', { cx: 0, cy: H, r: COURT.centerCircleRadius }),
    el('circle', { cx: 0, cy: 0, r: COURT.rimRadius }),
  );

  svg.append(defs, zonesG, linesG, labelsG, dotsG, ghost);
  container.append(svg);

  return {
    svg,
    setZones(stats) {
      for (const zone of ZONES) {
        const { tone, lowConfidence } = zoneTone(zone, stats[zone]);
        zoneEls[zone].setAttribute('data-tone', tone);
        zoneEls[zone].toggleAttribute('data-low', lowConfidence);
        for (const t of labelEls[zone]) t.textContent = formatStat(stats[zone]);
      }
    },
    setDots(shots) {
      dotsG.replaceChildren(...shots.map(shotMark));
    },
    setGhost(point) {
      if (!point) {
        ghost.setAttribute('visibility', 'hidden');
        return;
      }
      ghost.setAttribute('cx', String(point.x));
      ghost.setAttribute('cy', String(point.y));
      ghost.setAttribute('visibility', 'visible');
    },
    clientToCourt(clientX, clientY) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: NaN, y: NaN };
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
  };
}
