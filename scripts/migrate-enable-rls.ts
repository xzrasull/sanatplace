import postgres from 'postgres';

// Row level security on every table that did not have it, so Supabase's public
// Data API (the anon key) can no longer read or write them. No policies are
// added: nothing but the app uses these tables, and the app connects as their
// owner, which RLS doesn't apply to. Safe to run again.
//
// Before changing anything it checks exactly that: if the connection is not
// the owner of a table (and cannot bypass RLS), turning RLS on would lock the
// site out of its own data, so the script stops and changes nothing.
//
//   npx dotenv -e .env.local -- npx tsx scripts/migrate-enable-rls.ts
//   npx dotenv -e .env.test -e .env.local -- npx tsx scripts/migrate-enable-rls.ts
const TABLES = [
  'users',
  'seller_applications',
  'categories',
  'techniques',
  'artworks',
  'login_requests',
  'artwork_likes',
  'home_collage',
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: 'require', max: 1 });
  try {
    await sql.begin(async (tx) => {
      const rows = await tx<{ name: string; rls: boolean; forced: boolean; mine: boolean }[]>`
        select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as forced,
               (pg_get_userbyid(c.relowner) = current_user
                 or (select rolbypassrls from pg_roles where rolname = current_user)) as mine
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname in ${tx(TABLES)}`;

      const missing = TABLES.filter((t) => !rows.some((r) => r.name === t));
      if (missing.length) throw new Error(`Tables not found: ${missing.join(', ')}. Nothing was changed.`);
      const locked = rows.filter((r) => !r.mine || r.forced).map((r) => r.name);
      if (locked.length) {
        throw new Error(
          `The app's connection would lose access to: ${locked.join(', ')} ` +
            '(it is not their owner, or RLS is forced on them). Nothing was changed.',
        );
      }

      for (const { name, rls } of rows) {
        if (rls) continue;
        await tx.unsafe(`alter table public.${name} enable row level security`);
      }
      const turnedOn = rows.filter((r) => !r.rls).map((r) => r.name);
      console.log(turnedOn.length ? `RLS turned on: ${turnedOn.join(', ')}.` : 'RLS was already on for every table.');
    });
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
