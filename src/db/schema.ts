import { pgTable, uuid, text, timestamp, integer, bigint, boolean, date, pgEnum, primaryKey, index } from 'drizzle-orm/pg-core';
import { POST_CATEGORIES } from '../lib/journal/categories';

export const roleEnum = pgEnum('role', ['buyer', 'seller', 'admin']);
export const applicationStatusEnum = pgEnum('application_status', [
  'pending',
  'approved',
  'rejected',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  username: text('username'),
  fullName: text('full_name').notNull(),
  photoUrl: text('photo_url'),
  role: roleEnum('role').notNull().default('buyer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sellerApplications = pgTable('seller_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  displayName: text('display_name').notNull(),
  bio: text('bio').notNull(),
  telegramContact: text('telegram_contact'),
  // The artist's photo, uploaded in the cabinet or the admin; without it the
  // public pages show the Telegram photo, then the first letter of the name.
  avatarUrl: text('avatar_url'),
  status: applicationStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  reviewedByAdminId: uuid('reviewed_by_admin_id').references(() => users.id),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});

export const artworkStatusEnum = pgEnum('artwork_status', [
  'pending',
  'published',
  'rejected',
  'sold',
]);

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const techniques = pgTable('techniques', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const artworks = pgTable('artworks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sellerId: uuid('seller_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  heightCm: integer('height_cm').notNull(),
  widthCm: integer('width_cm').notNull(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  techniqueId: uuid('technique_id')
    .notNull()
    .references(() => techniques.id),
  imageUrl: text('image_url').notNull(),
  // Optional: the year it was painted, and the stored photo's pixel size
  // (saved on upload so the page can reserve the right space).
  year: integer('year'),
  widthPx: integer('width_px'),
  heightPx: integer('height_px'),
  status: artworkStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedByAdminId: uuid('reviewed_by_admin_id').references(() => users.id),
});

// One-time "sign in via the bot" requests. The browser keeps the raw token in
// an httpOnly cookie and the bot receives it as the /start payload; only its
// SHA-256 hash is stored.
export const loginRequests = pgTable('login_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  isNewUser: boolean('is_new_user').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  confirmedAt: timestamp('confirmed_at'),
  consumedAt: timestamp('consumed_at'),
});

// One row per (user, artwork) like: the pair is the key, so a work can't be
// liked twice. Likes go away with the artwork or the user.
export const artworkLikes = pgTable(
  'artwork_likes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artworkId] }), index('artwork_likes_artwork_id_idx').on(t.artworkId)],
);

// The admin's picks for the home page collage: slot a (tall), b, c. An empty
// slot, or one whose work is no longer on sale, falls back to the newest work.
export const homeCollage = pgTable('home_collage', {
  slot: text('slot').primaryKey(),
  artworkId: uuid('artwork_id')
    .notNull()
    .unique()
    .references(() => artworks.id, { onDelete: 'cascade' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Home page banner slides, managed by the admin. The public reads only active
// ones inside their show window, ordered by sort_order.
export const banners = pgTable('banners', {
  id: uuid('id').defaultRandom().primaryKey(),
  imageUrl: text('image_url').notNull(),
  imageMobileUrl: text('image_mobile_url'),
  eyebrow: text('eyebrow'),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  buttonLabel: text('button_label'),
  buttonUrl: text('button_url'),
  button2Label: text('button2_label'),
  button2Url: text('button2_url'),
  artworkId: uuid('artwork_id').references(() => artworks.id, { onDelete: 'set null' }),
  overlay: integer('overlay').notNull().default(45),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// «Афиша и журнал»: exhibitions, events, news and articles, written by the
// admin. The public sees only published ones (status 'published' and
// published_at in the past); drafts stay in the admin.

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    category: text('category', { enum: POST_CATEGORIES }).notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt'),
    // Markdown
    body: text('body'),
    coverUrl: text('cover_url').notNull(),
    // exhibitions and events only (Dushanbe dates); a one-day event has no end
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    timeText: text('time_text'),
    place: text('place'),
    priceText: text('price_text'),
    signupUrl: text('signup_url'),
    artistId: uuid('artist_id').references(() => users.id, { onDelete: 'set null' }),
    isFeatured: boolean('is_featured').notNull().default(false),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    // admin-only: who asked for it and when
    sourceNote: text('source_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('posts_status_published_idx').on(t.status, t.publishedAt),
    index('posts_starts_on_idx').on(t.startsOn),
  ],
);
