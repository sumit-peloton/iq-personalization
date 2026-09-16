// Animation model. ONE source of truth for motion: `collapseProgress(u, anim)`
// returns how far the ring dots have collapsed toward the center at normalized
// cycle time u (0..1). The live SVG preview samples it every frame via rAF, and
// the Lottie exporter bakes it into position keyframes — so preview == export.

export type AnimationType = "none" | "thinking-pulse";

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
  /** Size multiplier the center dot grows to at full collapse (1 = no growth). */
  centerGrow: number;
  /** Cubic-bezier timing curve for the center grow ramp (shrink mirrors it). */
  centerEase: EaseCurve;
};

export const DEFAULT_ANIMATION: AnimationSettings = {
  type: "none",
  speed: 1.0,
  ease: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
  overshoot: 0.25,
  rubberband: 0.3,
  collapse: 1,
  centerGrow: 1.6,
  centerEase: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
};

export const ANIMATIONS: { value: AnimationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "thinking-pulse", label: "Thinking / Pulse" },
];

/** Index of the center dot in DOTS (the one the ring collapses onto). */
export const CENTER_INDEX = 3;

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
// One cycle runs in four beats: collapse in -> center grows -> center shrinks
// -> expand out. The ring holds fully collapsed through the two middle beats
// while only the center dot pulses; then it springs back out.
const COLLAPSE_END = 0.33; // ring is fully collapsed by here
const HOLD_END = 0.67; // center grow+shrink pulse done by here; expand runs after

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
 * Ring collapse amount at normalized cycle time u (0..1).
 *  0  = fully expanded (rest)
 *  1  = fully collapsed onto the center dot
 * <0  = sprung outward past rest (overshoot)
 *
 * Beats: collapse in over [0, COLLAPSE_END]; hold fully collapsed over
 * [COLLAPSE_END, HOLD_END] while the center pulses; expand out over
 * [HOLD_END, 1] (with the spring). Eased ends make each transition
 * velocity-smooth, and collapseProgress(0) === (1) === 0, so the loop is seamless.
 */
export function collapseProgress(u: number, anim: AnimationSettings): number {
  const ease = cubicBezier(anim.ease.x1, anim.ease.y1, anim.ease.x2, anim.ease.y2);

  if (u <= COLLAPSE_END) {
    return ease(u / COLLAPSE_END) * anim.collapse; // 0 -> 1, collapse in
  }
  if (u <= HOLD_END) {
    return anim.collapse; // held fully collapsed while the center grows/shrinks
  }
  const y = (u - HOLD_END) / (1 - HOLD_END);
  return (1 - ease(y) + springExpand(y, anim)) * anim.collapse; // 1 -> 0, expand out
}

/**
 * Scale multiplier for the center dot at normalized cycle time u. The center
 * holds its rest size (1) through the collapse and expand, and only grows —
 * up to anim.centerGrow and back — during the hold beat [COLLAPSE_END, HOLD_END],
 * i.e. once all the outer dots have collapsed into it. The grow ramp is shaped
 * by the centerEase curve; the shrink half is that same curve mirrored in time.
 * Shared by the preview and the Lottie exporter.
 */
export function centerScale(u: number, anim: AnimationSettings): number {
  if (u <= COLLAPSE_END || u >= HOLD_END) return 1;
  const h = (u - COLLAPSE_END) / (HOLD_END - COLLAPSE_END); // 0..1 across the hold
  const ease = cubicBezier(anim.centerEase.x1, anim.centerEase.y1, anim.centerEase.x2, anim.centerEase.y2);
  // First half grows 0->1 via the curve; second half shrinks 1->0 mirrored.
  const pulse = h <= 0.5 ? ease(h / 0.5) : ease((1 - h) / 0.5);
  return 1 + (anim.centerGrow - 1) * pulse;
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
