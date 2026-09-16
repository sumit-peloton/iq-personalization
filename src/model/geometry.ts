// The WYSIWYG contract: this module is the ONE place that turns GlowSettings
// into halo geometry + gradient stops. Both the SVG preview (IconPreview) and
// the Lottie generator import it, so the on-screen glow and the exported glow
// are computed identically.

import { DOT_R } from "./dots";
import type { GlowSettings } from "./settings";
import { hexToRgb01, mixRgb, rgb01ToHex } from "./color";

// How much of the glow color bleeds into the dot when glow is enabled.
// At 0.25 the dot picks up a strong tint without losing its identity.
const DOT_TINT = 0.25;

/** Radius of the glow halo in canvas units. */
export function haloRadius(s: GlowSettings): number {
  return DOT_R * s.glowRadius;
}

/**
 * Fill color for the solid dot. When glow is enabled the dot is tinted
 * DOT_TINT% toward the glow color so the dot and its halo read as one
 * luminous object rather than a white circle with colored light behind it.
 */
export function dotColor(s: GlowSettings): string {
  if (!s.glowEnabled) return s.iconColor;
  return rgb01ToHex(mixRgb(hexToRgb01(s.iconColor), hexToRgb01(s.glowColor), DOT_TINT));
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
 * Four-stop radial gradient with a tight power-curve falloff, making the glow
 * bloom from the dot's surface like a real light source.
 *
 * The solid dot covers [0, dotEdge] of the gradient, so we hold full intensity
 * there (hidden, but sets the base). The key is the mid-stop just outside the
 * dot: it drops to ~30% intensity over the first 25% of the outer zone, then
 * tapers to 0 at the edge. This exponential-like shape hugs the dot tightly
 * instead of spreading as a diffuse halo.
 *
 *   0                  → glowIntensity             (center, under dot)
 *   dotEdge            → glowIntensity             (dot surface, full)
 *   dotEdge + 25% out  → glowIntensity*(1-falloff) (mid-stop shaped by falloff)
 *   1                  → 0                         (halo edge)
 *
 * glowFalloff 0 = soft/diffuse (mid stays near full → gradual spread)
 * glowFalloff 1 = tight/sharp  (mid drops to 0      → bloom hugs the dot)
 */
export function haloStops(s: GlowSettings): GradientStop[] {
  const dotEdge = 1 / Math.max(s.glowRadius, 1.01);
  const outer = 1 - dotEdge;
  const mid = dotEdge + outer * 0.25;
  const midOpacity = s.glowIntensity * (1 - (s.glowFalloff ?? 0.7));
  return [
    { offset: 0,       color: s.glowColor, opacity: s.glowIntensity },
    { offset: dotEdge, color: s.glowColor, opacity: s.glowIntensity },
    { offset: mid,     color: s.glowColor, opacity: midOpacity },
    { offset: 1,       color: s.glowColor, opacity: 0 },
  ];
}
