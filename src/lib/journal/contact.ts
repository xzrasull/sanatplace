import { OPERATOR } from '../legal';
import { telegramHref } from '../telegram';

// The admin's Telegram: ADMIN_TELEGRAM_USERNAME when set, else the operator's
// contact from the legal pages. `text` is typed into the chat in advance.
export function adminTelegramLink(text?: string): string | null {
  const base = telegramHref(process.env.ADMIN_TELEGRAM_USERNAME) ?? telegramHref(OPERATOR.telegram);
  if (!base) return null;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const PROPOSE_TEXT =
  'Здравствуйте! Хочу разместить материал в афише sanatplace.\n\nЧто: \nДаты и время: \nМесто: \nСтоимость: \nОписание: \n\n(фото пришлю следующим сообщением)';

export const signupText = (title: string) => `Здравствуйте! Хочу записаться: «${title}».`;
