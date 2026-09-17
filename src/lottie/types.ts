// Minimal Lottie (bodymovin) schema types — only the subset this generator emits.
// A property is static as { a: 0, k: value }; when it animates, `a` flips to 1
// and `k` becomes a keyframe array.

export type StaticValue<T> = { a: 0; k: T };

type Tangent = { x: number[]; y: number[] };

/** One keyframe of an animated 2D value (position). */
export type Vec2Keyframe = {
  t: number; // frame
  s: [number, number]; // value at this frame
  i?: Tangent; // in tangent (easing to next kf)
  o?: Tangent; // out tangent
};

export type AnimatedVec2 = { a: 1; k: Vec2Keyframe[] };

/** A 2D property that may be static or keyframed. */
export type Vec2Prop = StaticValue<[number, number]> | AnimatedVec2;

/** One keyframe of an animated scalar (e.g. opacity 0..100). */
export type ScalarKeyframe = { t: number; s: [number]; i?: Tangent; o?: Tangent };
export type AnimatedScalar = { a: 1; k: ScalarKeyframe[] };
/** A scalar property that may be static or keyframed. */
export type ScalarProp = StaticValue<number> | AnimatedScalar;

/** One keyframe of an animated rgba color (components 0..1). */
export type ColorKeyframe = { t: number; s: [number, number, number, number]; i?: Tangent; o?: Tangent };
export type AnimatedColor = { a: 1; k: ColorKeyframe[] };
/** An rgba color property that may be static or keyframed. */
export type ColorProp = StaticValue<[number, number, number, number]> | AnimatedColor;

/** One keyframe of an animated gradient stop array (packed colors then alphas). */
export type GradientArrayKeyframe = { t: number; s: number[]; i?: Tangent; o?: Tangent };
export type AnimatedGradientArray = { a: 1; k: GradientArrayKeyframe[] };
/** A gradient stop array that may be static or keyframed. */
export type GradientArrayProp = StaticValue<number[]> | AnimatedGradientArray;

/** Transform block shared by layers and shape groups. */
export type Transform = {
  ty?: "tr";
  o: StaticValue<number>; // opacity 0..100
  r: StaticValue<number>; // rotation degrees
  p: Vec2Prop; // position (static or animated)
  a: StaticValue<[number, number]>; // anchor
  s: Vec2Prop; // scale % [x, y] (static or animated)
};

export type EllipseShape = {
  ty: "el";
  d: 1;
  s: StaticValue<[number, number]>; // size (diameter x, y)
  p: StaticValue<[number, number]>; // center (local)
};

export type SolidFill = {
  ty: "fl";
  c: ColorProp; // rgba 0..1 (static or animated)
  o: ScalarProp; // opacity 0..100 (static or animated)
  r: 1; // fill rule (nonzero)
  bm: 0;
};

export type GradientFill = {
  ty: "gf";
  t: 1 | 2; // 1 = linear, 2 = radial
  o: ScalarProp; // opacity 0..100 (static or animated)
  s: StaticValue<[number, number]>; // gradient start point (center for radial)
  e: StaticValue<[number, number]>; // gradient end point (|e - s| = radius)
  g: {
    p: number; // number of COLOR stops
    k: GradientArrayProp; // packed color stops then alpha stops (static or animated)
  };
  r: 1;
  bm: 0;
};

export type ShapeItem = EllipseShape | SolidFill | GradientFill | Transform;

export type ShapeGroup = {
  ty: "gr";
  nm: string;
  it: ShapeItem[];
};

export type ShapeLayer = {
  ty: 4;
  nm: string;
  ind: number;
  ddd: 0;
  ao: 0;
  bm: 0;
  sr: 1;
  ip: number;
  op: number;
  st: 0;
  ks: Transform;
  shapes: ShapeGroup[];
};

export type LottieAnimation = {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  ddd: 0;
  nm: string;
  assets: unknown[];
  layers: ShapeLayer[];
};
