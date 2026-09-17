// Builds a real Lottie/bodymovin animation from GlowSettings.
//
// WHY IT LOOKS LIKE THIS: lottie-android does NOT render After Effects
// glow/blur filter effects. So the glow is faked with primitives Android
// renders reliably: a solid ellipse per dot (el + fl) plus a larger ellipse
// per dot filled with a RADIAL gradient (el + gf, t:2) that fades from the
// glow color at the center to transparent at the edge. The web preview draws
// the exact same radial gradient, so preview == export.
//
// MOTION: every animated channel is BAKED. We sample the shared per-dot
// MOTION[type].sample() across frames of one cycle and emit a keyframe per
// sample for each channel (position, scale, opacity, color). Baking (rather
// than translating springs into bezier handles) guarantees the export matches
// the JS-driven preview exactly, no matter how complex the motion is. A channel
// whose samples never change is collapsed to a static property to keep the file
// lean.

import { CANVAS, DOTS, DOT_R, toCanvas } from "../model/dots";
import { dotColor, haloRadius, haloStops } from "../model/geometry";
import { hexToRgb01, mixHex } from "../model/color";
import { FPS, MOTION, cycleFrames } from "../model/animation";
import type { AnimationSettings, DotSample } from "../model/animation";
import type { GlowSettings } from "../model/settings";
import type {
  ColorKeyframe,
  ColorProp,
  GradientArrayKeyframe,
  GradientArrayProp,
  LottieAnimation,
  ScalarKeyframe,
  ScalarProp,
  ShapeGroup,
  ShapeLayer,
  SolidFill,
  Transform,
  Vec2Keyframe,
  Vec2Prop,
} from "./types";

const LINEAR_OUT = { x: [0], y: [0] };
const LINEAR_IN = { x: [1], y: [1] };

function identityLayerTransform(): Transform {
  return {
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
  };
}

const STATIC_SCALE: Vec2Prop = { a: 0, k: [100, 100] };
const STATIC_OPACITY: ScalarProp = { a: 0, k: 100 };

/**
 * Group transform placing a shape (built at local [0,0]) at a canvas position.
 * `scale` (percent) may be animated; the anchor is [0,0] and shapes are centered
 * there, so scaling grows the shape in place.
 */
function groupTransform(pos: Vec2Prop, scale: Vec2Prop = STATIC_SCALE): Transform {
  return {
    ty: "tr",
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    p: pos,
    a: { a: 0, k: [0, 0] },
    s: scale,
  };
}

/** A solid dot: ellipse (diameter = 2*DOT_R) filled with the (tinted) dot color. */
export function buildDotGroup(
  pos: Vec2Prop,
  s: GlowSettings,
  scale?: Vec2Prop,
  opacity: ScalarProp = STATIC_OPACITY,
  color?: ColorProp,
): ShapeGroup {
  const d = 2 * DOT_R;
  const { r: cr, g: cg, b: cb } = hexToRgb01(dotColor(s));
  const fill: SolidFill = {
    ty: "fl",
    c: color ?? { a: 0, k: [cr, cg, cb, 1] },
    o: opacity,
    r: 1,
    bm: 0,
  };
  return {
    ty: "gr",
    nm: "dot",
    it: [
      { ty: "el", d: 1, s: { a: 0, k: [d, d] }, p: { a: 0, k: [0, 0] } },
      fill,
      groupTransform(pos, scale),
    ],
  };
}

/**
 * A radial-gradient halo behind a dot.
 *
 * Gradient stop packing (the critical bit): g.k.k is a flat number array.
 * COLOR stops come first, each as [offset, r, g, b] (4 numbers), repeated g.p
 * times. ALPHA stops are appended AFTER, each as [offset, alpha] (2 numbers).
 * g.p is the count of COLOR stops only. Driven by the same haloStops() used by
 * the SVG preview so preview == export. `gradient` (when supplied) may itself be
 * animated for color-shifting states; the dot's opacity rides on gf.o.
 */
export function buildHaloGroup(
  pos: Vec2Prop,
  s: GlowSettings,
  scale?: Vec2Prop,
  opacity: ScalarProp = STATIC_OPACITY,
  gradientArray?: { p: number; k: GradientArrayProp },
): ShapeGroup {
  const r = haloRadius(s);
  const d = 2 * r;
  const packed = gradientArray ?? staticGradientArray(s);

  const gradient = {
    ty: "gf" as const,
    t: 2 as const, // radial
    o: opacity,
    s: { a: 0 as const, k: [0, 0] as [number, number] }, // center (local coords)
    e: { a: 0 as const, k: [r, 0] as [number, number] }, // |e - s| = halo radius
    g: packed,
    r: 1 as const,
    bm: 0 as const,
  };

  return {
    ty: "gr",
    nm: "halo",
    it: [
      { ty: "el", d: 1, s: { a: 0, k: [d, d] }, p: { a: 0, k: [0, 0] } },
      gradient,
      groupTransform(pos, scale),
    ],
  };
}

