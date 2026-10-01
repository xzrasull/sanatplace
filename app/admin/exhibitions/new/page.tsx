// app/admin/exhibitions/new/page.tsx
import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { listAnnouncementChoices } from '@/src/lib/exhibitions/admin';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ExhibitionForm } from '@/src/components/admin/exhibition-form';
import { saveExhibitionAction } from '../actions';

export const metadata = { title: 'Новая выставка' };

export default async function NewExhibitionPage() {
  const role = await requireStaff('admin');
  const announcements = await listAnnouncementChoices(getDb());
  return (
    <main>
      <AdminNav role={role} />
      <Link href="/admin/exhibitions" className="text-sm text-muted-foreground hover:text-brand">
        ← Все выставки
      </Link>
      <h1 className="mt-3">Новая выставка</h1>
      <p className="mt-2 text-muted-foreground">Залы и работы добавляются после создания.</p>
      <ExhibitionForm action={saveExhibitionAction} announcements={announcements} />
    </main>
  );
}
