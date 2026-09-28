import { requireStaff } from '@/src/lib/auth/staff';
import { PostPage } from '../post-page';

export const metadata = { title: 'Новый материал' };

export default async function NewPostPage() {
  const role = await requireStaff('admin');
  return <PostPage role={role} />;
}
