'use server';

import { redirect } from 'next/navigation';
import { getStaffSession, requireStaff, startStaffSession } from '@/src/lib/auth/staff';
import { saveStaffPassword, savedStaffHash } from '@/src/lib/auth/staff-accounts';
import {
  MIN_STAFF_PASSWORD_LENGTH,
  STAFF_ACCOUNTS,
  checkStaffLogin,
  hashStaffPassword,
} from '@/src/lib/auth/staff-password';

// The admin sets a new password for a staff login, confirming with their own
// current password. Older sessions of that login end; the admin's own session
// is renewed when they change their own password.
export async function changeStaffPassword(formData: FormData) {
  await requireStaff('admin');
  const me = await getStaffSession();
  if (!me) redirect('/sanatadmin');

  const account = STAFF_ACCOUNTS.find((a) => a.login === formData.get('login'));
  if (!account) redirect('/admin/staff');
  const back = (error: string): never => redirect(`/admin/staff?error=${error}&for=${account.login}`);

  const password = String(formData.get('password') ?? '');
  if (password.trim().length < MIN_STAFF_PASSWORD_LENGTH) back('short');
  if (password !== String(formData.get('repeat') ?? '')) back('mismatch');

  const current = await checkStaffLogin(me.login, String(formData.get('current') ?? ''), savedStaffHash);
  if (!current.ok) back('current');

  try {
    await saveStaffPassword(account.login, await hashStaffPassword(password));
  } catch (e) {
    console.error('staff password save failed', e);
    back('save');
  }
  if (account.login === me.login) await startStaffSession(me.role, me.login);
  redirect(`/admin/staff?done=${account.login}`);
}
