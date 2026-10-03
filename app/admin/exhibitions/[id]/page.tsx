// app/admin/exhibitions/[id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { getExhibition, listAnnouncementChoices } from '@/src/lib/exhibitions/admin';
import { EXHIBITION_ERRORS, isExhibitionErrorCode } from '@/src/lib/exhibitions/exhibition-form';
import { exhibitionPhase, PHASE_LABEL } from '@/src/lib/exhibitions/status';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ExhibitionForm } from '@/src/components/admin/exhibition-form';
import { SubmitButton } from '@/src/components/form/submit-button';
import { buttonVariants } from '@/src/components/ui/button';
import { HallsEditor } from './halls-editor';
import { saveExhibitionAction, setExhibitionStatusAction } from '../actions';

export const metadata = { title: 'Выставка' };

export default async function EditExhibitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; hall?: string; q?: string }>;
}) {
  const role = await requireStaff('admin');
  const { id } = await params;
  const sp = await searchParams;
  const exhibition = isUuid(id) ? await getExhibition(getDb(), id) : undefined;
  if (!exhibition) notFound();
  const announcements = await listAnnouncementChoices(getDb());
  const phase = exhibitionPhase(exhibition, todayInDushanbe());
  const published = exhibition.status === 'published';
  const error = isExhibitionErrorCode(sp.error) ? EXHIBITION_ERRORS[sp.error] : null;

  return (
    <main>
      <AdminNav role={role} />
      <Link href="/admin/journal" className="text-sm text-muted-foreground hover:text-brand">
        ← Афиша и журнал
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{PHASE_LABEL[phase]}</p>
          <h1>{exhibition.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/exhibitions/${exhibition.id}/preview`} className={buttonVariants({ variant: 'outline' })} target="_blank">
            Предпросмотр
          </Link>
          <form action={setExhibitionStatusAction}>
            <input type="hidden" name="id" value={exhibition.id} />
            <input type="hidden" name="publish" value={published ? '0' : '1'} />
            <SubmitButton variant={published ? 'outline' : 'default'}>{published ? 'Снять с публикации' : 'Опубликовать'}</SubmitButton>
          </form>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice err mt-6">
          {error}
        </p>
      )}
      {sp.saved && !error && (
        <p role="status" className="notice mt-6">
          Сохранено.
        </p>
      )}
      <ExhibitionForm action={saveExhibitionAction} exhibition={exhibition} announcements={announcements} />
      <HallsEditor
        exhibitionId={exhibition.id}
        hallSearch={isUuid(sp.hall ?? '') ? sp.hall : undefined}
        q={(sp.q ?? '').trim().slice(0, 100)}
      />
    </main>
  );
}
