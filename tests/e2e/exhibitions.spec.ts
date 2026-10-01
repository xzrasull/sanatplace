// tests/e2e/exhibitions.spec.ts
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { eq, like } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { artworks, categories, exhibitions, sellerApplications, techniques, users } from '../../src/db/schema';
import { addHall, addWork, saveExhibition } from '../../src/lib/exhibitions/admin';
import { POSTS_BUCKET } from '../../src/lib/uploads/buckets';
import { dropImages } from '../../src/lib/uploads/upload-image';
import { testTelegramId } from '../helpers/test-telegram-id';
import { signInAsStaff } from './helpers/auth';

const PREFIX = 'e2e-ex-';
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const stamp = Date.now();

let sellerId: string;
let categoryId: string;
let techniqueId: string;
const works: { id: string; title: string }[] = [];

test.beforeAll(async () => {
  const [seller] = await getDb()
    .insert(users)
    .values({ telegramId: testTelegramId(`e2e_ex_${stamp}`), fullName: 'E2E Ex Seller', role: 'seller' })
    .returning();
  sellerId = seller.id;
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: `E2E Художник ${stamp}`,
    bio: 'Био.',
    telegramContact: '@e2e_ex',
    status: 'approved',
  });
  categoryId = (await getDb().insert(categories).values({ name: `E2E кат ${stamp}` }).returning())[0].id;
  techniqueId = (await getDb().insert(techniques).values({ name: `E2E тех ${stamp}` }).returning())[0].id;
  for (const [title, h] of [[`Большая гора ${stamp}`, 150], [`Маленький этюд ${stamp}`, 20]] as const) {
    const [row] = await getDb()
      .insert(artworks)
      .values({
        sellerId,
        title,
        description: 'Описание.',
        price: 2500,
        heightCm: h,
        widthCm: 100,
        categoryId,
        techniqueId,
        imageUrl: 'https://example.com/e2e-ex.jpg',
        status: 'published',
      })
      .returning();
    works.push({ id: row.id, title });
  }
});

test.afterAll(async () => {
  const gone = await getDb().delete(exhibitions).where(like(exhibitions.slug, `${PREFIX}%`)).returning();
  await dropImages(POSTS_BUCKET, gone.map((e) => e.coverUrl).filter((u) => !u.includes('example.com')));
  await getDb().delete(artworks).where(eq(artworks.sellerId, sellerId));
  await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, sellerId));
  await getDb().delete(users).where(eq(users.id, sellerId));
  await getDb().delete(categories).where(eq(categories.id, categoryId));
  await getDb().delete(techniques).where(eq(techniques.id, techniqueId));
});

