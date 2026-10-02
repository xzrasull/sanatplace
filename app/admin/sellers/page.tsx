import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { sellerApplications } from '@/src/db/schema';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { Input } from '@/src/components/ui/input';
import { listPublicArtists } from '@/src/lib/artworks/public-queries';
import { AVATAR_MESSAGES, type AvatarResult } from '@/src/lib/sellers/avatar';
import { AvatarForm } from '@/src/components/sanat/avatar-form';
import { approveApplication, rejectApplication, setArtistAvatar } from './actions';
import { SubmitButton } from '@/src/components/form/submit-button';

export default async function AdminSellersPage({ searchParams }: { searchParams: Promise<{ photo?: string }> }) {
  const role = await requireStaff();
  const { photo } = await searchParams;

  const [pending, artists] = await Promise.all([
    getDb().select().from(sellerApplications).where(eq(sellerApplications.status, 'pending')),
    listPublicArtists(getDb()),
  ]);

  return (
    <main>
      <AdminNav role={role} />
      <h1>Заявки продавцов на рассмотрении</h1>
      {pending.length === 0 && <p className="mt-4 text-muted-foreground">Нет заявок на рассмотрении.</p>}
      <div className="mt-6 grid max-w-2xl gap-4">
        {pending.map((application) => (
          <section key={application.id} className="rounded-sm border border-border bg-card p-5">
            <h2>{application.displayName}</h2>
            <p className="mt-2 whitespace-pre-line text-muted-foreground">{application.bio}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <form action={approveApplication}>
                <input type="hidden" name="applicationId" value={application.id} />
                <SubmitButton>Одобрить</SubmitButton>
              </form>
              <form action={rejectApplication} className="flex w-full gap-2 sm:w-auto sm:flex-1">
                <input type="hidden" name="applicationId" value={application.id} />
                <Input type="text" name="reason" placeholder="Причина отказа" aria-label="Причина отказа" />
                <SubmitButton variant="outline">
                  Отклонить
                </SubmitButton>
              </form>
            </div>
          </section>
        ))}
      </div>

      <h2 id="artists" className="mt-12 scroll-mt-6">
        Фото художников
      </h2>
      <p className="mt-2 text-muted-foreground">
        Фото показывается на странице художника и в списке художников. Без фото — первая буква имени.
      </p>
      {photo && photo in AVATAR_MESSAGES && (
        <p role={photo === 'saved' || photo === 'removed' ? 'status' : 'alert'} className="notice mt-4 max-w-2xl">
          {AVATAR_MESSAGES[photo as AvatarResult]}
        </p>
      )}
      {artists.length === 0 && <p className="mt-4 text-muted-foreground">Одобренных художников пока нет.</p>}
      <ul className="mt-6 grid max-w-2xl gap-4">
        {artists.map((a) => (
          <li key={a.id} className="rounded-sm bg-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl">{a.displayName}</h3>
              {role === 'admin' && (
                <Link className="btn sm" href={`/admin/artworks/new?seller=${a.id}`}>
                  + Добавить работу
                </Link>
              )}
            </div>
            <AvatarForm action={setArtistAvatar} name={a.displayName} url={a.avatarUrl} userId={a.id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
