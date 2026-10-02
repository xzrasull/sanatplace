// app/admin/exhibitions/[id]/preview/hall/page.tsx
import { notFound } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { hallIndex, hallsOf } from '@/src/lib/exhibitions/hall-data';
import { getExhibitionPreview } from '@/src/lib/exhibitions/queries';
import { ExhibitionHall } from '@/src/components/exhibitions/exhibition-hall';

export const metadata = { title: 'Предпросмотр залов', robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ hall?: string | string[] }> };

export default async function ExhibitionHallPreviewPage({ params, searchParams }: Props) {
  await requireStaff('admin');
  const { id } = await params;
  const view = isUuid(id) ? await getExhibitionPreview(getDb(), id) : undefined;
  if (!view || view.halls.length === 0) notFound();
  const halls = hallsOf(view);
  return (
    <ExhibitionHall
      title={view.exhibition.title}
      back={`/admin/exhibitions/${id}/preview`}
      halls={halls}
      start={hallIndex((await searchParams).hall, halls.length)}
    />
  );
}
