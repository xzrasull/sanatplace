// Where each work hangs in a hall's 3D room. Works keep their real size in cm
// and go round the room clockwise from the far wall: far, right, back, left.
// The room is 10 × 7 m at least and grows in steps when the works need more wall.

export const EYE = 1.6; // m, the visitor's eye height
const GAP = 1.2; // m between neighbouring works
const CORNER = 1; // m kept free at each end of a wall
const MIN_W = 10;
const MIN_D = 7;

export type Hung = {
  id: string;
  x: number;
  y: number; // the work's centre
  z: number;
  rotY: number; // turns a plane facing +z to face into the room
  w: number;
  h: number;
  standX: number; // where to stand to see it whole
  standZ: number;
};
export type RoomLayout = { width: number; depth: number; height: number; works: Hung[] };

type Wall = { x: number; z: number; dx: number; dz: number; nx: number; nz: number; len: number };

// in tour order; (x, z) is where the wall starts, (dx, dz) along it, (nx, nz) into the room
const walls = (W: number, D: number): Wall[] => [
  { x: -W / 2, z: -D / 2, dx: 1, dz: 0, nx: 0, nz: 1, len: W },
  { x: W / 2, z: -D / 2, dx: 0, dz: 1, nx: -1, nz: 0, len: D },
  { x: W / 2, z: D / 2, dx: -1, dz: 0, nx: 0, nz: -1, len: W },
  { x: -W / 2, z: D / 2, dx: 0, dz: -1, nx: 1, nz: 0, len: D },
];

// Works in order, split between the walls; undefined when they don't fit.
function pack(widths: number[], W: number, D: number): number[][] | undefined {
  const groups: number[][] = [[], [], [], []];
  let wall = 0;
  let used = 0;
  for (let i = 0; i < widths.length; i++) {
    const cap = walls(W, D)[wall].len - 2 * CORNER;
    const need = (groups[wall].length ? GAP : 0) + widths[i];
    if (used + need <= cap) {
      groups[wall].push(i);
      used += need;
      continue;
    }
    if (++wall > 3 || widths[i] > walls(W, D)[wall].len - 2 * CORNER) return undefined;
    groups[wall].push(i);
    used = widths[i];
  }
  return groups;
}

export function roomLayout(works: { id: string; heightCm: number; ratio: number }[]): RoomLayout {
  const sizes = works.map((w) => {
    const h = Math.max(0.15, (w.heightCm > 0 ? w.heightCm : 60) / 100);
    return { h, w: h * (w.ratio > 0 ? w.ratio : 0.8) };
  });
  let W = MIN_W;
  let D = MIN_D;
  let groups = pack(sizes.map((s) => s.w), W, D);
  while (!groups) {
    W += 0.5;
    D = Math.max(MIN_D, Math.round(W * 0.7 * 2) / 2);
    groups = pack(sizes.map((s) => s.w), W, D);
  }

  const hung: Hung[] = [];
  walls(W, D).forEach((wall, k) => {
    const ids = groups[k];
    const used = ids.reduce((sum, i) => sum + sizes[i].w, 0) + GAP * Math.max(0, ids.length - 1);
    let along = (wall.len - used) / 2;
    const depth = wall.dx ? D : W; // the room's size in front of this wall
    for (const i of ids) {
      const { w, h } = sizes[i];
      const mid = along + w / 2;
      along += w + GAP;
      const x = wall.x + wall.dx * mid + wall.nx * 0.03;
      const z = wall.z + wall.dz * mid + wall.nz * 0.03;
      // far enough that the work and its label take about half the view, never past the room's middle
      const back = Math.min(Math.max(2, Math.max(w, h) * 1.6 + 0.6), depth / 2);
      hung.push({
        id: works[i].id,
        x,
        y: Math.max(1.55, h / 2 + 0.75), // room for the label under it
        z,
        rotY: Math.atan2(wall.nx, wall.nz),
        w,
        h,
        standX: x + wall.nx * back,
        standZ: z + wall.nz * back,
      });
    }
  });
  const top = Math.max(0, ...hung.map((h) => h.y + h.h / 2));
  return { width: W, depth: D, height: Math.max(3.8, top + 0.8), works: hung };
}
