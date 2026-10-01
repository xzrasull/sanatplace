// src/lib/exhibitions/admin.ts
import { and, asc, desc, eq, ilike, inArray, max, or, sql } from 'drizzle-orm';
import type { Db } from '../../db';
import { artworks, exhibitionHalls, exhibitionWorks, exhibitions, posts, sellerApplications } from '../../db/schema';
import { MAX_HALLS, type ExhibitionFields, type HallFields } from './exhibition-form';
import { VISIBLE_STATUSES } from './status';

export type Exhibition = typeof exhibitions.$inferSelect;
export type ExhibitionInput = ExhibitionFields & { coverUrl: string; status: Exhibition['status'] };
export type ExhibitionSaveResult = { ok: true; id: string; slug: string } | { ok: false; reason: 'slug_taken' | 'not_found' };

const isUniqueViolation = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && ((e as { code?: string }).code === '23505' || isUniqueViolation((e as { cause?: unknown }).cause));

// ---------- exhibitions ----------

export async function listAllExhibitions(db: Db): Promise<Exhibition[]> {
  return db.select().from(exhibitions).orderBy(desc(exhibitions.startsOn), desc(exhibitions.createdAt));
}

export async function getExhibition(db: Db, id: string): Promise<Exhibition | undefined> {
  const [row] = await db.select().from(exhibitions).where(eq(exhibitions.id, id));
  return row;
}

export async function saveExhibition(db: Db, id: string | null, input: ExhibitionInput): Promise<ExhibitionSaveResult> {
  const values = { ...input, updatedAt: new Date() };
  const columns = { id: exhibitions.id, slug: exhibitions.slug };
  try {
    const [row] = id
      ? await db.update(exhibitions).set(values).where(eq(exhibitions.id, id)).returning(columns)
      : await db.insert(exhibitions).values(values).returning(columns);
    if (!row) return { ok: false, reason: 'not_found' };
    return { ok: true, id: row.id, slug: row.slug };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: 'slug_taken' };
    throw e;
  }
}

export async function setExhibitionStatus(db: Db, id: string, publish: boolean): Promise<Exhibition | undefined> {
  const [row] = await db
    .update(exhibitions)
    .set({ status: publish ? 'published' : 'draft', updatedAt: new Date() })
    .where(eq(exhibitions.id, id))
    .returning();
  return row;
}

// Halls and placements go with it (cascade); the catalog's works stay.
export async function deleteExhibition(db: Db, id: string): Promise<Exhibition | undefined> {
  const [row] = await db.delete(exhibitions).where(eq(exhibitions.id, id)).returning();
  return row;
}

// ---------- halls ----------

export type AdminWork = {
  artworkId: string;
  title: string;
  artistName: string | null;
  imageUrl: string;
  status: string;
  curatorNote: string | null;
};
export type AdminHall = { id: string; title: string; intro: string | null; wallColor: string | null; works: AdminWork[] };

// Every placed work, hidden ones too, so the admin sees what visitors miss.
export async function listHallsForAdmin(db: Db, exhibitionId: string): Promise<AdminHall[]> {
  const [halls, works] = await Promise.all([
    db
      .select()
      .from(exhibitionHalls)
      .where(eq(exhibitionHalls.exhibitionId, exhibitionId))
      .orderBy(asc(exhibitionHalls.position)),
    db
      .select({
        hallId: exhibitionWorks.hallId,
        artworkId: artworks.id,
        title: artworks.title,
        artistName: sellerApplications.displayName,
        imageUrl: artworks.imageUrl,
        status: artworks.status,
        curatorNote: exhibitionWorks.curatorNote,
      })
      .from(exhibitionWorks)
      .innerJoin(artworks, eq(artworks.id, exhibitionWorks.artworkId))
      .leftJoin(sellerApplications, eq(sellerApplications.userId, artworks.sellerId))
      .where(eq(exhibitionWorks.exhibitionId, exhibitionId))
      .orderBy(asc(exhibitionWorks.position)),
  ]);
  return halls.map((h) => ({
    id: h.id,
    title: h.title,
    intro: h.intro,
    wallColor: h.wallColor,
    works: works
      .filter((w) => w.hallId === h.id)
      .map((w) => ({
        artworkId: w.artworkId,
        title: w.title,
        artistName: w.artistName,
        imageUrl: w.imageUrl,
        status: w.status,
        curatorNote: w.curatorNote,
      })),
  }));
}

export type AddHallResult = { ok: true; id: string } | { ok: false; reason: 'too_many' | 'not_found' };

// The exhibition's row is locked, so two quick clicks cannot make a sixth hall.
export async function addHall(db: Db, exhibitionId: string, fields: HallFields): Promise<AddHallResult> {
  return db.transaction(async (tx) => {
    const [ex] = await tx.select({ id: exhibitions.id }).from(exhibitions).where(eq(exhibitions.id, exhibitionId)).for('update');
    if (!ex) return { ok: false as const, reason: 'not_found' as const };
    const [{ n, last }] = await tx
      .select({ n: sql<number>`count(*)::int`, last: max(exhibitionHalls.position) })
      .from(exhibitionHalls)
      .where(eq(exhibitionHalls.exhibitionId, exhibitionId));
    if (n >= MAX_HALLS) return { ok: false as const, reason: 'too_many' as const };
    const [row] = await tx
      .insert(exhibitionHalls)
      .values({ exhibitionId, position: (last ?? -1) + 1, ...fields })
      .returning({ id: exhibitionHalls.id });
    return { ok: true as const, id: row.id };
  });
}

export async function updateHall(db: Db, hallId: string, fields: HallFields): Promise<string | undefined> {
  const [row] = await db
    .update(exhibitionHalls)
    .set(fields)
    .where(eq(exhibitionHalls.id, hallId))
    .returning({ exhibitionId: exhibitionHalls.exhibitionId });
  return row?.exhibitionId;
}

