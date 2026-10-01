// app/admin/exhibitions/[id]/preview/page.tsx
import { notFound } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { getExhibitionPreview } from '@/src/lib/exhibitions/queries';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { ExhibitionView } from '@/src/components/exhibitions/exhibition-view';

export const metadata = { title: 'Предпросмотр выставки', robots: { index: false } };

export default async function ExhibitionPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('admin');
  const { id } = await params;
  const view = isUuid(id) ? await getExhibitionPreview(getDb(), id) : undefined;
  if (!view) notFound();
  return <ExhibitionView view={view} today={todayInDushanbe()} likes={{}} others={[]} preview />;
}
