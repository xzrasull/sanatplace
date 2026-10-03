import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { ARTWORK_IMAGES_BUCKET, AVATARS_BUCKET, BANNERS_BUCKET, POSTS_BUCKET } from '../src/lib/uploads/buckets';
import { getStorageClient } from '../src/lib/uploads/upload-image';
import { assertTestDatabase } from '../tests/helpers/assert-test-database';

// Prepares an empty Supabase project for the tests: the tables of
// tests/db/schema.sql (the live database's structure, no rows) and the public
// buckets. Safe to run again: existing tables are left as they are.
//
//   npm run test:db:setup
//
// A later scripts/migrate-*.ts has to be run on the test project as well:
//
//   npx dotenv -e .env.test -e .env.local -- npx tsx scripts/migrate-….ts
const SCHEMA_FILE = 'tests/db/schema.sql';

const IMAGES = ['image/jpeg', 'image/webp', 'image/png'];
const BUCKETS = [
  { name: ARTWORK_IMAGES_BUCKET, fileSizeLimit: '10MB', allowedMimeTypes: [...IMAGES, 'image/gif', 'image/avif'] },
  { name: BANNERS_BUCKET, fileSizeLimit: '5MB', allowedMimeTypes: IMAGES },
  { name: AVATARS_BUCKET, fileSizeLimit: '5MB', allowedMimeTypes: IMAGES },
  { name: POSTS_BUCKET, fileSizeLimit: '5MB', allowedMimeTypes: IMAGES },
];

// pg_dump's output is meant for psql. Its meta-commands are not SQL, and its
// session settings would stay on the pooler's shared connection, so both go;
// every name in the dump carries its schema, so nothing depends on them.
function schemaSql(): string {
  return readFileSync(SCHEMA_FILE, 'utf8')
    .split('\n')
    .filter((line) => !/^(\\|SET |SELECT pg_catalog\.set_config|CREATE SCHEMA public|COMMENT ON SCHEMA public)/.test(line))
    .join('\n');
}

async function main() {
  assertTestDatabase();

  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: 'require', max: 1 });
  try {
    const [{ exists }] = await sql`select to_regclass('public.users') is not null as exists`;
    if (exists) {
      console.log('Database: the tables are already there, left as they are.');
    } else {
      await sql.begin((tx) => tx.unsafe(schemaSql()));
      console.log(`Database: tables created from ${SCHEMA_FILE}.`);
    }
  } finally {
    await sql.end();
  }

  const { storage } = getStorageClient();
  for (const { name, ...limits } of BUCKETS) {
    const options = { public: true, ...limits };
    const { data: existing } = await storage.getBucket(name);
    const { error } = existing ? await storage.updateBucket(name, options) : await storage.createBucket(name, options);
    if (error) throw error;
    console.log(`Bucket "${name}" ${existing ? 'updated' : 'created'}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