test('the admin builds an exhibition and a visitor walks through it', async ({ page }) => {
  test.setTimeout(120_000); // many page loads on a cold dev server
  const slug = `${PREFIX}gory-${stamp}`;
  const title = `E2E Горы ${stamp}`;
  const cover = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#617f6c' } }).jpeg().toBuffer();

  await signInAsStaff(page, 'admin');
  await page.goto('/admin/exhibitions/new');
  await page.getByLabel('Название', { exact: true }).fill(title);
  await page.getByLabel('Адрес страницы').fill(slug);
  await page.getByLabel('Дата открытия').fill(inDays(0));
  await page.getByLabel('Дата закрытия').fill(inDays(10));
  await page.getByLabel('Обложка').setInputFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: cover });
  await page.getByLabel('Кураторский текст').fill('Горы как характер.');
  await page.getByRole('button', { name: 'Создать выставку' }).click();
  await expect(page.getByText('Сохранено.')).toBeVisible({ timeout: 20000 });
  const adminUrl = page.url().split('?')[0];

  // a hall, two works found in the catalog
  await page.getByLabel('Название зала').fill('Вершины');
  await page.getByRole('button', { name: 'Добавить зал' }).click();
  await expect(page.getByRole('heading', { name: 'Зал 1. Вершины' })).toBeVisible({ timeout: 20000 });
  for (const w of works) {
    await page.getByLabel('Найти работу для зала «Вершины»').fill(w.title);
    await page.getByRole('button', { name: 'Найти' }).click();
    await page.getByRole('button', { name: `Добавить: ${w.title}` }).click();
    await expect(page.getByRole('button', { name: `Убрать: ${w.title}` })).toBeVisible({ timeout: 20000 });
  }
  // the same work twice is refused
  await page.getByLabel('Найти работу для зала «Вершины»').fill(works[0].title);
  await page.getByRole('button', { name: 'Найти' }).click();
  await page.getByRole('button', { name: `Добавить: ${works[0].title}` }).click();
  await expect(page.getByText('Эта работа уже есть на выставке.')).toBeVisible({ timeout: 20000 });

  // a draft is not public
  await page.context().clearCookies();
  // the status stays 200 because the page streams; the content is the 404
  await page.goto(`/exhibitions/${slug}`);
  await expect(page.getByText('Страница не найдена')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: title })).toHaveCount(0);
  await signInAsStaff(page, 'admin');
  await page.goto(adminUrl);
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByRole('button', { name: 'Снять с публикации' })).toBeVisible({ timeout: 20000 });

  // the visitor
  await page.context().clearCookies();
  await page.goto('/exhibitions');
  await page.getByRole('link', { name: new RegExp(title) }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Вершины' })).toBeVisible();

  // the big canvas hangs taller than the study
  const big = page.getByRole('button', { name: new RegExp(`Открыть: ${works[0].title}`) });
  const small = page.getByRole('button', { name: new RegExp(`Открыть: ${works[1].title}`) });
  const [hb, hs] = [(await big.boundingBox())!.height, (await small.boundingBox())!.height];
  expect(hb).toBeGreaterThan(hs * 2);

  await big.click();
  await expect(page).toHaveURL(new RegExp(`work=${works[0].id}`));
  const viewer = page.getByRole('dialog');
  await expect(viewer.getByText('2500 TJS')).toBeVisible();
  await viewer.getByRole('button', { name: 'Следующая →' }).click();
  await expect(page).toHaveURL(new RegExp(`work=${works[1].id}`));
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();

  // a shared link opens the work; a stranger's id opens nothing
  await page.goto(`/exhibitions/${slug}?work=${works[1].id}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goto(`/exhibitions/${slug}?work=00000000-0000-4000-8000-000000000000`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();

  // through to the artwork page
  await page.goto(`/exhibitions/${slug}?work=${works[0].id}`);
  await page.getByRole('dialog').getByRole('link', { name: 'Подробнее и купить' }).click();
  await expect(page).toHaveURL(new RegExp(`/gallery/artwork/${works[0].id}`));
  await expect(page.getByText(`Участвует в выставке «${title}»`)).toBeVisible();
});

test('a closed exhibition stays open to visitors with a notice; an upcoming one is listed but closed', async ({ page }) => {
  test.setTimeout(90_000);
  const closed = await saveExhibition(getDb(), null, {
    title: `E2E Прошлая ${stamp}`,
    slug: `${PREFIX}past-${stamp}`,
    subtitle: null,
    curatorName: null,
    intro: null,
    startsOn: inDays(-30),
    endsOn: inDays(-2),
    postId: null,
    coverUrl: 'https://example.com/e2e-ex-cover.jpg',
    status: 'published',
  });
  const soon = await saveExhibition(getDb(), null, {
    title: `E2E Будущая ${stamp}`,
    slug: `${PREFIX}soon-${stamp}`,
    subtitle: null,
    curatorName: null,
    intro: null,
    startsOn: inDays(5),
    endsOn: inDays(20),
    postId: null,
    coverUrl: 'https://example.com/e2e-ex-cover.jpg',
    status: 'draft',
  });
  if (!closed.ok || !soon.ok) throw new Error('seed failed');
  const hall = await addHall(getDb(), closed.id, { title: 'Архив', intro: null, wallColor: 'stone' });
  if (!hall.ok) throw new Error('seed failed');
  await addWork(getDb(), hall.id, works[0].id);

  // published through the admin, like a person does: that drops the cached list
  await signInAsStaff(page, 'admin');
  await page.goto(`/admin/exhibitions/${soon.id}`);
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByRole('button', { name: 'Снять с публикации' })).toBeVisible({ timeout: 20000 });
  await page.context().clearCookies();

  await page.goto(`/exhibitions/${closed.slug}`);
  await expect(page.getByText(/Выставка завершилась/)).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`Открыть: ${works[0].title}`) })).toBeVisible();

  await page.goto('/exhibitions');
  await expect(page.getByText(`E2E Будущая ${stamp}`)).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(`E2E Будущая ${stamp}`) })).toHaveCount(0);
  await page.goto(`/exhibitions/${soon.slug}`);
  await expect(page.getByText('Страница не найдена')).toBeVisible();
});
