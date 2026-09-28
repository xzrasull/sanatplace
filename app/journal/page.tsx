import Link from 'next/link';
import { getDb } from '@/src/db';
import { adminTelegramLink, PROPOSE_TEXT } from '@/src/lib/journal/contact';
import { CATEGORY_TABS, isPostCategory, todayInDushanbe } from '@/src/lib/journal/post-form';
import { getFeaturedPost, listPublishedPosts } from '@/src/lib/journal/posts';
import { pagePreview } from '@/src/lib/seo';
import { PostFeatured } from '@/src/components/journal/post-featured';
import { PostGrid } from '@/src/components/journal/post-card';

const TITLE = 'Афиша и журнал';
const DESCRIPTION = 'Выставки, мастер-классы, новости и статьи о том, что происходит вокруг искусства.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...pagePreview({ title: TITLE, description: DESCRIPTION }),
};

const PAGE_SIZE = 12;

// Rubric chips (?c=), the featured post on top of "Все", then a grid of the
// rest, newest first; "Показать ещё" adds twelve more (?page=).
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ c?: string; page?: string }> }) {
  const params = await searchParams;
  const category = isPostCategory(params.c) ? params.c : undefined;
  const page = Math.min(50, Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1));
  const today = todayInDushanbe();

  const featured = category ? undefined : await getFeaturedPost(getDb());
  const { items, total } = await listPublishedPosts(getDb(), {
    category,
    exceptId: featured?.id,
    limit: PAGE_SIZE * page,
  });
  const hrefFor = (c: string, p?: number) => {
    const q = new URLSearchParams();
    if (c) q.set('c', c);
    if (p && p > 1) q.set('page', String(p));
    const s = q.toString();
    return s ? `/journal?${s}` : '/journal';
  };
  const propose = adminTelegramLink(PROPOSE_TEXT);

  return (
    <main>
      <div className="wrap stack pg">
        <div>
          <div className="jhead">
            <h1 className="t">{TITLE}</h1>
            <p className="lead">{DESCRIPTION}</p>
          </div>
          <nav className="jtabs" aria-label="Рубрики">
            <div className="chips jchips">
              {CATEGORY_TABS.map((t) => (
                <Link
                  key={t.value}
                  className="chip"
                  href={hrefFor(t.value)}
                  aria-current={(category ?? '') === t.value ? 'page' : undefined}
                  scroll={false}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div>
          {featured && <PostFeatured post={featured} today={today} />}
          {items.length > 0 ? (
            <PostGrid posts={items} today={today} />
          ) : (
            !featured && (
              <div className="empty">
                <h3>Пока ничего нет</h3>
                <p>В этой рубрике скоро появятся материалы.</p>
              </div>
            )
          )}
          {items.length < total && (
            <div className="jmore">
              <Link className="btn alt" href={hrefFor(category ?? '', page + 1)} scroll={false}>
                Показать ещё
              </Link>
            </div>
          )}
        </div>

        {propose && (
          <section className="panel jpropose" aria-labelledby="jpropose-t">
            <h2 id="jpropose-t">Хотите разместить своё событие?</h2>
            <p>
              Напишите администратору в Telegram: что за событие, даты, место и пара фотографий. Мы подготовим материал и
              опубликуем его в афише.
            </p>
            <a className="btn btn-tg" href={propose} target="_blank" rel="noopener noreferrer">
              Написать администратору
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
