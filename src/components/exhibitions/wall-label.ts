// The label painted on the wall under a work: its title, the artist and a
// «Подробнее» button, drawn on a transparent canvas that becomes a texture.

const PX_W = 1024;
const PX_H = 288;
export const LABEL_W = 1.2; // m on the wall
export const LABEL_H = (LABEL_W * PX_H) / PX_W;

// where the button is, in the plane's uv (0..1, v up)
export type Box = { u0: number; v0: number; u1: number; v1: number };

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function drawLabel(title: string, artist: string): { canvas: HTMLCanvasElement; more: Box } {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [PX_W, PX_H];
  const g = canvas.getContext('2d')!;
  const font = css('--font-nunito-sans', 'sans-serif');
  const [ink, mute, sage] = [css('--ink', '#232a25'), css('--mute', '#6b6b6b'), css('--sage', '#617f6c')];
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  // the title shrinks to fit, then is cut with an ellipsis
  let size = 76;
  g.font = `700 ${size}px ${font}`;
  while (g.measureText(title).width > PX_W - 40 && size > 52) g.font = `700 ${(size -= 2)}px ${font}`;
  let shown = title;
  while (g.measureText(shown).width > PX_W - 40 && shown.length > 1) shown = shown.slice(0, -2) + '…';
  g.fillStyle = ink;
  g.fillText(shown, PX_W / 2, 76);

  g.font = `600 50px ${font}`;
  g.fillStyle = mute;
  g.fillText(artist, PX_W / 2, 142);

  // the button
  g.font = `700 50px ${font}`;
  const text = 'Подробнее';
  const bw = g.measureText(text).width + 88;
  const [bh, by] = [88, 182];
  const bx = (PX_W - bw) / 2;
  g.fillStyle = sage;
  g.beginPath();
  g.roundRect(bx, by, bw, bh, bh / 2);
  g.fill();
  g.fillStyle = '#fff';
  g.fillText(text, PX_W / 2, by + 61);

  return { canvas, more: { u0: bx / PX_W, u1: (bx + bw) / PX_W, v0: 1 - (by + bh) / PX_H, v1: 1 - by / PX_H } };
}
