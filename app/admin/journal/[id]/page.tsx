import { notFound } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { getPost } from '@/src/lib/journal/posts';
import { PostPage } from '../post-page';

export const metadata = { title: 'Изменить материал' };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await requireStaff('admin');
  const { id } = await params;
  const post = isUuid(id) ? await getPost(getDb(), id) : undefined;
  if (!post) notFound();
  return <PostPage role={role} post={post} />;
}
