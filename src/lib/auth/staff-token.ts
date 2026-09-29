import { encoder, fromBase64Url, hmacSha256, safeEqual, toBase64Url } from './crypto';

// Staff (admin and moderator) sign in at /sanatadmin with a login and password,
// not Telegram. Their session is its own cookie, separate from the site's
// Telegram session, and shorter-lived. Web Crypto only, so middleware can read it.

export const STAFF_COOKIE = 'staff';
export const STAFF_MAX_AGE_SECONDS = 12 * 60 * 60;

export type StaffRole = 'admin' | 'moderator';

// Who is signed in and when: `iat` lets a password change end older sessions.
export interface StaffSession {
  role: StaffRole;
  login: string;
  iat: number;
}

interface StaffPayload extends StaffSession {
  exp: number;
}

// Signed over a "staff." prefix so a site session token can never pass as a staff one.
const sign = async (body: string, secret: string) =>
  toBase64Url(await hmacSha256(encoder.encode(secret), `staff.${body}`));

export async function createStaffToken(
  role: StaffRole,
  login: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: StaffPayload = { role, login, iat: nowSeconds, exp: nowSeconds + STAFF_MAX_AGE_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, secret)}`;
}

// The session in a valid, unexpired staff token, otherwise null. Tokens from
// before the login was added to them are refused: those staff sign in again.
export async function readStaffToken(
  token: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<StaffSession | null> {
  if (!token) return null;
  const [body, signature, ...rest] = token.split('.');
  if (!body || !signature || rest.length) return null;
  if (!safeEqual(await sign(body, secret), signature)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as StaffPayload;
    if (payload.role !== 'admin' && payload.role !== 'moderator') return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
    if (typeof payload.login !== 'string' || typeof payload.iat !== 'number') return null;
    return { role: payload.role, login: payload.login, iat: payload.iat };
  } catch {
    return null;
  }
}
