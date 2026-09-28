// Finds images in the public buckets that no database row points at any more
// (replaced artwork photos, failed saves, deleted rows) and removes them.
//
//   npx dotenv -e .env.local -- npx tsx scripts/prune-orphan-images.ts           # report only
//   npx dotenv -e .env.local -- npx tsx scripts/prune-orphan-images.ts --apply   # delete
//
// Files younger than a day are never touched: an upload whose row is still
// being saved looks orphaned for a moment.
import { getDb } from '../src/db';
import { ARTWORK_IMAGES_BUCKET, AVATARS_BUCKET, BANNERS_BUCKET, POSTS_BUCKET } from '../src/lib/uploads/buckets';
import { findOrphans, type StoredFile } from '../src/lib/uploads/orphans';
import { listReferencedImageUrls } from '../src/lib/uploads/references';
import { getStorageClient } from '../src/lib/uploads/upload-image';

const BUCKETS = [ARTWORK_IMAGES_BUCKET, AVATARS_BUCKET, BANNERS_BUCKET, POSTS_BUCKET];
const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE = 1000;
const REMOVE_BATCH = 100;

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

// Every file at the bucket's root (uploads are stored flat as <uuid>.webp).
async function listFiles(bucket: string): Promise<StoredFile[]> {
  const storage = getStorageClient().storage.from(bucket);
  const files: StoredFile[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.list('', { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`listing "${bucket}" failed: ${error.message}`);
    for (const f of data) {
      if (!f.id) continue; // a folder, not a file
      files.push({
        name: f.name,
        size: Number(f.metadata?.size ?? 0),
        createdAt: f.created_at ? new Date(f.created_at) : null,
      });
    }
    if (data.length < PAGE) return files;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const referenced = await listReferencedImageUrls(getDb());
  const now = new Date();
  let totalFiles = 0;
  let totalBytes = 0;

  for (const bucket of BUCKETS) {
    const files = await listFiles(bucket);
    const orphans = findOrphans(bucket, files, referenced, now, MIN_AGE_MS);
    const bytes = orphans.reduce((sum, f) => sum + f.size, 0);
    const all = files.reduce((sum, f) => sum + f.size, 0);
    console.log(`${bucket}: ${files.length} files, ${kb(all)}; unused: ${orphans.length}, ${kb(bytes)}`);
    for (const f of orphans) console.log(`  - ${f.name} (${kb(f.size)}, ${f.createdAt?.toISOString().slice(0, 10)})`);
    totalFiles += orphans.length;
    totalBytes += bytes;

    if (!apply || orphans.length === 0) continue;
    const storage = getStorageClient().storage.from(bucket);
    for (let i = 0; i < orphans.length; i += REMOVE_BATCH) {
      const { error } = await storage.remove(orphans.slice(i, i + REMOVE_BATCH).map((f) => f.name));
      if (error) throw new Error(`deleting from "${bucket}" failed: ${error.message}`);
    }
    console.log(`  → deleted ${orphans.length} file(s)`);
  }

  console.log(
    `\nUnused in total: ${totalFiles} file(s), ${kb(totalBytes)}${apply ? ' — deleted' : ' (report only; pass --apply to delete)'}`,
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
