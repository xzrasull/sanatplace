import postgres from 'postgres';

// Online exhibitions: the exhibitions, exhibition_halls and exhibition_works
// tables. Only additions, so it is safe to run again; no existing table is
// touched. Covers reuse the existing 'posts' bucket.
//
//   npx dotenv -e .env.local -- npx tsx scripts/migrate-exhibitions.ts
const SQL = `
create table if not exists exhibitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  curator_name text,
  intro text,
  cover_url text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  post_id uuid references posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exhibitions_dates_order check (ends_on >= starts_on)
);
create index if not exists exhibitions_status_starts_idx on exhibitions (status, starts_on);

create table if not exists exhibition_halls (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references exhibitions(id) on delete cascade,
  position integer not null,
  title text not null,
  intro text,
  wall_color text
);
create index if not exists exhibition_halls_exhibition_idx on exhibition_halls (exhibition_id, position);

create table if not exists exhibition_works (
  hall_id uuid not null references exhibition_halls(id) on delete cascade,
  artwork_id uuid not null references artworks(id) on delete cascade,
  exhibition_id uuid not null references exhibitions(id) on delete cascade,
  position integer not null,
  curator_note text,
  primary key (hall_id, artwork_id),
  constraint exhibition_works_once unique (exhibition_id, artwork_id)
);
create index if not exists exhibition_works_artwork_idx on exhibition_works (artwork_id);

-- No policies: the app connects as the table owner, and Supabase's public API
-- must not see these tables (same as staff_accounts).
alter table exhibitions enable row level security;
alter table exhibition_halls enable row level security;
alter table exhibition_works enable row level security;
`;

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: 'require', max: 1 });
  try {
    await sql.unsafe(SQL);
    console.log('Database: the exhibitions tables are in place.');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
