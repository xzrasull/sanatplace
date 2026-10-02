// width / height: the stored photo's, else the painting's size in cm, else 4:5
// (the same rule as the artwork page).
export function workRatio(w: { widthCm: number; heightCm: number; widthPx: number | null; heightPx: number | null }): number {
  if (w.widthPx && w.heightPx) return w.widthPx / w.heightPx;
  if (w.widthCm > 0 && w.heightCm > 0) return w.widthCm / w.heightCm;
  return 4 / 5;
}