function buildLayer(nm: string, ind: number, shapes: ShapeGroup[], op: number): ShapeLayer {
  return {
    ty: 4,
    nm,
    ind,
    ddd: 0,
    ao: 0,
    bm: 0,
    sr: 1,
    ip: 0,
    op,
    st: 0,
    ks: identityLayerTransform(),
    shapes,
  };
}

// --- Baking infrastructure ---
//
// Sample the shared per-dot motion model across one cycle, then build a keyframe
// stream per channel. A channel whose samples never vary collapses to a static
// property (matching — and generalising — the old per-type static guards), so
// the file stays lean and preview == export is guaranteed by construction.

const EPS = 1e-4;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;

type DotCycle = { times: number[]; total: number; samples: DotSample[] };

/** Frame timestamps for one baked cycle (dense enough to capture springs). */
function frameTimes(anim: AnimationSettings): { times: number[]; total: number } {
  const total = cycleFrames(anim);
  const step = Math.max(1, Math.round(total / 60));
  const times: number[] = [];
  for (let f = 0; f <= total; f += step) {
    if (f > total) break;
    times.push(f);
  }
  // Ensure the final frame lands exactly on `total` for a seamless loop.
  if (times[times.length - 1] !== total) times.push(total);
  return { times, total };
}

/** Sample every channel of one dot across the cycle. */
function sampleDot(index: number, s: GlowSettings): DotCycle {
  const anim = s.animation;
  const { times, total } = frameTimes(anim);
  const samples = times.map((t) => MOTION[anim.type].sample(t / total, index, anim));
  return { times, total, samples };
}

function stripEnds<T extends { o?: unknown; i?: unknown }>(keys: T[]): T[] {
  // The last keyframe carries no outgoing tangent (it IS the loop seam).
  const last = keys[keys.length - 1];
  delete last.o;
  delete last.i;
  return keys;
}

function vec2Prop(times: number[], vals: [number, number][]): Vec2Prop {
  if (vals.every((v) => near(v[0], vals[0][0]) && near(v[1], vals[0][1]))) {
    return { a: 0, k: vals[0] };
  }
  const keys: Vec2Keyframe[] = times.map((t, idx) => ({
    t,
    s: vals[idx],
    o: LINEAR_OUT,
    i: LINEAR_IN,
  }));
  return { a: 1, k: stripEnds(keys) };
}

function scalarProp(times: number[], vals: number[]): ScalarProp {
  if (vals.every((v) => near(v, vals[0]))) return { a: 0, k: vals[0] };
  const keys: ScalarKeyframe[] = times.map((t, idx) => ({
    t,
    s: [vals[idx]],
    o: LINEAR_OUT,
    i: LINEAR_IN,
  }));
  return { a: 1, k: stripEnds(keys) };
}

type Rgba = [number, number, number, number];

function colorProp(times: number[], vals: Rgba[]): ColorProp {
  if (vals.every((c) => c.every((x, idx) => near(x, vals[0][idx])))) {
    return { a: 0, k: vals[0] };
  }
  const keys: ColorKeyframe[] = times.map((t, idx) => ({
    t,
    s: vals[idx],
    o: LINEAR_OUT,
    i: LINEAR_IN,
  }));
  return { a: 1, k: stripEnds(keys) };
}

function gradientArrayProp(times: number[], vals: number[][]): GradientArrayProp {
  if (vals.every((a) => a.every((x, idx) => near(x, vals[0][idx])))) {
    return { a: 0, k: vals[0] };
  }
  const keys: GradientArrayKeyframe[] = times.map((t, idx) => ({
    t,
    s: vals[idx],
    o: LINEAR_OUT,
    i: LINEAR_IN,
  }));
  return { a: 1, k: stripEnds(keys) };
}

// --- Per-dot channel props (each collapses to static when the model says the
//     channel is inert OR when the samples turn out constant). ---

