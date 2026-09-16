// Animation model. ONE source of truth for motion: `collapseProgress(u, anim)`
// returns how far the ring dots have collapsed toward the center at normalized
// cycle time u (0..1). The live SVG preview samples it every frame via rAF, and
// the Lottie exporter bakes it into position keyframes — so preview == export.

export type AnimationType = "none" | "thinking-pulse" | "rotate-clockwise";

/**
 * The two control points of a cubic-bezier easing curve, as edited by the
 * graph. Anchors are fixed at (0,0) and (1,1); p1=(x1,y1), p2=(x2,y2). x is
 * clamped to [0,1] (time); y may exceed it for anticipation/overshoot.
 */
export type EaseCurve = { x1: number; y1: number; x2: number; y2: number };

export type AnimationSettings = {
  type: AnimationType;
  /** Playback speed multiplier. Higher = faster (shorter cycle). */
  speed: number;
  /** Cubic-bezier timing curve shaping the collapse/expand (edited via graph). */
  ease: EaseCurve;
  /** How far past rest the dots spring on the way back out (0 = none). */
  overshoot: number;
  /** Elastic wobble that decays after the overshoot (0 = none). */
  rubberband: number;
  /** How far the ring collapses toward center (1 = fully onto center dot). */
  collapse: number;
  /** How much the outer dots shrink at full collapse (0 = none, 0.3 = 30% smaller). */
  ringShrink: number;
  /** Whether the center dot pulses (grows/shrinks) during the hold beat. */
  centerGrowEnabled: boolean;
  /** Size multiplier the center dot grows to at full collapse (1 = no growth). */
  centerGrow: number;
  /** Rotate only: mirror the outer dots' shrink pulse on the center dot too. */
  centerMatchRing: boolean;
  /** Rotate only: fraction of each cycle spent holding at the target (0 = continuous). */
  rotateHold: number;
};

export const DEFAULT_ANIMATION: AnimationSettings = {
  type: "none",
  speed: 1.0,
  ease: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
  overshoot: 0.25,
  rubberband: 0.3,
  collapse: 1,
  ringShrink: 0.15,
  centerGrowEnabled: true,
  centerGrow: 1.6,
  centerMatchRing: false,
  rotateHold: 0,
};

export const ANIMATIONS: { value: AnimationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "thinking-pulse", label: "Thinking / Pulse" },
  { value: "rotate-clockwise", label: "Rotate Clockwise" },
];

/** Index of the center dot in DOTS (the one the ring collapses onto). */
export const CENTER_INDEX = 3;

/**
 * Outer dot indices in clockwise order (sorted by angle from center).
 * Used by the rotate-clockwise animation to determine which position
 * each dot travels to.
 *
 * Angular positions (screen coords, 0°=right, clockwise):
 *   Dot 5 → 63.4°  (lower-right)
 *   Dot 4 → 116.6° (lower-left)
 *   Dot 1 → 206.6° (upper-left)
 *   Dot 0 → 270.0° (top)
 *   Dot 2 → 333.4° (upper-right)
 */
export const OUTER_CLOCKWISE: readonly number[] = [5, 4, 1, 0, 2];

// Each outer dot's "next" position in the clockwise rotation.
const CW_NEXT: Readonly<Record<number, number>> = { 5: 4, 4: 1, 1: 0, 0: 2, 2: 5 };

/**
 * Returns the dot index whose resting position the given outer dot travels
 * toward during one clockwise rotation step.
 */
export function clockwiseTarget(index: number): number {
  return CW_NEXT[index] ?? index;
}

/** Frame rate used for the Lottie timeline and keyframe baking. */
export const FPS = 60;

const BASE_PERIOD = 1.6; // seconds for one cycle at speed = 1

/** Duration of one full cycle in seconds. */
export function cycleDuration(anim: AnimationSettings): number {
  return BASE_PERIOD / Math.max(anim.speed, 0.01);
}

