import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../src/db';

const callTelegram = vi.fn();
vi.mock('../../src/lib/telegram-bot/api', () => ({ callTelegram: (...args: unknown[]) => callTelegram(...args) }));

const {
  notifyAdminOfApplication,
  notifyAdminOfArtwork,
  notifyArtworkApproved,
  notifyArtworkRejected,
  notifySellerApproved,
  notifySellerRejected,
} = await import('../../src/lib/telegram-bot/notify');

// A stand-in for drizzle: each select().from().where() answers with the next
// prepared rows, in order.
function fakeDb(...answers: unknown[][]) {
  const queue = [...answers];
  return { select: () => ({ from: () => ({ where: async () => queue.shift() ?? [] }) }) } as unknown as Db;
}

describe('telegram approval messages', () => {
  beforeEach(() => {
    callTelegram.mockReset();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sanatplace.example');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('tells the artist their application is approved, with a button to the cabinet', async () => {
    const db = fakeDb([{ userId: 'u1', displayName: 'Rasul' }], [{ telegramId: 42 }]);
    await notifySellerApproved(db, 'app1');
    expect(callTelegram).toHaveBeenCalledOnce();
    const [method, body] = callTelegram.mock.calls[0];
    expect(method).toBe('sendMessage');
    expect(body.chat_id).toBe(42);
    expect(body.text).toContain('Rasul, ваша заявка одобрена');
    expect(body.reply_markup.inline_keyboard[0][0]).toEqual({
      text: 'Открыть кабинет',
      url: 'https://sanatplace.example/dashboard/seller',
    });
  });

  it('tells the artist their artwork is published, with a link to it', async () => {
    const db = fakeDb([{ sellerId: 'u1', title: 'Звездная ночь' }], [{ telegramId: 42 }]);
    await notifyArtworkApproved(db, 'art1');
    const body = callTelegram.mock.calls[0][1];
    expect(body.text).toContain('«Звездная ночь»');
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe('https://sanatplace.example/gallery/artwork/art1');
  });

  it('sends no button when the site is on localhost (Telegram refuses such links)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    await notifyArtworkApproved(fakeDb([{ sellerId: 'u1', title: 'T' }], [{ telegramId: 42 }]), 'art1');
    expect(callTelegram.mock.calls[0][1].reply_markup).toBeUndefined();
  });

  it('does not throw when Telegram fails (e.g. the artist blocked the bot)', async () => {
    callTelegram.mockRejectedValue(new Error('Forbidden: bot was blocked by the user'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      notifySellerApproved(fakeDb([{ userId: 'u1', displayName: 'R' }], [{ telegramId: 42 }]), 'app1'),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('tells the artist their application is rejected, with the reason and a way back', async () => {
    const db = fakeDb([{ userId: 'u1', rejectionReason: 'Нужны фото работ' }], [{ telegramId: 42 }]);
    await notifySellerRejected(db, 'app1');
    const body = callTelegram.mock.calls[0][1];
    expect(body.chat_id).toBe(42);
    expect(body.text).toContain('заявка продавца на sanatplace отклонена');
    expect(body.text).toContain('Причина: Нужны фото работ');
    expect(body.reply_markup.inline_keyboard[0][0]).toEqual({
      text: 'Отправить заявку заново',
      url: 'https://sanatplace.example/become-seller',
    });
  });

  it('tells the artist their artwork is rejected, with a link to fix it', async () => {
    const db = fakeDb([{ sellerId: 'u1', title: 'Закат', rejectionReason: 'Размытое фото' }], [{ telegramId: 42 }]);
    await notifyArtworkRejected(db, 'art1');
    const body = callTelegram.mock.calls[0][1];
    expect(body.text).toContain('«Закат» не прошла проверку');
    expect(body.text).toContain('Причина: Размытое фото');
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe('https://sanatplace.example/dashboard/seller/art1/edit');
  });

  it('leaves the reason out when staff gave none', async () => {
    await notifyArtworkRejected(fakeDb([{ sellerId: 'u1', title: 'T', rejectionReason: '  ' }], [{ telegramId: 42 }]), 'a');
    await notifySellerRejected(fakeDb([{ userId: 'u1', rejectionReason: null }], [{ telegramId: 42 }]), 'b');
    for (const [, body] of callTelegram.mock.calls) expect(body.text).not.toContain('Причина');
  });

  it('sends nothing for an unknown application or artwork', async () => {
    await notifySellerApproved(fakeDb([]), 'nope');
    await notifyArtworkApproved(fakeDb([]), 'nope');
    expect(callTelegram).not.toHaveBeenCalled();
  });
});

describe('telegram messages to the admin', () => {
  beforeEach(() => {
    callTelegram.mockReset();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sanatplace.example');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('tells the admin about a new seller application, with a button to the queue', async () => {
    const db = fakeDb([{ displayName: 'Студия Сафар' }], [{ telegramId: 7 }]);
    await notifyAdminOfApplication(db, 'u1');
    expect(callTelegram).toHaveBeenCalledOnce();
    const body = callTelegram.mock.calls[0][1];
    expect(body.chat_id).toBe(7);
    expect(body.text).toBe('🆕 Новая заявка художника: Студия Сафар.');
    expect(body.reply_markup.inline_keyboard[0][0]).toEqual({
      text: 'Открыть заявки',
      url: 'https://sanatplace.example/admin/sellers',
    });
  });

  it('tells the admin about a new artwork, with its title and artist', async () => {
    const db = fakeDb([{ sellerId: 'u1', title: 'Закат' }], [{ displayName: 'Студия Сафар' }], [{ telegramId: 7 }]);
    await notifyAdminOfArtwork(db, 'art1');
    const body = callTelegram.mock.calls[0][1];
    expect(body.text).toBe('🖼 Новая картина на проверку: «Закат» — Студия Сафар.');
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe('https://sanatplace.example/admin/artworks');
  });

  it('says so when the artwork was edited and is on review again', async () => {
    const db = fakeDb([{ sellerId: 'u1', title: 'Закат' }], [{ displayName: 'Студия Сафар' }], [{ telegramId: 7 }]);
    await notifyAdminOfArtwork(db, 'art1', true);
    expect(callTelegram.mock.calls[0][1].text).toContain('Картина изменена и снова ждёт проверки: «Закат»');
  });

  it('sends nothing while the admin account has not signed in on the site', async () => {
    await notifyAdminOfApplication(fakeDb([{ displayName: 'R' }], []), 'u1');
    expect(callTelegram).not.toHaveBeenCalled();
  });

  it('does not throw when Telegram fails', async () => {
    callTelegram.mockRejectedValue(new Error('Forbidden: bot was blocked by the user'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(notifyAdminOfApplication(fakeDb([{ displayName: 'R' }], [{ telegramId: 7 }]), 'u1')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
