// FIBA half-court in metres. Origin = basket centre, +x toward the right
// sideline, +y from the baseline toward half-court (matches SVG y-down with
// the baseline at the top of the screen).
const THREE_RADIUS = 6.75;
const CORNER_X = 6.6;

export const COURT = {
  halfWidth: 7.5,
  baselineY: -1.575,
  halfCourtY: 12.425,
  paintHalfWidth: 2.45,
  paintTopY: 4.225, // 5.8 m from the baseline
  threeRadius: THREE_RADIUS,
  cornerX: CORNER_X,
  breakY: Math.sqrt(THREE_RADIUS ** 2 - CORNER_X ** 2), // ≈ 1.415 (2.99 m from baseline)
  topAngleDeg: 22.5,
  ftCircleRadius: 1.8,
  centerCircleRadius: 1.8,
  rimRadius: 0.225,
  backboardY: -0.375, // 1.2 m from the baseline
  backboardHalfWidth: 0.9,
};

export const ZONES = ['paint', 'mid', 'corner3', 'wing3', 'top3'];
export const THREE_POINT_ZONES = new Set(['corner3', 'wing3', 'top3']);

export function isInBounds(x, y) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Math.abs(x) <= COURT.halfWidth &&
    y >= COURT.baselineY &&
    y <= COURT.halfCourtY
  );
}

// A shot exactly on the line is a two.
export function isThree(x, y) {
  if (y <= COURT.breakY) return Math.abs(x) > COURT.cornerX;
  return Math.hypot(x, y) > COURT.threeRadius;
}

export function classifyZone(x, y) {
  if (!isInBounds(x, y)) return null;
  if (isThree(x, y)) {
    if (y <= COURT.breakY) return 'corner3';
    const angle = (Math.abs(Math.atan2(x, y)) * 180) / Math.PI;
    return angle <= COURT.topAngleDeg ? 'top3' : 'wing3';
  }
  if (Math.abs(x) <= COURT.paintHalfWidth && y <= COURT.paintTopY) return 'paint';
  return 'mid';
}
