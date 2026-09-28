'use server';

import { requireStaff } from '@/src/lib/auth/staff';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getDb } from '@/src/db';
import { approveOrRejectArtwork } from '@/src/lib/artworks/admin-operations';
import { notifyArtworkApproved } from '@/src/lib/telegram-bot/notify';

export async function approveArtwork(formData: FormData) {
  await requireStaff();
  const artworkId = String(formData.get('artworkId') ?? '').trim();
  if (!artworkId) redirect('/admin/artworks');
  await approveOrRejectArtwork(getDb(), { artworkId, adminUserId: null, decision: 'approve' });
  // the artist hears from the bot; the admin does not wait for Telegram
  after(() => notifyArtworkApproved(getDb(), artworkId));
  revalidatePath('/admin/artworks');
}

export async function rejectArtwork(formData: FormData) {
  await requireStaff();
  const artworkId = String(formData.get('artworkId') ?? '').trim();
  if (!artworkId) redirect('/admin/artworks');
  await approveOrRejectArtwork(getDb(), {
    artworkId,
    adminUserId: null,
    decision: 'reject',
    reason: String(formData.get('reason') || ''),
  });
  revalidatePath('/admin/artworks');
}
