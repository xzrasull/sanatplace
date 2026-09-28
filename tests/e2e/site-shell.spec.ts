import { test, expect } from '@playwright/test';

test('the header holds only the logo and the menu button', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: /sanatplace/ })).toHaveAttribute('href', '/');
  await expect(header.getByRole('button', { name: 'Меню' })).toBeVisible();
  // everything else lives in the menu, which starts closed
  await expect(header.getByRole('link', { name: 'Каталог' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeHidden();
});

test('the menu search opens the catalog with the query', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('searchbox', { name: 'Поиск' }).fill('ночь');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/gallery\?q=/, { timeout: 15000 });
  await expect(page.getByRole('searchbox', { name: 'Поиск по каталогу' })).toHaveValue('ночь');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('the menu opens from the top right and closes three ways', async ({ page }) => {
    await page.goto('/');
    const burger = page.getByRole('button', { name: 'Меню' });
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await burger.click();
    const menu = page.getByRole('navigation', { name: 'Основная навигация' });
    await expect(menu.getByRole('link', { name: 'Войти через Telegram' })).toHaveAttribute('href', '/sign-in');
    await expect(menu.getByRole('link', { name: 'Главная' })).toHaveAttribute('aria-current', 'page');
    await expect(menu.getByRole('link', { name: 'Продавцам' })).toHaveCount(0);

    // 1. Escape, focus back on the button
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    const closeButton = page.getByRole('button', { name: 'Меню' });
    await expect(closeButton).toBeFocused();

    // 2. a click outside
    await closeButton.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(200, 700);
    await expect(menu).toBeHidden();

    // 3. the button again
    await page.getByRole('button', { name: 'Меню' }).click();
    await page.getByRole('button', { name: 'Закрыть меню' }).click();
    await expect(menu).toBeHidden();

    // going to another page closes it too
    await page.getByRole('button', { name: 'Меню' }).click();
    await menu.getByRole('link', { name: 'Каталог' }).click();
    await expect(page).toHaveURL(/\/gallery$/, { timeout: 15000 });
    await expect(menu).toBeHidden();
    await page.getByRole('button', { name: 'Меню' }).click();
    await expect(menu.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page');
  });

  test('the page has no horizontal scroll', async ({ page }) => {
    for (const path of ['/', '/gallery', '/artists', '/sell', '/sign-in']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBe(0);
    }
  });
});
