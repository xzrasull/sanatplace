import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getDb } from '@/src/db';
import { getCurrentUser } from '@/src/lib/auth/session';
import { searchCatalog } from '@/src/lib/gallery/catalog';
import { listLiveBanners, type HeroSlide } from '@/src/lib/home/banners';
import { likeInfoFor, type LikeInfo } from '@/src/lib/likes/likes';
import { plural } from '@/src/lib/ru-format';
import { BRAND_NAME } from '@/src/lib/brand';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { listHomeAfisha, type PostSummary } from '@/src/lib/journal/posts';
import { PostGrid } from '@/src/components/journal/post-card';
import { ArtworkCard, RAIL_CARD_SIZES } from '@/src/components/artwork/artwork-card';
import { Hero } from '@/src/components/home/hero';
import { Rail } from '@/src/components/sanat/rail';

const RAIL_SIZE = 8;

// Banners change rarely: read at most once a minute, and at once after the
// admin saves (the admin actions revalidate the 'banners' tag).
const liveBanners = unstable_cache(() => listLiveBanners(getDb()), ['live-banners'], {
  revalidate: 60,
  tags: ['banners'],
});

// «Афиша»: the three nearest exhibitions and events (else the latest ones); the
// admin's journal actions revalidate the 'posts' tag.
const upcomingEvents = unstable_cache((today: string) => listHomeAfisha(getDb(), today, 3), ['home-afisha'], {
  revalidate: 60,
  tags: ['posts'],
});

export default async function HomePage() {
  const user = await getCurrentUser();
  let items: Awaited<ReturnType<typeof searchCatalog>>['items'] = [];
  let total = 0;
  let likes: Record<string, LikeInfo> = {};
  let slides: HeroSlide[] = [];
  let loadFailed = false;
  const today = todayInDushanbe();
  let events: PostSummary[] = [];
  const [catalog, banners, upcoming] = await Promise.allSettled([
    searchCatalog(getDb(), {}, { page: 1, pageSize: RAIL_SIZE }),
    liveBanners(),
    upcomingEvents(today),
  ]);
  if (upcoming.status === 'fulfilled') {
    // the cache hands dates back as strings
    events = upcoming.value.map((p) => ({ ...p, publishedAt: p.publishedAt ? new Date(p.publishedAt) : null }));
  } else console.error('home: failed to load upcoming events', upcoming.reason);
  if (banners.status === 'fulfilled') slides = banners.value;
  else console.error('home: failed to load banners', banners.reason);
  if (catalog.status === 'fulfilled') {
    ({ items, total } = catalog.value);
    likes = await likeInfoFor(getDb(), items, user?.id ?? null).catch(() => ({}));
  } else {
    console.error('home: failed to load latest artworks', catalog.reason);
    loadFailed = true;
  }

  return (
    <main>
      <h1 className="sr-only">{BRAND_NAME} — картины прямо от художников</h1>
      <Hero slides={slides} />
      <div className="wrap stack">
        {loadFailed ? (
          <p className="empty">Не удалось загрузить новые поступления. Попробуйте позже.</p>
        ) : items.length === 0 ? (
          <p className="empty">Пока нет опубликованных картин.</p>
        ) : (
          <Rail title="Новые поступления" moreHref="/gallery">
            {items.map((w) => (
              <ArtworkCard key={w.id} artwork={w} like={likes[w.id]} sizes={RAIL_CARD_SIZES} />
            ))}
            <Link className="all" href="/gallery">
              <span className="all-c" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
              </span>
              <b>Все картины</b>
              <small>
                {total} {plural(total, ['работа', 'работы', 'работ'])}
              </small>
            </Link>
          </Rail>
        )}
        <section className="sec home-j" aria-labelledby="home-j-t">
          <div className="sec-head">
            <h2 id="home-j-t">Афиша</h2>
            <Link className="more" href="/journal">
              Смотреть все{' '}
              <i>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </i>
            </Link>
          </div>
          {events.length > 0 ? (
            <PostGrid posts={events} today={today} />
          ) : (
            <p className="empty">Скоро здесь появятся выставки и мастер-классы.</p>
          )}
        </section>
      </div>
    </main>
  );
}
