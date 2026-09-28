'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { WishCount } from '@/src/components/sanat/wish-count';
import { startNavProgress } from '@/src/components/sanat/instant-feedback';
import { prefersReducedMotion } from '@/src/lib/sanat/reveal';

type Item = { href: string; label: string; current: (path: string) => boolean; wish?: boolean };

const under = (prefix: string) => (path: string) => path === prefix || path.startsWith(prefix + '/');

const ITEMS: Item[] = [
  { href: '/', label: 'Главная', current: (p) => p === '/' },
  { href: '/gallery', label: 'Каталог', current: (p) => p === '/gallery' || p.startsWith('/gallery/artwork/') },
  { href: '/artists', label: 'Художники', current: (p) => under('/artists')(p) || p.startsWith('/gallery/artist/') },
  { href: '/journal', label: 'Афиша', current: under('/journal') },
  { href: '/favorites', label: 'Wishlist', current: under('/favorites'), wish: true },
];

// the clip-path reveal in site.css (.menu) takes this long
const CLOSE_MS = 700;

// The menu button at the top right and its panel. The panel opens under the
// header, growing as a circle from the top right corner. It closes on the
// button, on Escape (focus returns to the button), on a click outside and when
// the page changes; while it is open the page behind does not scroll.
export function BurgerMenu({ signedIn, wishCount }: { signedIn: boolean; wishCount: number }) {
  // `want`: the visitor asked for the menu; `shown`: the panel is in the page
  // (it stays while closing); `open`: the circle is grown.
  const [want, setWant] = useState(false);
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const searchId = useId();
  const menuRef = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const show = () => {
    // the header must be on screen: the panel hangs from its bottom edge
    window.scrollTo(0, 0);
    const bottom = button.current?.closest('header')?.getBoundingClientRect().bottom ?? 80;
    menuRef.current?.style.setProperty('--mt', `${Math.round(bottom)}px`);
    setShown(true);
    setWant(true);
  };
  const close = () => {
    setWant(false);
    setOpen(false);
  };

  // Once the panel is in the page, its clipped state is computed (the forced
  // layout below) before the circle grows, so the transition has a start.
  useLayoutEffect(() => {
    if (!want || !shown || open) return;
    void menuRef.current?.offsetWidth;
    setOpen(true);
  }, [want, shown, open]);

  useEffect(() => {
    if (want || open || !shown) return;
    if (prefersReducedMotion()) return setShown(false);
    const t = window.setTimeout(() => setShown(false), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [want, open, shown]);

  useEffect(() => close(), [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('menu-open', open);
    if (!open) return;
    menuRef.current?.querySelector('a')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !button.current?.contains(t)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.documentElement.classList.remove('menu-open');
    };
  }, [open]);

  // choosing a link (even the current page) or "Выйти" closes the menu
  const onMenuClick = (e: MouseEvent) => {
    if ((e.target as Element).closest('a, button[type="submit"]')) close();
  };

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
    e.currentTarget.reset();
    close();
    const href = q ? `/gallery?q=${encodeURIComponent(q)}` : '/gallery';
    if (href !== location.pathname + location.search) startNavProgress();
    router.push(href);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="burger"
        aria-expanded={want}
        aria-controls={menuId}
        aria-label={want ? 'Закрыть меню' : 'Меню'}
        onClick={() => (want ? close() : show())}
      >
        <svg className="b-o" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M4 7h20M4 14h20M4 21h20" />
        </svg>
        <svg className="b-x" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M7 7l14 14M21 7L7 21" />
        </svg>
      </button>
      <nav
        ref={menuRef}
        id={menuId}
        className={open ? 'menu open' : 'menu'}
        aria-label="Основная навигация"
        hidden={!shown}
        onClick={onMenuClick}
      >
        <div className="menu-body">
          <div className="menu-links">
            {ITEMS.map((item) => (
              <Link key={item.href} href={item.href} aria-current={item.current(pathname) ? 'page' : undefined}>
                {item.label}
                {item.wish && <WishCount initial={wishCount} signedIn={signedIn} />}
              </Link>
            ))}
          </div>
          <div className="menu-side">
            <form className="hsearch" action="/gallery" role="search" onSubmit={onSearch}>
              <label htmlFor={searchId}>Поиск</label>
              <input
                id={searchId}
                className="hsearch-in"
                type="search"
                name="q"
                placeholder="Название или художник"
                autoComplete="off"
                enterKeyHint="search"
              />
            </form>
            {signedIn ? (
              <div className="menu-account">
                <Link className="btn alt" href="/cabinet">
                  Профиль
                </Link>
                <form action="/auth/sign-out" method="post">
                  <button type="submit" className="btn alt">
                    Выйти
                  </button>
                </form>
              </div>
            ) : (
              <Link className="btn btn-tg" href="/sign-in">
                Войти через Telegram
              </Link>
            )}
            <p className="menu-note">Покупатели пишут художникам напрямую в Telegram: без паролей и SMS-кодов.</p>
          </div>
        </div>
      </nav>
    </>
  );
}
