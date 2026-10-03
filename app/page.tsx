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
import { getOpenExhibitionForHome, type ExhibitionCard } from '@/src/lib/exhibitions/queries';
import { ExhibitionCardView } from '@/src/components/exhibitions/exhibition-card';
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

// «Афиша»: the nearest exhibitions and events, then the newest posts; the
// admin's journal actions revalidate the 'posts' tag.
const upcomingEvents = unstable_cache((today: string) => listHomeAfisha(getDb(), today, 3), ['home-afisha'], {
  revalidate: 60,
  tags: ['posts'],
});

// The open online exhibition for the home block; the admin's exhibition
// actions revalidate the 'exhibitions' tag.
const openExhibition = unstable_cache((today: string) => getOpenExhibitionForHome(getDb(), today), ['home-exhibition'], {
  revalidate: 60,
  tags: ['exhibitions'],
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
  let exhibition: ExhibitionCard | undefined;
  const [catalog, banners, upcoming, onShow] = await Promise.allSettled([
    searchCatalog(getDb(), {}, { page: 1, pageSize: RAIL_SIZE }),
    liveBanners(),
    upcomingEvents(today),
    openExhibition(today),
  ]);
  if (upcoming.status === 'fulfilled') {
    // the cache hands dates back as strings
    events = upcoming.value.map((p) => ({ ...p, publishedAt: p.publishedAt ? new Date(p.publishedAt) : null }));
  } else console.error('home: failed to load upcoming events', upcoming.reason);
  if (onShow.status === 'fulfilled') exhibition = onShow.value;
  else console.error('home: failed to load the open exhibition', onShow.reason);
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
        {exhibition && (
          <section className="sec" aria-labelledby="home-ex-t">
            <div className="sec-head">
              <h2 id="home-ex-t">Сейчас на выставке</h2>
              <Link className="more" href="/journal?c=exhibition">
                Все выставки
              </Link>
            </div>
            <ExhibitionCardView card={exhibition} today={today} />
          </section>
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
            <p className="empty">Скоро здесь появятся выставки, события и новости.</p>
          )}
        </section>
      </div>
    </main>
  );
}
