'use server';

import { getCurrentUser } from '@/src/lib/auth/session';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getDb } from '@/src/db';
import { createSellerApplication } from '@/src/lib/sellers/applications';
import { parseSellerProfileForm } from '@/src/lib/sellers/profile-form';
import { hasSellerConsent } from '@/src/lib/legal';
import { notifyAdminOfApplication } from '@/src/lib/telegram-bot/notify';

export async function submitSellerApplication(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  // the page's checkbox is `required`; this covers requests that skip it
  if (!hasSellerConsent(formData)) redirect('/become-seller?error=consent');

  const profile = parseSellerProfileForm(formData);
  if (!profile) redirect('/become-seller?error=invalid');

  await createSellerApplication(getDb(), { userId: user.id, ...profile });
  after(() => notifyAdminOfApplication(getDb(), user.id));

  redirect('/become-seller/status');
}
