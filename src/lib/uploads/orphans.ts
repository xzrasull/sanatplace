import { ARTWORK_IMAGES_BUCKET, AVATARS_BUCKET, BANNERS_BUCKET, POSTS_BUCKET } from './buckets';

// Finding stored images nothing points at any more (left behind by replaced
// photos, failed saves or deleted rows), so they can be removed.

// The object path inside `bucket` for one of its public URLs, or null when
// the URL belongs to another bucket or another site.
export function storagePathOf(bucket: string, url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const path = url.slice(at + marker.length).split(/[?#]/)[0];
  return path ? decodeURIComponent(path) : null;
}

export type StoredFile = { name: string; size: number; createdAt: Date | null };

// Files not referenced by any URL. Files younger than `minAgeMs` are kept: an
// upload whose database row is still being written looks orphaned for a moment.
export function findOrphans(
  bucket: string,
  files: StoredFile[],
  referencedUrls: (string | null | undefined)[],
  now: Date,
  minAgeMs: number,
): StoredFile[] {
  const used = new Set(referencedUrls.map((u) => storagePathOf(bucket, u)).filter((p): p is string => p !== null));
  return files.filter(
    (f) => !used.has(f.name) && f.createdAt !== null && now.getTime() - f.createdAt.getTime() >= minAgeMs,
  );
}

// Where each table keeps its images: removing a row leaves these files unused.
export const IMAGE_COLUMNS: Record<string, { bucket: string; columns: string[] }> = {
  artworks: { bucket: ARTWORK_IMAGES_BUCKET, columns: ['imageUrl'] },
  banners: { bucket: BANNERS_BUCKET, columns: ['imageUrl', 'imageMobileUrl'] },
  seller_applications: { bucket: AVATARS_BUCKET, columns: ['avatarUrl'] },
  posts: { bucket: POSTS_BUCKET, columns: ['coverUrl'] },
};

export function imageUrlsOf(table: string, rows: Record<string, unknown>[]): string[] {
  const columns = IMAGE_COLUMNS[table]?.columns ?? [];
  return rows.flatMap((row) => columns.map((c) => row[c])).filter((v): v is string => typeof v === 'string' && v !== '');
}
