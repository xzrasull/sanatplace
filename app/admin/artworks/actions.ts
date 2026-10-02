'use server';

import { requireStaff } from '@/src/lib/auth/staff';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { getDb } from '@/src/db';
import { approveOrRejectArtwork, deleteArtwork, findApprovedArtist } from '@/src/lib/artworks/admin-operations';
import { parseNewArtwork } from '@/src/lib/artworks/new-artwork-form';
import { createArtwork } from '@/src/lib/artworks/seller-operations';
import { isUuid } from '@/src/lib/gallery/types';
import { dropArtworkImages, tryUploadArtworkImage } from '@/src/lib/uploads/upload-image';
import { notifyArtworkApproved, notifyArtworkRejected } from '@/src/lib/telegram-bot/notify';

export async function approveArtwork(formData: FormData) {
  await requireStaff();
  const artworkId = String(formData.get('artworkId') ?? '').trim();
  if (!artworkId) redirect('/admin/artworks');
  await approveOrRejectArtwork(getDb(), { artworkId, adminUserId: null, decision: 'approve' });
  // the artist hears from the bot; the admin does not wait for Telegram
  after(() => notifyArtworkApproved(getDb(), artworkId));
  revalidateTag('exhibitions');
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
  revalidateTag('exhibitions');
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
  revalidateTag('exhibitions');
  revalidatePath('/', 'layout');
}

// An admin adds a painting for an artist who asked for it: it is the artist's
// from the start and goes up at once, and the artist hears from the bot as on
// an approval. The form is bound to the artist's id.
export async function addArtworkForArtist(sellerId: string, formData: FormData) {
  await requireStaff('admin');
  const artist = isUuid(sellerId) ? await findApprovedArtist(getDb(), sellerId) : undefined;
  if (!artist) redirect('/admin/artworks/new');
  const back = `/admin/artworks/new?seller=${artist.id}`;

  const fields = parseNewArtwork(formData);
  if (!fields) redirect(`${back}&error=invalid`);
  const { image, ...artwork } = fields;

  const upload = await tryUploadArtworkImage(image);
  if (upload.error !== undefined) redirect(`${back}&error=${upload.error}`);

  let id: string;
  try {
    id = await createArtwork(getDb(), {
      ...artwork,
      sellerId: artist.id,
      imageUrl: upload.url,
      widthPx: upload.width,
      heightPx: upload.height,
    });
  } catch (error) {
    // no row points at the uploaded photo
    await dropArtworkImages([upload.url]);
    throw error;
  }
  await approveOrRejectArtwork(getDb(), { artworkId: id, adminUserId: null, decision: 'approve' });
  after(() => notifyArtworkApproved(getDb(), id));
  // the catalog, the artist's page and the home rail
  revalidateTag('exhibitions');
  revalidatePath('/', 'layout');
  redirect(`${back}&added=${id}`);
}
