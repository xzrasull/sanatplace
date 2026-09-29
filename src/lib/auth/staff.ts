import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionSecret } from './session-token';
import { readStaffSession } from './staff-accounts';
import { STAFF_COOKIE, STAFF_MAX_AGE_SECONDS, createStaffToken, type StaffRole, type StaffSession } from './staff-token';

export type { StaffRole, StaffSession };

// The signed-in staff member, or null.
export async function getStaffSession(): Promise<StaffSession | null> {
  return readStaffSession((await cookies()).get(STAFF_COOKIE)?.value);
}

// The signed-in staff role, or null.
export async function getStaffRole(): Promise<StaffRole | null> {
  return (await getStaffSession())?.role ?? null;
}

// For staff pages and actions: moderators and admins get in; `admin` pages
// only admins. Anyone else goes to the staff sign-in.
export async function requireStaff(level: 'moderator' | 'admin' = 'moderator'): Promise<StaffRole> {
  const role = await getStaffRole();
  if (!role) redirect('/sanatadmin');
  if (level === 'admin' && role !== 'admin') redirect('/admin/sellers');
  return role;
}

export async function startStaffSession(role: StaffRole, login: string) {
  (await cookies()).set(STAFF_COOKIE, await createStaffToken(role, login, getSessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: STAFF_MAX_AGE_SECONDS,
  });
}

export async function endStaffSession() {
  (await cookies()).delete(STAFF_COOKIE);
}
