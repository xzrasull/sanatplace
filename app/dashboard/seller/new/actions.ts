'use server';

import { getCurrentUser } from '@/src/lib/auth/session';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getDb } from '@/src/db';
import { notifyAdminsOfArtwork } from '@/src/lib/telegram-bot/notify';
import { createArtwork } from '@/src/lib/artworks/seller-operations';
import { parseNewArtwork } from '@/src/lib/artworks/new-artwork-form';
import { dropArtworkImages, tryUploadArtworkImage } from '@/src/lib/uploads/upload-image';

export async function submitNewArtwork(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (!user || user.role !== 'seller') redirect('/');

  const fields = parseNewArtwork(formData);
  if (!fields) redirect('/dashboard/seller/new?error=invalid');
  const { image, ...artwork } = fields;

  const upload = await tryUploadArtworkImage(image);
  if (upload.error !== undefined) redirect(`/dashboard/seller/new?error=${upload.error}`);

  try {
    const id = await createArtwork(getDb(), {
      ...artwork,
      sellerId: user.id,
      imageUrl: upload.url,
      widthPx: upload.width,
      heightPx: upload.height,
    });
    after(() => notifyAdminsOfArtwork(getDb(), id));
  } catch (error) {
    // no row points at the uploaded photo
    await dropArtworkImages([upload.url]);
    throw error;
  }

  redirect('/dashboard/seller');
}
