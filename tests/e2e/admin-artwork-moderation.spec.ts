import { test, expect } from '@playwright/test';
import { signInAsNewUser, signInAsStaff } from './helpers/auth';
import { testTelegramId } from '../helpers/test-telegram-id';
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { users, sellerApplications, categories, techniques, artworks } from '../../src/db/schema';
import { createArtwork } from '../../src/lib/artworks/seller-operations';

test('admin approves a pending artwork', async ({ page }) => {
  const [seller] = await getDb()
    .insert(users)
    .values({
      telegramId: testTelegramId(`test_artwork_mod_seller_${Date.now()}`),
      fullName: 'Seller',
      role: 'seller',
    })
    .returning();
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: `Худ. модерация теста ${Date.now()}`,
    bio: 'Био.',
    status: 'approved',
  });
  const [category] = await getDb().insert(categories).values({ name: `Категория модерации ${Date.now()}` }).returning();
  const [technique] = await getDb().insert(techniques).values({ name: `Техника модерации ${Date.now()}` }).returning();

  const artworkTitle = `Картина для одобрения ${Date.now()}`;
  const artworkId = await createArtwork(getDb(), {
    sellerId: seller.id,
    title: artworkTitle,
    description: 'Описание.',
    price: 900,
    heightCm: 25,
    widthCm: 35,
    categoryId: category.id,
    techniqueId: technique.id,
    imageUrl: 'https://example.com/pending-e2e.png',
  });

  let adminUserId: string | undefined;
  try {
    const adminUser = await signInAsNewUser(page, 'artwork_mod_admin');
    adminUserId = adminUser.id;
    await signInAsStaff(page, 'moderator');

    await page.goto('/admin/artworks');
    await expect(page.getByText(artworkTitle)).toBeVisible();
    await page
      .locator('section', { hasText: artworkTitle })
      .getByRole('button', { name: 'Одобрить' })
      .click();
    await expect(page.getByText(artworkTitle)).not.toBeVisible();

    const [row] = await getDb().select().from(artworks).where(eq(artworks.id, artworkId));
    expect(row.status).toBe('published');
  } finally {
    await getDb().delete(artworks).where(eq(artworks.id, artworkId));
    await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, seller.id));
    await getDb().delete(users).where(eq(users.id, seller.id));
    if (adminUserId) await getDb().delete(users).where(eq(users.id, adminUserId));
    await getDb().delete(categories).where(eq(categories.id, category.id));
    await getDb().delete(techniques).where(eq(techniques.id, technique.id));
  }
});

test('the admin deletes a published artwork everywhere', async ({ page }) => {
  const [seller] = await getDb()
    .insert(users)
    .values({ telegramId: testTelegramId(`test_artwork_del_seller_${Date.now()}`), fullName: 'Seller', role: 'seller' })
    .returning();
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: `Худ. удаления ${Date.now()}`,
    bio: 'Био.',
    status: 'approved',
  });
  const [category] = await getDb().insert(categories).values({ name: `Категория удаления ${Date.now()}` }).returning();
  const [technique] = await getDb().insert(techniques).values({ name: `Техника удаления ${Date.now()}` }).returning();
  const title = `Картина для удаления ${Date.now()}`;
  const artworkId = await createArtwork(getDb(), {
    sellerId: seller.id,
    title,
    description: 'Описание.',
    price: 500,
    heightCm: 20,
    widthCm: 30,
    categoryId: category.id,
    techniqueId: technique.id,
    imageUrl: 'https://example.com/delete-e2e.png',
  });
  await getDb().update(artworks).set({ status: 'published' }).where(eq(artworks.id, artworkId));

  try {
    await signInAsStaff(page, 'admin');
    await page.goto(`/admin/artworks?q=${encodeURIComponent(title)}`);
    const row = page.getByRole('listitem').filter({ hasText: title });
    await row.getByRole('button', { name: `Удалить: ${title}` }).click();
    await row.getByRole('button', { name: `Точно удалить: ${title}` }).click();
    await expect(page.getByText('Ничего не нашлось.')).toBeVisible();

    const left = await getDb().select().from(artworks).where(eq(artworks.id, artworkId));
    expect(left).toHaveLength(0);
    await page.goto(`/gallery?q=${encodeURIComponent(title)}`);
    await expect(page.getByText(title)).toHaveCount(0);
  } finally {
    await getDb().delete(artworks).where(eq(artworks.id, artworkId));
    await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, seller.id));
    await getDb().delete(users).where(eq(users.id, seller.id));
    await getDb().delete(categories).where(eq(categories.id, category.id));
    await getDb().delete(techniques).where(eq(techniques.id, technique.id));
  }
});
