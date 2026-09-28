import Link from 'next/link';
import { staffSignOut } from '@/app/sanatadmin/actions';
import type { StaffRole } from '@/src/lib/auth/staff';
import { SubmitButton } from '@/src/components/form/submit-button';

// Moderators: applications, artworks, categories, techniques. The admin also
// gets the database editor, the home page banners and the journal.
const ADMIN_LINKS = [
  { href: '/admin/database', label: 'База данных' },
  { href: '/admin/banners', label: 'Баннеры' },
  { href: '/admin/journal', label: 'Афиша и журнал' },
];
const LINKS = [
  { href: '/admin/sellers', label: 'Заявки продавцов' },
  { href: '/admin/artworks', label: 'Картины на модерации' },
  { href: '/admin/categories', label: 'Категории' },
  { href: '/admin/techniques', label: 'Техники' },
];

const pill =
  'inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-card px-4 text-sm hover:border-brand hover:text-brand';

export function AdminNav({ role }: { role: StaffRole }) {
  const links = role === 'admin' ? [...ADMIN_LINKS, ...LINKS] : LINKS;
  return (
    <div className="mb-7 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tracking-widest text-ink-2 uppercase">
          {role === 'admin' ? 'Администратор' : 'Модератор'}
        </p>
        <form action={staffSignOut}>
          <SubmitButton plain className={pill}>
            Выйти
          </SubmitButton>
        </form>
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
