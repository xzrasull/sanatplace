// app/exhibitions/[slug]/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { getDb } from '@/src/db';
import { getCurrentUser } from '@/src/lib/auth/session';
import { getPublicExhibition, listOtherExhibitions } from '@/src/lib/exhibitions/queries';
import { isSlug, todayInDushanbe } from '@/src/lib/journal/post-form';
import { likeInfoFor } from '@/src/lib/likes/likes';
import { pagePreview, snippet } from '@/src/lib/seo';
import { ExhibitionView } from '@/src/components/exhibitions/exhibition-view';

// The admin's actions revalidate the 'exhibitions' tag; a work sold or taken
// down elsewhere shows up within a minute.
const cachedView = unstable_cache((slug: string, today: string) => getPublicExhibition(getDb(), slug, today), ['exhibition-view'], {
  revalidate: 60,
  tags: ['exhibitions'],
});
const cachedOthers = unstable_cache((id: string, today: string) => listOtherExhibitions(getDb(), id, today), ['exhibition-others'], {
  revalidate: 60,
  tags: ['exhibitions'],
});

const load = cache(async (slug: string) => (isSlug(slug) ? cachedView(slug, todayInDushanbe()) : undefined));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const view = await load((await params).slug);
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
  const view = await load((await params).slug);
  if (!view) notFound();
  const today = todayInDushanbe();
  const works = view.halls.flatMap((h) => h.works);
  const user = await getCurrentUser();
  const [likes, others] = await Promise.all([
    likeInfoFor(getDb(), works.map((w) => ({ id: w.id, sellerId: w.artistId })), user?.id ?? null).catch(() => ({})),
    cachedOthers(view.exhibition.id, today),
  ]);
  return <ExhibitionView view={view} today={today} likes={likes} others={others} />;
}
