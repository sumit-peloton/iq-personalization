// Animation model. ONE source of truth for motion: the MOTION registry exposes a
// pure per-dot `sample(u, index, anim)` for each animation type, returning every
// animatable channel (position, scale, opacity, color) at normalized cycle time
// u (0..1). The live SVG preview samples it every frame via rAF, and the Lottie
// exporter bakes it into keyframes — so preview == export.

import { DOTS, toCanvas } from "./dots";

export type AnimationType =
  | "none"
  // Reactive core
  | "thinking-pulse"
  | "heartbeat"
  | "metronome"
  // Feedback moments
  | "celebration"
  | "encouragement"
  | "success"
  // Ambient
  | "idle-breathing"
  | "sleeping"
  // Status
  | "rotate-clockwise"
  | "syncing"
  | "alert";

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
  /** Rotate only: pause at each position before continuing (false = continuous). */
  rotateHold: boolean;
  /**
   * Per-dot phase offset (Primitive A). 0 = all dots move in unison; 1 = the
   * outer dots are evenly staggered across the cycle in OUTER_CLOCKWISE order.
   * Used by sequential states (metronome, and future wave/orbit).
   */
  phaseSpread: number;
  /** Resting opacity multiplier for dimmed states (1 = full). */
  dimOpacity: number;
  /** How far the color shifts toward alertColor at the pulse peak (0 = none). */
  colorShift: number;
  /** Target color for alert/success color shifts, hex "#RRGGBB". */
  alertColor: string;
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
  rotateHold: false,
  phaseSpread: 0,
  dimOpacity: 1,
  colorShift: 0,
  alertColor: "#FF3B30",
};

export const ANIMATIONS: { value: AnimationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "thinking-pulse", label: "Thinking / Pulse" },
  { value: "heartbeat", label: "Heartbeat" },
  { value: "metronome", label: "Metronome" },
  { value: "celebration", label: "Celebration" },
  { value: "encouragement", label: "Encouragement" },
  { value: "success", label: "Success" },
  { value: "idle-breathing", label: "Idle Breathing" },
  { value: "sleeping", label: "Sleeping" },
  { value: "rotate-clockwise", label: "Rotate Clockwise" },
  { value: "syncing", label: "Syncing" },
  { value: "alert", label: "Alert" },
];

/** Index of the center dot in DOTS (the one the ring collapses onto). */
export const CENTER_INDEX = 3;

// --- Character body map ---
//
// The 6 dots also read as a little figure — a workout buddy — which is the
// lens the "alive" states animate through (a head that bobs, arms that swing,
// legs that plant), rather than an abstract ring:
//
//           0            head
//       1       2        arms
//           3            body / torso  (== CENTER_INDEX)
//       4       5        legs
export const HEAD_INDEX = 0;
export const BODY_INDEX = CENTER_INDEX; // torso — the figure's core
export const ARM_INDICES: readonly number[] = [1, 2];
export const LEG_INDICES: readonly number[] = [4, 5];
const isArm = (i: number) => i === 1 || i === 2;

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
// When hold is enabled, the move phase takes this fraction of the cycle;
// the remaining 30% the dot sits at the target position.
const ROTATE_MOVE_FRAC = 0.7;

