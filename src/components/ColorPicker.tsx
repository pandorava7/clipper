"use client";

import { hexToRgb, normalizeHex, rgbToHex } from "@/src/lib/image-tools";

import styles from "./ColorPicker.module.css";

type ColorPickerProps = {
  value: string;
  onChange: (nextColor: string) => void;
  onPickFromScreen?: () => void;
  eyeDropperSupported?: boolean;
};

export function ColorPicker({
  value,
  onChange,
  onPickFromScreen,
  eyeDropperSupported = false,
}: ColorPickerProps) {
  const rgb = hexToRgb(value) ?? { r: 0, g: 0, b: 0 };

  return (
    <div className={styles.panel}>
      <div className={styles.topRow}>
        <div className={styles.previewBlock}>
          <div className={styles.swatch} style={{ backgroundColor: value }} />
          <div className={styles.previewMeta}>
            <p className={styles.label}>背景颜色</p>
            <p className={styles.value}>{value}</p>
          </div>
        </div>

        <label className={styles.nativePickerLabel}>
          <span className={styles.nativePickerText}>色盘</span>
          <input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className={styles.nativePicker} />
        </label>
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>HEX</span>
          <input
            value={value}
            onChange={(event) => {
              const nextHex = normalizeHex(event.target.value);
              if (nextHex) {
                onChange(nextHex);
              }
            }}
            className={styles.fieldInput}
          />
        </label>

        <button
          type="button"
          onClick={onPickFromScreen}
          disabled={!eyeDropperSupported}
          className={styles.eyeDropperButton}
        >
          滴管取色
        </button>
      </div>

      <div className={styles.sliderGroup}>
        {([
          ["R", rgb.r, (nextValue: number) => onChange(rgbToHex(nextValue, rgb.g, rgb.b))],
          ["G", rgb.g, (nextValue: number) => onChange(rgbToHex(rgb.r, nextValue, rgb.b))],
          ["B", rgb.b, (nextValue: number) => onChange(rgbToHex(rgb.r, rgb.g, nextValue))],
        ] as const).map(([label, sliderValue, onSliderChange]) => (
          <label key={label} className={styles.sliderRow}>
            <span className={styles.sliderLabel}>{label}</span>
            <input
              type="range"
              min="0"
              max="255"
              value={sliderValue}
              onChange={(event) => onSliderChange(Number(event.target.value))}
              className={styles.slider}
            />
            <span className={styles.sliderValue}>{sliderValue}</span>
          </label>
        ))}
      </div>
    </div>
  );
}