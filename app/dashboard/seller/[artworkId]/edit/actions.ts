'use server';

import { getCurrentUser } from '@/src/lib/auth/session';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getDb } from '@/src/db';
import { notifyAdminOfArtwork } from '@/src/lib/telegram-bot/notify';
import { getArtworkForOwner, updateArtwork } from '@/src/lib/artworks/seller-operations';
import { dropArtworkImages, tryUploadArtworkImage } from '@/src/lib/uploads/upload-image';
import { parseYear } from '@/src/lib/artworks/year';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export async function submitEditArtwork(artworkId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (!user || user.role !== 'seller') redirect('/');

  const existing = await getArtworkForOwner(getDb(), { artworkId, sellerId: user.id });
  if (!existing) redirect('/dashboard/seller');

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const price = Number(formData.get('price'));
  const heightCm = Number(formData.get('heightCm'));
  const widthCm = Number(formData.get('widthCm'));
  const categoryId = String(formData.get('categoryId') ?? '').trim();
  const techniqueId = String(formData.get('techniqueId') ?? '').trim();
  const year = parseYear(formData.get('year'));
  const image = formData.get('image');

  const validNumbers =
    Number.isFinite(price) && price > 0 && Number.isFinite(heightCm) && heightCm > 0 && Number.isFinite(widthCm) && widthCm > 0;

  if (
    !title ||
    !description ||
    title.length > MAX_TITLE_LENGTH ||
    description.length > MAX_DESCRIPTION_LENGTH ||
    !validNumbers ||
    !categoryId ||
    !techniqueId ||
    year === undefined
  ) {
    redirect(`/dashboard/seller/${artworkId}/edit?error=invalid`);
  }

  let photo: { imageUrl: string; widthPx?: number; heightPx?: number } = { imageUrl: existing.imageUrl };
  if (image instanceof File && image.size > 0) {
    const upload = await tryUploadArtworkImage(image);
    if (upload.error !== undefined) redirect(`/dashboard/seller/${artworkId}/edit?error=${upload.error}`);
    photo = { imageUrl: upload.url, widthPx: upload.width, heightPx: upload.height };
  }

  const replaced = photo.imageUrl !== existing.imageUrl;
  try {
    await updateArtwork(getDb(), {
      artworkId,
      sellerId: user.id,
      title,
      description,
      price,
      heightCm,
      widthCm,
      categoryId,
      techniqueId,
      ...photo,
      year,
    });
  } catch (error) {
    // the row still points at the old photo, so the new file is unused
    if (replaced) await dropArtworkImages([photo.imageUrl]);
    throw error;
  }
  // Only once the row points at the new photo is the old file removed.
  if (replaced) await dropArtworkImages([existing.imageUrl]);
  after(() => notifyAdminOfArtwork(getDb(), artworkId, true));

  redirect('/dashboard/seller');
}
