import Link from 'next/link';
import { getCurrentUser } from '@/src/lib/auth/session';
import { BRAND_NAME } from '@/src/lib/brand';

export const metadata = {
  title: 'Продавцам',
  description: `Продавайте оригиналы на ${BRAND_NAME}: вход через Telegram, покупатели пишут вам напрямую.`,
};

// For artists: what selling here looks like, and the way in.
export default async function SellPage() {
  const user = await getCurrentUser();
  const start = user
    ? { href: '/choose-role', label: 'Хочу продавать картины', tg: false }
    : { href: '/sign-in', label: 'Войти через Telegram', tg: true };
  return (
    <main>
      <div className="wrap stack pg">
        <div className="panel sell-hero">
          <p className="eyebrow">Продавцам</p>
          <h1 className="t">Продавайте оригиналы на {BRAND_NAME}</h1>
          <p>
            Покажите свои картины тем, кто ищет живое искусство. Вход через Telegram: без паролей, номеров телефонов и
            SMS-кодов.
          </p>
          <Link className={start.tg ? 'btn btn-tg' : 'btn'} href={start.href}>
            {start.label}
          </Link>
        </div>
        <section className="sec" aria-labelledby="steps-title">
          <div className="sec-head">
            <h2 id="steps-title">Как начать</h2>
            <Link className="more" href="/sell/guide">
              Подробная инструкция{' '}
              <i>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </i>
            </Link>
          </div>
          <ol className="steps">
            <li className="step">
              <b>1</b>
              <h3>Войдите</h3>
              <p>Подтвердите вход через Telegram-бота. Аккаунт создаётся сам.</p>
            </li>
            <li className="step">
              <b>2</b>
              <h3>Добавьте картину</h3>
              <p>Фото, название, размеры, техника и цена. Работа появится в каталоге после проверки.</p>
            </li>
            <li className="step">
              <b>3</b>
              <h3>Общайтесь с покупателями</h3>
              <p>Покупатели пишут вам напрямую в Telegram.</p>
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
