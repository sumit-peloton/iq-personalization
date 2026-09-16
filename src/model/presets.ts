// Named presets of GlowSettings, persisted in localStorage so they survive reloads.

import { DEFAULT_SETTINGS, type GlowSettings } from "./settings";
import { DEFAULT_ANIMATION } from "./animation";
import { SEED_PRESETS } from "../data/seed";

export type Preset = {
  id: string;
  name: string;
  settings: GlowSettings;
};

const STORAGE_KEY = "iq-glow-presets";

/**
 * Merge a stored/seeded preset over the current defaults so older or baked-in
 * presets gain any new fields — including nested animation fields (e.g. the
 * ease curve, which replaced the old easeIn/easeOut scalars).
 */
function normalize(p: Preset): Preset {
  return {
    ...p,
    settings: {
      ...DEFAULT_SETTINGS,
      ...p.settings,
      animation: { ...DEFAULT_ANIMATION, ...p.settings?.animation },
    },
  };
}

export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // No local presets yet → fall back to the baked-in seed so the published
    // site ships with the author's presets. A visitor's own edits (once saved)
    // land in localStorage and take precedence from then on.
    const parsed = raw ? (JSON.parse(raw) as Preset[]) : SEED_PRESETS;
    if (!Array.isArray(parsed)) return SEED_PRESETS.map(normalize);
    return parsed.map(normalize);
  } catch {
    return SEED_PRESETS.map(normalize);
  }
}

export function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage unavailable (private mode / quota) — presets simply won't persist.
  }
}

export function makePreset(name: string, settings: GlowSettings): Preset {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    settings: { ...settings },
  };
}
