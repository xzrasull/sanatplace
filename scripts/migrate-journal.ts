import postgres from 'postgres';
import { getStorageClient } from '../src/lib/uploads/upload-image';
import { POSTS_BUCKET } from '../src/lib/uploads/buckets';

// «Афиша и журнал»: the posts table and the covers bucket. Only additions, so
// it is safe to run again; no existing table is touched.
//
//   npx dotenv -e .env.local -- npx tsx scripts/migrate-journal.ts
const SQL = `
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null check (category in ('exhibition', 'event', 'news', 'article')),
  title text not null,
  excerpt text check (char_length(excerpt) <= 200),
  body text,
  cover_url text not null,
  starts_on date,
  ends_on date,
  time_text text,
  place text,
  price_text text,
  signup_url text,
  artist_id uuid references users(id) on delete set null,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_dates_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists posts_status_published_idx on posts (status, published_at);
create index if not exists posts_starts_on_idx on posts (starts_on);
-- only one featured post at a time
create unique index if not exists posts_one_featured_idx on posts (is_featured) where is_featured;

-- The site reads and writes posts on the server (the admin check lives in the
-- server actions). Through Supabase's public API: anyone may read only
-- published posts, and nobody may write (no insert/update/delete policy).
alter table posts enable row level security;
drop policy if exists posts_public_read on posts;
create policy posts_public_read on posts for select
  using (status = 'published' and published_at is not null and published_at <= now());
`;

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: 'require', max: 1 });
  try {
    await sql.unsafe(SQL);
    console.log('Database: the posts table is in place.');
  } finally {
    await sql.end();
  }

  const { storage } = getStorageClient();
  const options = { public: true, fileSizeLimit: '5MB', allowedMimeTypes: ['image/jpeg', 'image/webp', 'image/png'] };
  const { data: existing } = await storage.getBucket(POSTS_BUCKET);
  const { error } = existing ? await storage.updateBucket(POSTS_BUCKET, options) : await storage.createBucket(POSTS_BUCKET, options);
  if (error) throw error;
  console.log(`Bucket "${POSTS_BUCKET}" ${existing ? 'updated' : 'created'} (public read, uploads from the server only).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