export async function deleteHall(db: Db, hallId: string): Promise<string | undefined> {
  const [row] = await db
    .delete(exhibitionHalls)
    .where(eq(exhibitionHalls.id, hallId))
    .returning({ exhibitionId: exhibitionHalls.exhibitionId });
  return row?.exhibitionId;
}

// Swaps the hall with its neighbour above (-1) or below (1); at the ends nothing moves.
export async function moveHall(db: Db, hallId: string, dir: -1 | 1): Promise<string | undefined> {
  return db.transaction(async (tx) => {
    const [hall] = await tx.select().from(exhibitionHalls).where(eq(exhibitionHalls.id, hallId)).for('update');
    if (!hall) return undefined;
    const siblings = await tx
      .select({ id: exhibitionHalls.id, position: exhibitionHalls.position })
      .from(exhibitionHalls)
      .where(eq(exhibitionHalls.exhibitionId, hall.exhibitionId))
      .orderBy(asc(exhibitionHalls.position));
    const other = siblings[siblings.findIndex((s) => s.id === hallId) + dir];
    if (other) {
      await tx.update(exhibitionHalls).set({ position: other.position }).where(eq(exhibitionHalls.id, hallId));
      await tx.update(exhibitionHalls).set({ position: hall.position }).where(eq(exhibitionHalls.id, other.id));
    }
    return hall.exhibitionId;
  });
}

// ---------- works ----------

export type AddWorkResult = { ok: true; exhibitionId: string } | { ok: false; reason: 'duplicate' | 'hidden' | 'not_found' };

export async function addWork(db: Db, hallId: string, artworkId: string): Promise<AddWorkResult> {
  try {
    return await db.transaction(async (tx) => {
      const [hall] = await tx
        .select({ exhibitionId: exhibitionHalls.exhibitionId })
        .from(exhibitionHalls)
        .where(eq(exhibitionHalls.id, hallId))
        .for('update');
      const [art] = await tx.select({ status: artworks.status }).from(artworks).where(eq(artworks.id, artworkId));
      if (!hall || !art) return { ok: false as const, reason: 'not_found' as const };
      if (!(VISIBLE_STATUSES as readonly string[]).includes(art.status)) return { ok: false as const, reason: 'hidden' as const };
      const [{ last }] = await tx
        .select({ last: max(exhibitionWorks.position) })
        .from(exhibitionWorks)
        .where(eq(exhibitionWorks.hallId, hallId));
      await tx
        .insert(exhibitionWorks)
        .values({ hallId, artworkId, exhibitionId: hall.exhibitionId, position: (last ?? -1) + 1 });
      return { ok: true as const, exhibitionId: hall.exhibitionId };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: 'duplicate' };
    throw e;
  }
}

const placement = (hallId: string, artworkId: string) =>
  and(eq(exhibitionWorks.hallId, hallId), eq(exhibitionWorks.artworkId, artworkId));

export async function moveWork(db: Db, hallId: string, artworkId: string, dir: -1 | 1): Promise<string | undefined> {
  return db.transaction(async (tx) => {
    const [work] = await tx.select().from(exhibitionWorks).where(placement(hallId, artworkId)).for('update');
    if (!work) return undefined;
    const siblings = await tx
      .select({ artworkId: exhibitionWorks.artworkId, position: exhibitionWorks.position })
      .from(exhibitionWorks)
      .where(eq(exhibitionWorks.hallId, hallId))
      .orderBy(asc(exhibitionWorks.position));
    const other = siblings[siblings.findIndex((s) => s.artworkId === artworkId) + dir];
    if (other) {
      await tx.update(exhibitionWorks).set({ position: other.position }).where(placement(hallId, artworkId));
      await tx.update(exhibitionWorks).set({ position: work.position }).where(placement(hallId, other.artworkId));
    }
    return work.exhibitionId;
  });
}

export async function removeWork(db: Db, hallId: string, artworkId: string): Promise<string | undefined> {
  const [row] = await db
    .delete(exhibitionWorks)
    .where(placement(hallId, artworkId))
    .returning({ exhibitionId: exhibitionWorks.exhibitionId });
  return row?.exhibitionId;
}

export async function setWorkNote(db: Db, hallId: string, artworkId: string, note: string | null): Promise<string | undefined> {
  const [row] = await db
    .update(exhibitionWorks)
    .set({ curatorNote: note })
    .where(placement(hallId, artworkId))
    .returning({ exhibitionId: exhibitionWorks.exhibitionId });
  return row?.exhibitionId;
}

// ---------- pickers ----------

export type ArtworkChoice = { id: string; title: string; artistName: string; imageUrl: string; status: string };

// Works that can hang: published or sold, matched by title or artist; % and _ are literal.
export async function searchArtworkChoices(db: Db, q: string, limit = 12): Promise<ArtworkChoice[]> {
  const pattern = `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select({
      id: artworks.id,
      title: artworks.title,
      artistName: sellerApplications.displayName,
      imageUrl: artworks.imageUrl,
      status: artworks.status,
    })
    .from(artworks)
    .innerJoin(sellerApplications, eq(sellerApplications.userId, artworks.sellerId))
    .where(
      and(
        inArray(artworks.status, [...VISIBLE_STATUSES]),
        or(ilike(artworks.title, pattern), ilike(sellerApplications.displayName, pattern)),
      ),
    )
    .orderBy(desc(artworks.submittedAt))
    .limit(limit);
}

// The journal's exhibition posts, for the «анонс» list.
export async function listAnnouncementChoices(db: Db) {
  return db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(eq(posts.category, 'exhibition'))
    .orderBy(desc(posts.createdAt));
}
