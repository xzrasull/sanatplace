// src/lib/exhibitions/queries.ts
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, type SQL } from 'drizzle-orm';
import type { Db } from '../../db';
import { artworks, exhibitionHalls, exhibitionWorks, exhibitions, posts, sellerApplications, techniques, users } from '../../db/schema';
import { ARTIST_AVATAR } from '../artworks/public-queries';
import { VISIBLE_STATUSES } from './status';

// No Date fields: these go through unstable_cache, which hands back JSON.
export type ExhibitionCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string;
  startsOn: string;
  endsOn: string;
  status: 'draft' | 'published';
};
const CARD = {
  id: exhibitions.id,
  slug: exhibitions.slug,
  title: exhibitions.title,
  subtitle: exhibitions.subtitle,
  coverUrl: exhibitions.coverUrl,
  startsOn: exhibitions.startsOn,
  endsOn: exhibitions.endsOn,
  status: exhibitions.status,
};

const published = eq(exhibitions.status, 'published');
// published and its first day has come (open or closed)
const started = (today: string) => and(published, lte(exhibitions.startsOn, today));
const running = (today: string) => and(started(today), gte(exhibitions.endsOn, today));

export type WallWork = {
  id: string;
  title: string;
  price: number;
  status: string;
  year: number | null;
  heightCm: number;
  widthCm: number;
  widthPx: number | null;
  heightPx: number | null;
  imageUrl: string;
  techniqueName: string;
  artistId: string;
  artistName: string;
  curatorNote: string | null;
};
export type ViewHall = { id: string; title: string; intro: string | null; wallColor: string | null; works: WallWork[] };
export type ExhibitionViewData = {
  exhibition: ExhibitionCard & { curatorName: string | null; intro: string | null };
  halls: ViewHall[];
  artists: { id: string; name: string; avatarUrl: string | null }[];
};

// The exhibition with its halls in order; works the public cannot see are
// skipped, and so are halls left without works.
async function loadView(db: Db, where: SQL | undefined): Promise<ExhibitionViewData | undefined> {
  const [ex] = await db
    .select({ ...CARD, curatorName: exhibitions.curatorName, intro: exhibitions.intro })
    .from(exhibitions)
    .where(where)
    .limit(1);
  if (!ex) return undefined;
  const [halls, works] = await Promise.all([
    db.select().from(exhibitionHalls).where(eq(exhibitionHalls.exhibitionId, ex.id)).orderBy(asc(exhibitionHalls.position)),
    db
      .select({
        hallId: exhibitionWorks.hallId,
        curatorNote: exhibitionWorks.curatorNote,
        id: artworks.id,
        title: artworks.title,
        price: artworks.price,
        status: artworks.status,
        year: artworks.year,
        heightCm: artworks.heightCm,
        widthCm: artworks.widthCm,
        widthPx: artworks.widthPx,
        heightPx: artworks.heightPx,
        imageUrl: artworks.imageUrl,
        techniqueName: techniques.name,
        artistId: artworks.sellerId,
        artistName: sellerApplications.displayName,
        artistAvatar: ARTIST_AVATAR,
      })
      .from(exhibitionWorks)
      .innerJoin(artworks, eq(artworks.id, exhibitionWorks.artworkId))
      .innerJoin(techniques, eq(techniques.id, artworks.techniqueId))
      .innerJoin(sellerApplications, eq(sellerApplications.userId, artworks.sellerId))
      .innerJoin(users, eq(users.id, artworks.sellerId))
      .where(and(eq(exhibitionWorks.exhibitionId, ex.id), inArray(artworks.status, [...VISIBLE_STATUSES])))
      .orderBy(asc(exhibitionWorks.position)),
  ]);
  const viewHalls = halls
    .map((h) => ({
      id: h.id,
      title: h.title,
      intro: h.intro,
      wallColor: h.wallColor,
      works: works
        .filter((w) => w.hallId === h.id)
        .map((w) => ({
          id: w.id,
          title: w.title,
          price: w.price,
          status: w.status,
          year: w.year,
          heightCm: w.heightCm,
          widthCm: w.widthCm,
          widthPx: w.widthPx,
          heightPx: w.heightPx,
          imageUrl: w.imageUrl,
          techniqueName: w.techniqueName,
          artistId: w.artistId,
          artistName: w.artistName,
          curatorNote: w.curatorNote,
        })),
    }))
    .filter((h) => h.works.length > 0);
  const avatarOf = new Map(works.map((w) => [w.artistId, w.artistAvatar]));
  const artists = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
  for (const h of viewHalls)
    for (const w of h.works)
      if (!artists.has(w.artistId))
        artists.set(w.artistId, { id: w.artistId, name: w.artistName, avatarUrl: avatarOf.get(w.artistId) ?? null });
  return { exhibition: ex, halls: viewHalls, artists: [...artists.values()] };
}

export const getPublicExhibition = (db: Db, slug: string, today: string) =>
  loadView(db, and(started(today), eq(exhibitions.slug, slug)));

// Any status: the admin's preview.
export const getExhibitionPreview = (db: Db, id: string) => loadView(db, eq(exhibitions.id, id));

// The journal's cards: every published one, upcoming too, newest first. One
// with a live announcement is left to that post, which links to it.
export async function listAfishaExhibitions(db: Db, now = new Date()): Promise<ExhibitionCard[]> {
  return db
    .select(CARD)
    .from(exhibitions)
    .leftJoin(posts, and(eq(posts.id, exhibitions.postId), eq(posts.status, 'published'), lte(posts.publishedAt, now)))
    .where(and(published, isNull(posts.id)))
    .orderBy(desc(exhibitions.startsOn), asc(exhibitions.title));
}

export async function listOtherExhibitions(db: Db, exceptId: string, today: string, limit = 3): Promise<ExhibitionCard[]> {
  return db
    .select(CARD)
    .from(exhibitions)
    .where(and(started(today), ne(exhibitions.id, exceptId)))
    .orderBy(desc(exhibitions.endsOn))
    .limit(limit);
}

export async function getExhibitionLinkForPost(db: Db, postId: string, today: string) {
  const [row] = await db
    .select({ slug: exhibitions.slug, title: exhibitions.title })
    .from(exhibitions)
    .where(and(started(today), eq(exhibitions.postId, postId)))
    .limit(1);
  return row;
}

export async function listOpenExhibitionsWithArtwork(db: Db, artworkId: string, today: string) {
  return db
    .select({ slug: exhibitions.slug, title: exhibitions.title })
    .from(exhibitionWorks)
    .innerJoin(exhibitions, eq(exhibitions.id, exhibitionWorks.exhibitionId))
    .where(and(running(today), eq(exhibitionWorks.artworkId, artworkId)))
    .orderBy(desc(exhibitions.startsOn));
}

export async function listSitemapExhibitions(db: Db, today: string) {
  return db
    .select({ slug: exhibitions.slug, changedAt: exhibitions.updatedAt })
    .from(exhibitions)
    .where(started(today))
    .orderBy(desc(exhibitions.startsOn));
}
