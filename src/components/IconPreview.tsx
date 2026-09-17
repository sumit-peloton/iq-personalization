import { useEffect, useRef, useState } from "react";
import { CANVAS, DOTS, DOT_R } from "../model/dots";
import { dotColor, haloRadius, haloStops } from "../model/geometry";
import { mixHex } from "../model/color";
import { MOTION, cycleDuration } from "../model/animation";
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
  const showGlow = settings.glowEnabled;
  const dotFill = dotColor(settings);

  const anim = settings.animation;
  const active = anim.type !== "none";
  // Preview-only: stretch the cycle so more frames are visible; export unaffected.
  const u = useCycleProgress(active, cycleDuration(anim) * (slowMo ? 2 : 1));

  // ONE per-dot sample drives position, scale, opacity, and color — the same
  // sampler the Lottie exporter bakes, so preview == export.
  const samples = DOTS.map((_, i) => MOTION[anim.type].sample(u, i, anim));

  // Per-dot color shift toward alertColor (0 = base color for that dot).
  const dotFillOf = (mix: number) => (mix > 0 ? mixHex(dotFill, anim.alertColor, mix) : dotFill);
  const stopsOf = (mix: number) =>
    haloStops(settings, mix > 0 ? { color: mixHex(settings.glowColor, anim.alertColor, mix) } : undefined);

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
          samples.map((sd, i) => (
            <radialGradient
              key={i}
              id={`halo-${i}`}
              gradientUnits="userSpaceOnUse"
              cx={sd.pos.x}
              cy={sd.pos.y}
              r={r * sd.scale}
            >
              {stopsOf(sd.colorMix).map((stop, j) => (
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
        samples.map((sd, i) => (
          <circle
            key={`halo-${i}`}
            cx={sd.pos.x}
            cy={sd.pos.y}
            r={r * sd.scale}
            fill={`url(#halo-${i})`}
            opacity={sd.opacity}
          />
        ))}

      {/* Solid dots (front) — tinted toward the glow color when glow is on */}
      {samples.map((sd, i) => (
        <circle
          key={`dot-${i}`}
          cx={sd.pos.x}
          cy={sd.pos.y}
          r={DOT_R * sd.scale}
          fill={dotFillOf(sd.colorMix)}
          fillOpacity={sd.opacity}
        />
      ))}
    </svg>
  );
}
