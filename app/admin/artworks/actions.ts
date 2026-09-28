'use server';

import { requireStaff } from '@/src/lib/auth/staff';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { getDb } from '@/src/db';
import { approveOrRejectArtwork, deleteArtwork } from '@/src/lib/artworks/admin-operations';
import { isUuid } from '@/src/lib/gallery/types';
import { dropArtworkImages } from '@/src/lib/uploads/upload-image';
import { notifyArtworkApproved, notifyArtworkRejected } from '@/src/lib/telegram-bot/notify';

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
  after(() => notifyArtworkRejected(getDb(), artworkId));
  revalidatePath('/admin/artworks');
}

// The admin removes an artwork everywhere: the row (its likes and collage slot
// go with it), the photo in storage, and every page that showed it.
export async function removeArtwork(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const gone = await deleteArtwork(getDb(), id);
  if (!gone) return;
  await dropArtworkImages([gone.imageUrl]);
  // the catalog, the artist's page, wishlists, the home rail and banners
  revalidateTag('banners');
  revalidatePath('/', 'layout');
}
