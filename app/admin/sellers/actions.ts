'use server';

import { requireStaff } from '@/src/lib/auth/staff';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getDb } from '@/src/db';
import { approveOrRejectApplication } from '@/src/lib/sellers/applications';
import { changeSellerAvatar } from '@/src/lib/sellers/avatar';
import { isUuid } from '@/src/lib/gallery/types';
import { notifySellerApproved } from '@/src/lib/telegram-bot/notify';

export async function approveApplication(formData: FormData) {
  await requireStaff();
  const applicationIdRaw = formData.get('applicationId');
  if (typeof applicationIdRaw !== 'string' || !applicationIdRaw.trim()) {
    redirect('/admin/sellers');
  }
  await approveOrRejectApplication(getDb(), {
    applicationId: applicationIdRaw,
    adminUserId: null,
    decision: 'approve',
  });
  // the artist hears from the bot; the admin does not wait for Telegram
  after(() => notifySellerApproved(getDb(), applicationIdRaw));
  revalidatePath('/admin/sellers');
}

export async function rejectApplication(formData: FormData) {
  await requireStaff();
  const applicationIdRaw = formData.get('applicationId');
  if (typeof applicationIdRaw !== 'string' || !applicationIdRaw.trim()) {
    redirect('/admin/sellers');
  }
  await approveOrRejectApplication(getDb(), {
    applicationId: applicationIdRaw,
    adminUserId: null,
    decision: 'reject',
    reason: String(formData.get('reason') || ''),
  });
  revalidatePath('/admin/sellers');
}

// Staff set or remove an artist's photo.
export async function setArtistAvatar(formData: FormData) {
  await requireStaff();
  const userId = String(formData.get('userId') ?? '');
  if (!isUuid(userId)) redirect('/admin/sellers');
  const result = await changeSellerAvatar(userId, formData);
  revalidatePath('/artists');
  revalidatePath(`/gallery/artist/${userId}`);
  redirect(`/admin/sellers?photo=${result}#artists`);
}
