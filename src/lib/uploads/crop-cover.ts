// Browser side: cut a journal cover to 16:9 and shrink it to 1600px wide
// before upload. `position` (0–1) slides the frame along the side that is too
// long: 0 keeps the top (or left) edge, 1 the bottom (or right), 0.5 the middle.

export const COVER_RATIO = 16 / 9;
export const COVER_WIDTH = 1600;
// the aim for the stored file; quality drops once if it comes out heavier
const TARGET_BYTES = 400 * 1024;

export type CroppedCover = { file: File; width: number; height: number };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

// null when the browser can't decode the file (the server then decides).
export async function cropCover(file: File, position = 0.5): Promise<CroppedCover | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  const { width: bw, height: bh } = bitmap;
  const p = Math.min(1, Math.max(0, position));
  let sx = 0,
    sy = 0,
    sw = bw,
    sh = bh;
  if (bw / bh > COVER_RATIO) {
    sw = bh * COVER_RATIO;
    sx = (bw - sw) * p;
  } else {
    sh = bw / COVER_RATIO;
    sy = (bh - sh) * p;
  }
  const width = Math.max(1, Math.round(Math.min(COVER_WIDTH, sw)));
  const height = Math.max(1, Math.round(width / COVER_RATIO));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  let blob = await toBlob(canvas, 'image/webp', 0.84);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.86);
  if (blob && blob.size > TARGET_BYTES) blob = (await toBlob(canvas, blob.type, 0.72)) ?? blob;
  if (!blob) return null;
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const name = `${file.name.replace(/\.[^.]*$/, '') || 'cover'}.${ext}`;
  return { file: new File([blob], name, { type: blob.type }), width, height };
}
