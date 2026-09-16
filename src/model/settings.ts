// The single settings object tuned by the UI. Kept deliberately flat so it can
// grow (e.g. a `pulse` block) without restructuring the generator or preview.

import { DEFAULT_ANIMATION, type AnimationSettings } from "./animation";

export type GlowSettings = {
  /** Fill color of the icon dots, hex "#RRGGBB". */
  iconColor: string;
  /** Master switch: when false the glow is fully off (no halos rendered/exported). */
  glowEnabled: boolean;
  /** Halo size as a multiple of the dot radius (DOT_R). 1 = dot-sized. */
  glowRadius: number;
  /** Brightness of the glow: center alpha of the halo, 0..1. */
  glowIntensity: number;
  /** How sharply the glow falls off from the dot edge. 0 = soft/diffuse, 1 = tight/sharp. */
  glowFalloff: number;
  /** Glow color as a hex string "#RRGGBB". */
  glowColor: string;
  /** Motion settings. */
  animation: AnimationSettings;
};

export const DEFAULT_SETTINGS: GlowSettings = {
  iconColor: "#FFFFFF",
  glowEnabled: true,
  glowRadius: 1.6,
  glowIntensity: 0.35,
  glowFalloff: 0.4,
  glowColor: "#4DA3FF",
  animation: DEFAULT_ANIMATION,
};

export const RADIUS_RANGE = { min: 1.0, max: 5.0, step: 0.1 } as const;
export const INTENSITY_RANGE = { min: 0, max: 1, step: 0.01 } as const;
export const FALLOFF_RANGE = { min: 0, max: 1, step: 0.05 } as const;

export const SPEED_RANGE = { min: 0.25, max: 3, step: 0.05 } as const;
export const OVERSHOOT_RANGE = { min: 0, max: 1, step: 0.01 } as const;
export const RUBBERBAND_RANGE = { min: 0, max: 1, step: 0.01 } as const;
export const COLLAPSE_RANGE = { min: 0, max: 1, step: 0.01 } as const;
export const RING_SHRINK_RANGE = { min: 0, max: 0.6, step: 0.05 } as const;
// rotateHold is stored 0→1 where 1 = the original pre-slider hold (30% of cycle).
export const ROTATE_HOLD_RANGE = { min: 0, max: 1, step: 0.05 } as const;
export const CENTER_GROW_RANGE = { min: 1, max: 3, step: 0.05 } as const;