/** Number of frames in one cycle on the Lottie timeline. */
export function cycleFrames(anim: AnimationSettings): number {
  return Math.max(2, Math.round(cycleDuration(anim) * FPS));
}

/**
 * Elastic spring added on top of the rotation ease near the destination.
 * Fires late in the cycle (sin²(π·u³) peaks near u≈0.8) so the overshoot
 * happens as the dot arrives at the target — not mid-travel. Zero VALUE and
 * zero VELOCITY at both u=0 and u=1, so the loop boundary is seamless.
 * A positive overshoot means the dot travels slightly PAST the target (further
 * clockwise) before springing back, giving a natural elastic landing that
 * breaks the "decelerate to a pause" feel of a plain ease curve.
 */
function rotateSpring(u: number, anim: AnimationSettings): number {
  if (anim.overshoot <= 0) return 0;
  const w = Math.sin(Math.PI * u * u * u); // late-biased; w(0)=w(1)=0
  const wobbles = anim.rubberband * 3;
  const osc = Math.cos(2 * Math.PI * wobbles * (u - 0.8));
  return anim.overshoot * 0.3 * w * w * osc;
}

/**
 * Position progress for one clockwise swap-step. The move phase covers
 * [0, 1-rotateHold] of the cycle; the remaining hold fraction the dot sits
 * at the target. Within the move phase, the ease curve shapes acceleration and
 * the spring adds an elastic landing. Progress can briefly exceed 1 (overshoot)
 * but is exactly 1 at the end of the move phase and throughout the hold, so
 * the loop boundary is seamless.
 */
// rotateHold is stored 0→1; multiply by this to get the actual cycle fraction.
// 1 = the original pre-slider hold (30% of cycle, i.e. move takes 70%).
const ROTATE_HOLD_MAX_FRAC = 0.3;

export function rotateProgress(u: number, anim: AnimationSettings): number {
  const ease = cubicBezier(anim.ease.x1, anim.ease.y1, anim.ease.x2, anim.ease.y2);
  const holdFrac = (anim.rotateHold ?? 0) * ROTATE_HOLD_MAX_FRAC;
  const moveFrac = Math.max(1 - holdFrac, 0.05); // at least 5% for move
  if (u >= moveFrac) return 1; // hold at destination
  const t = u / moveFrac; // normalised 0→1 within the move window
  return ease(t) + rotateSpring(t, anim);
}

/**
 * Scale pulse for an outer dot during the clockwise rotation. The dot shrinks
 * mid-travel and grows back on arrival, giving visible shrink → move → grow
 * phases that overlap continuously. The pulse is normalised to the move window
 * so the dot is at full size throughout any hold. ringShrink controls the dip.
 */
export function ringRotateScale(u: number, anim: AnimationSettings): number {
  if (anim.ringShrink <= 0) return 1;
  const holdFrac = (anim.rotateHold ?? 0) * ROTATE_HOLD_MAX_FRAC;
  const moveFrac = Math.max(1 - holdFrac, 0.05);
  const t = Math.min(u / moveFrac, 1); // clamped: hold phase keeps t=1 → scale=1
  return 1 - anim.ringShrink * Math.sin(Math.PI * t);
}

// --- Easing helpers ---

/** CSS-style cubic-bezier(x1, y1, x2, y2) timing function, solved with Newton. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    x = Math.min(Math.max(x, 0), 1);
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-5) break;
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(t);
  };
}

// --- Core motion ---
//
// One continuous "breath": the ring rushes inward while the center swells to
// receive it (both peak together at PEAK_TIME), then everything reverses and
// expands back out together. A single normalized curve `breath(u)` drives all
// three effects — ring position, ring shrink, and center grow — so they move as
// one. The `ease` curve shapes the timing; with its default (0,0)->(1,1) slopes
// at both ends the turnaround at the peak and the loop seam are velocity-smooth,
// which is what makes it feel fluid rather than mechanical.
const PEAK_TIME = 0.45; // fully collapsed / center fully grown by here; expand after

/**
 * Smooth spring flourish (overshoot + rubberband) added on top of the expand.
 * y is the expand-normalized time in [0,1] (0 = leaving full collapse, 1 =
 * rest). The window sin^2(pi * y^3) is late-biased (peaks near y=0.8) so the
 * spring fires as the dots reach rest — a real outward overshoot past the rest
 * point, not a mid-flight wobble. Being a sin^2 of a function that hits 0 at
 * y=0 and y=1, its VALUE and VELOCITY are both zero at the start of the expand
 * and at the loop seam, so neither develops a velocity kink. Rubberband adds
 * decaying oscillations after that first overshoot. Negative = sprung outward.
 */
