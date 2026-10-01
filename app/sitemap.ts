import type { MetadataRoute } from 'next';
import { getDb } from '@/src/db';
import { listSitemapEntries } from '@/src/lib/artworks/sitemap-queries';
import { listSitemapExhibitions } from '@/src/lib/exhibitions/queries';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { listSitemapPosts } from '@/src/lib/journal/posts';
import { siteUrl } from '@/src/lib/site-url';

// Rebuilt on request (at most hourly) so new artworks show up for search engines.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [{ works, artists }, posts, shows] = await Promise.all([
    listSitemapEntries(getDb()),
    listSitemapPosts(getDb()),
    listSitemapExhibitions(getDb(), todayInDushanbe()),
  ]);
  const date = (d: Date | string | null) => (d ? new Date(d) : undefined);
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/gallery`, changeFrequency: 'daily', priority: 0.9 },
    ...works.map((w) => ({
      url: `${base}/gallery/artwork/${w.id}`,
      lastModified: date(w.changedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...artists.map((a) => ({
      url: `${base}/gallery/artist/${a.id}`,
      lastModified: date(a.changedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    { url: `${base}/journal`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/exhibitions`, changeFrequency: 'weekly', priority: 0.7 },
    ...shows.map((s) => ({
      url: `${base}/exhibitions/${s.slug}`,
      lastModified: date(s.changedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/sell/guide`, changeFrequency: 'monthly', priority: 0.4 },
    ...posts.map((p) => ({
      url: `${base}/journal/${p.slug}`,
      lastModified: date(p.changedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
