import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { StaffRole } from './staff-token';

// Staff logins. The passwords are never in the code (the repository is
// public): only their salted scrypt hashes, in environment variables, made
// with `npx tsx scripts/hash-staff-password.ts <password>`. Once the admin sets
// a password in the admin area, its hash in the database is used instead.
export const STAFF_ACCOUNTS: { login: string; role: StaffRole; hashEnv: string }[] = [
  { login: 'admin', role: 'admin', hashEnv: 'STAFF_ADMIN_PASSWORD_HASH' },
  { login: 'moder', role: 'moderator', hashEnv: 'STAFF_MODERATOR_PASSWORD_HASH' },
];

const KEY_LENGTH = 32;
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, PARAMS, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

// Format: scrypt:<salt base64>:<hash base64> (no "$": .env files would expand it)
export async function hashStaffPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString('base64')}:${(await derive(password, salt)).toString('base64')}`;
}

export async function verifyStaffPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split(':');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await derive(password, Buffer.from(saltB64, 'base64'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const MIN_STAFF_PASSWORD_LENGTH = 10;

export type StaffLoginResult =
  | { ok: true; role: StaffRole; login: string }
  | { ok: false; reason: 'invalid' | 'not_configured' };

// Checks a login and password. `savedHash` gives the hash set in the admin
// area, if any; otherwise the environment variable's is used. A wrong login
// still runs scrypt, so the answer takes the same time whether or not the
// login exists.
export async function checkStaffLogin(
  login: string,
  password: string,
  savedHash: (login: string) => Promise<string | null> = async () => null,
): Promise<StaffLoginResult> {
  const account = STAFF_ACCOUNTS.find((a) => a.login === login.trim().toLowerCase());
  const saved = account ? await savedHash(account.login) : null;
  const configured = saved || STAFF_ACCOUNTS.some((a) => process.env[a.hashEnv]);
  if (!configured) return { ok: false, reason: 'not_configured' };
  const stored = saved ?? (account ? process.env[account.hashEnv] : undefined);
  const ok = await verifyStaffPassword(password, stored ?? 'scrypt:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
  return ok && account && stored
    ? { ok: true, role: account.role, login: account.login }
    : { ok: false, reason: 'invalid' };
}
