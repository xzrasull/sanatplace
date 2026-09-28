import { test, expect } from '@playwright/test';
import { signInAsStaff } from './helpers/auth';

test('the admin area sends anyone without a staff sign-in to /sanatadmin', async ({ page }) => {
  await page.goto('/admin/sellers');
  await expect(page).toHaveURL(/\/sanatadmin$/);
  await expect(page.getByRole('heading', { name: 'Администрация' })).toBeVisible();
  await expect(page.getByLabel('Логин')).toBeVisible();
  await expect(page.getByLabel('Пароль')).toHaveAttribute('type', 'password');

  await page.getByLabel('Логин').fill('admin');
  await page.getByLabel('Пароль').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByText('Неверный логин или пароль.')).toBeVisible();
  await page.goto('/admin/database');
  await expect(page).toHaveURL(/\/sanatadmin$/);
});

test('a moderator gets moderation but not the database', async ({ page, baseURL }) => {
  await signInAsStaff(page, 'moderator', baseURL);
  await page.goto('/admin/sellers');
  await expect(page.getByRole('heading', { name: 'Заявки продавцов', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'База данных' })).toHaveCount(0);
  await page.goto('/admin/database');
  await expect(page).toHaveURL(/\/admin\/sellers$/);
});

test('the admin gets the database editor on top of moderation', async ({ page, baseURL }) => {
  await signInAsStaff(page, 'admin', baseURL);
  await page.goto('/sanatadmin');
  await expect(page).toHaveURL(/\/admin\/database$/);
  await expect(page.getByRole('link', { name: /Пользователи/ })).toBeVisible();
  await page.goto('/admin/database/categories');
  await expect(page.getByRole('link', { name: 'Добавить запись' })).toBeVisible();

  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.getByRole('dialog', { name: 'Выйти из аккаунта?' }).getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/sanatadmin$/);
  await page.goto('/admin/sellers');
  await expect(page).toHaveURL(/\/sanatadmin$/);
});
