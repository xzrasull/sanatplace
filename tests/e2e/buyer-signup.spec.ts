import { test, expect } from '@playwright/test';
import { testTelegramId } from '../helpers/test-telegram-id';

test('first sign-in from the sign-in page leads to the role-choice screen', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Вход в sanatplace' })).toBeVisible();

  const devLogin = page.getByRole('form', { name: 'Вход для разработки' });
  await devLogin.getByLabel('Telegram ID').fill(String(testTelegramId(`buyer_signup_${Date.now()}`)));
  await devLogin.getByLabel('Имя').fill('Покупатель Тест');
  await devLogin.getByRole('button', { name: 'Войти как тестовый пользователь' }).click();

  await expect(page).toHaveURL(/\/choose-role/, { timeout: 15000 });
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText('Как вы хотите');
});

test('a signed-in user can sign out from the menu', async ({ page }) => {
  await page.goto(`/auth/dev-login?id=${testTelegramId(`sign_out_${Date.now()}`)}`);
  await expect(page).toHaveURL(/\/choose-role/, { timeout: 15000 });

  const menu = page.getByRole('navigation', { name: 'Основная навигация' });
  await page.getByRole('button', { name: 'Меню' }).click();
  await expect(menu.getByRole('link', { name: 'Профиль' })).toHaveAttribute('href', '/cabinet');
  // «Выйти» asks first: «Остаться» keeps the session
  await menu.getByRole('button', { name: 'Выйти' }).click();
  const confirm = page.getByRole('dialog', { name: 'Выйти из аккаунта?' });
  await expect(confirm.getByRole('button', { name: 'Остаться' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Остаться' }).click();
  await expect(confirm).toBeHidden();
  await expect(menu.getByRole('link', { name: 'Профиль' })).toBeVisible();
  await menu.getByRole('button', { name: 'Выйти' }).click();
  await confirm.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/$/);
  // sign-out reloads the page: retry until the menu button is interactive
  await expect(async () => {
    await page.getByRole('button', { name: 'Меню' }).click();
    await expect(menu.getByRole('link', { name: 'Войти через Telegram' })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });

  await page.goto('/dashboard/buyer');
  await expect(page).toHaveURL(/\/sign-in/);
});
