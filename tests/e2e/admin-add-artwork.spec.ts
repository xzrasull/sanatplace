import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { artworks, categories, sellerApplications, techniques, users } from '../../src/db/schema';
import { deleteArtworkImages } from '../../src/lib/uploads/upload-image';
import { testTelegramId } from '../helpers/test-telegram-id';
import { signInAsStaff } from './helpers/auth';
import { pick } from './helpers/select';

const stamp = Date.now();
const artistName = `E2E Художник за ${stamp}`;
let sellerId: string;
let categoryId: string;
let techniqueId: string;

test.beforeAll(async () => {
  const [seller] = await getDb()
    .insert(users)
    .values({ telegramId: testTelegramId(`e2e_for_artist_${stamp}`), fullName: 'E2E For Artist', role: 'seller' })
    .returning();
  sellerId = seller.id;
  await getDb().insert(sellerApplications).values({ userId: seller.id, displayName: artistName, bio: 'Био.', status: 'approved' });
  categoryId = (await getDb().insert(categories).values({ name: `E2E кат за ${stamp}` }).returning())[0].id;
  techniqueId = (await getDb().insert(techniques).values({ name: `E2E тех за ${stamp}` }).returning())[0].id;
});

test.afterAll(async () => {
  const uploaded = await getDb().select({ url: artworks.imageUrl }).from(artworks).where(eq(artworks.sellerId, sellerId));
  await deleteArtworkImages(uploaded.map((a) => a.url));
  await getDb().delete(artworks).where(eq(artworks.sellerId, sellerId));
  await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, sellerId));
  await getDb().delete(users).where(eq(users.id, sellerId));
  await getDb().delete(categories).where(eq(categories.id, categoryId));
  await getDb().delete(techniques).where(eq(techniques.id, techniqueId));
});

test('an admin adds a painting for an artist; it is theirs and in the catalog at once', async ({ page }) => {
  test.setTimeout(90_000);
  const title = `E2E работа за художника ${stamp}`;
  const png = await sharp({ create: { width: 80, height: 100, channels: 3, background: '#617f6c' } }).png().toBuffer();

  await signInAsStaff(page, 'admin');
  await page.goto('/admin/sellers');
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: artistName }) })
    .getByRole('link', { name: '+ Добавить работу' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: `Добавить работу за художника: ${artistName}` })).toBeVisible();

  await page.getByLabel('Название').fill(title);
  await page.getByLabel('Описание').fill('Добавлено админом по просьбе художника.');
  await page.getByLabel('Цена (сомони)').fill('1200');
  await page.getByLabel('Высота (см)').fill('50');
  await page.getByLabel('Ширина (см)').fill('40');
  const [category] = await getDb().select().from(categories).where(eq(categories.id, categoryId));
  const [technique] = await getDb().select().from(techniques).where(eq(techniques.id, techniqueId));
  await pick(page, 'Категория', category.name);
  await pick(page, 'Техника', technique.name);
  await page.getByLabel('Фото').setInputFiles({ name: 'work.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Добавить и опубликовать' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Работа добавлена и опубликована' })).toBeVisible({ timeout: 20000 });
  const [row] = await getDb().select().from(artworks).where(eq(artworks.title, title));
  expect([row.sellerId, row.status]).toEqual([sellerId, 'published']);
  // the form is empty again for the next one
  await expect(page.getByLabel('Название')).toHaveValue('');

  await page.context().clearCookies();
  await page.goto(`/gallery/artwork/${row.id}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(artistName).first()).toBeVisible();
});

test('a moderator has no such button and cannot open the page', async ({ page }) => {
  await signInAsStaff(page, 'moderator');
  await page.goto('/admin/artworks');
  await expect(page.getByRole('link', { name: /Добавить работу за художника/ })).toHaveCount(0);
  await page.goto(`/admin/artworks/new?seller=${sellerId}`);
  await expect(page).toHaveURL(/\/admin\/sellers/);
});
