import { requireStaff } from '@/src/lib/auth/staff';
import { isPostCategory } from '@/src/lib/journal/post-form';
import { PostPage } from '../post-page';

export const metadata = { title: 'Новый материал' };

// `?c=` picks the rubric; exhibitions come here from the online/offline choice.
export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const role = await requireStaff('admin');
  const { c } = await searchParams;
  return <PostPage role={role} category={isPostCategory(c) ? c : undefined} />;
}
