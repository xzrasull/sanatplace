// app/exhibitions/[slug]/hall/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hallIndex, hallsOf } from '@/src/lib/exhibitions/hall-data';
import { loadPublicExhibition } from '@/src/lib/exhibitions/public-view';
import { ExhibitionHall } from '@/src/components/exhibitions/exhibition-hall';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ hall?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = await loadPublicExhibition(slug);
  if (!view) return {};
  return { title: `Залы — ${view.exhibition.title}`, alternates: { canonical: `/exhibitions/${slug}` } };
}

// The exhibition's halls as 3D rooms over the whole screen.
export default async function ExhibitionHallPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const view = await loadPublicExhibition(slug);
  if (!view || view.halls.length === 0) notFound();
  const halls = hallsOf(view);
  return (
    <ExhibitionHall
      title={view.exhibition.title}
      back={`/exhibitions/${slug}`}
      halls={halls}
      start={hallIndex((await searchParams).hall, halls.length)}
    />
  );
}
