import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { and, eq, like, sql } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { posts } from '../../src/db/schema';
import {
  getFeaturedPost,
  getPublishedPostBySlug,
  listPublishedPosts,
  listRelatedPosts,
  listUpcomingEvents,
  savePost,
  setPostStatus,
  type PostInput,
} from '../../src/lib/journal/posts';

const PREFIX = 'test-journal-';
const base: PostInput = {
  category: 'news',
  title: 'Тест',
  slug: '',
  excerpt: null,
  body: null,
  coverUrl: 'https://example.com/cover.jpg',
  startsOn: null,
  endsOn: null,
  timeText: null,
  place: null,
  priceText: null,
  signupUrl: null,
  artistId: null,
  isFeatured: false,
  sourceNote: null,
  status: 'draft',
};
const input = (slug: string, extra: Partial<PostInput> = {}): PostInput => ({ ...base, slug: PREFIX + slug, ...extra });

async function save(slug: string, extra: Partial<PostInput> = {}) {
  const r = await savePost(getDb(), null, input(slug, extra));
  if (!r.ok) throw new Error(r.reason);
  return r.id;
}

describe('journal posts', () => {
  // a real featured post, if there is one, gets its place back afterwards
  let realFeatured: string | undefined;
  beforeAll(async () => {
    const [row] = await getDb().select({ id: posts.id }).from(posts).where(eq(posts.isFeatured, true));
    realFeatured = row?.id;
  });
  afterAll(async () => {
    await getDb().delete(posts).where(like(posts.slug, `${PREFIX}%`));
    if (realFeatured) await getDb().update(posts).set({ isFeatured: true }).where(eq(posts.id, realFeatured));
  });

  it('keeps drafts off the public side until published', async () => {
    const id = await save('draft');
    expect(await getPublishedPostBySlug(getDb(), `${PREFIX}draft`)).toBeUndefined();
    const { items } = await listPublishedPosts(getDb(), { limit: 500 });
    expect(items.some((p) => p.id === id)).toBe(false);

    const published = await setPostStatus(getDb(), id, true);
    expect(published?.publishedAt).toBeInstanceOf(Date);
    expect((await getPublishedPostBySlug(getDb(), `${PREFIX}draft`))?.post.id).toBe(id);

    // taken down: gone again, but it keeps its first publication date
    await setPostStatus(getDb(), id, false);
    expect(await getPublishedPostBySlug(getDb(), `${PREFIX}draft`)).toBeUndefined();
    const again = await setPostStatus(getDb(), id, true);
    expect(again?.publishedAt?.getTime()).toBe(published?.publishedAt?.getTime());
  });

  it('refuses a taken address', async () => {
    await save('same');
    expect(await savePost(getDb(), null, input('same'))).toEqual({ ok: false, reason: 'slug_taken' });
  });

  it('has one featured post at a time', async () => {
    const a = await save('feat-a', { status: 'published', isFeatured: true });
    const b = await save('feat-b', { status: 'published', isFeatured: true });
    const featured = await getDb().select({ id: posts.id }).from(posts).where(eq(posts.isFeatured, true));
    expect(featured.map((p) => p.id)).toEqual([b]);
    expect((await getFeaturedPost(getDb()))?.id).toBe(b);
    expect(a).not.toBe(b);
  });

  it('lists upcoming exhibitions and events, soonest first, without finished ones', async () => {
    const today = '2090-06-15';
    const event = { status: 'published' as const, category: 'event' as const };
    await save('ev-past', { ...event, startsOn: '2090-06-01' });
    const later = await save('ev-later', { ...event, startsOn: '2090-07-01' });
    const running = await save('ev-running', { ...event, category: 'exhibition', startsOn: '2090-06-01', endsOn: '2090-06-30' });
    const upcoming = (await listUpcomingEvents(getDb(), today, 50)).filter((p) => p.slug.startsWith(PREFIX));
    expect(upcoming.map((p) => p.id)).toEqual([running, later]);
  });

  it('suggests the same rubric first in «Читайте также»', async () => {
    const own = await save('rel-own', { status: 'published', category: 'article' });
    const same = await save('rel-same', { status: 'published', category: 'article' });
    const related = await listRelatedPosts(getDb(), { id: own, category: 'article' }, 3);
    expect(related[0]?.id).toBe(same);
    expect(related.some((p) => p.id === own)).toBe(false);
  });

  it('lets the public API read only published posts and write nothing', async () => {
    await save('rls-draft');
    await save('rls-live', { status: 'published' });
    const seen = await getDb().transaction(async (tx) => {
      await tx.execute(sql`set local role anon`);
      return tx.select({ slug: posts.slug }).from(posts).where(and(like(posts.slug, `${PREFIX}rls-%`)));
    });
    expect(seen.map((r) => r.slug)).toEqual([`${PREFIX}rls-live`]);

    await expect(
      getDb().transaction(async (tx) => {
        await tx.execute(sql`set local role anon`);
        await tx.insert(posts).values(input('rls-anon'));
      }),
    ).rejects.toThrow();
  });
});
