import Slider from "./Slider";
import CurveEditor from "./CurveEditor";
import {
  CENTER_GROW_RANGE,
  COLLAPSE_RANGE,
  INTENSITY_RANGE,
  OVERSHOOT_RANGE,
  RADIUS_RANGE,
  RUBBERBAND_RANGE,
  SPEED_RANGE,
  type GlowSettings,
} from "../model/settings";
import { ANIMATIONS, type AnimationSettings, type AnimationType } from "../model/animation";

type Props = {
  settings: GlowSettings;
  onChange: (next: GlowSettings) => void;
  /** Switch the active animation (restores that type's remembered params). */
  onSelectAnimation: (type: AnimationType) => void;
};

export default function ControlsPanel({ settings, onChange, onSelectAnimation }: Props) {
  const patch = (p: Partial<GlowSettings>) => onChange({ ...settings, ...p });
  const patchAnim = (p: Partial<AnimationSettings>) =>
    patch({ animation: { ...settings.animation, ...p } });
  const on = settings.glowEnabled;
  const anim = settings.animation;
  const animOn = anim.type !== "none";

  return (
    <div className="controls">
      <label className="color-field">
        <span>Icon</span>
        <input
          type="color"
          value={settings.iconColor}
          onChange={(e) => patch({ iconColor: e.target.value })}
        />
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => patch({ glowEnabled: e.target.checked })}
        />
        <span>Glow</span>
      </label>

      <div className={`group${on ? "" : " group-disabled"}`}>
        <Slider
          label="Amount"
          value={settings.glowRadius}
          min={RADIUS_RANGE.min}
          max={RADIUS_RANGE.max}
          step={RADIUS_RANGE.step}
          disabled={!on}
          onChange={(glowRadius) => patch({ glowRadius })}
          format={(v) => `${v.toFixed(1)}×`}
        />

        <Slider
          label="Intensity"
          value={settings.glowIntensity}
          min={INTENSITY_RANGE.min}
          max={INTENSITY_RANGE.max}
          step={INTENSITY_RANGE.step}
          disabled={!on}
          onChange={(glowIntensity) => patch({ glowIntensity })}
          format={(v) => `${Math.round(v * 100)}%`}
        />

        <label className="color-field">
          <span>Color</span>
          <input
            type="color"
            value={settings.glowColor}
            disabled={!on}
            onChange={(e) => patch({ glowColor: e.target.value })}
          />
        </label>
      </div>

      <label className="select-field">
        <span>Animation</span>
        <select
          value={anim.type}
          onChange={(e) => onSelectAnimation(e.target.value as AnimationType)}
        >
          {ANIMATIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      {animOn && (
        <div className="group">
          <Slider
            label="Speed"
            value={anim.speed}
            min={SPEED_RANGE.min}
            max={SPEED_RANGE.max}
            step={SPEED_RANGE.step}
            onChange={(speed) => patchAnim({ speed })}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <div className="curve-field">
            <span>Curve</span>
            <CurveEditor value={anim.ease} onChange={(ease) => patchAnim({ ease })} />
          </div>
          <Slider
            label="Overshoot"
            value={anim.overshoot}
            min={OVERSHOOT_RANGE.min}
            max={OVERSHOOT_RANGE.max}
            step={OVERSHOOT_RANGE.step}
            onChange={(overshoot) => patchAnim({ overshoot })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Rubberband"
            value={anim.rubberband}
            min={RUBBERBAND_RANGE.min}
            max={RUBBERBAND_RANGE.max}
            step={RUBBERBAND_RANGE.step}
            onChange={(rubberband) => patchAnim({ rubberband })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Collapse"
            value={anim.collapse}
            min={COLLAPSE_RANGE.min}
            max={COLLAPSE_RANGE.max}
            step={COLLAPSE_RANGE.step}
            onChange={(collapse) => patchAnim({ collapse })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Center Grow"
            value={anim.centerGrow}
            min={CENTER_GROW_RANGE.min}
            max={CENTER_GROW_RANGE.max}
            step={CENTER_GROW_RANGE.step}
            onChange={(centerGrow) => patchAnim({ centerGrow })}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <div className="curve-field">
            <span>Grow Curve</span>
            <CurveEditor
              value={anim.centerEase}
              onChange={(centerEase) => patchAnim({ centerEase })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
