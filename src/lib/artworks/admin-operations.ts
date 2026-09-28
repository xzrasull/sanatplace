import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { Db } from '../../db';
import { artworks, categories, techniques, sellerApplications } from '../../db/schema';
import { decideArtworkOutcome } from './decision';

export async function approveOrRejectArtwork(
  db: Db,
  input: {
    artworkId: string;
    /** the reviewer's users row; null for staff signed in at /sanatadmin */
    adminUserId: string | null;
    decision: 'approve' | 'reject';
    reason?: string;
  },
): Promise<void> {
  const outcome = decideArtworkOutcome(input.decision, input.reason);

  await db
    .update(artworks)
    .set({
      status: outcome.status,
      rejectionReason: outcome.rejectionReason,
      reviewedByAdminId: input.adminUserId,
      reviewedAt: new Date(),
    })
    .where(eq(artworks.id, input.artworkId));
}

export async function listPendingArtworks(db: Db) {
  return db
    .select({
      id: artworks.id,
      title: artworks.title,
      description: artworks.description,
      price: artworks.price,
      heightCm: artworks.heightCm,
      widthCm: artworks.widthCm,
      imageUrl: artworks.imageUrl,
      categoryName: categories.name,
      techniqueName: techniques.name,
      sellerDisplayName: sellerApplications.displayName,
    })
    .from(artworks)
    .innerJoin(categories, eq(artworks.categoryId, categories.id))
    .innerJoin(techniques, eq(artworks.techniqueId, techniques.id))
    .innerJoin(sellerApplications, eq(artworks.sellerId, sellerApplications.userId))
    .where(eq(artworks.status, 'pending'));
}

// Every artwork, newest first, for the admin's «Все картины» list; `q` looks in
// the title and the artist's name.
export async function listAllArtworks(db: Db, { q, limit }: { q?: string; limit: number }) {
  const term = q?.trim();
  const like = term ? `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  return db
    .select({
      id: artworks.id,
      title: artworks.title,
      price: artworks.price,
      status: artworks.status,
      imageUrl: artworks.imageUrl,
      submittedAt: artworks.submittedAt,
      sellerDisplayName: sellerApplications.displayName,
    })
    .from(artworks)
    .leftJoin(
      sellerApplications,
      and(eq(sellerApplications.userId, artworks.sellerId), eq(sellerApplications.status, 'approved')),
    )
    .where(like ? or(ilike(artworks.title, like), ilike(sellerApplications.displayName, like)) : undefined)
    .orderBy(desc(artworks.submittedAt))
    .limit(limit);
}

// Removes the artwork row for good. Its likes and home collage slot go with it
// (foreign keys cascade) and a banner that pointed to it keeps its own picture.
// Returns what the caller needs to delete the photo and refresh the pages.
export async function deleteArtwork(db: Db, artworkId: string) {
  const [gone] = await db
    .delete(artworks)
    .where(eq(artworks.id, artworkId))
    .returning({ imageUrl: artworks.imageUrl, sellerId: artworks.sellerId });
  return gone;
}
