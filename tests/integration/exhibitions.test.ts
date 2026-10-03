// tests/integration/exhibitions.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { eq, inArray, like } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { artworks, categories, exhibitions, sellerApplications, techniques, users } from '../../src/db/schema';
import { listReferencedImageUrls } from '../../src/lib/uploads/references';
import { testTelegramId } from '../helpers/test-telegram-id';
import {
  addHall,
  addWork,
  deleteHall,
  listHallsForAdmin,
  moveHall,
  moveWork,
  removeWork,
  saveExhibition,
  searchArtworkChoices,
  setWorkNote,
  type ExhibitionInput,
} from '../../src/lib/exhibitions/admin';
import {
  getExhibitionPreview,
  getOpenExhibitionForHome,
  getPublicExhibition,
  listOpenExhibitionsWithArtwork,
  listAfishaExhibitions,
} from '../../src/lib/exhibitions/queries';

const PREFIX = 'test-ex-';

// ---------- fixtures ----------
type Fx = { sellerId: string; categoryId: string; techniqueId: string };
let fx: Fx | undefined;

async function fixtures(): Promise<Fx> {
  if (fx) return fx;
  const [seller] = await getDb()
    .insert(users)
    .values({ telegramId: testTelegramId(`test_ex_seller_${Date.now()}`), fullName: 'Ex Test Seller', role: 'seller' })
    .returning();
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: 'Тест выставок студия',
    bio: 'Био.',
    telegramContact: '@ex_test',
    status: 'approved',
  });
  const [category] = await getDb().insert(categories).values({ name: `Категория выставок ${Date.now()}` }).returning();
  const [technique] = await getDb().insert(techniques).values({ name: `Техника выставок ${Date.now()}` }).returning();
  fx = { sellerId: seller.id, categoryId: category.id, techniqueId: technique.id };
  return fx;
}

async function artwork(title: string, status: 'published' | 'sold' | 'pending' = 'published', heightCm = 50) {
  const f = await fixtures();
  const [row] = await getDb()
    .insert(artworks)
    .values({
      sellerId: f.sellerId,
      title,
      description: 'Описание.',
      price: 1000,
      heightCm,
      widthCm: 40,
      categoryId: f.categoryId,
      techniqueId: f.techniqueId,
      imageUrl: `https://example.com/${PREFIX}${title}.jpg`,
      status,
    })
    .returning();
  return row.id;
}

const baseInput: ExhibitionInput = {
  title: 'Тест',
  slug: '',
  subtitle: null,
  curatorName: null,
  intro: null,
  startsOn: '2090-01-01',
  endsOn: '2090-01-31',
  postId: null,
  coverUrl: 'https://example.com/cover.jpg',
  status: 'draft',
};

async function exhibition(slug: string, extra: Partial<ExhibitionInput> = {}) {
  const r = await saveExhibition(getDb(), null, { ...baseInput, slug: PREFIX + slug, ...extra });
  if (!r.ok) throw new Error(r.reason);
  return r.id;
}

async function hall(exhibitionId: string, title: string) {
  const r = await addHall(getDb(), exhibitionId, { title, intro: null, wallColor: null });
  if (!r.ok) throw new Error(r.reason);
  return r.id;
}

afterAll(async () => {
  await getDb().delete(exhibitions).where(like(exhibitions.slug, `${PREFIX}%`));
  if (fx) {
    await getDb().delete(artworks).where(eq(artworks.sellerId, fx.sellerId));
    await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, fx.sellerId));
    await getDb().delete(users).where(eq(users.id, fx.sellerId));
    await getDb().delete(categories).where(eq(categories.id, fx.categoryId));
    await getDb().delete(techniques).where(eq(techniques.id, fx.techniqueId));
  }
});

describe('exhibitions schema', () => {
  it('keeps exhibition covers among the referenced images', async () => {
    const cover = `https://example.com/${PREFIX}cover-${Date.now()}.jpg`;
    await getDb().insert(exhibitions).values({
      slug: `${PREFIX}refs`,
      title: 'Тест',
      coverUrl: cover,
      startsOn: '2090-01-01',
      endsOn: '2090-01-31',
    });
    expect(await listReferencedImageUrls(getDb())).toContain(cover);
  });
});

