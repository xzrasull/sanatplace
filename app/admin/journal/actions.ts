'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { parsePostForm, type PostErrorCode } from '@/src/lib/journal/post-form';
import { deletePost, getPost, savePost, setPostStatus } from '@/src/lib/journal/posts';
import { POSTS_BUCKET } from '@/src/lib/uploads/buckets';
import { dropImages, tryUploadImage } from '@/src/lib/uploads/upload-image';

// Covers: up to 1600px wide (the browser already cropped them to 16:9).
const COVER_SIDE = 1600;

// The list, the home page's «Афиша» block and the post's own page (under its
// old address too, when it moved).
function changed(...slugs: (string | null | undefined)[]) {
  revalidateTag('posts');
  revalidatePath('/admin/journal');
  revalidatePath('/journal');
  revalidatePath('/');
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/journal/${slug}`);
}

const fileOf = (form: FormData, key: string) => {
  const v = form.get(key);
  return v instanceof File && v.size > 0 ? v : null;
};

export type SavePostState = { error: PostErrorCode } | null;

// Creates a post, or updates the one named by the hidden `id` field. The
// pressed button says whether it is saved as a draft or published. A problem
// comes back to the form (which keeps what was typed); success goes to the list.
export async function savePostAction(_prev: SavePostState, formData: FormData): Promise<SavePostState> {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  const existing = id ? await getPost(getDb(), id) : undefined;
  if (id && (!isUuid(id) || !existing)) return { error: 'not_found' };

  const parsed = parsePostForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const cover = fileOf(formData, 'cover');
  if (!cover && !existing) return { error: 'cover' };
  let coverUrl = existing?.coverUrl ?? '';
  if (cover) {
    const up = await tryUploadImage(POSTS_BUCKET, cover, COVER_SIDE);
    if (up.error !== undefined) return { error: up.error };
    coverUrl = up.url;
  }

  const status = formData.get('intent') === 'publish' ? 'published' : 'draft';
  const result = await savePost(getDb(), existing ? id : null, { ...parsed.fields, coverUrl, status });
  if (!result.ok) {
    if (cover) await dropImages(POSTS_BUCKET, [coverUrl]);
    return { error: result.reason };
  }
  if (existing && existing.coverUrl !== coverUrl) await dropImages(POSTS_BUCKET, [existing.coverUrl]);
  changed(result.slug, existing?.slug);
  redirect(`/admin/journal?saved=${status}`);
}

export async function setPostStatusAction(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const row = await setPostStatus(getDb(), id, formData.get('publish') === '1');
  changed(row?.slug);
}

export async function removePost(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const gone = await deletePost(getDb(), id);
  if (gone) await dropImages(POSTS_BUCKET, [gone.coverUrl]);
  changed(gone?.slug);
}
