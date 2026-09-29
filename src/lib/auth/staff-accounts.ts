import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { staffAccounts } from '../../db/schema';
import { getSessionSecret } from './session-token';
import { readStaffToken, type StaffSession } from './staff-token';

// Staff passwords the admin set in the admin area. Reads fall back to "nothing
// saved" when the database can't answer (say, the table isn't created yet), so
// the passwords from the environment variables keep working.

async function savedRow(login: string) {
  try {
    const [row] = await getDb().select().from(staffAccounts).where(eq(staffAccounts.login, login));
    return row ?? null;
  } catch (e) {
    console.error('staff_accounts read failed', e);
    return null;
  }
}

export async function savedStaffHash(login: string): Promise<string | null> {
  return (await savedRow(login))?.passwordHash ?? null;
}

// When each login's password was last set in the admin area; `ready` is false
// when the table can't be read (not created yet), so changes can't be saved.
export async function staffPasswordDates(): Promise<{ ready: boolean; changed: Map<string, Date> }> {
  try {
    const rows = await getDb()
      .select({ login: staffAccounts.login, at: staffAccounts.passwordChangedAt })
      .from(staffAccounts);
    return { ready: true, changed: new Map(rows.map((r) => [r.login, r.at])) };
  } catch (e) {
    console.error('staff_accounts read failed', e);
    return { ready: false, changed: new Map() };
  }
}

// Stores the new hash; sessions of this login started before now stop counting.
export async function saveStaffPassword(login: string, passwordHash: string): Promise<void> {
  const passwordChangedAt = new Date();
  await getDb()
    .insert(staffAccounts)
    .values({ login, passwordHash, passwordChangedAt })
    .onConflictDoUpdate({ target: staffAccounts.login, set: { passwordHash, passwordChangedAt } });
}

// The session in a staff cookie, if it is valid and began after the last
// password change of its login.
export async function readStaffSession(token: string | undefined): Promise<StaffSession | null> {
  const session = await readStaffToken(token, getSessionSecret());
  if (!session) return null;
  const row = await savedRow(session.login);
  if (row && session.iat < Math.floor(row.passwordChangedAt.getTime() / 1000)) return null;
  return session;
}
