// app/exhibitions/[slug]/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cachedOthers, loadPublicExhibition } from '@/src/lib/exhibitions/public-view';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { pagePreview, snippet } from '@/src/lib/seo';
import { ExhibitionView } from '@/src/components/exhibitions/exhibition-view';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const view = await loadPublicExhibition((await params).slug);
  if (!view) return {};
  const ex = view.exhibition;
  const description = snippet(ex.subtitle || ex.intro || 'Онлайн-выставка');
  return {
    title: ex.title,
    description,
    ...pagePreview({ title: ex.title, description, image: { url: ex.coverUrl, alt: ex.title } }),
  };
}

export default async function ExhibitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await loadPublicExhibition(slug);
  if (!view) notFound();
  const today = todayInDushanbe();
  const others = await cachedOthers(view.exhibition.id, today);
  return <ExhibitionView view={view} today={today} others={others} hallHref={`/exhibitions/${slug}/hall`} />;
}
