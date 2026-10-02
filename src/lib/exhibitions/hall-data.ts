import { WALL_COLORS, type WallColor } from './exhibition-form';
import type { ExhibitionViewData } from './queries';
import { workRatio } from './wall-scale';

export type HallData = {
  id: string;
  number: number;
  title: string;
  wall: string | null;
  works: { id: string; title: string; artistName: string; imageUrl: string; heightCm: number; ratio: number }[];
};

// What the 3D hall page needs of each hall: its colour and its works' sizes.
export function hallsOf(view: ExhibitionViewData): HallData[] {
  return view.halls.map((h, i) => ({
    id: h.id,
    number: i + 1,
    title: h.title,
    wall: h.wallColor && Object.hasOwn(WALL_COLORS, h.wallColor) ? WALL_COLORS[h.wallColor as WallColor].value : null,
    works: h.works.map((w) => ({
      id: w.id,
      title: w.title,
      artistName: w.artistName,
      imageUrl: w.imageUrl,
      heightCm: w.heightCm,
      ratio: workRatio(w),
    })),
  }));
}

// ?hall=2 → 1; anything else → the first hall
export function hallIndex(param: string | string[] | undefined, count: number): number {
  const n = Number(Array.isArray(param) ? param[0] : param);
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : 0;
}
