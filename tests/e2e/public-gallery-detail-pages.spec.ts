import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { users, sellerApplications, categories, techniques, artworks } from '../../src/db/schema';
import { createArtwork } from '../../src/lib/artworks/seller-operations';
import { testTelegramId } from '../helpers/test-telegram-id';

test('artist page and artwork page render for a published artwork, and a pending one 404s', async ({ page }) => {
  const [seller] = await getDb()
    .insert(users)
    .values({
      telegramId: testTelegramId(`test_detail_seller_${Date.now()}`),
      fullName: 'Detail Test Seller',
      role: 'seller',
    })
    .returning();
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: `Детали-тест студия ${Date.now()}`,
    bio: 'Тестовое био художника.',
    telegramContact: '@detail_test',
    status: 'approved',
  });
  const [category] = await getDb().insert(categories).values({ name: `Детали категория ${Date.now()}` }).returning();
  const [technique] = await getDb().insert(techniques).values({ name: `Детали техника ${Date.now()}` }).returning();

  const artworkTitle = `Детальная картина ${Date.now()}`;
  const publishedId = await createArtwork(getDb(), {
    sellerId: seller.id,
    title: artworkTitle,
    description: 'Подробное описание картины.',
    price: 2200,
    heightCm: 45,
    widthCm: 55,
    categoryId: category.id,
    techniqueId: technique.id,
    imageUrl: 'https://example.com/detail.png',
  });
  await getDb().update(artworks).set({ status: 'published' }).where(eq(artworks.id, publishedId));

  const pendingId = await createArtwork(getDb(), {
    sellerId: seller.id,
    title: `Ожидающая картина ${Date.now()}`,
    description: 'Описание.',
    price: 100,
    heightCm: 10,
    widthCm: 10,
    categoryId: category.id,
    techniqueId: technique.id,
    imageUrl: 'https://example.com/pending-detail.png',
  });

  try {
    await page.goto(`/gallery/artwork/${publishedId}`);
    await expect(page.getByRole('heading', { name: artworkTitle })).toBeVisible();
    await expect(page.getByText('2200 TJS')).toBeVisible();

    await page.goto(`/gallery/artist/${seller.id}`);
    await expect(page.getByRole('heading', { name: /Детали-тест студия/ })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Коротко о художнике' })).toContainText(/1\s*работа в продаже/);
    await expect(page.getByRole('heading', { name: 'Как купить работу' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Написать в Telegram' })).toHaveAttribute('href', 'https://t.me/detail_test');
    const forSale = page.getByRole('region', { name: 'Работы' });
    await expect(forSale.getByText(artworkTitle)).toBeVisible();
    await expect(forSale.getByText(/Ожидающая картина/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Уже проданы' })).toHaveCount(0);

    // the status stays 200 because the page streams; the content is the 404
    const pending = await (await page.request.get(`/gallery/artwork/${pendingId}`)).text();
    expect(pending).toContain('Страница не найдена');
    expect(pending).not.toContain('Ожидающая картина');
  } finally {
    await getDb().delete(artworks).where(eq(artworks.sellerId, seller.id));
    await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, seller.id));
    await getDb().delete(users).where(eq(users.id, seller.id));
    await getDb().delete(categories).where(eq(categories.id, category.id));
    await getDb().delete(techniques).where(eq(techniques.id, technique.id));
  }
});
