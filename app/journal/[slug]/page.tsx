import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { getDb } from '@/src/db';
import { adminTelegramLink, signupText } from '@/src/lib/journal/contact';
import { CATEGORY_NAME, isDated, isOver, isSlug, publishedDate, todayInDushanbe } from '@/src/lib/journal/post-form';
import { getPublishedPostBySlug, listRelatedPosts } from '@/src/lib/journal/posts';
import { getExhibitionLinkForPost } from '@/src/lib/exhibitions/queries';
import { pagePreview, snippet } from '@/src/lib/seo';
import { MarkdownBody } from '@/src/components/journal/markdown-body';
import { PostCover, PostGrid } from '@/src/components/journal/post-card';
import { PostFacts } from '@/src/components/journal/post-facts';

// One lookup per request, shared by the page and its link preview. Drafts are
// not found, whoever asks.
const loadPost = cache(async (slug: string) => {
  if (!isSlug(slug)) return undefined;
  return getPublishedPostBySlug(getDb(), slug);
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const found = await loadPost((await params).slug);
  if (!found) return {};
  const { post } = found;
  const description = snippet(post.excerpt || post.body || CATEGORY_NAME[post.category]);
  return {
    title: post.title,
    description,
    ...pagePreview({ title: post.title, description, image: { url: post.coverUrl, alt: post.title } }),
  };
}

function Arrow() {
  return (
    <i>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </i>
  );
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const found = await loadPost((await params).slug);
  if (!found) notFound();
  const { post, artistName } = found;
  const today = todayInDushanbe();
  const dated = isDated(post.category);
  const over = isOver(post, today);
  const related = await listRelatedPosts(getDb(), post);
  const online = await getExhibitionLinkForPost(getDb(), post.id, today).catch(() => undefined);
  const signup = post.signupUrl ?? adminTelegramLink(signupText(post.title));
  const external = signup ? /^https?:\/\//.test(signup) : false;

  return (
    <main>
      <div className="wrap stack pg">
        <nav className="crumbs" aria-label="Путь">
          <Link href="/">Главная</Link>
          <span aria-hidden="true">/</span>
          <Link href="/journal">Афиша и журнал</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/journal?c=${post.category}`}>{CATEGORY_NAME[post.category]}</Link>
        </nav>

        <article className="post">
          <header className="post-head">
            <p className="eyebrow">
              {CATEGORY_NAME[post.category]}
              {!dated && post.publishedAt && ` · ${publishedDate(post.publishedAt)}`}
              {over && ' · Завершено'}
            </p>
            <h1 className="t">{post.title}</h1>
            {post.excerpt && <p className="post-lead">{post.excerpt}</p>}
          </header>
          <div className="post-cover">
            <PostCover post={post} alt={post.title} sizes="(min-width: 1240px) 1180px, 100vw" priority />
          </div>
          <div className="post-cols">
            {dated && (
              <aside className="post-aside" aria-label="Когда и где">
                <PostFacts
                  startsOn={post.startsOn}
                  endsOn={post.endsOn}
                  timeText={post.timeText}
                  place={post.place}
                  priceText={post.priceText}
                />
                {over ? (
                  <p className="post-over">Событие завершилось</p>
                ) : (
                  signup && (
                    <>
                      <a
                        className="btn btn-tg wide"
                        href={signup}
                        {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
                      >
                        Записаться в Telegram
                      </a>
                      <p className="small">Мест ограниченное количество, запись подтверждается в личных сообщениях.</p>
                    </>
                  )
                )}
              </aside>
            )}
            <div className="post-main">
              {online && (
                <p>
                  <Link className="btn" href={`/exhibitions/${online.slug}`}>
                    Смотреть онлайн-выставку
                  </Link>
                </p>
              )}
              {post.body && <MarkdownBody source={post.body} />}
              {post.artistId && artistName && (
                <p className="post-artist">
                  Художник: <Link href={`/gallery/artist/${post.artistId}`}>{artistName}</Link>
                </p>
              )}
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className="sec" aria-labelledby="related-t">
            <div className="sec-head">
              <h2 id="related-t">Читайте также</h2>
              <Link className="more" href="/journal">
                Вся афиша <Arrow />
              </Link>
            </div>
            <PostGrid posts={related} today={today} />
          </section>
        )}
      </div>
    </main>
  );
}
