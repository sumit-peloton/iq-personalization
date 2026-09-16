// The WYSIWYG contract: this module is the ONE place that turns GlowSettings
// into halo geometry + gradient stops. Both the SVG preview (IconPreview) and
// the Lottie generator import it, so the on-screen glow and the exported glow
// are computed identically.

import { DOT_R } from "./dots";
import type { GlowSettings } from "./settings";

/** Radius of the glow halo in canvas units. */
export function haloRadius(s: GlowSettings): number {
  return DOT_R * s.glowRadius;
}

export type GradientStop = {
  /** Position along the gradient, 0 (center) .. 1 (edge). */
  offset: number;
  /** Hex color "#RRGGBB". */
  color: string;
  /** Alpha 0..1. */
  opacity: number;
};

/**
 * Three-stop radial gradient that makes the glow feel like it emanates from
 * the dot rather than floating around it as a ring.
 *
 * The solid dot covers the inner (DOT_R / haloRadius = 1/glowRadius) portion
 * of the gradient, so a simple center→edge fade reads as an outline because
 * the brightest part is hidden. Instead we hold full intensity all the way to
 * the dot's edge, then fade from there to transparent — so the visible glow
 * starts at full brightness right at the dot's surface.
 *
 *   0            → glowIntensity  (center, hidden under the solid dot)
 *   1/glowRadius → glowIntensity  (dot edge — first visible point, full brightness)
 *   1            → 0              (halo edge — fully transparent)
 */
export function haloStops(s: GlowSettings): [GradientStop, GradientStop, GradientStop] {
  const dotEdge = 1 / Math.max(s.glowRadius, 1.01); // where the solid dot ends, normalized
  return [
    { offset: 0,       color: s.glowColor, opacity: s.glowIntensity },
    { offset: dotEdge, color: s.glowColor, opacity: s.glowIntensity },
    { offset: 1,       color: s.glowColor, opacity: 0 },
  ];
}
