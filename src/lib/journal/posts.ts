import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, notInArray, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db';
import { posts, sellerApplications } from '../../db/schema';
import type { PostCategory } from './categories';
import type { PostFields } from './post-form';

export type Post = typeof posts.$inferSelect;

// What a card needs.
export type PostSummary = Pick<
  Post,
  'id' | 'slug' | 'category' | 'title' | 'excerpt' | 'coverUrl' | 'startsOn' | 'endsOn' | 'place' | 'publishedAt'
>;

const SUMMARY = {
  id: posts.id,
  slug: posts.slug,
  category: posts.category,
  title: posts.title,
  excerpt: posts.excerpt,
  coverUrl: posts.coverUrl,
  startsOn: posts.startsOn,
  endsOn: posts.endsOn,
  place: posts.place,
  publishedAt: posts.publishedAt,
};

// The same rule as the database's public read policy.
const live = (now: Date) => and(eq(posts.status, 'published'), lte(posts.publishedAt, now));
const newestFirst = [desc(posts.publishedAt), desc(posts.createdAt)];

// ---------- public ----------

export async function listPublishedPosts(
  db: Db,
  { category, exceptId, limit }: { category?: PostCategory; exceptId?: string; limit: number },
  now = new Date(),
): Promise<{ items: PostSummary[]; total: number }> {
  const where = and(live(now), category ? eq(posts.category, category) : undefined, exceptId ? ne(posts.id, exceptId) : undefined);
  const [items, [row]] = await Promise.all([
    db.select(SUMMARY).from(posts).where(where).orderBy(...newestFirst).limit(limit),
    db.select({ n: count() }).from(posts).where(where),
  ]);
  return { items, total: row?.n ?? 0 };
}

export async function getFeaturedPost(db: Db, now = new Date()): Promise<PostSummary | undefined> {
  const [row] = await db.select(SUMMARY).from(posts).where(and(live(now), eq(posts.isFeatured, true))).limit(1);
  return row;
}

// A published post with its linked artist's name (drafts are not found).
export async function getPublishedPostBySlug(db: Db, slug: string, now = new Date()) {
  const [row] = await db
    .select({ post: posts, artistName: sellerApplications.displayName })
    .from(posts)
    .leftJoin(
      sellerApplications,
      and(eq(sellerApplications.userId, posts.artistId), eq(sellerApplications.status, 'approved')),
    )
    .where(and(live(now), eq(posts.slug, slug)))
    .limit(1);
  return row;
}

// Exhibitions and events that have not finished yet, soonest first.
export async function listUpcomingEvents(db: Db, today: string, limit = 3, now = new Date()): Promise<PostSummary[]> {
  return db
    .select(SUMMARY)
    .from(posts)
    .where(
      and(
        live(now),
        inArray(posts.category, ['exhibition', 'event']),
        gte(sql`coalesce(${posts.endsOn}, ${posts.startsOn})`, today),
      ),
    )
    .orderBy(asc(posts.startsOn), asc(posts.title))
    .limit(limit);
}

// The home page «Афиша»: exhibitions and events that have not finished yet,
// soonest first, topped up with the newest finished ones so the block is never
// empty while the journal has any.
export async function listHomeAfisha(db: Db, today: string, limit = 3, now = new Date()): Promise<PostSummary[]> {
  const upcoming = await listUpcomingEvents(db, today, limit, now);
  if (upcoming.length >= limit) return upcoming;
  const seen = upcoming.map((p) => p.id);
  const past = await db
    .select(SUMMARY)
    .from(posts)
    .where(
      and(
        live(now),
        inArray(posts.category, ['exhibition', 'event']),
        seen.length ? notInArray(posts.id, seen) : undefined,
      ),
    )
    .orderBy(sql`coalesce(${posts.endsOn}, ${posts.startsOn}) desc nulls last`, ...newestFirst)
    .limit(limit - upcoming.length);
  return [...upcoming, ...past];
}