function springExpand(y: number, anim: AnimationSettings): number {
  if (anim.overshoot <= 0) return 0;
  const w = Math.sin(Math.PI * y * y * y); // late-biased, 0 (with 0 slope) at both ends
  const wobbles = anim.rubberband * 3; // more rubberband => more settling oscillations
  const osc = Math.cos(2 * Math.PI * wobbles * (y - 0.8)); // aligned so the peak springs out
  return -anim.overshoot * 0.3 * w * w * osc;
}

/**
 * The breath: 0 at rest, rising to 1 at full collapse (PEAK_TIME), back to 0 at
 * the loop seam, dipping <0 as it springs outward past rest on the expand. This
 * ONE curve is shared by the ring position, ring shrink, and center grow so the
 * whole mark moves together. breath(0) === breath(1) === 0 → seamless loop.
 */
function breath(u: number, anim: AnimationSettings): number {
  const ease = cubicBezier(anim.ease.x1, anim.ease.y1, anim.ease.x2, anim.ease.y2);
  if (u <= PEAK_TIME) {
    return ease(u / PEAK_TIME); // 0 -> 1, collapse in as the center grows
  }
  const y = (u - PEAK_TIME) / (1 - PEAK_TIME);
  return 1 - ease(y) + springExpand(y, anim); // 1 -> 0, expand out (with spring)
}

/**
 * Ring collapse amount at normalized cycle time u (0..1).
 *  0  = fully expanded (rest)
 *  1  = fully collapsed onto the center dot
 * <0  = sprung outward past rest (overshoot)
 */
export function collapseProgress(u: number, anim: AnimationSettings): number {
  if (anim.type === "rotate-clockwise") return 0;
  return breath(u, anim) * anim.collapse;
}

/**
 * Scale multiplier for the center dot at normalized cycle time u. The center
 * grows in step with the breath — swelling up to anim.centerGrow as the ring
 * collapses into it, and easing back to rest size as the ring expands out.
 * Coupled to the SAME curve as the ring, so they peak and release together.
 * Clamped at rest size so an overshoot past rest doesn't shrink it below 1.
 */
export function centerScale(u: number, anim: AnimationSettings): number {
  if (anim.type === "rotate-clockwise") {
    return anim.centerMatchRing ? ringRotateScale(u, anim) : 1;
  }
  if (!anim.centerGrowEnabled) return 1;
  const b = Math.min(Math.max(breath(u, anim), 0), 1);
  return 1 + (anim.centerGrow - 1) * b;
}

/**
 * Scale multiplier for an OUTER (ring) dot at cycle time u. The ring dots shrink
 * as they collapse inward — down to (1 - ringShrink) at full collapse — and grow
 * back to rest size as they expand, driven by the same breath as their position
 * so the shrink follows the exact same motion. Shared by preview and export.
 */
export function ringScale(u: number, anim: AnimationSettings): number {
  if (anim.ringShrink <= 0) return 1;
  const b = Math.min(Math.max(breath(u, anim), 0), 1); // clamp so overshoot doesn't enlarge
  return 1 - anim.ringShrink * b;
}

/** Linear interpolate a point from rest toward center by amount c. */
export function collapsedPoint(
  rest: { x: number; y: number },
  center: { x: number; y: number },
  c: number
): { x: number; y: number } {
  return {
    x: rest.x + (center.x - rest.x) * c,
    y: rest.y + (center.y - rest.y) * c,
  };
}