export function rotateProgress(u: number, anim: AnimationSettings): number {
  const ease = cubicBezier(anim.ease.x1, anim.ease.y1, anim.ease.x2, anim.ease.y2);

  if (!anim.rotateHold) {
    // Continuous: blend the curve with linear using a tent weight (1 − |2u−1|).
    // Weight is 0 at u=0 and u=1 (pure linear → velocity-continuous loop) and
    // 1 at u=0.5 (full curve influence at mid-cycle). This lets the Curve editor
    // shape the rhythm — faster/slower through the midpoint — without introducing
    // any velocity kink at the loop boundary.
    const blend = 1 - Math.abs(2 * u - 1);
    const shaped = u + (ease(u) - u) * blend;
    return shaped + rotateSpring(u, anim);
  }

  // Hold: ease into the target, then pause for the remaining 30% of the cycle.
  if (u >= ROTATE_MOVE_FRAC) return 1;
  const t = u / ROTATE_MOVE_FRAC;
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
  // Continuous: scale pulse runs over the full cycle (sin(πu) is zero at both
  // endpoints so the loop is seamless and the pulse is symmetric).
  // Hold: compress the pulse into the move window; full size during the hold.
  const t = anim.rotateHold ? Math.min(u / ROTATE_MOVE_FRAC, 1) : u;
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

// --- Primitive A: per-dot phase offset ---
//
// SEAM SAFETY: if a base motion f(u) already loops seamlessly (equal value AND
// velocity at u=0 and u=1), then f(mod1(u + φ)) does too — a constant phase
// shift φ just slides the same seamless loop, so no velocity kink is introduced
// at the boundary. This holds for any constant φ, so per-dot staggering composes
// with the existing seam guarantee for free (provided the base curve is clean).

const mod1 = (x: number) => x - Math.floor(x);

/**
 * Phase offset for a dot, in cycle fractions. The center dot (not in the ring)
 * never offsets. Outer dots offset by their position in OUTER_CLOCKWISE, scaled
 * by phaseSpread. The offset is NEGATIVE so that, as u increases, the dots reach
 * their pulse peak in clockwise order (5 → 4 → 1 → 0 → 2). phaseSpread=0 yields
 * 0 for every dot (unison — backward compatible).
 */
export function phaseOffset(index: number, anim: AnimationSettings): number {
  const k = OUTER_CLOCKWISE.indexOf(index); // -1 for the center dot
  if (k < 0) return 0;
  return -(k / OUTER_CLOCKWISE.length) * anim.phaseSpread;
}

/** A dot's phase-shifted cycle time. dotU(1,i) === dotU(0,i), so loops stay seamless. */
export function dotU(u: number, index: number, anim: AnimationSettings): number {
  return mod1(u + phaseOffset(index, anim));
}

// --- Primitive B channels + the per-dot sampler ---

/**
 * One sample of everything animatable for a single dot at cycle time u.
 * ONE sampler feeds both the SVG preview and the Lottie bake, so preview ==
 * export for every channel — position, scale, opacity, and color.
 */
export type DotSample = {
  /** Canvas-space position (already toCanvas'd). */
  pos: { x: number; y: number };
  /** Scale multiplier (1 = rest). Uniform unless `squash` is set. */
  scale: number;
  /** Opacity multiplier 0..1 (1 = full). Multiplies both the dot fill and its halo. */
  opacity: number;
  /** How far this dot's color has shifted toward anim.alertColor (0 = base). */
  colorMix: number;
  /**
   * Signed squash & stretch (default 0). >0 = stretched taller and narrower,
   * <0 = squashed shorter and wider. Rides the scale channel via dotScaleXY.
   */
  squash?: number;
  /**
   * Glow-intensity boost for effort coupling (default 0). >0 brightens this
   * dot's halo (a bloom), leaving the solid dot untouched.
   */
  glow?: number;
};

/**
 * A motion type's behaviour, expressed as a pure per-dot sampler. `animates`
 * declares which channels this type ever moves, so the Lottie baker can keep
 * emitting cheap static props for the rest (and a channel that samples constant
 * is collapsed to a static prop anyway — see generateLottie). `glow` is optional
 * (defaults false); squash rides the scale channel so it needs no separate flag.
 */
export type MotionModel = {
  animates: { pos: boolean; scale: boolean; opacity: boolean; color: boolean; glow?: boolean };
  sample(u: number, index: number, anim: AnimationSettings): DotSample;
};

function restSample(index: number): DotSample {
  return { pos: toCanvas(DOTS[index]), scale: 1, opacity: 1, colorMix: 0 };
}

/** Gain from a sample's `glow` boost to a halo-intensity multiplier (clamped in haloStops). */
const GLOW_GAIN = 1.2;

/** Per-dot scale resolved into [x, y] fractions, applying squash & stretch. */
export function dotScaleXY(sd: DotSample): [number, number] {
  const q = sd.squash ?? 0;
  return [sd.scale * (1 - q), sd.scale * (1 + q)];
}

/** Halo brightness multiplier for a sample's effort `glow` (1 = base). */
export function haloBoost(sd: DotSample): number {
  return 1 + GLOW_GAIN * (sd.glow ?? 0);
}

// --- Shared envelopes for the new states (all seam-clean: value AND velocity
//     are zero at u=0 and u=1 unless noted) ---

/**
 * An ASYMMETRIC breath: rises 0 → 1 over [0, peak], falls 1 → 0 over [peak, 1].
 * Both halves are raised cosines, so VALUE and VELOCITY are zero at u=0, u=peak
 * and u=1 — fully C¹, hence seam-clean AND smooth through the crest. With
 * peak<0.5 the inhale is quicker than the exhale (a natural sigh), which reads
 * far more alive than a symmetric cosine swell. Composing with mod1(u+φ) keeps
 * it seam-clean, so it can be phase-shifted per dot for a travelling wave.
 */
function breathEnv(u: number, peak = 0.4): number {
  if (u <= peak) return (1 - Math.cos((Math.PI * u) / peak)) / 2;
  return (1 + Math.cos((Math.PI * (u - peak)) / (1 - peak))) / 2;
}

/**
 * A single asymmetric hump confined to [a, b] (0 outside). sin²(π·x) has zero
 * value AND slope at x=0 and x=1, so the hump joins the flat 0 regions cleanly.
 */
function hump(u: number, a: number, b: number): number {
  if (u <= a || u >= b) return 0;
  return Math.sin(Math.PI * ((u - a) / (b - a))) ** 2;
}

/** Two quick thumps early in the cycle (systole/diastole), flat afterward. */
function doubleThump(u: number): number {
  return hump(u, 0.04, 0.2) + 0.75 * hump(u, 0.24, 0.4);
}

// --- Character-motion kit ---
//
// Reusable body-move envelopes shared by the "alive" states, all seam-clean
// (value AND velocity zero at u=0 and u=1). Amplitudes live with each state; these
// return normalized shapes so the same move reads consistently everywhere.

const JUMP_CROUCH = 0.3; // anticipation dip before launch, as a fraction of hop height
const JUMP_REBOUND = 0.15; // little rebound after landing, same units
const PUMP_COUNT = 2; // arm pumps per cycle (even → seam-clean)
const SHUDDER_FREQ = 4; // oscillations in an alert shudder

/**
 * A jump: anticipation crouch → airborne arc → land → small rebound. Positive =
 * airborne (up). Built from humps that are all 0 (slope 0) at the seam, so the
 * figure starts and ends planted — correct for a one-shot that the tuner loops.
 */
function hop(u: number): number {
  return (
    hump(u, 0.12, 0.72) - // airborne arc (peaks ~0.42)
    JUMP_CROUCH * hump(u, 0, 0.16) + // wind-up crouch
    JUMP_REBOUND * hump(u, 0.74, 1) // landing rebound
  );
}

/**
 * PUMP_COUNT even pumps across the cycle (each a rise-and-fall). (1−cos)/2 over an
 * integer number of periods is 0 with 0 slope at both u=0 and u=1 → seam-clean.
 */
function pump(u: number): number {
  return (1 - Math.cos(2 * Math.PI * PUMP_COUNT * u)) / 2;
}

/**
 * Raise → hold → lower: 0 (slope 0) at the seam, a flat 1 across [rise, fall].
 * For "strike a pose and hold it" moves (arms up in a V) that still loop clean.
 */
function plateau(u: number, rise = 0.25, fall = 0.75): number {
  if (u < rise) return (1 - Math.cos((Math.PI * u) / rise)) / 2;
  if (u > fall) return (1 + Math.cos((Math.PI * (u - fall)) / (1 - fall))) / 2;
  return 1;
}

/**
 * A damped left-right shudder confined to the first ~0.6 of the cycle (0 after).
 * The hump envelope has zero value+slope at both ends and the sine is windowed by
 * it, so the flinch fires once and settles without a seam kink.
 */
function shudder(u: number): number {
  return hump(u, 0, 0.6) * Math.sin(2 * Math.PI * SHUDDER_FREQ * u);
}

/** Outward horizontal sign for a dot relative to the torso (−1 left, +1 right). */
function outwardX(rest: { x: number }): number {
  return Math.sign(rest.x - toCanvas(DOTS[BODY_INDEX]).x) || 1;
}

/**
 * Travel along an ARC toward a target displacement (tx, ty) by fraction r, bowing
 * `bow` px perpendicular to the straight line. The bow is sin(π·r) — 0 at r=0 and
 * r=1 — so limbs sweep on a curve but still hit rest and the pose exactly, and the
 * whole thing stays seam-clean when r is (r'=0 at the seam ⇒ the bow's slope is 0
 * there too). Positive bow curves toward the (−ty, tx) side; flip the sign to bow
 * the other way.
 */
function arc(tx: number, ty: number, r: number, bow: number): { dx: number; dy: number } {
  const len = Math.hypot(tx, ty) || 1;
  const b = bow * Math.sin(Math.PI * r);
  return { dx: tx * r + (-ty / len) * b, dy: ty * r + (tx / len) * b };
}

/**
 * Shared clockwise-rotation sampler. Used by both "rotate-clockwise" and
 * "syncing" (syncing is just a slow rotate). Computes the center scale directly
 * so it doesn't depend on the animation type.
 */
function rotateSample(u: number, index: number, anim: AnimationSettings): DotSample {
  const rest = toCanvas(DOTS[index]);
  if (index === CENTER_INDEX) {
    const scale = anim.centerMatchRing ? ringRotateScale(u, anim) : 1;
    return { pos: rest, scale, opacity: 1, colorMix: 0 };
  }
  const target = toCanvas(DOTS[clockwiseTarget(index)]);
  const rp = rotateProgress(u, anim);
  return {
    pos: { x: rest.x + (target.x - rest.x) * rp, y: rest.y + (target.y - rest.y) * rp },
    scale: ringRotateScale(u, anim),
    opacity: 1,
    colorMix: 0,
  };
}

// Character-move amplitudes (px unless noted). Tuned against the ~22px torso→head
// distance: idle is a few px; expressive states swing 5–10px.
const CELEB_JUMP = 9; // hop height
const CELEB_ARM_RAISE = 8; // arms thrown up
const CELEB_ARM_OUT = 3; // arms out into a V
const CELEB_ARM_BOW = 1; // barely-there arm curve — enough to read as a sweep, not a flail
const CELEB_LEG_TUCK = 4; // feet tuck up mid-air
const CELEB_LEG_BOW = 0.5; // barely-there leg curve
const CELEB_POP = 0.09; // scale pop at the apex
const CELEB_STRETCH = 0; // no dot-deformation — squashing the round dots reads cartoonish on this mark
const CELEB_SQUASH = 0; // same; life comes from follow-through + arc + pop/glow instead
const CELEB_GLOW = 0.75; // halo bloom at the apex
const CELEB_DRAG_HEAD = 0.02; // slight follow-through so the leap isn't rigid
const CELEB_DRAG_ARM = 0.03; // arms trail a touch more

const ENC_ARM_PUMP = 8; // fist-pump travel
const ENC_BODY_BOUNCE = 2.5; // body bounces with each pump
const ENC_POP = 0.06; // body scale bump per pump
const ENC_SQUASH = 0.04; // body squashes down as the arms punch up (subtle)
const ENC_GLOW = 0.7; // halo pulses with each pump

const HEART_GLOW = 0.9; // halo brightens on each beat

const MARCH_LIFT = 5; // foot lift height
const MARCH_ARM = 3; // opposite-arm swing
const MARCH_BODY_BOB = 1.5; // torso bob per step

const HEART_SYMPATHY = 2.5; // head/limbs pulse outward on each beat

const SUCCESS_ARM_RAISE = 8; // arms up into a held V
const SUCCESS_ARM_OUT = 3.5;
const SUCCESS_ARM_BOW = 3; // arc bow on the arm raise
const SUCCESS_LIFT = 2; // torso/head lift while holding
const SUCCESS_POP = 0.05;
const SUCCESS_GLOW = 0.8; // halo blooms while the pose is held

const ALERT_SHUDDER = 3; // horizontal flinch travel
const ALERT_LEG_ROOT = 0.3; // legs shudder less (planted)

const SLEEP_HEAD_DROOP = 3; // head hangs forward/down
const SLEEP_ARM_DROOP = 1.5; // arms hang limp
const SLEEP_BREATH = 0.9; // slow shallow breath rise
const SLEEP_BODY_SCALE = 0.03;

// --- "Alive" idle stance (character reading) ---
// A standing figure that never freezes: it breathes, shifts its weight, bobs
// its head and lets its arms hang and sway. Amplitudes are small (a few px) and
// legs stay planted so it reads grounded, not floaty. All drivers are seam-clean.
const IDLE_BREATH_RISE = 1.3; // px the upper body lifts on the inhale
const IDLE_BODY_SCALE = 0.05; // torso "chest expand" on the inhale
const IDLE_SWAY = 1.5; // px horizontal weight shift, left↔right
const IDLE_HEAD_BOB = 0.9; // px extra head bob, trailing the breath
const IDLE_HEAD_LAG = 0.08; // head follows the breath this fraction of a cycle late
const IDLE_ARM_SWING = 1.3; // px arm pendulum on top of the weight shift
const IDLE_ARM_LAG = 0.12; // arms trail the body's sway (pendulum follow-through)
const IDLE_LEG_ROOT = 0.15; // legs barely shift — planted feet keep it grounded

/**
 * The living resting pose. Reads as a little figure standing and breathing:
 *  - torso breathes (asymmetric inhale/exhale) and rides a slow weight shift,
 *  - head lifts with the breath plus a trailing bob (follow-through),
 *  - arms hang and swing as pendulums that lag the body's sway (overlapping
 *    action), so the mark never pulses as one rigid blob,
 *  - legs stay planted for grounding.
 * Every driver — breathEnv, sin(2πu) — is seam-clean, so the loop is smooth.
 */
function idleStance(u: number, index: number): DotSample {
  const rest = toCanvas(DOTS[index]);
  const breath = breathEnv(u); // 0→1→0, quicker inhale than exhale
  const sway = Math.sin(2 * Math.PI * u); // weight shift L↔R (2π-periodic → seam-clean)
  let dx = 0;
  let dy = 0;
  let scale = 1;

  if (index === BODY_INDEX) {
    dx = IDLE_SWAY * sway;
    dy = -IDLE_BREATH_RISE * 0.5 * breath;
    scale = 1 + IDLE_BODY_SCALE * breath;
  } else if (index === HEAD_INDEX) {
    const bob = breathEnv(mod1(u - IDLE_HEAD_LAG));
    dx = IDLE_SWAY * sway;
    dy = -IDLE_BREATH_RISE * breath - IDLE_HEAD_BOB * bob;
    scale = 1 + IDLE_BODY_SCALE * 0.6 * breath;
  } else if (isArm(index)) {
    const swingA = Math.sin(2 * Math.PI * (u - IDLE_ARM_LAG)); // trailing pendulum
    dx = IDLE_SWAY * sway + IDLE_ARM_SWING * swingA;
    dy = -IDLE_BREATH_RISE * 0.7 * breath; // shoulders rise with the breath
  } else {
    // Legs: planted. The feet barely track the weight shift.
    dx = IDLE_SWAY * IDLE_LEG_ROOT * sway;
  }

  return { pos: { x: rest.x + dx, y: rest.y + dy }, scale, opacity: 1, colorMix: 0 };
}

// --- The registry: one entry per AnimationType ---

export const MOTION: Record<AnimationType, MotionModel> = {
  none: {
    animates: { pos: false, scale: false, opacity: false, color: false },
    sample: (_u, index) => restSample(index),
  },

  "thinking-pulse": {
    animates: { pos: true, scale: true, opacity: false, color: false },
    sample: (u, index, anim) => {
      const rest = toCanvas(DOTS[index]);
      if (index === CENTER_INDEX) {
        return { pos: rest, scale: centerScale(u, anim), opacity: 1, colorMix: 0 };
      }
      const center = toCanvas(DOTS[CENTER_INDEX]);
      const c = collapseProgress(u, anim);
      return { pos: collapsedPoint(rest, center, c), scale: ringScale(u, anim), opacity: 1, colorMix: 0 };
    },
  },

  "rotate-clockwise": {
    animates: { pos: true, scale: true, opacity: false, color: false },
    sample: rotateSample,
  },

  // Slow rotate — a determinate/indeterminate spinner for loading & syncing.
  syncing: {
    animates: { pos: true, scale: true, opacity: false, color: false },
    sample: rotateSample,
  },

  // Marches in place as a cadence guide: legs alternate (left then right), arms
  // swing opposite like a natural gait, torso bobs on each step. Left leg lifts
  // in the first half, right in the second; opposite arm leads each stride.
  metronome: {
    animates: { pos: true, scale: false, opacity: false, color: false },
    sample: (u, index) => {
      const rest = toCanvas(DOTS[index]);
      let dy = 0;
      if (index === 4) dy = -MARCH_LIFT * hump(u, 0, 0.5); // left foot
      else if (index === 5) dy = -MARCH_LIFT * hump(u, 0.5, 1); // right foot
      else if (index === 2) dy = -MARCH_ARM * hump(u, 0, 0.5); // right arm w/ left leg
      else if (index === 1) dy = -MARCH_ARM * hump(u, 0.5, 1); // left arm w/ right leg
      else dy = -MARCH_BODY_BOB * (hump(u, 0, 0.5) + hump(u, 0.5, 1)); // head + torso bob
      return { pos: { x: rest.x, y: rest.y + dy }, scale: 1, opacity: 1, colorMix: 0 };
    },
  },

  // A double-thump at the core, sized to effort (centerGrow). Head and limbs give
  // a small sympathetic pulse OUTWARD on each beat, so the whole figure feels the
  // heartbeat rather than one dot pulsing alone.
  heartbeat: {
    animates: { pos: true, scale: true, opacity: false, color: false, glow: true },
    sample: (u, index, anim) => {
      const rest = toCanvas(DOTS[index]);
      const beat = doubleThump(u);
      if (index === BODY_INDEX) {
        return { pos: rest, scale: 1 + (anim.centerGrow - 1) * beat, opacity: 1, colorMix: 0, glow: HEART_GLOW * beat };
      }
      const center = toCanvas(DOTS[BODY_INDEX]);
      let dx = rest.x - center.x;
      let dy = rest.y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      return {
        pos: { x: rest.x + dx * HEART_SYMPATHY * beat, y: rest.y + dy * HEART_SYMPATHY * beat },
        scale: 1,
        opacity: 1,
        colorMix: 0,
        glow: HEART_GLOW * 0.5 * beat,
      };
    },
  },

  // The payoff: the figure JUMPS — anticipation crouch, arms thrown up into a V,
  // feet tucking mid-air, a scale pop at the apex, then a rebound landing. Starts
  // and ends planted so it reads as a one-shot even though the tuner loops it.
  celebration: {
    animates: { pos: true, scale: true, opacity: false, color: false, glow: true },
    sample: (u, index) => {
      const rest = toCanvas(DOTS[index]);
      // Head and arms TRAIL the torso's jump (follow-through) via a small phase lag.
      const lag = index === HEAD_INDEX ? CELEB_DRAG_HEAD : isArm(index) ? CELEB_DRAG_ARM : 0;
      const air = hop(mod1(u - lag));
      let dx = 0;
      let dy = -CELEB_JUMP * air; // the whole figure rides the jump
      const scale = 1 + CELEB_POP * Math.max(air, 0);
      // Squash & stretch: tall on launch, wide on the crouch and the landing.
      const squash =
        CELEB_STRETCH * hump(u, 0.12, 0.45) -
        CELEB_SQUASH * (hump(u, 0, 0.16) + hump(u, 0.66, 0.82));
      if (isArm(index)) {
        const raise = hump(u, 0.1, 0.7);
        const a = arc(outwardX(rest) * CELEB_ARM_OUT, -CELEB_ARM_RAISE, raise, CELEB_ARM_BOW);
        dx += a.dx;
        dy += a.dy;
      } else if (index === 4 || index === 5) {
        const tuck = hump(u, 0.15, 0.65);
        const a = arc(-outwardX(rest) * 1.5, -CELEB_LEG_TUCK, tuck, CELEB_LEG_BOW); // feet up & slightly in
        dx += a.dx;
        dy += a.dy;
      }
      return { pos: { x: rest.x + dx, y: rest.y + dy }, scale, squash, opacity: 1, colorMix: 0, glow: CELEB_GLOW * Math.max(air, 0) };
    },
  },

  // "Let's go!" — a rhythmic fist pump. Arms drive up on each pump, the body
  // bounces and pops slightly in time; legs stay planted.
  encouragement: {
    animates: { pos: true, scale: true, opacity: false, color: false, glow: true },
    sample: (u, index) => {
      const rest = toCanvas(DOTS[index]);
      const p = pump(u);
      let dy = 0;
      let scale = 1;
      let squash = 0;
      if (isArm(index)) {
        dy = -ENC_ARM_PUMP * p; // arms punch up
      } else if (index === BODY_INDEX || index === HEAD_INDEX) {
        dy = -ENC_BODY_BOUNCE * p;
        scale = 1 + ENC_POP * p;
        squash = -ENC_SQUASH * p; // body compresses as it drives the pump
      }
      return { pos: { x: rest.x, y: rest.y + dy }, scale, squash, opacity: 1, colorMix: 0, glow: ENC_GLOW * p };
    },
  },

  // Workout complete: arms rise into a held V while the figure lifts and brightens
  // toward the success color, then eases back. Loop-safe (rest at both ends).
  success: {
    animates: { pos: true, scale: true, opacity: false, color: true, glow: true },
    sample: (u, index, anim) => {
      const rest = toCanvas(DOTS[index]);
      const h = plateau(u);
      const colorMix = anim.colorShift * h;
      let dx = 0;
      let dy = 0;
      let scale = 1;
      if (isArm(index)) {
        const a = arc(outwardX(rest) * SUCCESS_ARM_OUT, -SUCCESS_ARM_RAISE, h, SUCCESS_ARM_BOW);
        dx = a.dx;
        dy = a.dy;
      } else if (index === BODY_INDEX || index === HEAD_INDEX) {
        dy = -SUCCESS_LIFT * h;
        scale = 1 + SUCCESS_POP * h;
      }
      return { pos: { x: rest.x + dx, y: rest.y + dy }, scale, opacity: 1, colorMix, glow: SUCCESS_GLOW * h };
    },
  },

  // A living resting stance — the figure breathes, shifts its weight, bobs its
  // head and lets its arms swing, feet planted. Replaces "none" as the default.
  "idle-breathing": {
    animates: { pos: true, scale: true, opacity: false, color: false },
    sample: (u, index) => idleStance(u, index),
  },

  // Slumped and dozing: the head droops forward, arms hang limp, and a slow
  // shallow breath rises through the torso — all dimmed by dimOpacity.
  sleeping: {
    animates: { pos: true, scale: true, opacity: true, color: false },
    sample: (u, index, anim) => {
      const rest = toCanvas(DOTS[index]);
      const breath = breathEnv(u);
      let dy = 0;
      let scale = 1;
      if (index === HEAD_INDEX) {
        dy = SLEEP_HEAD_DROOP + SLEEP_BREATH * breath; // droops down (screen +y)
      } else if (isArm(index)) {
        dy = SLEEP_ARM_DROOP + SLEEP_BREATH * 0.5 * breath;
      } else if (index === BODY_INDEX) {
        dy = SLEEP_BREATH * 0.5 * breath;
        scale = 1 + SLEEP_BODY_SCALE * breath;
      }
      return { pos: { x: rest.x, y: rest.y + dy }, scale, opacity: anim.dimOpacity, colorMix: 0 };
    },
  },

  // Attention needed (lost strap, dropped connection): the figure flinches — a
  // quick damped left-right shudder — and flashes toward alertColor. Legs stay
  // rooted so it reads as a startle, not a slide.
  alert: {
    animates: { pos: true, scale: false, opacity: false, color: true },
    sample: (u, index, anim) => {
      const rest = toCanvas(DOTS[index]);
      const root = index === 4 || index === 5 ? ALERT_LEG_ROOT : 1;
      const dx = ALERT_SHUDDER * root * shudder(u);
      return {
        pos: { x: rest.x + dx, y: rest.y },
        scale: 1,
        opacity: 1,
        colorMix: anim.colorShift * hump(u, 0, 0.5),
      };
    },
  },
};
