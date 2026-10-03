import Image from 'next/image';
import Link from 'next/link';
import { CATEGORY_NAME, dateRange, isDated, isOver, publishedDate } from '@/src/lib/journal/post-form';
import type { AfishaCard } from '@/src/lib/journal/afisha';
import type { PostSummary } from '@/src/lib/journal/posts';
import { isStorageUrl } from '@/src/lib/uploads/buckets';

// 3 → 2 → 1 columns
export const POST_CARD_SIZES = '(min-width: 1240px) 400px, (min-width: 640px) 45vw, 100vw';

// Exhibitions and events show their period, news and articles the day they
// came out; finished events say so.
export function postWhen(p: PostSummary, today: string, withYear = false): string {
  if (isDated(p.category) && p.startsOn) {
    const range = dateRange(p.startsOn, p.endsOn, withYear);
    return isOver(p, today) ? `Завершено · ${range}` : range;
  }
  return p.publishedAt ? publishedDate(p.publishedAt) : '';
}

export function PostCover({ post, sizes, priority, alt = '' }: { post: PostSummary; sizes: string; priority?: boolean; alt?: string }) {
  return (
    <Image
      className="pimg"
      src={post.coverUrl}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!isStorageUrl(post.coverUrl)}
      draggable={false}
    />
  );
}

// A 4:3 cover with the rubric on it, then the date, title, short description
// and place. Both the cover and the text open the post; an online exhibition
// opens its own page, and one that has not opened yet has no link.
export function PostCard({ post, today }: { post: AfishaCard; today: string }) {
  const href = post.href === undefined ? `/journal/${post.slug}` : post.href;
  const thumb = (
    <>
      <PostCover post={post} sizes={POST_CARD_SIZES} />
      <span className="ptag">{post.tag ?? CATEGORY_NAME[post.category]}</span>
    </>
  );
  const meta = (
    <>
      <p className="pdate">{post.when ?? postWhen(post, today)}</p>
      <h3>{post.title}</h3>
      {post.excerpt && <p className="pex">{post.excerpt}</p>}
      {post.place && <p className="pplace">{post.place}</p>}
    </>
  );
  return (
    <article className="pcard">
      {href ? (
        <>
          <Link className="pthumb" href={href} tabIndex={-1} aria-hidden="true">
            {thumb}
          </Link>
          <Link className="pmeta" href={href}>
            {meta}
          </Link>
        </>
      ) : (
        <>
          <div className="pthumb">{thumb}</div>
          <div className="pmeta">{meta}</div>
        </>
      )}
    </article>
  );
}

export function PostGrid({ posts, today }: { posts: AfishaCard[]; today: string }) {
  return (
    <ul className="pgrid" role="list">
      {posts.map((p) => (
        <li key={p.id}>
          <PostCard post={p} today={today} />
        </li>
      ))}
    </ul>
  );
}
