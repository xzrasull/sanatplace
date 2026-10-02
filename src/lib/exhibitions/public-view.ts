import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { getDb } from '@/src/db';
import { isSlug, todayInDushanbe } from '@/src/lib/journal/post-form';
import { getPublicExhibition, listOtherExhibitions } from './queries';

// The admin's actions revalidate the 'exhibitions' tag; a work sold or taken
// down elsewhere shows up within a minute.
const cachedView = unstable_cache((slug: string, today: string) => getPublicExhibition(getDb(), slug, today), ['exhibition-view'], {
  revalidate: 60,
  tags: ['exhibitions'],
});
export const cachedOthers = unstable_cache((id: string, today: string) => listOtherExhibitions(getDb(), id, today), ['exhibition-others'], {
  revalidate: 60,
  tags: ['exhibitions'],
});

// The exhibition page and its hall page, once per request.
export const loadPublicExhibition = cache(async (slug: string) => (isSlug(slug) ? cachedView(slug, todayInDushanbe()) : undefined));
