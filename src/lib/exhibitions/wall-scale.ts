// The smallest work is drawn at least this share of the wall's height, so a
// miniature next to a big canvas stays visible.
export const MIN_SHARE = 0.3;

// Each work's height as a share of the wall: the tallest (in cm) is 1, the rest
// in proportion.
export function wallShares(heightsCm: number[]): number[] {
  const tallest = Math.max(0, ...heightsCm);
  if (tallest <= 0) return heightsCm.map(() => 1);
  return heightsCm.map((h) => Math.min(1, Math.max(MIN_SHARE, h / tallest)));
}

// width / height: the stored photo's, else the painting's size in cm, else 4:5
// (the same rule as the artwork page).
export function workRatio(w: { widthCm: number; heightCm: number; widthPx: number | null; heightPx: number | null }): number {
  if (w.widthPx && w.heightPx) return w.widthPx / w.heightPx;
  if (w.widthCm > 0 && w.heightCm > 0) return w.widthCm / w.heightCm;
  return 4 / 5;
}
