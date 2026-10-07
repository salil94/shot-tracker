import { COURT, ZONES } from './geometry.js';
import { zoneTone } from '../heatmap.js';
const SVG_NS = 'http://www.w3.org/2000/svg';
const r4 = (n) => Number(n.toFixed(4));
const MISS_ARM = 0.2; // half-length of each stroke in the miss ×, metres

// Where each zone's two-line label sits (court metres). Corner labels run vertically
// along the sideline because the corner strip is only 0.9 m wide.
export const LABEL_ANCHORS = {
  leftCorner3: { x: -7.05, y: 0, rotate: -90 },
  leftWing3: { x: -5.6, y: 6 },
  top3: { x: 0, y: 9 },
  rightWing3: { x: 5.6, y: 6 },
  rightCorner3: { x: 7.05, y: 0, rotate: 90 },
  leftBaseline: { x: -4.55, y: 0.4 },
  leftElbow: { x: -3.7, y: 4.6 },
  straightaway: { x: 0, y: 5.5 },
  rightElbow: { x: 3.7, y: 4.6 },
  rightBaseline: { x: 4.55, y: 0.4 },
  restricted: { x: 0, y: 0.7 },
  leftShort: { x: -1.85, y: 1.9 },
  shortCenter: { x: 0, y: 3 },
  rightShort: { x: 1.85, y: 1.9 },
};

// 2K-style label: FG% on top, made/attempts underneath; empty zones show only the hatch.
export function zoneLabel({ made, attempts, pct }) {
  return attempts === 0 ? { pct: '', count: '' } : { pct: `${pct}%`, count: `${made}/${attempts}` };
}

// Point on a ray from the basket, `deg` from straight-on, at distance r.
const onRay = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [r4(r * Math.sin(a)), r4(r * Math.cos(a))];
};

export function zonePaths() {
  const { halfWidth: W, baselineY: B, halfCourtY: H, paintHalfWidth: P, paintTopY: PT, threeRadius: R, cornerX: CX } = COURT;
  const RA = COURT.restrictedRadius;
  const c = COURT.centerAngleDeg;
  const e = COURT.baselineAngleDeg;
  const by = r4(COURT.breakY);
  const [ax, ay] = onRay(c, R); // centre/side ray meets the arc
  const hx = r4(H * Math.tan((c * Math.PI) / 180)); // ...meets half-court
  const fx = r4(PT * Math.tan((c * Math.PI) / 180)); // ...meets the FT line
  const [rx, ry] = onRay(c, RA); // ...meets the restricted-area arc
  const [bx, bY] = onRay(e, R); // elbow/baseline ray meets the arc
  const sy = r4(P / Math.tan((e * Math.PI) / 180)); // ...meets the paint side

  // Side zones are drawn for s = +1 (right); s = -1 mirrors x and flips every arc's sweep.
  const side = (s) => {
    const X = (v) => r4(s * v);
    const sw = (v) => (s > 0 ? v : 1 - v);
    return {
      Corner3: `M ${X(CX)} ${B} H ${X(W)} V ${by} H ${X(CX)} Z`,
      Wing3: `M ${X(CX)} ${by} H ${X(W)} V ${H} H ${X(hx)} L ${X(ax)} ${ay} A ${R} ${R} 0 0 ${sw(0)} ${X(CX)} ${by} Z`,
      Elbow: `M ${X(fx)} ${PT} L ${X(ax)} ${ay} A ${R} ${R} 0 0 ${sw(0)} ${X(bx)} ${bY} L ${X(P)} ${sy} V ${PT} Z`,
      Baseline: `M ${X(P)} ${sy} L ${X(bx)} ${bY} A ${R} ${R} 0 0 ${sw(0)} ${X(CX)} ${by} V ${B} H ${X(P)} Z`,
      Short: `M ${X(rx)} ${ry} L ${X(fx)} ${PT} H ${X(P)} V ${B} H 0 V ${-RA} A ${RA} ${RA} 0 0 ${sw(1)} ${X(rx)} ${ry} Z`,
    };
  };
  const L = side(-1);
  const Rt = side(1);
  return {
    leftCorner3: L.Corner3,
    leftWing3: L.Wing3,
    top3: `M ${ax} ${ay} L ${hx} ${H} H ${-hx} L ${-ax} ${ay} A ${R} ${R} 0 0 0 ${ax} ${ay} Z`,
    rightWing3: Rt.Wing3,
    rightCorner3: Rt.Corner3,
    leftBaseline: L.Baseline,
    leftElbow: L.Elbow,
    straightaway: `M ${-fx} ${PT} H ${fx} L ${ax} ${ay} A ${R} ${R} 0 0 1 ${-ax} ${ay} Z`,
    rightElbow: Rt.Elbow,
    rightBaseline: Rt.Baseline,
    restricted: `M 0 ${-RA} A ${RA} ${RA} 0 1 1 0 ${RA} A ${RA} ${RA} 0 1 1 0 ${-RA} Z`,
    leftShort: L.Short,
    shortCenter: `M ${rx} ${ry} L ${fx} ${PT} H ${-fx} L ${-rx} ${ry} A ${RA} ${RA} 0 0 0 ${rx} ${ry} Z`,
    rightShort: Rt.Short,
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
    const { x, y, rotate } = LABEL_ANCHORS[zone];
    const narrow = rotate !== undefined; // corner strips: smaller type
    const text = el('text', {
      x,
      y,
      'data-zone': zone,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      transform: rotate ? `rotate(${rotate} ${x} ${y})` : '',
    });
    const pct = el('tspan', { x, dy: -0.18, class: 'pct', 'font-size': narrow ? 0.4 : 0.5 });
    const count = el('tspan', { x, dy: narrow ? 0.42 : 0.5, class: 'count', 'font-size': narrow ? 0.3 : 0.38 });
    text.append(pct, count);
    labelsG.append(text);
    labelEls[zone] = { pct, count };
  }

  for (const d of courtLinePaths()) linesG.append(el('path', { d }));
  linesG.append(
    el('circle', { cx: 0, cy: COURT.paintTopY, r: COURT.ftCircleRadius }),
    el('circle', { cx: 0, cy: H, r: COURT.centerCircleRadius }),
    el('circle', { cx: 0, cy: 0, r: COURT.rimRadius }),
  );

  // 2K-style dividers: every zone outline stroked from the same paths the fills use,
  // a soft shade under a thin light line so they read on pale and dark tones alike.
  const outlines = ZONES.map((z) => paths[z]).join(' ');
  const dividersG = el('g', { class: 'dividers' });
  dividersG.append(el('path', { d: outlines, class: 'shade' }), el('path', { d: outlines, class: 'line' }));

  svg.append(defs, zonesG, dividersG, linesG, labelsG, dotsG, ghost);
  container.append(svg);

  return {
    svg,
    setZones(stats) {
      for (const zone of ZONES) {
        const { tone, lowConfidence } = zoneTone(zone, stats[zone]);
        zoneEls[zone].setAttribute('data-tone', tone);
        zoneEls[zone].toggleAttribute('data-low', lowConfidence);
        const { pct, count } = zoneLabel(stats[zone]);
        labelEls[zone].pct.textContent = pct;
        labelEls[zone].count.textContent = count;
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
