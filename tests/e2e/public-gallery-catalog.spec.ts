import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { users, sellerApplications, categories, techniques, artworks } from '../../src/db/schema';
import { createArtwork } from '../../src/lib/artworks/seller-operations';
import { testTelegramId } from '../helpers/test-telegram-id';

test('published artworks appear in the public catalog and respect category filter', async ({ page }) => {
  const [seller] = await getDb()
    .insert(users)
    .values({
      telegramId: testTelegramId(`test_catalog_seller_${Date.now()}`),
      fullName: 'Catalog Test Seller',
      role: 'seller',
    })
    .returning();
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: `Каталог-тест студия ${Date.now()}`,
    bio: 'Био.',
    status: 'approved',
  });
  const [category] = await getDb().insert(categories).values({ name: `Каталог категория ${Date.now()}` }).returning();
  const [otherCategory] = await getDb().insert(categories).values({ name: `Другая категория ${Date.now()}` }).returning();
  const [technique] = await getDb().insert(techniques).values({ name: `Каталог техника ${Date.now()}` }).returning();

  const artworkTitle = `Каталожная картина ${Date.now()}`;
  const artworkId = await createArtwork(getDb(), {
    sellerId: seller.id,
    title: artworkTitle,
    description: 'Описание.',
    price: 1500,
    heightCm: 50,
    widthCm: 60,
    categoryId: category.id,
    techniqueId: technique.id,
    imageUrl: 'https://example.com/catalog.png',
  });
  await getDb().update(artworks).set({ status: 'published' }).where(eq(artworks.id, artworkId));

  try {
    await page.goto('/gallery');
    await expect(page.getByText(artworkTitle)).toBeVisible();

    await page.goto(`/gallery?categoryId=${otherCategory.id}`);
    await expect(page.getByText(artworkTitle)).not.toBeVisible();

    await page.goto(`/gallery?categoryId=${category.id}`);
    await expect(page.getByText(artworkTitle)).toBeVisible();
  } finally {
    await getDb().delete(artworks).where(eq(artworks.id, artworkId));
    await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, seller.id));
    await getDb().delete(users).where(eq(users.id, seller.id));
    await getDb().delete(categories).where(eq(categories.id, category.id));
    await getDb().delete(categories).where(eq(categories.id, otherCategory.id));
    await getDb().delete(techniques).where(eq(techniques.id, technique.id));
  }
});

test('catalog filters stay folded until opened and fold again after applying', async ({ page }) => {
  await page.goto('/gallery');
  const toggle = page.getByRole('button', { name: /Фильтры/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Цена до')).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByLabel('Цена от').fill('1');
  await page.getByLabel('Цена до').fill('999999');
  await page.getByRole('button', { name: 'Применить фильтры' }).click();

  await expect(page).toHaveURL(/minPrice=1&maxPrice=999999/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // a price range counts as one filter (one tag under the search)
  await expect(toggle).toContainText('1');
  await expect(page.getByRole('link', { name: 'Убрать: Цена: от 1 до 999999 TJS' })).toBeVisible();
});

test('technique, artist and sort are the site own dropdowns, one open at a time', async ({ page }) => {
  await page.goto('/gallery');
  const toggle = page.getByRole('button', { name: /Фильтры/ });
  await toggle.click();
  const sort = page.getByRole('button', { name: /Сортировка/ });
  const artist = page.getByRole('button', { name: /Художник/ });
  await expect(sort).toHaveAttribute('aria-haspopup', 'listbox');
  await expect(sort).toContainText('Сначала новые');

  // a click on another dropdown closes the first
  await sort.click();
  await expect(page.getByRole('listbox', { name: 'Сортировка' })).toBeVisible();
  await artist.click();
  await expect(page.getByRole('listbox', { name: 'Сортировка' })).toBeHidden();
  await expect(page.getByRole('option', { name: 'Все художники' })).toBeFocused();

  // Escape closes and gives the focus back
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox', { name: 'Художник' })).toBeHidden();
  await expect(artist).toBeFocused();

  // folding the panel closes an open list
  await artist.click();
  await toggle.click();
  await toggle.click();
  await expect(page.getByRole('listbox', { name: 'Художник' })).toBeHidden();

  // the keyboard: open, End, Enter picks «По названию»
  await sort.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Сначала новые' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: 'По названию' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/sort=az/);
  await expect(page.getByRole('button', { name: /Сортировка/ })).toContainText('По названию');
});
