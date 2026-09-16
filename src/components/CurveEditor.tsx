import { useRef, useState } from "react";
import type { EaseCurve } from "../model/animation";

type Props = {
  value: EaseCurve;
  onChange: (next: EaseCurve) => void;
};

// SVG canvas in viewBox units. PAD leaves room for handles dragged past the
// [0,1] box (anticipation / overshoot in y).
const W = 200;
const H = 150;
const PAD = 22;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Normalized curve coords (x,y in ~[0,1]) -> SVG px, with y flipped (up = 1). */
function toPx(nx: number, ny: number) {
  return {
    x: PAD + nx * (W - 2 * PAD),
    y: H - PAD - ny * (H - 2 * PAD),
  };
}

/**
 * Draggable cubic-bezier editor. Anchors at (0,0)→(1,1); two handles set the
 * control points that shape the animation's timing curve. Editing here is just
 * another view of `animation.ease`, so preview and Lottie export follow along.
 */
export default function CurveEditor({ value, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<1 | 2 | null>(null);

  const box0 = toPx(0, 0); // bottom-left of the unit box
  const box1 = toPx(1, 1); // top-right
  const p0 = box0;
  const p3 = box1;
  const p1 = toPx(value.x1, value.y1);
  const p2 = toPx(value.x2, value.y2);

  const startDrag = (which: 1 | 2) => (e: React.PointerEvent) => {
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag(which);
  };

  const move = (e: React.PointerEvent) => {
    if (!drag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const nx = clamp((sx - PAD) / (W - 2 * PAD), 0, 1);
    const ny = clamp((H - PAD - sy) / (H - 2 * PAD), -0.4, 1.4);
    if (drag === 1) onChange({ ...value, x1: round2(nx), y1: round2(ny) });
    else onChange({ ...value, x2: round2(nx), y2: round2(ny) });
  };

  const end = () => setDrag(null);

  return (
    <svg
      ref={svgRef}
      className="curve-editor"
      viewBox={`0 0 ${W} ${H}`}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* Unit box + slow/fast diagonal reference */}
      <rect
        className="curve-frame"
        x={box0.x}
        y={box1.y}
        width={box1.x - box0.x}
        height={box0.y - box1.y}
      />
      <line className="curve-diag" x1={p0.x} y1={p0.y} x2={p3.x} y2={p3.y} />

      {/* Handle stems */}
      <line className="curve-stem" x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} />
      <line className="curve-stem" x1={p3.x} y1={p3.y} x2={p2.x} y2={p2.y} />

      {/* The curve */}
      <path
        className="curve-path"
        d={`M ${p0.x} ${p0.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`}
      />

      {/* Fixed anchors */}
      <circle className="curve-anchor" cx={p0.x} cy={p0.y} r={2.5} />
      <circle className="curve-anchor" cx={p3.x} cy={p3.y} r={2.5} />

      {/* Draggable control handles */}
      <circle
        className="curve-handle"
        cx={p1.x}
        cy={p1.y}
        r={5}
        onPointerDown={startDrag(1)}
      />
      <circle
        className="curve-handle"
        cx={p2.x}
        cy={p2.y}
        r={5}
        onPointerDown={startDrag(2)}
      />
    </svg>
  );
}
