import Link from 'next/link';
import { Logo } from '@/src/components/sanat/logo';
import { BRAND_NAME, INSTAGRAM_URL, SOURCE_URL } from '@/src/lib/brand';
import { LEGAL_DOCS } from '@/src/lib/legal';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot">
          <div>
            <Logo />
            <a className="ig" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Мы в Instagram
            </a>
          </div>
          <nav aria-label="Покупателям">
            <h4>Покупателям</h4>
            <Link href="/gallery">Каталог</Link>
            <Link href="/artists">Художники</Link>
            <Link href="/exhibitions">Выставки</Link>
            <Link href="/journal">Афиша и журнал</Link>
            <Link href="/favorites">Wishlist</Link>
            <Link href="/about">О нас</Link>
          </nav>
          <nav aria-label="Продавцам">
            <h4>Продавцам</h4>
            <Link href="/sell">Стать продавцом</Link>
            <Link href="/sell/guide">Инструкция для художников</Link>
            <Link href="/sign-in">Войти через Telegram</Link>
            <Link href="/rules/sellers">Правила для продавцов</Link>
          </nav>
          <nav aria-label="Документы">
            <h4>Документы</h4>
            {LEGAL_DOCS.filter((d) => d.href !== '/rules/sellers').map((d) => (
              <Link key={d.href} href={d.href}>
                {d.title}
              </Link>
            ))}
          </nav>
        </div>
        <div className="copy">
          <span>
            © {new Date().getFullYear()} {BRAND_NAME} — место для искусства ·{' '}
            <a className="src" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
              исходный код
            </a>
          </span>
          <span>
            санъат ·{' '}
            <span lang="fa" dir="rtl" className="fa">
              صنعت
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
