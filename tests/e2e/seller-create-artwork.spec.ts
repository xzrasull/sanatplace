import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { signInAsNewUser } from './helpers/auth';
import { pick } from './helpers/select';
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { users, sellerApplications, categories, techniques, artworks } from '../../src/db/schema';
import { deleteArtworkImages } from '../../src/lib/uploads/upload-image';

type Photo = { name: string; mimeType: string; buffer: Buffer };

// An approved seller with their own category and technique; `cleanup` removes
// them together with any artwork and uploaded image they created.
async function approvedSeller(page: Page, label: string) {
  const seller = await signInAsNewUser(page, label);
  await getDb().update(users).set({ role: 'seller' }).where(eq(users.id, seller.id));
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: `E2E студия ${Date.now()}`,
    bio: 'Био.',
    status: 'approved',
  });
  const [category] = await getDb().insert(categories).values({ name: `E2E категория ${label} ${Date.now()}` }).returning();
  const [technique] = await getDb().insert(techniques).values({ name: `E2E техника ${label} ${Date.now()}` }).returning();
  const cleanup = async () => {
    const uploaded = await getDb().select({ url: artworks.imageUrl }).from(artworks).where(eq(artworks.sellerId, seller.id));
    await deleteArtworkImages(uploaded.map((a) => a.url));
    await getDb().delete(artworks).where(eq(artworks.sellerId, seller.id));
    await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, seller.id));
    await getDb().delete(categories).where(eq(categories.id, category.id));
    await getDb().delete(techniques).where(eq(techniques.id, technique.id));
    await getDb().delete(users).where(eq(users.id, seller.id));
  };
  return { seller, category, technique, cleanup };
}

async function fillArtwork(page: Page, title: string, category: string, technique: string, photo: Photo) {
  await page.goto('/dashboard/seller/new');
  await page.getByLabel('Название').fill(title);
  await page.getByLabel('Описание').fill('Тестовое описание картины.');
  await page.getByLabel('Цена (сомони)').fill('750');
  await page.getByLabel('Высота (см)').fill('40');
  await page.getByLabel('Ширина (см)').fill('30');
  await pick(page, 'Категория', category);
  await pick(page, 'Техника', technique);
  await page.getByLabel('Фото').setInputFiles(photo);
}

test('an approved seller creates an artwork', async ({ page }) => {
  const { category, technique, cleanup } = await approvedSeller(page, 'create_artwork_seller');
  const artworkTitle = `E2E картина ${Date.now()}`;
  const png = await sharp({ create: { width: 80, height: 100, channels: 3, background: '#e3b02b' } }).png().toBuffer();
  try {
    await fillArtwork(page, artworkTitle, category.name, technique.name, { name: 'test.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'Отправить на модерацию' }).click();

    await expect(page).toHaveURL(/\/dashboard\/seller$/, { timeout: 15000 });
    await expect(page.getByText(artworkTitle)).toBeVisible();
    await expect(page.getByText('На модерации')).toBeVisible();

    const [artwork] = await getDb().select().from(artworks).where(eq(artworks.title, artworkTitle));
    expect(artwork.status).toBe('pending');
  } finally {
    await cleanup();
  }
});

test('a large phone photo is shrunk in the browser and uploads', async ({ page }) => {
  test.setTimeout(90_000);
  const { category, technique, cleanup } = await approvedSeller(page, 'large_photo_seller');
  const artworkTitle = `E2E большое фото ${Date.now()}`;
  // noisy 2400×1800 JPEG: well over the old 1 MB limit, like a real phone photo
  const w = 2400,
    h = 1800;
  const noise = Buffer.alloc(w * h * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() * 255) | 0;
  const jpeg = await sharp(noise, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  expect(jpeg.length).toBeGreaterThan(2 * 1024 * 1024);
  try {
    await fillArtwork(page, artworkTitle, category.name, technique.name, { name: 'phone.jpg', mimeType: 'image/jpeg', buffer: jpeg });
    await expect(page.getByRole('status').filter({ hasText: 'Фото готово: 2000×1500' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Отправить на модерацию' }).click();

    await expect(page).toHaveURL(/\/dashboard\/seller$/, { timeout: 30000 });
    const [artwork] = await getDb().select().from(artworks).where(eq(artworks.title, artworkTitle));
    expect(artwork.imageUrl).toMatch(/\.webp$/);
    const stored = await sharp(Buffer.from(await (await fetch(artwork.imageUrl)).arrayBuffer())).metadata();
    expect([stored.format, stored.width, stored.height]).toEqual(['webp', 2000, 1500]);
  } finally {
    await cleanup();
  }
});

test('a file that is not an image gets a clear message', async ({ page }) => {
  const { category, technique, cleanup } = await approvedSeller(page, 'bad_photo_seller');
  try {
    await fillArtwork(page, `E2E не фото ${Date.now()}`, category.name, technique.name, {
      name: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    await page.getByRole('button', { name: 'Отправить на модерацию' }).click();
    await expect(page).toHaveURL(/error=image/, { timeout: 15000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Не удалось прочитать фото' })).toBeVisible();
  } finally {
    await cleanup();
  }
});
