# iQ Personalization

A web tool for tuning the **glow and animation of the iQ mark** and exporting it as
**Lottie JSON** for `lottie-android`. You dial in colors, glow, and motion in a live
preview, then export a `.json` the Android app can play.

The iQ mark is six dots. Read abstractly it's a logo; read as a character it's a little
**workout buddy** — a head, two arms, a body, and legs — which is the lens the animation
states are built through (it bobs, marches, jumps, flinches) rather than plain
pulses and spins.

```
          ●            head        (dot 0)
      ●       ●        arms        (dots 1, 2)
          ●            body/torso  (dot 3)
      ●       ●        legs        (dots 4, 5)
```

## Quick start

```bash
npm install
npm run dev        # live tuner at the printed localhost URL
npm run build      # tsc --noEmit + vite build → dist/
npm run preview    # serve the production build
```

No runtime animation library — the preview is hand-rolled SVG driven by
`requestAnimationFrame`, and the export is bodymovin-compatible Lottie JSON.

## How it works

### One source of truth: preview == export

Every animation type is a pure per-dot **sampler**, `sample(u, index, anim)`, keyed on
normalized cycle time `u ∈ [0,1)`. It returns everything animatable for one dot —
position, scale, opacity, and color. The **same sampler** feeds two consumers:

- the **live SVG preview** ([`IconPreview.tsx`](src/components/IconPreview.tsx)), evaluated every frame, and
- the **Lottie exporter** ([`generateLottie.ts`](src/lottie/generateLottie.ts)), which *bakes* ~60 samples per cycle into keyframes.

Because both read the same function, the exported animation matches the preview exactly.
The registry lives in [`MOTION`](src/model/animation.ts) — one entry per type, each
declaring which channels it animates so the baker can keep the rest as cheap static
properties (a channel that samples constant is also collapsed to static).

### The loop-seam rule

Every animation loops. For a seamless loop, both **value and velocity** must match at
`u=0` and `u=1` — otherwise the wraparound shows a visible jump or kink. The motion
envelopes (`breathEnv`, `hump`, `hop`, `pump`, `plateau`, `shudder`, …) are all built to
be seam-clean, and the per-dot **phase-offset** primitive preserves that property (a
constant phase shift just slides a clean loop). Seams are verified numerically during
development.

### Faking the glow

`lottie-android` does **not** render After Effects glow/blur effects, so the glow is
faked with primitives Android renders reliably: a solid tinted dot in front, plus a
larger ellipse behind it filled with a **radial gradient** that fades to transparent.
The SVG preview draws the identical gradient, so again preview == export.

## Animation states

| State | Motion |
|---|---|
| `none` | static rest |
| `thinking-pulse` | the signature ring-collapse-into-center pulse |
| `rotate-clockwise` | dots rotate to the next clockwise position |
| `syncing` | slow rotate — a loading/sync spinner |
| `idle-breathing` | living stance: breath, weight shift, head bob, arm sway, feet planted |
| `sleeping` | slumped head droop + slow shallow breath, dimmed |
| `heartbeat` | core double-thump with a sympathetic outward pulse of head/limbs |
| `metronome` | marches in place (alternating legs, opposite arm swing) as a cadence guide |
| `encouragement` | rhythmic fist pump with a body bounce |
| `celebration` | anticipation crouch → jump, arms up in a V, rebound landing |
| `success` | arms rise into a held V and brighten to the success color |
| `alert` | a damped left-right flinch + color flash, legs rooted |

Amplitudes and timing for each state are constants at the top of its block in
[`animation.ts`](src/model/animation.ts), so tuning a move is a one-line change.

## Project layout

```
src/
  App.tsx                    top-level state, preview + controls wiring
  components/
    IconPreview.tsx          rAF-driven SVG preview (samples MOTION)
    ControlsPanel.tsx        glow + animation controls
    CurveEditor.tsx          cubic-bezier easing editor
    PresetsPanel.tsx         save/load named presets
    Slider.tsx
  model/
    dots.ts                  mark geometry + body-part map
    animation.ts             MOTION registry, motion kit, seam-safe envelopes
    settings.ts              GlowSettings + control ranges
    geometry.ts              halo radius + gradient stops
    color.ts                 hex/rgb helpers, color mixing
    presets.ts, animationTunings.ts
  lottie/
    generateLottie.ts        bakes MOTION into Lottie keyframes
    types.ts                 Lottie/bodymovin type definitions
    download.ts
  data/seed.ts               factory presets + per-type default tunings
```

Presets and per-type tunings are seeded from [`data/seed.ts`](src/data/seed.ts) but a
visitor's own edits (saved to `localStorage`) always take precedence — the seed is a
fallback so the published site ships with sensible defaults.

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the site and publishes `dist/` to **GitHub Pages**.

## Tech

React 18 · TypeScript · Vite · no runtime animation dependencies.
