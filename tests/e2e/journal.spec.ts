import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { posts } from '../../src/db/schema';
import { POSTS_BUCKET } from '../../src/lib/uploads/buckets';
import { dropImages } from '../../src/lib/uploads/upload-image';
import { signInAsNewUser, signInAsStaff } from './helpers/auth';

// a far-future event, so it is the soonest upcoming one only if nothing else is
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test('the admin writes an event as a draft, publishes it, and it shows on the site', async ({ page }) => {
  const slug = `e2e-sobytie-${Date.now()}`;
  const title = `E2E мастер-класс ${Date.now()}`;
  // a 4:3 photo: the form cuts it to 16:9
  const cover = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#617f6c' } }).jpeg().toBuffer();

  await signInAsStaff(page, 'admin');
  try {
    await page.goto('/admin/journal/new');
    // picked with the keyboard, as a person does (separate input and change
    // events): the choice must stick
    const rubric = page.getByLabel('Рубрика');
    await rubric.focus();
    await page.keyboard.press('ArrowDown');
    await expect(rubric).toHaveValue('event');
    await expect(page.getByLabel('Дата начала')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(rubric).toHaveValue('news');
    await expect(page.getByLabel('Дата начала')).toHaveCount(0);
    await rubric.selectOption('event');
    await page.getByLabel('Заголовок', { exact: true }).fill(title);
    await page.getByLabel('Адрес страницы').fill(slug);
    await page.getByLabel(/Короткое описание/).fill('Три часа с кистью.');
    await page.getByLabel('Обложка').setInputFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: cover });
    await expect(page.getByText(/Готово: 1200×675/)).toBeVisible();
    await page.getByLabel('Дата начала').fill(inDays(1));
    await page.getByLabel('Место').fill('Галерея sanatplace, Душанбе');
    await page.getByLabel('Стоимость').fill('150 TJS');
    await page.getByLabel('Текст материала').fill('Мы начнём с простых упражнений.\n\n## Что взять\n\n- фартук');
    await page.getByRole('button', { name: 'Сохранить черновик' }).click();
    await expect(page.getByText('Черновик сохранён.')).toBeVisible({ timeout: 20000 });

    // the filters apply as soon as a choice is made
    await page.getByLabel('Статус').selectOption('draft');
    await expect(page).toHaveURL(/[?&]s=draft/);
    await page.getByLabel('Рубрика').selectOption('event');
    await expect(page).toHaveURL(/[?&]c=event/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.goto('/admin/journal');

    // a draft is not on the site, not even by its address (the status stays
    // 200 because the page streams, as for a missing artwork; the content is the 404)
    const draft = await (await page.request.get(`/journal/${slug}`)).text();
    expect(draft).toContain('Страница не найдена');
    expect(draft).not.toContain(title);

    await page.getByRole('button', { name: `Опубликовать: ${title}` }).click();
    await expect(page.getByRole('button', { name: `Снять с публикации: ${title}` })).toBeVisible();

    await page.goto(`/journal/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Что взять' })).toBeVisible();
    await expect(page.getByText('150 TJS')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Записаться в Telegram' })).toHaveAttribute('href', /^https:\/\/t\.me\//);

    await page.goto('/journal?c=event');
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
  } finally {
    const [row] = await getDb().select().from(posts).where(eq(posts.slug, slug));
    if (row) {
      await getDb().delete(posts).where(eq(posts.id, row.id));
      await dropImages(POSTS_BUCKET, [row.coverUrl]);
    }
  }
});

test('only the admin can open the journal section', async ({ page }) => {
  await signInAsNewUser(page, 'journal_buyer');
  await page.goto('/admin/journal');
  await expect(page).not.toHaveURL(/\/admin\/journal$/);

  await signInAsStaff(page, 'moderator');
  await page.goto('/admin/journal');
  await expect(page).toHaveURL(/\/admin\/sellers/);
});
