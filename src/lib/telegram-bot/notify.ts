import { eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { artworks, sellerApplications, users } from '../../db/schema';
import { BRAND_NAME } from '../brand';
import { siteUrl } from '../site-url';
import { callTelegram } from './api';

// Messages from the bot to an artist when staff approve or reject their seller
// application or an artwork. Everyone who signed in did so through the bot, so
// it may write to them. Best effort: a person who blocked the bot, or Telegram
// being down, must never break the moderation, so failures are only logged.

async function sendToUser(db: Db, userId: string, text: string, button?: { text: string; path: string }) {
  try {
    const [user] = await db.select({ telegramId: users.telegramId }).from(users).where(eq(users.id, userId));
    if (!user) return;
    const url = button && `${siteUrl()}${button.path}`;
    await callTelegram('sendMessage', {
      chat_id: user.telegramId,
      text,
      link_preview_options: { is_disabled: true },
      // Telegram refuses buttons that lead to localhost: in development the
      // message comes without one
      ...(url?.startsWith('https://') && { reply_markup: { inline_keyboard: [[{ text: button!.text, url }]] } }),
    });
  } catch (e) {
    console.error('telegram notify failed', e);
  }
}

export async function notifySellerApproved(db: Db, applicationId: string) {
  const [application] = await db
    .select({ userId: sellerApplications.userId, displayName: sellerApplications.displayName })
    .from(sellerApplications)
    .where(eq(sellerApplications.id, applicationId));
  if (!application) return;
  await sendToUser(
    db,
    application.userId,
    `🎉 ${application.displayName}, ваша заявка одобрена!\n\n` +
      `Теперь вы художник на ${BRAND_NAME}. Добавьте свои картины в кабинете — после проверки они появятся в каталоге.`,
    { text: 'Открыть кабинет', path: '/dashboard/seller' },
  );
}

export async function notifyArtworkApproved(db: Db, artworkId: string) {
  const [artwork] = await db
    .select({ sellerId: artworks.sellerId, title: artworks.title })
    .from(artworks)
    .where(eq(artworks.id, artworkId));
  if (!artwork) return;
  await sendToUser(
    db,
    artwork.sellerId,
    `✅ Картина «${artwork.title}» прошла проверку и опубликована в каталоге ${BRAND_NAME}.`,
    { text: 'Посмотреть картину', path: `/gallery/artwork/${artworkId}` },
  );
}

// The staff's reason, when they gave one, as its own paragraph.
const reasonLine = (reason: string | null) => (reason?.trim() ? `\n\nПричина: ${reason.trim()}` : '');

export async function notifySellerRejected(db: Db, applicationId: string) {
  const [application] = await db
    .select({ userId: sellerApplications.userId, rejectionReason: sellerApplications.rejectionReason })
    .from(sellerApplications)
    .where(eq(sellerApplications.id, applicationId));
  if (!application) return;
  await sendToUser(
    db,
    application.userId,
    `К сожалению, ваша заявка продавца на ${BRAND_NAME} отклонена.` +
      reasonLine(application.rejectionReason) +
      '\n\nВы можете исправить её и отправить заново.',
    { text: 'Отправить заявку заново', path: '/become-seller' },
  );
}

export async function notifyArtworkRejected(db: Db, artworkId: string) {
  const [artwork] = await db
    .select({ sellerId: artworks.sellerId, title: artworks.title, rejectionReason: artworks.rejectionReason })
    .from(artworks)
    .where(eq(artworks.id, artworkId));
  if (!artwork) return;
  await sendToUser(
    db,
    artwork.sellerId,
    `Картина «${artwork.title}» не прошла проверку.` +
      reasonLine(artwork.rejectionReason) +
      '\n\nИсправьте её в кабинете — после сохранения она снова уйдёт на проверку.',
    { text: 'Исправить картину', path: `/dashboard/seller/${artworkId}/edit` },
  );
}
