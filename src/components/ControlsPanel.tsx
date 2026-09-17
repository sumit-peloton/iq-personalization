import Slider from "./Slider";
import CurveEditor from "./CurveEditor";
import {
  CENTER_GROW_RANGE,
  COLLAPSE_RANGE,
  COLOR_SHIFT_RANGE,
  DIM_OPACITY_RANGE,
  FALLOFF_RANGE,
  INTENSITY_RANGE,
  OVERSHOOT_RANGE,
  RADIUS_RANGE,
  RING_SHRINK_RANGE,
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
  // Capability flags decide which controls are relevant for the active type,
  // instead of stacking type === "x" checks throughout the markup.
  const isRotate = anim.type === "rotate-clockwise" || anim.type === "syncing";
  const isPulse = anim.type === "thinking-pulse";
  const hasDim = anim.type === "sleeping";
  const hasColorShift = anim.type === "alert" || anim.type === "success";
  // Types that use the breath/spring shaping (curve + overshoot + rubberband).
  // The character states carry their own baked motion, so they only expose Speed
  // (plus color for alert/success, dim for sleeping).
  const usesShaping = isPulse || isRotate;
  // Ring/dot shrink is only meaningful for the collapse & rotate families.
  const hasRingShrink = isPulse || isRotate;

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

        <Slider
          label="Falloff"
          value={settings.glowFalloff}
          min={FALLOFF_RANGE.min}
          max={FALLOFF_RANGE.max}
          step={FALLOFF_RANGE.step}
          disabled={!on}
          onChange={(glowFalloff) => patch({ glowFalloff })}
          format={(v) => v < 0.2 ? "Soft" : v > 0.8 ? "Sharp" : `${Math.round(v * 100)}%`}
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
          {hasDim && (
            <Slider
              label="Dim"
              value={anim.dimOpacity}
              min={DIM_OPACITY_RANGE.min}
              max={DIM_OPACITY_RANGE.max}
              step={DIM_OPACITY_RANGE.step}
              onChange={(dimOpacity) => patchAnim({ dimOpacity })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          )}
          {hasColorShift && (<>
            <Slider
              label="Color Shift"
              value={anim.colorShift}
              min={COLOR_SHIFT_RANGE.min}
              max={COLOR_SHIFT_RANGE.max}
              step={COLOR_SHIFT_RANGE.step}
              onChange={(colorShift) => patchAnim({ colorShift })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <label className="color-field">
              <span>{anim.type === "alert" ? "Alert" : "Accent"}</span>
              <input
                type="color"
                value={anim.alertColor}
                onChange={(e) => patchAnim({ alertColor: e.target.value })}
              />
            </label>
          </>)}
          {usesShaping && <>
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
            {hasRingShrink && (
              <Slider
                label={isRotate ? "Dot Shrink" : "Ring Shrink"}
                value={anim.ringShrink}
                min={RING_SHRINK_RANGE.min}
                max={RING_SHRINK_RANGE.max}
                step={RING_SHRINK_RANGE.step}
                onChange={(ringShrink) => patchAnim({ ringShrink })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            )}
            {isRotate && (<>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={anim.centerMatchRing}
                  onChange={(e) => patchAnim({ centerMatchRing: e.target.checked })}
                />
                <span>Center Matches</span>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={anim.rotateHold}
                  onChange={(e) => patchAnim({ rotateHold: e.target.checked })}
                />
                <span>Hold</span>
              </label>
            </>)}
            {isPulse && <>
              <Slider
                label="Collapse"
                value={anim.collapse}
                min={COLLAPSE_RANGE.min}
                max={COLLAPSE_RANGE.max}
                step={COLLAPSE_RANGE.step}
                onChange={(collapse) => patchAnim({ collapse })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={anim.centerGrowEnabled}
                  onChange={(e) => patchAnim({ centerGrowEnabled: e.target.checked })}
                />
                <span>Center Grow</span>
              </label>
              <div className={`group${anim.centerGrowEnabled ? "" : " group-disabled"}`}>
                <Slider
                  label="Size"
                  value={anim.centerGrow}
                  min={CENTER_GROW_RANGE.min}
                  max={CENTER_GROW_RANGE.max}
                  step={CENTER_GROW_RANGE.step}
                  disabled={!anim.centerGrowEnabled}
                  onChange={(centerGrow) => patchAnim({ centerGrow })}
                  format={(v) => `${v.toFixed(2)}×`}
                />
              </div>
            </>}
          </>}
        </div>
      )}
    </div>
  );
}
