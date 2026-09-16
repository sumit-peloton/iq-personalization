import { useEffect, useState } from "react";
import IconPreview from "./components/IconPreview";
import ControlsPanel from "./components/ControlsPanel";
import PresetsPanel from "./components/PresetsPanel";
import { DEFAULT_SETTINGS, type GlowSettings } from "./model/settings";
import type { AnimationType } from "./model/animation";
import { loadTunings, saveTunings } from "./model/animationTunings";
import { generateLottie } from "./lottie/generateLottie";
import { downloadLottie } from "./lottie/download";

export default function App() {
  const [settings, setSettings] = useState<GlowSettings>(DEFAULT_SETTINGS);
  // Per-animation-type parameter memory (auto-saved, persisted).
  const [tunings, setTunings] = useState(loadTunings);
  // Preview-only slow motion (does not affect exported Lottie or settings).
  const [slowMo, setSlowMo] = useState(false);

  useEffect(() => {
    saveTunings(tunings);
  }, [tunings]);

  /** Remember the live animation params under their type (skip "none"). */
  const rememberAnimation = (s: GlowSettings) => {
    if (s.animation.type === "none") return;
    setTunings((t) => ({ ...t, [s.animation.type]: s.animation }));
  };

  // Slider / color / glow edits: apply, and keep this animation's memory current.
  const handleChange = (next: GlowSettings) => {
    setSettings(next);
    rememberAnimation(next);
  };

  // Animation dropdown: switch type and restore THAT type's remembered params.
  const handleSelectAnimation = (type: AnimationType) => {
    setSettings((s) => ({ ...s, animation: { ...tunings[type], type } }));
  };

  // Recalling a preset adopts its full settings verbatim, and seeds the
  // per-type memory with the preset's animation so tuning continues from there.
  const handleRecall = (next: GlowSettings) => {
    setSettings(next);
    rememberAnimation(next);
  };

  return (
    <div className="app">
      {/* Preview-only playback speed — lets you scrub the motion in more frames. */}
      <button
        className={`slowmo${slowMo ? " slowmo-on" : ""}`}
        onClick={() => setSlowMo((v) => !v)}
        title="Slow the preview to 0.5× (preview only)"
      >
        0.5×
      </button>

      <section className="stage">
        <IconPreview settings={settings} slowMo={slowMo} />
      </section>

      <ControlsPanel
        settings={settings}
        onChange={handleChange}
        onSelectAnimation={handleSelectAnimation}
      />

      <div className="bottom-left">
        <PresetsPanel settings={settings} onRecall={handleRecall} />

        <div className="actions">
          <button className="btn" onClick={() => downloadLottie(generateLottie(settings))}>
            Export
          </button>
          <button className="btn btn-ghost" onClick={() => setSettings(DEFAULT_SETTINGS)}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
