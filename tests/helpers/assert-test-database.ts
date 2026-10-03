import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Tests create and delete rows and stored files, so they must never touch the
// live project. They take the database and the storage from .env.test (a
// separate Supabase project); .env.local, which holds the live one, only fills
// in the rest. Throws unless that is how the process was started.
export function assertTestDatabase(): void {
  const { DATABASE_URL, SUPABASE_URL } = process.env;
  if (!DATABASE_URL || !SUPABASE_URL) {
    throw new Error('Tests need DATABASE_URL and SUPABASE_URL of the test Supabase project. Put them in .env.test.');
  }

  const live = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
  if (DATABASE_URL === live.DATABASE_URL || SUPABASE_URL === live.SUPABASE_URL) {
    throw new Error(
      'Refusing to run: the tests are pointed at the live project from .env.local. ' +
        'Put DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY of the test Supabase project in .env.test.',
    );
  }

  // The database and the storage must be one project, so a half-filled
  // .env.test cannot pair the test storage with the live database.
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  if (!DATABASE_URL.includes(projectRef)) {
    throw new Error(`Refusing to run: DATABASE_URL is not the database of the Supabase project "${projectRef}" from SUPABASE_URL.`);
  }
}
