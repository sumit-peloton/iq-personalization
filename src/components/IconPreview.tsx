import { useEffect, useRef, useState } from "react";
import { CANVAS, DOTS, DOT_R, toCanvas } from "../model/dots";
import { haloRadius, haloStops } from "../model/geometry";
import {
  CENTER_INDEX,
  centerScale,
  collapseProgress,
  collapsedPoint,
  cycleDuration,
  ringScale,
} from "../model/animation";
import type { GlowSettings } from "../model/settings";

type Props = { settings: GlowSettings; slowMo?: boolean };

/** requestAnimationFrame clock returning normalized cycle progress u in [0,1). */
function useCycleProgress(active: boolean, period: number): number {
  const [u, setU] = useState(0);
  const start = useRef(0);

  useEffect(() => {
    if (!active) {
      setU(0);
      return;
    }
    let raf = 0;
    start.current = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start.current) / 1000;
      setU((elapsed % period) / period);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, period]);

  return u;
}

/**
 * Live preview of the iQ icon with glow + motion. Draws the SAME radial-gradient
 * halo the Lottie exporter emits, and moves the dots with the SAME collapse
 * curve the exporter bakes — so preview == export.
 */
export default function IconPreview({ settings, slowMo = false }: Props) {
  const r = haloRadius(settings);
  const stops = haloStops(settings);
  const showGlow = settings.glowEnabled;

  const anim = settings.animation;
  const active = anim.type !== "none";
  // Preview-only: stretch the cycle so more frames are visible; export unaffected.
  const u = useCycleProgress(active, cycleDuration(anim) * (slowMo ? 2 : 1));
  const c = active ? collapseProgress(u, anim) : 0;

  const center = toCanvas(DOTS[CENTER_INDEX]);
  const positions = DOTS.map((p, i) => {
    const rest = toCanvas(p);
    if (!active || i === CENTER_INDEX) return rest;
    return collapsedPoint(rest, center, c);
  });
  // The center dot grows during the hold; the outer dots shrink as they collapse.
  const scale = (i: number) => {
    if (!active) return 1;
    return i === CENTER_INDEX ? centerScale(u, anim) : ringScale(u, anim);
  };

  return (
    <svg
      className="preview-svg"
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="iQ icon glow preview"
    >
      <defs>
        {showGlow &&
          positions.map((c, i) => (
            <radialGradient
              key={i}
              id={`halo-${i}`}
              gradientUnits="userSpaceOnUse"
              cx={c.x}
              cy={c.y}
              r={r * scale(i)}
            >
              {stops.map((stop, j) => (
                <stop
                  key={j}
                  offset={stop.offset}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity}
                />
              ))}
            </radialGradient>
          ))}
      </defs>

      {/* Halos (behind) */}
      {showGlow &&
        positions.map((c, i) => (
          <circle key={`halo-${i}`} cx={c.x} cy={c.y} r={r * scale(i)} fill={`url(#halo-${i})`} />
        ))}

      {/* Solid dots (front) */}
      {positions.map((c, i) => (
        <circle key={`dot-${i}`} cx={c.x} cy={c.y} r={DOT_R * scale(i)} fill={settings.iconColor} />
      ))}
    </svg>
  );
}
