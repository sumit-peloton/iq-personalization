// Baked-in "factory" presets and per-animation tunings, captured from the
// author's tuning session and committed so the published site ships with them.
//
// These are only a FALLBACK: a visitor's own localStorage (their edits) always
// takes precedence. See loadPresets() / loadTunings() for the layering.
//
// To refresh these from your live tuning, run this in the browser console on
// the running app, then paste the result over the two consts below:
//
//   copy(JSON.stringify({
//     presets: JSON.parse(localStorage.getItem("iq-glow-presets") || "[]"),
//     tunings: JSON.parse(localStorage.getItem("iq-anim-tunings") || "{}"),
//   }, null, 2))

import type { Preset } from "../model/presets";
import type { AnimationSettings, AnimationType } from "../model/animation";
import { DEFAULT_ANIMATION } from "../model/animation";

/** Named presets that ship with the app when a visitor has none of their own. */
export const SEED_PRESETS: Preset[] = [
  {
    id: "preset-electric",
    name: "Electric",
    settings: {
      iconColor: "#FFFFFF",
      glowEnabled: true,
      glowColor: "#4DA3FF",
      glowRadius: 1.6,
      glowIntensity: 0.35,
      glowFalloff: 0.4,
      animation: DEFAULT_ANIMATION,
    },
  },
  {
    id: "preset-inferno",
    name: "Inferno",
    settings: {
      iconColor: "#FFFFFF",
      glowEnabled: true,
      glowColor: "#FF3B30",
      glowRadius: 1.6,
      glowIntensity: 0.35,
      glowFalloff: 0.4,
      animation: DEFAULT_ANIMATION,
    },
  },
  {
    id: "preset-solar",
    name: "Solar",
    settings: {
      iconColor: "#FFF3D6",
      glowEnabled: true,
      glowColor: "#FFAA00",
      glowRadius: 1.6,
      glowIntensity: 0.35,
      glowFalloff: 0.4,
      animation: DEFAULT_ANIMATION,
    },
  },
  {
    id: "preset-emerald",
    name: "Emerald",
    settings: {
      iconColor: "#EAFFF4",
      glowEnabled: true,
      glowColor: "#00C853",
      glowRadius: 1.6,
      glowIntensity: 0.35,
      glowFalloff: 0.4,
      animation: DEFAULT_ANIMATION,
    },
  },
  {
    id: "preset-aurora",
    name: "Aurora",
    settings: {
      iconColor: "#F2ECFF",
      glowEnabled: true,
      glowColor: "#A855F7",
      glowRadius: 1.6,
      glowIntensity: 0.35,
      glowFalloff: 0.4,
      animation: DEFAULT_ANIMATION,
    },
  },
  {
    id: "preset-frost",
    name: "Frost",
    settings: {
      iconColor: "#FFFFFF",
      glowEnabled: true,
      glowColor: "#B8D4FF",
      glowRadius: 1.6,
      glowIntensity: 0.35,
      glowFalloff: 0.4,
      animation: DEFAULT_ANIMATION,
    },
  },
];

/** Per-animation-type params that ship as the starting point for each type. */
export const SEED_TUNINGS: Partial<Record<AnimationType, AnimationSettings>> = {
  "thinking-pulse": {
    type: "thinking-pulse",
    speed: 0.9,
    ease: { x1: 0.59, y1: -0.04, x2: 0.44, y2: 0.99 },
    overshoot: 0.03,
    rubberband: 0.68,
    collapse: 1,
    ringShrink: 0.3,
    centerGrowEnabled: true,
    centerGrow: 1.1,
  },
};
