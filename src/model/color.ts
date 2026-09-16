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

/** Convert 0..1 RGB back to "#RRGGBB". */
export function rgb01ToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(Math.max(v, 0), 1) * 255)
    .toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linearly blend a toward b by t (0 = all a, 1 = all b). */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}
