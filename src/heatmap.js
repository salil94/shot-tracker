import { THREE_POINT_ZONES } from './court/geometry.js';

// FG% at which a zone is fully cold / fully hot. Threes are judged on a lower scale.
export const ANCHORS = {
  two: { cold: 0.3, hot: 0.6 },
  three: { cold: 0.2, hot: 0.45 },
};

// Diverging bins: cold arm, neutral midpoint, hot arm. Colours are CSS tokens (--heat-<tone>).
export const TONES = ['c3', 'c2', 'c1', 'n', 'h1', 'h2', 'h3'];
export const MIN_CONFIDENT_ATTEMPTS = 3;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function heatT(zone, ratio) {
  const { cold, hot } = THREE_POINT_ZONES.has(zone) ? ANCHORS.three : ANCHORS.two;
  return clamp01((ratio - cold) / (hot - cold));
}

export function heatTone(zone, ratio) {
  return TONES[Math.round(heatT(zone, ratio) * (TONES.length - 1))];
}

export function zoneTone(zone, { made, attempts }) {
  if (attempts === 0) return { tone: 'empty', lowConfidence: false };
  return { tone: heatTone(zone, made / attempts), lowConfidence: attempts < MIN_CONFIDENT_ATTEMPTS };
}
