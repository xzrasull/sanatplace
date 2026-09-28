import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../src/db';

const callTelegram = vi.fn();
vi.mock('../../src/lib/telegram-bot/api', () => ({ callTelegram: (...args: unknown[]) => callTelegram(...args) }));

const { notifyArtworkApproved, notifySellerApproved } = await import('../../src/lib/telegram-bot/notify');

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

  it('sends nothing for an unknown application or artwork', async () => {
    await notifySellerApproved(fakeDb([]), 'nope');
    await notifyArtworkApproved(fakeDb([]), 'nope');
    expect(callTelegram).not.toHaveBeenCalled();
  });
});
