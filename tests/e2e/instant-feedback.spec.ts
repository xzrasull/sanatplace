import { test, expect, type Page, type Request } from '@playwright/test';
import { signInAsNewUser } from './helpers/auth';

// Holds every request that matches for `ms`, like a slow connection would.
async function slowDown(page: Page, match: (r: Request) => boolean, ms: number) {
  await page.route('**/*', async (route) => {
    if (match(route.request())) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

// InstantFeedback comes alive a little after the page's links and buttons do;
// on a busy machine a press could come before it listens.
const listening = (page: Page) => expect(page.locator('html[data-instant-feedback]')).toBeAttached();

const isServerAction = (r: Request) => r.method() === 'POST' && Boolean(r.headers()['next-action']);

test('a form button locks at once and a double press sends the form once', async ({ page }) => {
  await signInAsNewUser(page, 'instant_submit');
  await slowDown(page, isServerAction, 1500);
  const posts: string[] = [];
  page.on('request', (r) => {
    if (isServerAction(r)) posts.push(r.url());
  });

  const button = page.getByRole('button', { name: 'Я покупатель' });
  await button.dblclick();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');

  await expect(page).toHaveURL(/\/dashboard\/buyer/, { timeout: 15000 });
  expect(posts).toHaveLength(1);
});

test('"Выйти" sends one request even when pressed twice', async ({ page }) => {
  await signInAsNewUser(page, 'instant_signout');
  await slowDown(page, (r) => r.method() === 'POST' && r.url().includes('/auth/sign-out'), 1500);
  let signOuts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/auth/sign-out')) signOuts++;
  });

  await listening(page);
  await page.getByRole('button', { name: 'Меню' }).click();
  const form = page.getByRole('navigation', { name: 'Основная навигация' }).locator('form[action="/auth/sign-out"]');
  // a second press while the first is still on its way
  const locked = await form.evaluate(async (f: HTMLFormElement) => {
    f.requestSubmit();
    await new Promise((r) => setTimeout(r, 300));
    const wasLocked = f.hasAttribute('data-submitting');
    f.requestSubmit();
    return wasLocked;
  });
  expect(locked).toBe(true);
  await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
  expect(signOuts).toBe(1);
});

test('a link click shows the loading bar right away', async ({ page }) => {
  await page.goto('/sell');
  await slowDown(page, (r) => r.headers()['rsc'] === '1', 1500);
  await listening(page);
  await page.getByRole('link', { name: 'Каталог' }).first().click();
  await expect(page.getByRole('progressbar', { name: 'Загрузка страницы' })).toBeVisible({ timeout: 500 });
  await expect(page).toHaveURL(/\/gallery$/, { timeout: 15000 });
  await expect(page.getByRole('progressbar', { name: 'Загрузка страницы' })).toBeHidden();
});
