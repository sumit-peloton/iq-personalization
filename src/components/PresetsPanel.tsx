import { useEffect, useState } from "react";
import type { GlowSettings } from "../model/settings";
import { loadPresets, makePreset, savePresets, type Preset } from "../model/presets";

type Props = {
  settings: GlowSettings;
  onRecall: (settings: GlowSettings) => void;
};

export default function PresetsPanel({ settings, onRecall }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");

  // Load once on mount.
  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  // Persist whenever the list changes.
  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Overwrite a same-named preset if one exists, else append.
    const existing = presets.find((p) => p.name === trimmed);
    if (existing) {
      setPresets(presets.map((p) => (p.id === existing.id ? makePreset(trimmed, settings) : p)));
    } else {
      setPresets([...presets, makePreset(trimmed, settings)]);
    }
    setName("");
  };

  const remove = (id: string) => setPresets(presets.filter((p) => p.id !== id));

  return (
    <div className="presets">
      <div className="presets-head">Presets</div>

      {presets.length > 0 && (
        <ul className="preset-list">
          {presets.map((p) => (
            <li key={p.id}>
              <button
                className="preset-name"
                title="Recall"
                onClick={() => onRecall(p.settings)}
              >
                {p.name}
              </button>
              <button className="preset-del" title="Delete" onClick={() => remove(p.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="preset-save">
        <input
          type="text"
          placeholder="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button className="btn" onClick={save} disabled={!name.trim()}>
          Save
        </button>
      </div>
    </div>
  );
}
