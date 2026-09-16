// Per-animation-type parameter memory. Each animation type remembers the params
// you last tuned for it, auto-saved to localStorage — so switching between
// animations (or reloading) brings back that animation's dialed-in settings
// instead of carrying one animation's values onto another.

import {
  ANIMATIONS,
  DEFAULT_ANIMATION,
  type AnimationSettings,
  type AnimationType,
} from "./animation";
import { SEED_TUNINGS } from "../data/seed";

export type AnimationTunings = Record<AnimationType, AnimationSettings>;

const STORAGE_KEY = "iq-anim-tunings";

/** Default params for a type: the shared defaults with the type stamped on. */
export function defaultTuning(type: AnimationType): AnimationSettings {
  return { ...DEFAULT_ANIMATION, type };
}

/** A full map of every known animation type to its default params. */
export function defaultTunings(): AnimationTunings {
  const out = {} as AnimationTunings;
  for (const a of ANIMATIONS) out[a.value] = defaultTuning(a.value);
  return out;
}

export function loadTunings(): AnimationTunings {
  const out = defaultTunings();
  // Layer the baked-in author tunings over the code defaults, so a fresh
  // visitor starts from the author's dialed-in params. localStorage (below)
  // then overrides these once the visitor tunes anything themselves.
  for (const a of ANIMATIONS) {
    const seeded = SEED_TUNINGS[a.value];
    if (seeded) out[a.value] = { ...out[a.value], ...seeded, type: a.value };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Partial<Record<AnimationType, AnimationSettings>>;
    // Merge stored params over defaults so new fields (or newly added animation
    // types) always get sane values.
    for (const a of ANIMATIONS) {
      const stored = parsed?.[a.value];
      if (stored) out[a.value] = { ...out[a.value], ...stored, type: a.value };
    }
  } catch {
    // Corrupt/unavailable storage — fall back to defaults.
  }
  return out;
}

export function saveTunings(tunings: AnimationTunings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tunings));
  } catch {
    // Storage unavailable (private mode / quota) — memory just won't persist.
  }
}
