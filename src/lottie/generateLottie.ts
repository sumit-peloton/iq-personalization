// Builds a real Lottie/bodymovin animation from GlowSettings.
//
// WHY IT LOOKS LIKE THIS: lottie-android does NOT render After Effects
// glow/blur filter effects. So the glow is faked with primitives Android
// renders reliably: a solid ellipse per dot (el + fl) plus a larger ellipse
// per dot filled with a RADIAL gradient (el + gf, t:2) that fades from the
// glow color at the center to transparent at the edge. The web preview draws
// the exact same radial gradient, so preview == export.
//
// MOTION: animated dot positions are BAKED — we sample the shared
// collapseProgress() curve at frames across one cycle and emit a position
// keyframe per sample. Baking (rather than translating springs into bezier
// handles) guarantees the export matches the JS-driven preview exactly, no
// matter how complex the easing/overshoot/rubberband is.

import { CANVAS, DOTS, DOT_R, toCanvas } from "../model/dots";
import { haloRadius } from "../model/geometry";
import { hexToRgb01 } from "../model/color";
import {
  CENTER_INDEX,
  FPS,
  centerScale,
  collapseProgress,
  collapsedPoint,
  cycleFrames,
} from "../model/animation";
import type { GlowSettings } from "../model/settings";
import type {
  GradientFill,
  LottieAnimation,
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

/** A solid dot: ellipse (diameter = 2*DOT_R) filled with the icon color. */
export function buildDotGroup(pos: Vec2Prop, color: string, scale?: Vec2Prop): ShapeGroup {
  const d = 2 * DOT_R;
  const { r: cr, g: cg, b: cb } = hexToRgb01(color);
  const fill: SolidFill = {
    ty: "fl",
    c: { a: 0, k: [cr, cg, cb, 1] },
    o: { a: 0, k: 100 },
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
 * g.p is the count of COLOR stops only. Here: 2 color stops (glow color at 0
 * and 1) + 2 alpha stops (intensity at 0, fully transparent at 1).
 */
export function buildHaloGroup(pos: Vec2Prop, s: GlowSettings, scale?: Vec2Prop): ShapeGroup {
  const r = haloRadius(s);
  const d = 2 * r;
  const { r: cr, g: cg, b: cb } = hexToRgb01(s.glowColor);

  const gradient: GradientFill = {
    ty: "gf",
    t: 2, // radial
    o: { a: 0, k: 100 },
    s: { a: 0, k: [0, 0] }, // center (local coords)
    e: { a: 0, k: [r, 0] }, // |e - s| = halo radius
    g: {
      p: 2,
      k: {
        a: 0,
        k: [
          // color stops: offset, r, g, b
          0, cr, cg, cb,
          1, cr, cg, cb,
          // alpha stops: offset, alpha
          0, s.glowIntensity,
          1, 0,
        ],
      },
    },
    r: 1,
    bm: 0,
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

/**
 * Position prop for one dot. Center dot (and any non-animated build) is static;
 * ring dots get baked keyframes sampled from collapseProgress across one cycle.
 */
function dotPosition(index: number, s: GlowSettings): Vec2Prop {
  const rest = toCanvas(DOTS[index]);
  const anim = s.animation;

  if (anim.type === "none" || index === CENTER_INDEX) {
    return { a: 0, k: [rest.x, rest.y] };
  }

  const center = toCanvas(DOTS[CENTER_INDEX]);
  const total = cycleFrames(anim);
  // Cap keyframe count for a lean file; dense enough to capture the spring.
  const step = Math.max(1, Math.round(total / 60));

  const keys: Vec2Keyframe[] = [];
  for (let f = 0; f <= total; f += step) {
    if (f > total) break;
    const u = f / total;
    const c = collapseProgress(u, anim);
    const p = collapsedPoint(rest, center, c);
    const kf: Vec2Keyframe = { t: f, s: [p.x, p.y], o: LINEAR_OUT, i: LINEAR_IN };
    keys.push(kf);
  }
  // Ensure the final frame lands exactly on `total` for a seamless loop.
  if (keys[keys.length - 1].t !== total) {
    const c = collapseProgress(1, anim);
    const p = collapsedPoint(rest, center, c);
    keys.push({ t: total, s: [p.x, p.y], o: LINEAR_OUT, i: LINEAR_IN });
  }
  // Last keyframe carries no outgoing tangent.
  delete keys[keys.length - 1].o;
  delete keys[keys.length - 1].i;

  return { a: 1, k: keys };
}

/**
 * Scale prop for one dot. Only the center dot grows (with the collapse); all
 * others stay at 100%. Baked from centerScale across one cycle, mirroring the
 * position baking so preview == export.
 */
function dotScale(index: number, s: GlowSettings): Vec2Prop {
  const anim = s.animation;

  if (anim.type === "none" || index !== CENTER_INDEX || anim.centerGrow === 1) {
    return { a: 0, k: [100, 100] };
  }

  const total = cycleFrames(anim);
  const step = Math.max(1, Math.round(total / 60));

  const keys: Vec2Keyframe[] = [];
  for (let f = 0; f <= total; f += step) {
    if (f > total) break;
    const pct = centerScale(f / total, anim) * 100;
    keys.push({ t: f, s: [pct, pct], o: LINEAR_OUT, i: LINEAR_IN });
  }
  if (keys[keys.length - 1].t !== total) {
    const pct = centerScale(1, anim) * 100;
    keys.push({ t: total, s: [pct, pct], o: LINEAR_OUT, i: LINEAR_IN });
  }
  delete keys[keys.length - 1].o;
  delete keys[keys.length - 1].i;

  return { a: 1, k: keys };
}

export function generateLottie(s: GlowSettings): LottieAnimation {
  const animated = s.animation.type !== "none";
  const op = animated ? cycleFrames(s.animation) : FPS;

  const positions = DOTS.map((_, i) => dotPosition(i, s));
  const scales = DOTS.map((_, i) => dotScale(i, s));

  const dotShapes = DOTS.map((_, i) => buildDotGroup(positions[i], s.iconColor, scales[i]));

  // Layers render top-first: dots layer (ind 1) sits above halos layer (ind 2).
  const layers = [buildLayer("dots", 1, dotShapes, op)];

  // When glow is disabled, omit the halo layer entirely — the export is just dots.
  if (s.glowEnabled) {
    const haloShapes = DOTS.map((_, i) => buildHaloGroup(positions[i], s, scales[i]));
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
