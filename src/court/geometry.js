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
  restrictedRadius: 1.25, // FIBA no-charge semicircle
  centerAngleDeg: 22.5, // centre wedges (top3, straightaway, shortCenter) vs side wedges
  baselineAngleDeg: 67.5, // mid-range elbow vs baseline
  ftCircleRadius: 1.8,
  centerCircleRadius: 1.8,
  rimRadius: 0.225,
  backboardY: -0.375, // 1.2 m from the baseline
  backboardHalfWidth: 0.9,
};

// NBA 2K-style hot zones, left/right separate. "Left" is the shooter's left facing the basket (x < 0).
export const ZONES = [
  'leftCorner3', 'leftWing3', 'top3', 'rightWing3', 'rightCorner3',
  'leftBaseline', 'leftElbow', 'straightaway', 'rightElbow', 'rightBaseline',
  'restricted', 'leftShort', 'shortCenter', 'rightShort',
];
export const THREE_POINT_ZONES = new Set(['leftCorner3', 'leftWing3', 'top3', 'rightWing3', 'rightCorner3']);

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

const inPaint = (x, y) => Math.abs(x) <= COURT.paintHalfWidth && y <= COURT.paintTopY;

export function classifyZone(x, y) {
  if (!isInBounds(x, y)) return null;
  const side = x < 0 ? 'left' : 'right';
  // Angle from straight-on toward half-court: 0° = centre, 180° = behind the basket.
  const deg = (Math.abs(Math.atan2(x, y)) * 180) / Math.PI;
  const centre = deg <= COURT.centerAngleDeg;
  if (isThree(x, y)) {
    if (y <= COURT.breakY) return `${side}Corner3`;
    return centre ? 'top3' : `${side}Wing3`;
  }
  if (inPaint(x, y)) {
    if (Math.hypot(x, y) <= COURT.restrictedRadius) return 'restricted';
    return centre ? 'shortCenter' : `${side}Short`;
  }
  if (centre) return 'straightaway';
  return deg <= COURT.baselineAngleDeg ? `${side}Elbow` : `${side}Baseline`;
}
