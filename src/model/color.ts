export type Rgb = { r: number; g: number; b: number };

/** Parse "#RRGGBB" (or "#RGB") into normalized 0..1 components. */
export function hexToRgb01(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const int = parseInt(h, 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  return { r: r / 255, g: g / 255, b: b / 255 };
}
