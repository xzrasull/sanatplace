// app/admin/exhibitions/actions.ts
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { parseExhibitionForm, parseHallForm, parseWorkNote, type ExhibitionErrorCode } from '@/src/lib/exhibitions/exhibition-form';
import {
  addHall,
  addWork,
  deleteExhibition,
  deleteHall,
  getExhibition,
  moveHall,
  moveWork,
  removeWork,
  saveExhibition,
  setExhibitionStatus,
  setWorkNote,
  updateHall,
} from '@/src/lib/exhibitions/admin';
import { POSTS_BUCKET } from '@/src/lib/uploads/buckets';
import { dropImages, tryUploadImage } from '@/src/lib/uploads/upload-image';

const COVER_SIDE = 1600;

// The journal's lists, the home page block and the exhibition's own page
// (under its old address too, when it moved). Not exported: every export of a
// 'use server' file becomes a callable action.
function exhibitionsChanged(...slugs: (string | null | undefined)[]) {
  revalidateTag('exhibitions');
  revalidatePath('/admin/journal');
  revalidatePath('/journal');
  revalidatePath('/');
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/exhibitions/${slug}`);
}

const fileOf = (form: FormData, key: string) => {
  const v = form.get(key);
  return v instanceof File && v.size > 0 ? v : null;
};

export type SaveExhibitionState = { error: ExhibitionErrorCode } | null;

// Creates an exhibition or updates the one in the hidden `id`. A new one opens
// its page, where the halls are added; an edit stays there too.
export async function saveExhibitionAction(_prev: SaveExhibitionState, formData: FormData): Promise<SaveExhibitionState> {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  const existing = id && isUuid(id) ? await getExhibition(getDb(), id) : undefined;
  if (id && !existing) return { error: 'not_found' };

  const parsed = parseExhibitionForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const cover = fileOf(formData, 'cover');
  if (!cover && !existing) return { error: 'cover' };
  let coverUrl = existing?.coverUrl ?? '';
  if (cover) {
    const up = await tryUploadImage(POSTS_BUCKET, cover, COVER_SIDE);
    if (up.error !== undefined) return { error: up.error };
    coverUrl = up.url;
  }

  const status = existing?.status ?? 'draft';
  const result = await saveExhibition(getDb(), existing ? id : null, { ...parsed.fields, coverUrl, status });
  if (!result.ok) {
    if (cover) await dropImages(POSTS_BUCKET, [coverUrl]);
    return { error: result.reason };
  }
  if (existing && existing.coverUrl !== coverUrl) await dropImages(POSTS_BUCKET, [existing.coverUrl]);
  exhibitionsChanged(result.slug, existing?.slug);
  redirect(`/admin/exhibitions/${result.id}?saved=1`);
}

export async function setExhibitionStatusAction(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const row = await setExhibitionStatus(getDb(), id, formData.get('publish') === '1');
  exhibitionsChanged(row?.slug);
}

export async function removeExhibition(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const gone = await deleteExhibition(getDb(), id);
  if (gone) await dropImages(POSTS_BUCKET, [gone.coverUrl]);
  exhibitionsChanged(gone?.slug);
  redirect('/admin/journal');
}

const idOf = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? '');
  return isUuid(v) ? v : null;
};
const dirOf = (form: FormData): -1 | 1 => (form.get('dir') === 'up' ? -1 : 1);

// Back to the exhibition's page, with a problem in the address if there was one.
async function backTo(exhibitionId: string | undefined | null, error?: ExhibitionErrorCode): Promise<never> {
  if (!exhibitionId) redirect('/admin/journal?error=not_found');
  const ex = await getExhibition(getDb(), exhibitionId);
  exhibitionsChanged(ex?.slug);
  redirect(`/admin/exhibitions/${exhibitionId}${error ? `?error=${error}` : ''}#halls`);
}

export async function addHallAction(formData: FormData) {
  await requireStaff('admin');
  const exhibitionId = idOf(formData, 'exhibitionId');
  const parsed = parseHallForm(formData);
  if (!parsed.ok) return backTo(exhibitionId, parsed.error);
  if (!exhibitionId) return backTo(null);
  const r = await addHall(getDb(), exhibitionId, parsed.fields);
  return backTo(exhibitionId, r.ok ? undefined : r.reason);
}

export async function updateHallAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const exhibitionId = idOf(formData, 'exhibitionId');
  const parsed = parseHallForm(formData);
  if (!parsed.ok) return backTo(exhibitionId, parsed.error);
  return backTo(hallId ? await updateHall(getDb(), hallId, parsed.fields) : null);
}

export async function deleteHallAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'id');
  return backTo(hallId ? await deleteHall(getDb(), hallId) : null);
}

export async function moveHallAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  return backTo(hallId ? await moveHall(getDb(), hallId, dirOf(formData)) : null);
}

export async function addWorkAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const artworkId = idOf(formData, 'artworkId');
  const exhibitionId = idOf(formData, 'exhibitionId');
  if (!hallId || !artworkId) return backTo(exhibitionId, 'not_found');
  const r = await addWork(getDb(), hallId, artworkId);
  return backTo(exhibitionId, r.ok ? undefined : r.reason);
}

export async function moveWorkAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const artworkId = idOf(formData, 'artworkId');
  return backTo(hallId && artworkId ? await moveWork(getDb(), hallId, artworkId, dirOf(formData)) : null);
}

export async function removeWorkAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const artworkId = idOf(formData, 'artworkId');
  return backTo(hallId && artworkId ? await removeWork(getDb(), hallId, artworkId) : null);
}

export async function setWorkNoteAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const artworkId = idOf(formData, 'artworkId');
  const exhibitionId = idOf(formData, 'exhibitionId');
  const parsed = parseWorkNote(formData);
  if (!parsed.ok) return backTo(exhibitionId, parsed.error);
  return backTo(hallId && artworkId ? await setWorkNote(getDb(), hallId, artworkId, parsed.note) : null);
}
