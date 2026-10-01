// app/admin/exhibitions/page.tsx
import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { listAllExhibitions } from '@/src/lib/exhibitions/admin';
import { exhibitionPhase, PHASE_LABEL } from '@/src/lib/exhibitions/status';
import { dateRange, todayInDushanbe } from '@/src/lib/journal/post-form';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ConfirmDelete } from '@/src/components/admin/confirm-delete';
import { buttonVariants } from '@/src/components/ui/button';
import { removeExhibition } from './actions';

export const metadata = { title: 'Выставки' };

export default async function AdminExhibitionsPage() {
  const role = await requireStaff('admin');
  const list = await listAllExhibitions(getDb());
  const today = todayInDushanbe();
  return (
    <main>
      <AdminNav role={role} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Онлайн-выставки</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">
            Подборки работ из каталога, по залам. Опубликованная выставка появляется на сайте в день открытия, а до
            этого видна в разделе «Скоро».
          </p>
        </div>
        <Link href="/admin/exhibitions/new" className={buttonVariants()}>
          Создать выставку
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Выставок пока нет.</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {list.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-5 rounded-sm bg-card p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small admin thumbnail */}
              <img src={e.coverUrl} alt="" className="banner-thumb" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  {PHASE_LABEL[exhibitionPhase(e, today)]} · {dateRange(e.startsOn, e.endsOn, true)}
                </p>
                <h2 className="text-2xl">{e.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/exhibitions/${e.id}`} className={buttonVariants({ variant: 'outline' })}>
                  Изменить
                </Link>
                <ConfirmDelete action={removeExhibition} id={e.id} what={e.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
