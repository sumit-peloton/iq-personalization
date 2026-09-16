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
 * Two-stop radial gradient: full-color glow at the center fading to fully
 * transparent at the halo edge. Only the alpha differs between stops, so the
 * halo blends cleanly over any background.
 */
export function haloStops(s: GlowSettings): [GradientStop, GradientStop] {
  return [
    { offset: 0, color: s.glowColor, opacity: s.glowIntensity },
    { offset: 1, color: s.glowColor, opacity: 0 },
  ];
}
