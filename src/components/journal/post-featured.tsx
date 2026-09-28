import Link from 'next/link';
import { CATEGORY_NAME } from '@/src/lib/journal/post-form';
import type { PostSummary } from '@/src/lib/journal/posts';
import { PostCover, postWhen } from './post-card';

// The main post on top of /journal: a large 3:2 cover beside its text.
export function PostFeatured({ post, today }: { post: PostSummary; today: string }) {
  const href = `/journal/${post.slug}`;
  const when = postWhen(post, today);
  return (
    <article className="jfeat">
      <Link className="jfeat-img" href={href} tabIndex={-1} aria-hidden="true">
        <PostCover post={post} sizes="(min-width: 1240px) 660px, (min-width: 860px) 55vw, 100vw" priority />
      </Link>
      <div className="jfeat-txt">
        <p className="eyebrow">
          {CATEGORY_NAME[post.category]}
          {when && ` · ${when}`}
        </p>
        <h2>{post.title}</h2>
        {post.excerpt && <p>{post.excerpt}</p>}
        {post.place && <p className="pplace">{post.place}</p>}
        <Link className="btn" href={href}>
          Подробнее
        </Link>
      </div>
    </article>
  );
}
