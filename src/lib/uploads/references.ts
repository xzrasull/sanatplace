import type { Db } from '../../db';
import { artworks, banners, posts, sellerApplications, users } from '../../db/schema';

// Every image URL the database points at. The tables are small, so they are
// read whole; used before deleting files, so a shared file is never removed.
export async function listReferencedImageUrls(db: Db): Promise<string[]> {
  const [a, b, s, u, p] = await Promise.all([
    db.select({ url: artworks.imageUrl }).from(artworks),
    db.select({ url: banners.imageUrl, mobile: banners.imageMobileUrl }).from(banners),
    db.select({ url: sellerApplications.avatarUrl }).from(sellerApplications),
    db.select({ url: users.photoUrl }).from(users),
    db.select({ url: posts.coverUrl }).from(posts),
  ]);
  return [
    ...a.map((r) => r.url),
    ...b.flatMap((r) => [r.url, r.mobile]),
    ...s.map((r) => r.url),
    ...u.map((r) => r.url),
    ...p.map((r) => r.url),
  ].filter((v): v is string => Boolean(v));
}