function positionProp(index: number, s: GlowSettings, cyc: DotCycle): Vec2Prop {
  const anim = s.animation;
  const rest = toCanvas(DOTS[index]);
  if (anim.type === "none" || !MOTION[anim.type].animates.pos) {
    return { a: 0, k: [rest.x, rest.y] };
  }
  return vec2Prop(cyc.times, cyc.samples.map((sd) => [sd.pos.x, sd.pos.y]));
}

function scaleProp(_index: number, s: GlowSettings, cyc: DotCycle): Vec2Prop {
  const anim = s.animation;
  if (anim.type === "none" || !MOTION[anim.type].animates.scale) return STATIC_SCALE;
  return vec2Prop(
    cyc.times,
    cyc.samples.map((sd) => {
      const pct = sd.scale * 100;
      return [pct, pct];
    }),
  );
}

function opacityProp(_index: number, s: GlowSettings, cyc: DotCycle): ScalarProp {
  const anim = s.animation;
  if (anim.type === "none" || !MOTION[anim.type].animates.opacity) return STATIC_OPACITY;
  return scalarProp(cyc.times, cyc.samples.map((sd) => sd.opacity * 100));
}

function fillColorProp(_index: number, s: GlowSettings, cyc: DotCycle): ColorProp | undefined {
  const anim = s.animation;
  if (anim.type === "none" || !MOTION[anim.type].animates.color) return undefined;
  const base = dotColor(s);
  const vals: Rgba[] = cyc.samples.map((sd) => {
    const hex = sd.colorMix > 0 ? mixHex(base, anim.alertColor, sd.colorMix) : base;
    const { r, g, b } = hexToRgb01(hex);
    return [r, g, b, 1];
  });
  return colorProp(cyc.times, vals);
}

/** Pack one gradient-stop array at a given color-shift amount (colors shift; alphas are static). */
function packGradient(s: GlowSettings, glowHex: string): { p: number; flat: number[] } {
  const stops = haloStops(s);
  const { r, g, b } = hexToRgb01(glowHex);
  const colorFlat = stops.flatMap((st) => [st.offset, r, g, b]);
  const alphaFlat = stops.flatMap((st) => [st.offset, st.opacity]);
  return { p: stops.length, flat: [...colorFlat, ...alphaFlat] };
}

function staticGradientArray(s: GlowSettings): { p: number; k: GradientArrayProp } {
  const { p, flat } = packGradient(s, s.glowColor);
  return { p, k: { a: 0, k: flat } };
}

function haloGradient(_index: number, s: GlowSettings, cyc: DotCycle): { p: number; k: GradientArrayProp } {
  const anim = s.animation;
  if (anim.type === "none" || !MOTION[anim.type].animates.color) return staticGradientArray(s);
  const p = packGradient(s, s.glowColor).p;
  const vals = cyc.samples.map((sd) => {
    const glow = sd.colorMix > 0 ? mixHex(s.glowColor, anim.alertColor, sd.colorMix) : s.glowColor;
    return packGradient(s, glow).flat;
  });
  return { p, k: gradientArrayProp(cyc.times, vals) };
}

export function generateLottie(s: GlowSettings): LottieAnimation {
  const animated = s.animation.type !== "none";
  const op = animated ? cycleFrames(s.animation) : FPS;

  const cycles = DOTS.map((_, i) => sampleDot(i, s));
  const positions = cycles.map((cyc, i) => positionProp(i, s, cyc));
  const scales = cycles.map((cyc, i) => scaleProp(i, s, cyc));
  const opacities = cycles.map((cyc, i) => opacityProp(i, s, cyc));
  const fills = cycles.map((cyc, i) => fillColorProp(i, s, cyc));

  const dotShapes = DOTS.map((_, i) => buildDotGroup(positions[i], s, scales[i], opacities[i], fills[i]));

  // Layers render top-first: dots layer (ind 1) sits above halos layer (ind 2).
  const layers = [buildLayer("dots", 1, dotShapes, op)];

  // When glow is disabled, omit the halo layer entirely — the export is just dots.
  if (s.glowEnabled) {
    const gradients = cycles.map((cyc, i) => haloGradient(i, s, cyc));
    const haloShapes = DOTS.map((_, i) => buildHaloGroup(positions[i], s, scales[i], opacities[i], gradients[i]));
    layers.push(buildLayer("halos", 2, haloShapes, op));
  }

  return {
    v: "5.7.0",
    fr: FPS,
    ip: 0,
    op,
    w: CANVAS,
    h: CANVAS,
    ddd: 0,
    nm: "iq-glow",
    assets: [],
    layers,
  };
}
