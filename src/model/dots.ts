// Geometry of the iQ logo mark, taken directly from iq.svg.
// The original art is 6 white circles on a 61x61 canvas.

export const DOT_R = 6.72;

/** Original iq.svg viewBox size (square). */
export const BASE = 61;

/**
 * Transparent padding added on every side of the original art so the glow
 * halo never clips against the comp/canvas edge, even at the maximum radius.
 * PAD >= DOT_R * MAX_RADIUS_MULT. See settings.ts for MAX_RADIUS_MULT (5).
 */
export const PAD = 40;

/** Final square canvas size used by both the SVG preview and the Lottie comp. */
export const CANVAS = BASE + 2 * PAD; // 141

export type Point = { x: number; y: number };

/** Dot centers in the ORIGINAL (unpadded) coordinate space. */
export const DOTS: readonly Point[] = [
  { x: 30.24, y: 7.84 },
  { x: 7.84, y: 19.04 },
  { x: 52.64, y: 19.04 },
  { x: 30.24, y: 30.24 },
  { x: 19.04, y: 52.64 },
  { x: 41.44, y: 52.64 },
];

/** Shift an original-space point into the padded canvas space. */
export function toCanvas(p: Point): Point {
  return { x: p.x + PAD, y: p.y + PAD };
}
