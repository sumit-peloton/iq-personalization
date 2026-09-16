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

/** Named presets that ship with the app when a visitor has none of their own. */
export const SEED_PRESETS: Preset[] = [];

/** Per-animation-type params that ship as the starting point for each type. */
export const SEED_TUNINGS: Partial<Record<AnimationType, AnimationSettings>> = {};