describe('exhibition admin', () => {
  it('refuses a taken address', async () => {
    await exhibition('same');
    expect(await saveExhibition(getDb(), null, { ...baseInput, slug: `${PREFIX}same` })).toEqual({
      ok: false,
      reason: 'slug_taken',
    });
  });

  it('allows at most five halls and keeps their order when moved', async () => {
    const ex = await exhibition('halls');
    const ids = [];
    for (const t of ['А', 'Б', 'В', 'Г', 'Д']) ids.push(await hall(ex, t));
    expect(await addHall(getDb(), ex, { title: 'Е', intro: null, wallColor: null })).toEqual({ ok: false, reason: 'too_many' });

    await moveHall(getDb(), ids[1], -1); // Б, А, В, Г, Д
    await moveHall(getDb(), ids[0], -1); // А, Б, В, Г, Д
    expect((await listHallsForAdmin(getDb(), ex)).map((h) => h.title)).toEqual(['А', 'Б', 'В', 'Г', 'Д']);
    await moveHall(getDb(), ids[4], 1); // the last stays last
    await moveHall(getDb(), ids[2], 1); // В down
    expect((await listHallsForAdmin(getDb(), ex)).map((h) => h.title)).toEqual(['А', 'Б', 'Г', 'В', 'Д']);

    await deleteHall(getDb(), ids[0]);
    expect(await hall(ex, 'Е')).toBeTruthy(); // room for one more after a delete
  });

  it('adds a work once per exhibition, refuses hidden ones, moves and removes', async () => {
    const ex = await exhibition('works');
    const h1 = await hall(ex, 'Один');
    const h2 = await hall(ex, 'Два');
    const a = await artwork('a');
    const b = await artwork('b', 'sold');
    const pending = await artwork('p', 'pending');

    expect(await addWork(getDb(), h1, a)).toEqual({ ok: true, exhibitionId: ex });
    expect(await addWork(getDb(), h1, b)).toEqual({ ok: true, exhibitionId: ex });
    expect(await addWork(getDb(), h2, a)).toEqual({ ok: false, reason: 'duplicate' });
    expect(await addWork(getDb(), h1, pending)).toEqual({ ok: false, reason: 'hidden' });

    await moveWork(getDb(), h1, b, -1);
    await setWorkNote(getDb(), h1, a, 'Ранняя работа.');
    let [first] = await listHallsForAdmin(getDb(), ex);
    expect(first.works.map((w) => w.artworkId)).toEqual([b, a]);
    expect(first.works[1].curatorNote).toBe('Ранняя работа.');

    await removeWork(getDb(), h1, b);
    [first] = await listHallsForAdmin(getDb(), ex);
    expect(first.works.map((w) => w.artworkId)).toEqual([a]);
  });

  it('finds published and sold works by title or artist, not pending ones', async () => {
    const a = await artwork('poisk-odin');
    await artwork('poisk-dva', 'pending');
    const found = await searchArtworkChoices(getDb(), 'poisk');
    expect(found.map((w) => w.id)).toEqual([a]);
    expect((await searchArtworkChoices(getDb(), 'Тест выставок студия', 100)).some((w) => w.id === a)).toBe(true);
  });
});

describe('exhibition public queries', () => {
  const today = '2090-06-15';

  it('shows a published exhibition from its first day, never a draft or an upcoming one', async () => {
    const draft = await exhibition('q-draft', { startsOn: '2090-06-01', endsOn: '2090-06-30' });
    await exhibition('q-soon', { status: 'published', startsOn: '2090-07-01', endsOn: '2090-07-30' });
    await exhibition('q-open', { status: 'published', startsOn: '2090-06-15', endsOn: '2090-06-15' });

    expect(await getPublicExhibition(getDb(), `${PREFIX}q-draft`, today)).toBeUndefined();
    expect(await getPublicExhibition(getDb(), `${PREFIX}q-soon`, today)).toBeUndefined();
    expect((await getPublicExhibition(getDb(), `${PREFIX}q-open`, today))?.exhibition.slug).toBe(`${PREFIX}q-open`);
    // the admin's preview sees drafts
    expect((await getExhibitionPreview(getDb(), draft))?.exhibition.id).toBe(draft);

    // the journal has upcoming ones (as «Скоро»), never drafts
    const slugs = (await listAfishaExhibitions(getDb())).map((e) => e.slug);
    expect(slugs).toContain(`${PREFIX}q-soon`);
    expect(slugs).not.toContain(`${PREFIX}q-draft`);
  });

  it('hides works that left the catalog and halls left empty, keeps sold ones', async () => {
    const ex = await exhibition('q-view', { status: 'published', startsOn: '2090-06-01', endsOn: '2090-06-30' });
    const h1 = await hall(ex, 'Полный');
    const h2 = await hall(ex, 'Опустевший');
    const shown = await artwork('q-shown', 'published', 100);
    const sold = await artwork('q-sold', 'sold', 40);
    const gone = await artwork('q-gone');
    for (const [h, a] of [[h1, shown], [h1, sold], [h2, gone]] as const) await addWork(getDb(), h, a);
    // taken off sale after it was hung
    await getDb().update(artworks).set({ status: 'pending' }).where(eq(artworks.id, gone));

    const view = await getPublicExhibition(getDb(), `${PREFIX}q-view`, today);
    expect(view?.halls.map((h) => h.title)).toEqual(['Полный']);
    expect(view?.halls[0].works.map((w) => w.id)).toEqual([shown, sold]);
    expect(view?.halls[0].works[1].status).toBe('sold');
    expect(view?.artists).toHaveLength(1);

    // every work gone: no halls at all, the page says so (Task 7)
    await getDb().update(artworks).set({ status: 'pending' }).where(inArray(artworks.id, [shown, sold]));
    expect((await getPublicExhibition(getDb(), `${PREFIX}q-view`, today))?.halls).toEqual([]);
  });

  it('finds the open exhibition for the home page and for an artwork', async () => {
    const ex = await exhibition('q-home', { status: 'published', startsOn: '2090-06-10', endsOn: '2090-06-20' });
    const h = await hall(ex, 'Зал');
    const a = await artwork('q-home-a');
    await addWork(getDb(), h, a);
    expect((await getOpenExhibitionForHome(getDb(), today))?.slug).toBeDefined();
    expect(await listOpenExhibitionsWithArtwork(getDb(), a, today)).toEqual([{ slug: `${PREFIX}q-home`, title: 'Тест' }]);
    expect(await listOpenExhibitionsWithArtwork(getDb(), a, '2090-06-21')).toEqual([]);
  });
});
