'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkStaffLogin } from '@/src/lib/auth/staff-password';
import { endStaffSession, startStaffSession } from '@/src/lib/auth/staff';
import { savedStaffHash } from '@/src/lib/auth/staff-accounts';

// Failed attempts per client address: 5 per 15 minutes. In memory, so it is
// per server instance, a brake on guessing rather than a wall.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

function recentFailures(ip: string, now: number) {
  const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(ip, list);
  return list;
}

export async function staffSignIn(formData: FormData) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
  const now = Date.now();
  if (recentFailures(ip, now).length >= MAX_FAILURES) redirect('/sanatadmin?error=too_many');

  const login = String(formData.get('login') ?? '');
  const password = String(formData.get('password') ?? '');
  const result = await checkStaffLogin(login, password, savedStaffHash);
  if (!result.ok) {
    if (result.reason === 'not_configured') redirect('/sanatadmin?error=not_configured');
    recentFailures(ip, now).push(now);
    redirect('/sanatadmin?error=invalid');
  }
  failures.delete(ip);
  await startStaffSession(result.role, result.login);
  redirect(result.role === 'admin' ? '/admin/database' : '/admin/sellers');
}

export async function staffSignOut() {
  await endStaffSession();
  redirect('/sanatadmin');
}
