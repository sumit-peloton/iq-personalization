// Minimal Lottie (bodymovin) schema types — only the subset this generator emits.
// Static values only for now (every property uses { a: 0, k: ... }); when we add
// pulsing, `k` becomes a keyframe array and `a` flips to 1.

export type StaticValue<T> = { a: 0; k: T };

/** One keyframe of an animated 2D value (position). */
export type Vec2Keyframe = {
  t: number; // frame
  s: [number, number]; // value at this frame
  i?: { x: number[]; y: number[] }; // in tangent (easing to next kf)
  o?: { x: number[]; y: number[] }; // out tangent
};

export type AnimatedVec2 = { a: 1; k: Vec2Keyframe[] };

/** A 2D property that may be static or keyframed. */
export type Vec2Prop = StaticValue<[number, number]> | AnimatedVec2;

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
  c: StaticValue<[number, number, number, number]>; // rgba 0..1
  o: StaticValue<number>; // opacity 0..100
  r: 1; // fill rule (nonzero)
  bm: 0;
};

export type GradientFill = {
  ty: "gf";
  t: 1 | 2; // 1 = linear, 2 = radial
  o: StaticValue<number>; // opacity 0..100
  s: StaticValue<[number, number]>; // gradient start point (center for radial)
  e: StaticValue<[number, number]>; // gradient end point (|e - s| = radius)
  g: {
    p: number; // number of COLOR stops
    k: StaticValue<number[]>; // packed color stops then alpha stops
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
