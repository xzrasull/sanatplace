import Link from 'next/link';
import { staffSignOut } from '@/app/sanatadmin/actions';
import type { StaffRole } from '@/src/lib/auth/staff';
import { SignOutButton } from '@/src/components/sanat/sign-out-button';

// Moderators: applications and artworks. The admin also gets the database
// editor, the home page banners, the journal, categories, techniques and the
// staff passwords.
const ADMIN_LINKS = [
  { href: '/admin/database', label: 'База данных' },
  { href: '/admin/banners', label: 'Баннеры' },
  { href: '/admin/journal', label: 'Афиша и журнал' },
  { href: '/admin/exhibitions', label: 'Выставки' },
];
const LINKS = [
  { href: '/admin/sellers', label: 'Заявки продавцов' },
  { href: '/admin/artworks', label: 'Картины на модерации' },
];
const ADMIN_TAIL_LINKS = [
  { href: '/admin/categories', label: 'Категории' },
  { href: '/admin/techniques', label: 'Техники' },
  { href: '/admin/staff', label: 'Доступы' },
];

const pill =
  'inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-card px-4 text-sm hover:border-brand hover:text-brand';

export function AdminNav({ role }: { role: StaffRole }) {
  const links = role === 'admin' ? [...ADMIN_LINKS, ...LINKS, ...ADMIN_TAIL_LINKS] : LINKS;
  return (
    <div className="mb-7 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tracking-widest text-ink-2 uppercase">
          {role === 'admin' ? 'Администратор' : 'Модератор'}
        </p>
        <SignOutButton action={staffSignOut} className={pill} note="Чтобы вернуться, нужно будет снова ввести логин и пароль." />
      </div>
      <nav aria-label="Разделы админки" className="-m-1 flex flex-nowrap gap-2 overflow-x-auto p-1 sm:flex-wrap">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={pill}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
