import Image from 'next/image';
import Link from 'next/link';
import { BRAND_NAME } from '@/src/lib/brand';
import { OPERATOR } from '@/src/lib/legal';
import { pagePreview } from '@/src/lib/seo';
import { telegramHref } from '@/src/lib/telegram';

const TITLE = 'О нас';
const DESCRIPTION = `${BRAND_NAME} — место, где художники показывают и продают свои оригиналы напрямую покупателям.`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...pagePreview({ title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION }),
};

// The person shown in «Наша команда».
const MEMBER = { name: 'Rasuljon Muminov', role: 'Owner', photo: '/team/rasuljon.webp' };

// The project, how it works, and the team.
export default function AboutPage() {
  const telegram = telegramHref(OPERATOR.telegram);
  return (
    <main>
      <div className="wrap stack pg">
        <div className="panel sell-hero">
          <p className="eyebrow">О нас</p>
          <h1 className="t">{BRAND_NAME} — место для искусства</h1>
          <p>
            «Санъат» по-таджикски значит «искусство». Мы собираем в одном месте живые картины и тех, кто их пишет, чтобы
            найти и купить оригинал было так же просто, как написать другу.
          </p>
        </div>

        <section className="sec about-txt" aria-labelledby="about-what">
          <div className="sec-head">
            <h2 id="about-what">Что такое {BRAND_NAME}</h2>
          </div>
          <p>
            Это онлайн-галерея и маркетплейс оригинальных картин. Художники сами выставляют свои работы: фото, размеры,
            технику и цену. Покупатель выбирает картину в каталоге и пишет автору напрямую. Пользоваться сайтом бесплатно:
            мы не берём комиссию и не участвуем в расчётах.
          </p>
          <p>
            Помимо каталога, у нас есть афиша и журнал: выставки, мастер-классы и новости о том, что происходит вокруг
            искусства в Душанбе.
          </p>
        </section>

        <section className="sec" aria-labelledby="about-how">
          <div className="sec-head">
            <h2 id="about-how">Как это работает</h2>
          </div>
          <ol className="steps">
            <li className="step">
              <b>1</b>
              <h3>Художник выставляет работы</h3>
              <p>Вход через Telegram, без паролей. Картину можно добавить за пару минут.</p>
            </li>
            <li className="step">
              <b>2</b>
              <h3>Мы проверяем каждую</h3>
              <p>В каталог попадают только оригиналы автора — копии и репродукции запрещены.</p>
            </li>
            <li className="step">
              <b>3</b>
              <h3>Покупатель пишет автору</h3>
              <p>Цену, доставку и детали вы обсуждаете напрямую в Telegram.</p>
            </li>
          </ol>
        </section>

        <section className="sec" aria-labelledby="about-me">
          <div className="sec-head">
            <h2 id="about-me">Наша команда</h2>
          </div>
          <div className="founder">
            <span className="founder-pic">
              <Image src={MEMBER.photo} alt={MEMBER.name} width={340} height={340} sizes="170px" />
            </span>
            <div className="founder-txt">
              <h3>{MEMBER.name}</h3>
              <p className="founder-role">{MEMBER.role}</p>
              <p>
                Мы — небольшая команда из Душанбе. Мы придумали и сделали {BRAND_NAME}, чтобы у художников было своё
                место, где их работы видят, а у людей — простой способ купить живую картину напрямую у автора.
              </p>
              <p>Если у вас есть идея, вопрос или вы хотите выставить свои работы — напишите нам, мы будем рады.</p>
              {telegram && (
                <a className="btn btn-tg" href={telegram} target="_blank" rel="noopener noreferrer">
                  Написать нам в Telegram
                </a>
              )}
            </div>
          </div>
        </section>

        <div className="about-cta">
          <Link className="btn" href="/gallery">
            Смотреть каталог
          </Link>
          <Link className="btn alt" href="/sell">
            Стать продавцом
          </Link>
        </div>
      </div>
    </main>
  );
}
