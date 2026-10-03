import type { ExhibitionCard } from '../exhibitions/queries';
import { exhibitionPhase } from '../exhibitions/status';
import { dateRange, isDated, isOver } from './post-form';
import type { PostSummary } from './posts';

// A journal card: a post, or an online exhibition standing among the posts.
// `href` null is a card without a link; `tag` and `when` replace the rubric
// and the date line.
export type AfishaCard = PostSummary & { href?: string | null; tag?: string; when?: string };

export const ONLINE_EXHIBITION = 'Онлайн-выставка';

// An upcoming exhibition has no page yet, so no link.
export function exhibitionAsCard(e: ExhibitionCard, today: string): AfishaCard {
  const upcoming = exhibitionPhase(e, today) === 'upcoming';
  return {
    id: e.id,
    slug: e.slug,
    category: 'exhibition',
    title: e.title,
    excerpt: e.subtitle,
    coverUrl: e.coverUrl,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    place: null,
    publishedAt: null,
    href: upcoming ? null : `/exhibitions/${e.slug}`,
    tag: ONLINE_EXHIBITION,
    when: upcoming ? `Скоро · ${dateRange(e.startsOn, e.endsOn)}` : undefined,
  };
}

// Posts by the day they came out, exhibitions by their first day (in Dushanbe).
const sortTime = (c: AfishaCard) =>
  c.publishedAt ? new Date(c.publishedAt).getTime() : c.startsOn ? Date.parse(`${c.startsOn}T00:00:00+05:00`) : 0;

// The newest `limit` of the posts (already the newest `limit`) and the exhibitions.
export function mergeAfisha(posts: PostSummary[], shows: ExhibitionCard[], today: string, limit: number): AfishaCard[] {
  if (shows.length === 0) return posts;
  return [...posts, ...shows.map((e) => exhibitionAsCard(e, today))].sort((a, b) => sortTime(b) - sortTime(a)).slice(0, limit);
}

// The home page «Афиша»: exhibitions (online ones too) and events that have
// not finished yet, soonest first, then the rest of `posts` (the newest ones).
export function homeAfisha(posts: PostSummary[], shows: ExhibitionCard[], today: string, limit: number): AfishaCard[] {
  const ahead = (p: PostSummary) => isDated(p.category) && p.startsOn !== null && !isOver(p, today);
  const events: AfishaCard[] = [
    ...posts.filter(ahead),
    ...shows.filter((e) => e.endsOn >= today).map((e) => exhibitionAsCard(e, today)),
  ].sort((a, b) => (a.startsOn ?? '').localeCompare(b.startsOn ?? '') || a.title.localeCompare(b.title));
  return [...events, ...posts.filter((p) => !ahead(p))].slice(0, limit);
}
