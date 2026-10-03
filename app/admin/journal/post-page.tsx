import Link from 'next/link';
import { getDb } from '@/src/db';
import type { StaffRole } from '@/src/lib/auth/staff';
import type { PostCategory } from '@/src/lib/journal/categories';
import { listArtistChoices, type Post } from '@/src/lib/journal/posts';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { PostForm } from '@/src/components/admin/post-form';
import { savePostAction } from './actions';

// The create and edit pages share everything but the post.
export async function PostPage({ role, post, category }: { role: StaffRole; post?: Post; category?: PostCategory }) {
  const artists = await listArtistChoices(getDb());
  return (
    <main>
      <AdminNav role={role} />
      <Link href="/admin/journal" className="text-sm text-muted-foreground hover:text-brand">
        ← Все материалы
      </Link>
      <h1 className="mt-3">{post ? 'Изменить материал' : 'Новый материал'}</h1>
      <PostForm action={savePostAction} post={post} category={category} artists={artists} />
    </main>
  );
}
