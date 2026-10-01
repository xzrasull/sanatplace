'use server';

import { getCurrentUser } from '@/src/lib/auth/session';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getDb } from '@/src/db';
import { markArtworkAsSold } from '@/src/lib/artworks/seller-operations';

export async function markAsSold(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (!user || user.role !== 'seller') redirect('/');

  const artworkId = String(formData.get('artworkId') ?? '').trim();
  if (!artworkId) redirect('/dashboard/seller');

  await markArtworkAsSold(getDb(), { artworkId, sellerId: user.id });
  revalidateTag('exhibitions');
  revalidatePath('/dashboard/seller');
}
