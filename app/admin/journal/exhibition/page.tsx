import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { AdminNav } from '@/src/components/admin/admin-nav';

export const metadata = { title: 'Новая выставка' };

const KINDS = [
  {
    href: '/admin/exhibitions/new',
    title: 'Онлайн',
    text: 'Проходит на сайте: залы с работами из каталога, по которым можно пройти и купить картину.',
  },
  {
    href: '/admin/journal/new?c=exhibition',
    title: 'Офлайн',
    text: 'Проходит в галерее или другом месте: анонс с датами, адресом, стоимостью и записью.',
  },
];

// The first step of adding an exhibition: where it takes place.
export default async function NewExhibitionKindPage() {
  const role = await requireStaff('admin');
  return (
    <main>
      <AdminNav role={role} />
      <Link href="/admin/journal" className="text-sm text-muted-foreground hover:text-brand">
        ← Афиша и журнал
      </Link>
      <h1 className="mt-3">Новая выставка</h1>
      <p className="mt-2 text-muted-foreground">Какая это выставка?</p>
      <ul className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {KINDS.map((k) => (
          <li key={k.href}>
            <Link href={k.href} className="block h-full rounded-sm border border-border bg-card p-6 hover:border-brand">
              <h2 className="text-2xl">{k.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{k.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