// «Читайте также»: the same rubric first, then the newest of the rest.
export async function listRelatedPosts(db: Db, post: Pick<Post, 'id' | 'category'>, limit = 3, now = new Date()) {
  const same = await db
    .select(SUMMARY)
    .from(posts)
    .where(and(live(now), eq(posts.category, post.category), ne(posts.id, post.id)))
    .orderBy(...newestFirst)
    .limit(limit);
  if (same.length >= limit) return same;
  const seen = [post.id, ...same.map((p) => p.id)];
  const rest = await db
    .select(SUMMARY)
    .from(posts)
    .where(and(live(now), notInArray(posts.id, seen)))
    .orderBy(...newestFirst)
    .limit(limit - same.length);
  return [...same, ...rest];
}

export async function listSitemapPosts(db: Db, now = new Date()) {
  return db.select({ slug: posts.slug, changedAt: posts.updatedAt }).from(posts).where(live(now)).orderBy(...newestFirst);
}

// ---------- admin ----------

export async function listAllPosts(
  db: Db,
  { category, status, q }: { category?: PostCategory; status?: Post['status']; q?: string },
): Promise<Post[]> {
  const where: (SQL | undefined)[] = [
    category ? eq(posts.category, category) : undefined,
    status ? eq(posts.status, status) : undefined,
    q ? ilike(posts.title, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`) : undefined,
  ];
  return db
    .select()
    .from(posts)
    .where(and(...where))
    .orderBy(desc(posts.createdAt));
}

export async function getPost(db: Db, id: string): Promise<Post | undefined> {
  const [row] = await db.select().from(posts).where(eq(posts.id, id));
  return row;
}

export type PostInput = PostFields & { coverUrl: string; status: Post['status'] };
export type PostSaveResult = { ok: true; id: string; slug: string } | { ok: false; reason: 'slug_taken' | 'not_found' };

const isUniqueViolation = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && ((e as { code?: string }).code === '23505' || isUniqueViolation((e as { cause?: unknown }).cause));

// Saves the post; publishing stamps published_at the first time. A featured
// post takes the place from whichever post had it.
export async function savePost(db: Db, id: string | null, input: PostInput): Promise<PostSaveResult> {
  try {
    return await db.transaction(async (tx) => {
      const [before] = id ? await tx.select({ publishedAt: posts.publishedAt }).from(posts).where(eq(posts.id, id)) : [];
      if (id && !before) return { ok: false as const, reason: 'not_found' as const };
      if (input.isFeatured) {
        const others = id ? and(eq(posts.isFeatured, true), ne(posts.id, id)) : eq(posts.isFeatured, true);
        await tx.update(posts).set({ isFeatured: false }).where(others);
      }
      const publishedAt = input.status === 'published' ? (before?.publishedAt ?? new Date()) : (before?.publishedAt ?? null);
      const values = { ...input, publishedAt, updatedAt: new Date() };
      const [row] = id
        ? await tx.update(posts).set(values).where(eq(posts.id, id)).returning({ id: posts.id, slug: posts.slug })
        : await tx.insert(posts).values(values).returning({ id: posts.id, slug: posts.slug });
      return { ok: true as const, id: row.id, slug: row.slug };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: 'slug_taken' };
    throw e;
  }
}

// Publish or take down from the list. A post published for the first time
// gets today's date; one put back keeps its original date.
export async function setPostStatus(db: Db, id: string, publish: boolean): Promise<Post | undefined> {
  const [row] = await db
    .update(posts)
    .set(
      publish
        ? { status: 'published', publishedAt: sql`coalesce(${posts.publishedAt}, now())`, updatedAt: new Date() }
        : { status: 'draft', updatedAt: new Date() },
    )
    .where(eq(posts.id, id))
    .returning();
  return row;
}

export async function deletePost(db: Db, id: string): Promise<Post | undefined> {
  const [row] = await db.delete(posts).where(eq(posts.id, id)).returning();
  return row;
}

// Approved artists, for the "связанный художник" list.
export async function listArtistChoices(db: Db) {
  return db
    .select({ id: sellerApplications.userId, name: sellerApplications.displayName })
    .from(sellerApplications)
    .where(eq(sellerApplications.status, 'approved'))
    .orderBy(asc(sellerApplications.displayName));
}
