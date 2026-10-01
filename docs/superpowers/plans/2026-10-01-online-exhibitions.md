# Онлайн-выставки — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кураторские онлайн-выставки из работ каталога: залы, «стена в масштабе», просмотр работы, админка для сборки и связи с главной, журналом и карточкой работы.

**Отклонения от спецификации:** вместо ISR (`revalidate` на странице) данные кешируются через `unstable_cache` с тегом `exhibitions`, потому что страницы динамические из-за шапки; аватары художников в финале — по возможности (Task 7, Step 4), в v1 допустимо только имя.

**Architecture:** Три новые таблицы (`exhibitions`, `exhibition_halls`, `exhibition_works`) в Drizzle-схеме. Чистые функции (фаза по датам, масштаб стены, разбор форм) в `src/lib/exhibitions/`, запросы разделены на админские (`admin.ts`) и публичные (`queries.ts`). Админка на server actions без клиентского JS, кроме формы выставки. Публичная страница — серверный компонент `ExhibitionView` плюс один клиентский `ExhibitionRoom` (стены и просмотр через `<dialog>`). Страницы динамические (шапка читает cookies), поэтому данные кешируются через `unstable_cache` с тегом `exhibitions`, как блоки главной.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, Drizzle ORM + postgres-js (Supabase), Vitest, Playwright, Tailwind 4 + `src/styles/*.css`.

**Spec:** `docs/superpowers/specs/2026-10-01-online-exhibitions-design.md`

## Global Constraints

- Интерфейс только на русском; даты выставок — строки `YYYY-MM-DD` по Душанбе (`todayInDushanbe()` из `src/lib/journal/post-form.ts`).
- Видимые на выставке работы — только статусы `published` и `sold`.
- Не больше **5** залов на выставку; одна работа — один раз на выставку.
- Обложки выставок в бакете `POSTS_BUCKET`, ширина до 1600px.
- Публичные выставки: `status = 'published'` и `starts_on <= today`; «скоро» видна только в списке, её страница — 404.
- Все новые таблицы — `.enableRLS()` без политик (как `staff_accounts`).
- Функции Vercel остаются в регионе `fra1`; ничего в `vercel.json`/`vercel.ts` не менять.
- `npm run db:push` меняет базу из `.env.local`. **Перед первым запуском спросить владельца проекта**, на какую базу он смотрит, и запускать только с его согласия.
- 3D-библиотеки и drag-and-drop не добавлять (вне первой версии).
- Стиль кода: комментарии короткие, по-английски, как в соседних файлах; тексты интерфейса по-русски.

## Review Focus

1. **Работу сняли с публикации или удалили, пока она на выставке** — она исчезает со стены, пустой зал скрывается, при нуле работ — «Экспозиция обновляется». Тесты: Task 4 (запрос) и Task 7 (рендер пустого состояния).
2. **День открытия и день закрытия по Душанбе** — оба дня включительно «идёт»; в 23:30 UTC в Душанбе уже завтра. Тест: Task 2.
3. **Работы очень разных размеров в одном зале** (15×20 рядом с 200×150) — маленькая не исчезает (нижняя граница доли), нулевые размеры не ломают расчёт. Тест: Task 2.
4. **Прямая ссылка на черновик или «скоро»** — 404, предпросмотр только у админа. Тесты: Task 4 (запрос), Task 10 (e2e).
5. **`?work=` с id работы, которой нет на выставке** — просмотр не открывается, страница не падает. Тест: Task 10 (e2e).

---

## Файлы

```
src/db/schema.ts                                  + 3 таблицы
src/lib/uploads/references.ts                     + обложки выставок
src/lib/exhibitions/status.ts                     фаза, подписи, VISIBLE_STATUSES
src/lib/exhibitions/wall-scale.ts                 доли высоты, пропорции
src/lib/exhibitions/exhibition-form.ts            лимиты, цвета стен, разбор форм, тексты ошибок
src/lib/exhibitions/admin.ts                      CRUD выставок, залов, работ; поиск работ
src/lib/exhibitions/queries.ts                    публичные запросы
src/components/exhibitions/exhibition-card.tsx    карточка для списков
src/components/exhibitions/work-label.tsx         этикетка
src/components/exhibitions/exhibition-room.tsx    (client) залы, стены, просмотр
src/components/exhibitions/exhibition-view.tsx    вся страница выставки (server)
src/components/admin/exhibition-form.tsx          (client) форма выставки
src/components/admin/admin-nav.tsx                + ссылка
src/styles/exhibitions.css                        стили; импорт в app/globals.css
app/admin/exhibitions/page.tsx                    список
app/admin/exhibitions/actions.ts                  server actions
app/admin/exhibitions/new/page.tsx
app/admin/exhibitions/[id]/page.tsx               форма + редактор залов
app/admin/exhibitions/[id]/halls-editor.tsx       залы и работы (server)
app/admin/exhibitions/[id]/preview/page.tsx       предпросмотр
app/exhibitions/page.tsx                          список
app/exhibitions/[slug]/page.tsx                   выставка
app/page.tsx, app/journal/[slug]/page.tsx,
app/gallery/artwork/[id]/page.tsx, app/sitemap.ts,
src/components/sanat/burger-menu.tsx,
src/components/site-footer.tsx                    связи
tests/unit/exhibitions.test.ts
tests/integration/exhibitions.test.ts
tests/e2e/exhibitions.spec.ts
```

---

### Task 1: Схема БД и ссылки на обложки

**Files:**
- Modify: `src/db/schema.ts` (импорт `unique`; новые таблицы после `posts`)
- Modify: `src/lib/uploads/references.ts`
- Test: `tests/integration/exhibitions.test.ts` (создаётся здесь, дополняется в Task 3–4)

**Interfaces:**
- Produces: `exhibitions`, `exhibitionHalls`, `exhibitionWorks` (Drizzle-таблицы); `Exhibition = typeof exhibitions.$inferSelect` экспортируется в Task 3.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/exhibitions.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { like } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { exhibitions } from '../../src/db/schema';
import { listReferencedImageUrls } from '../../src/lib/uploads/references';

const PREFIX = 'test-ex-';

describe('exhibitions schema', () => {
  afterAll(async () => {
    await getDb().delete(exhibitions).where(like(exhibitions.slug, `${PREFIX}%`));
  });

  it('keeps exhibition covers among the referenced images', async () => {
    const cover = `https://example.com/${PREFIX}cover-${Date.now()}.jpg`;
    await getDb().insert(exhibitions).values({
      slug: `${PREFIX}refs`,
      title: 'Тест',
      coverUrl: cover,
      startsOn: '2090-01-01',
      endsOn: '2090-01-31',
    });
    expect(await listReferencedImageUrls(getDb())).toContain(cover);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/exhibitions.test.ts` (через `npm run test:unit -- tests/integration/exhibitions.test.ts`, чтобы подхватить `.env.local`)
Expected: FAIL — `exhibitions` не экспортируется из схемы.

- [ ] **Step 3: Add the tables**

В `src/db/schema.ts` добавить `unique` в импорт из `drizzle-orm/pg-core` и после таблицы `posts`:

```ts
// Online exhibitions: curated selections of catalog works, in halls, open
// between two Dushanbe dates. Only the admin builds them.
export const exhibitions = pgTable(
  'exhibitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    curatorName: text('curator_name'),
    // Markdown
    intro: text('intro'),
    coverUrl: text('cover_url').notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    // the journal's announcement, if any
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('exhibitions_status_starts_idx').on(t.status, t.startsOn)],
).enableRLS();

export const exhibitionHalls = pgTable(
  'exhibition_halls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    exhibitionId: uuid('exhibition_id')
      .notNull()
      .references(() => exhibitions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    intro: text('intro'),
    // a key of WALL_COLORS (exhibition-form.ts); null is the page background
    wallColor: text('wall_color'),
  },
  (t) => [index('exhibition_halls_exhibition_idx').on(t.exhibitionId, t.position)],
).enableRLS();

// `exhibition_id` repeats the hall's, so a work can be on an exhibition once.
export const exhibitionWorks = pgTable(
  'exhibition_works',
  {
    hallId: uuid('hall_id')
      .notNull()
      .references(() => exhibitionHalls.id, { onDelete: 'cascade' }),
    artworkId: uuid('artwork_id')
      .notNull()
      .references(() => artworks.id, { onDelete: 'cascade' }),
    exhibitionId: uuid('exhibition_id')
      .notNull()
      .references(() => exhibitions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    curatorNote: text('curator_note'),
  },
  (t) => [
    primaryKey({ columns: [t.hallId, t.artworkId] }),
    unique('exhibition_works_once').on(t.exhibitionId, t.artworkId),
    index('exhibition_works_artwork_idx').on(t.artworkId),
  ],
).enableRLS();
```

- [ ] **Step 4: Include covers in references**

```ts
// src/lib/uploads/references.ts
import { artworks, banners, exhibitions, posts, sellerApplications, users } from '../../db/schema';

export async function listReferencedImageUrls(db: Db): Promise<string[]> {
  const [a, b, s, u, p, e] = await Promise.all([
    db.select({ url: artworks.imageUrl }).from(artworks),
    db.select({ url: banners.imageUrl, mobile: banners.imageMobileUrl }).from(banners),
    db.select({ url: sellerApplications.avatarUrl }).from(sellerApplications),
    db.select({ url: users.photoUrl }).from(users),
    db.select({ url: posts.coverUrl }).from(posts),
    db.select({ url: exhibitions.coverUrl }).from(exhibitions),
  ]);
  return [
    ...a.map((r) => r.url),
    ...b.flatMap((r) => [r.url, r.mobile]),
    ...s.map((r) => r.url),
    ...u.map((r) => r.url),
    ...p.map((r) => r.url),
    ...e.map((r) => r.url),
  ].filter((v): v is string => Boolean(v));
}
```

- [ ] **Step 5: Push the schema — только с согласия владельца**

Спросить владельца проекта, можно ли применить схему к базе из `.env.local`. После «да»:
Run: `npm run db:push`
Expected: drizzle-kit создаёт 3 таблицы, индексы и включает RLS; других изменений в диффе нет (если есть — остановиться и показать владельцу).

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:unit -- tests/integration/exhibitions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts src/lib/uploads/references.ts tests/integration/exhibitions.test.ts
git commit -m "feat: tables for online exhibitions"
```

---

### Task 2: Чистые функции — фаза, масштаб стены, формы

**Files:**
- Create: `src/lib/exhibitions/status.ts`
- Create: `src/lib/exhibitions/wall-scale.ts`
- Create: `src/lib/exhibitions/exhibition-form.ts`
- Test: `tests/unit/exhibitions.test.ts`

**Interfaces:**
- Consumes: `slugify`, `isSlug`, `dateRange`, `todayInDushanbe` из `src/lib/journal/post-form.ts`; `isUuid` из `src/lib/gallery/types.ts`.
- Produces:
  - `type ExhibitionPhase = 'draft' | 'upcoming' | 'open' | 'closed'`
  - `exhibitionPhase(e: { status: 'draft' | 'published'; startsOn: string; endsOn: string }, today: string): ExhibitionPhase`
  - `PHASE_LABEL: Record<ExhibitionPhase, string>`
  - `phaseNote(e: { startsOn: string; endsOn: string }, phase: ExhibitionPhase): string`
  - `VISIBLE_STATUSES: readonly ['published', 'sold']`
  - `MIN_SHARE = 0.3`; `wallShares(heightsCm: number[]): number[]`; `workRatio(w: { widthCm: number; heightCm: number; widthPx: number | null; heightPx: number | null }): number`
  - `MAX_HALLS = 5`; `EXHIBITION_LIMITS`; `WALL_COLORS: Record<WallColor, { label: string; value: string }>`; `type WallColor`
  - `type ExhibitionFields = { title: string; slug: string; subtitle: string | null; curatorName: string | null; intro: string | null; startsOn: string; endsOn: string; postId: string | null }`
  - `type HallFields = { title: string; intro: string | null; wallColor: WallColor | null }`
  - `parseExhibitionForm(form: FormData): { ok: true; fields: ExhibitionFields } | { ok: false; error: ExhibitionFormError }`
  - `parseHallForm(form: FormData): { ok: true; fields: HallFields } | { ok: false; error: HallFormError }`
  - `parseWorkNote(form: FormData): { ok: true; note: string | null } | { ok: false; error: 'note' }`
  - `type ExhibitionErrorCode`; `EXHIBITION_ERRORS: Record<ExhibitionErrorCode, string>`; `isExhibitionErrorCode(v: unknown): v is ExhibitionErrorCode`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/exhibitions.test.ts
import { describe, it, expect } from 'vitest';
import { exhibitionPhase, phaseNote } from '../../src/lib/exhibitions/status';
import { MIN_SHARE, wallShares, workRatio } from '../../src/lib/exhibitions/wall-scale';
import { parseExhibitionForm, parseHallForm, parseWorkNote } from '../../src/lib/exhibitions/exhibition-form';
import { todayInDushanbe } from '../../src/lib/journal/post-form';

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('exhibitionPhase', () => {
  const e = { status: 'published' as const, startsOn: '2026-11-01', endsOn: '2026-11-30' };
  it('is open on the first and the last day, inclusive', () => {
    expect(exhibitionPhase(e, '2026-10-31')).toBe('upcoming');
    expect(exhibitionPhase(e, '2026-11-01')).toBe('open');
    expect(exhibitionPhase(e, '2026-11-30')).toBe('open');
    expect(exhibitionPhase(e, '2026-12-01')).toBe('closed');
  });
  it('a draft is a draft whatever the dates', () => {
    expect(exhibitionPhase({ ...e, status: 'draft' }, '2026-11-10')).toBe('draft');
  });
  it('counts days in Dushanbe: 23:30 UTC on Oct 31 is already Nov 1 there', () => {
    const today = todayInDushanbe(new Date('2026-10-31T23:30:00Z'));
    expect(today).toBe('2026-11-01');
    expect(exhibitionPhase(e, today)).toBe('open');
  });
  it('says when it opens, until when it runs, when it ended', () => {
    expect(phaseNote(e, 'upcoming')).toBe('Откроется 1 ноября');
    expect(phaseNote(e, 'open')).toBe('до 30 ноября');
    expect(phaseNote(e, 'closed')).toBe('Завершилась 30 ноября');
  });
});

describe('wallShares', () => {
  it('scales by height in cm against the tallest work', () => {
    expect(wallShares([100, 50])).toEqual([1, 0.5]);
  });
  it('keeps a miniature next to a big canvas visible', () => {
    expect(wallShares([200, 20])).toEqual([1, MIN_SHARE]);
  });
  it('handles one work, equal sizes, none and zeros', () => {
    expect(wallShares([40])).toEqual([1]);
    expect(wallShares([40, 40])).toEqual([1, 1]);
    expect(wallShares([])).toEqual([]);
    expect(wallShares([0, 0])).toEqual([1, 1]);
  });
});

describe('workRatio', () => {
  it('prefers the photo, then the size in cm, then 4:5', () => {
    expect(workRatio({ widthCm: 40, heightCm: 30, widthPx: 1000, heightPx: 500 })).toBe(2);
    expect(workRatio({ widthCm: 40, heightCm: 20, widthPx: null, heightPx: null })).toBe(2);
    expect(workRatio({ widthCm: 0, heightCm: 0, widthPx: null, heightPx: null })).toBe(0.8);
  });
});

describe('parseExhibitionForm', () => {
  const ok = { title: 'Горы и город', startsOn: '2026-11-01', endsOn: '2026-11-30' };
  it('fills the address from the title and trims empties to null', () => {
    const r = parseExhibitionForm(form({ ...ok, subtitle: '  ' }));
    expect(r).toEqual({
      ok: true,
      fields: {
        title: 'Горы и город',
        slug: 'gory-i-gorod',
        subtitle: null,
        curatorName: null,
        intro: null,
        startsOn: '2026-11-01',
        endsOn: '2026-11-30',
        postId: null,
      },
    });
  });
  it('refuses missing or reversed dates, a bad address and a bad post id', () => {
    expect(parseExhibitionForm(form({ ...ok, title: '' }))).toEqual({ ok: false, error: 'title' });
    expect(parseExhibitionForm(form({ ...ok, startsOn: '' }))).toEqual({ ok: false, error: 'start' });
    expect(parseExhibitionForm(form({ ...ok, endsOn: '' }))).toEqual({ ok: false, error: 'end' });
    expect(parseExhibitionForm(form({ ...ok, endsOn: '2026-10-01' }))).toEqual({ ok: false, error: 'dates' });
    expect(parseExhibitionForm(form({ ...ok, slug: 'Не латиница' }))).toEqual({ ok: false, error: 'slug' });
    expect(parseExhibitionForm(form({ ...ok, postId: 'nope' }))).toEqual({ ok: false, error: 'post' });
  });
  it('a one-day exhibition is fine', () => {
    expect(parseExhibitionForm(form({ ...ok, endsOn: '2026-11-01' })).ok).toBe(true);
  });
});

describe('parseHallForm and parseWorkNote', () => {
  it('needs a title and a known wall colour', () => {
    expect(parseHallForm(form({ title: 'Горы', wallColor: 'sage' }))).toEqual({
      ok: true,
      fields: { title: 'Горы', intro: null, wallColor: 'sage' },
    });
    expect(parseHallForm(form({ title: 'Горы', wallColor: '' }))).toMatchObject({ ok: true, fields: { wallColor: null } });
    expect(parseHallForm(form({ title: '' }))).toEqual({ ok: false, error: 'hall_title' });
    expect(parseHallForm(form({ title: 'Горы', wallColor: 'red; x' }))).toEqual({ ok: false, error: 'wall' });
  });
  it('keeps a short note and refuses a long one', () => {
    expect(parseWorkNote(form({ note: '  Ранняя работа. ' }))).toEqual({ ok: true, note: 'Ранняя работа.' });
    expect(parseWorkNote(form({ note: '' }))).toEqual({ ok: true, note: null });
    expect(parseWorkNote(form({ note: 'а'.repeat(301) }))).toEqual({ ok: false, error: 'note' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/exhibitions.test.ts`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Write `status.ts`**

```ts
// src/lib/exhibitions/status.ts
import { dateRange } from '../journal/post-form';

// Where an exhibition is in its life, by Dushanbe dates (YYYY-MM-DD compare as strings).
export type ExhibitionPhase = 'draft' | 'upcoming' | 'open' | 'closed';

export function exhibitionPhase(
  e: { status: 'draft' | 'published'; startsOn: string; endsOn: string },
  today: string,
): ExhibitionPhase {
  if (e.status === 'draft') return 'draft';
  if (today < e.startsOn) return 'upcoming';
  return today > e.endsOn ? 'closed' : 'open';
}

export const PHASE_LABEL: Record<ExhibitionPhase, string> = {
  draft: 'Черновик',
  upcoming: 'Скоро',
  open: 'Идёт',
  closed: 'Закрыта',
};

// "Откроется 1 ноября", "до 30 ноября", "Завершилась 30 ноября"
export function phaseNote(e: { startsOn: string; endsOn: string }, phase: ExhibitionPhase): string {
  if (phase === 'upcoming') return `Откроется ${dateRange(e.startsOn)}`;
  if (phase === 'closed') return `Завершилась ${dateRange(e.endsOn)}`;
  return `до ${dateRange(e.endsOn)}`;
}

// Works an exhibition shows; anything else on it is skipped quietly.
export const VISIBLE_STATUSES = ['published', 'sold'] as const;
```

- [ ] **Step 4: Write `wall-scale.ts`**

```ts
// src/lib/exhibitions/wall-scale.ts

// The smallest work is drawn at least this share of the wall's height, so a
// miniature next to a big canvas stays visible.
export const MIN_SHARE = 0.3;

// Each work's height as a share of the wall: the tallest (in cm) is 1, the rest
// in proportion.
export function wallShares(heightsCm: number[]): number[] {
  const tallest = Math.max(0, ...heightsCm);
  if (tallest <= 0) return heightsCm.map(() => 1);
  return heightsCm.map((h) => Math.min(1, Math.max(MIN_SHARE, h / tallest)));
}

// width / height: the stored photo's, else the painting's size in cm, else 4:5
// (the same rule as the artwork page).
export function workRatio(w: { widthCm: number; heightCm: number; widthPx: number | null; heightPx: number | null }): number {
  if (w.widthPx && w.heightPx) return w.widthPx / w.heightPx;
  if (w.widthCm > 0 && w.heightCm > 0) return w.widthCm / w.heightCm;
  return 4 / 5;
}
```

- [ ] **Step 5: Write `exhibition-form.ts`**

```ts
// src/lib/exhibitions/exhibition-form.ts
import { isSlug, slugify } from '../journal/post-form';
import { isUuid } from '../gallery/types';

export const MAX_HALLS = 5;

export const EXHIBITION_LIMITS = {
  title: 160,
  subtitle: 200,
  curator: 120,
  intro: 20_000,
  hallTitle: 120,
  hallIntro: 5_000,
  note: 300,
} as const;

// Wall colours a hall can have; null keeps the page background.
export const WALL_COLORS = {
  white: { label: 'Белая', value: '#fbfaf7' },
  stone: { label: 'Камень', value: '#ece6dc' },
  sage: { label: 'Шалфей', value: '#dfe6dc' },
  clay: { label: 'Глина', value: '#ecdcd0' },
  sky: { label: 'Небо', value: '#dde5ec' },
} as const;
export type WallColor = keyof typeof WALL_COLORS;
const isWallColor = (v: string): v is WallColor => v in WALL_COLORS;

export type ExhibitionFields = {
  title: string;
  slug: string;
  subtitle: string | null;
  curatorName: string | null;
  intro: string | null;
  startsOn: string;
  endsOn: string;
  postId: string | null;
};
export type HallFields = { title: string; intro: string | null; wallColor: WallColor | null };

export type ExhibitionFormError = 'title' | 'slug' | 'subtitle' | 'curator' | 'intro' | 'start' | 'end' | 'dates' | 'post';
export type HallFormError = 'hall_title' | 'hall_intro' | 'wall';

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
};
const longText = (form: FormData, key: string) => text(form, key).replace(/\r\n/g, '\n');
const orNull = (s: string) => (s ? s : null);
const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime());

export function parseExhibitionForm(
  form: FormData,
): { ok: true; fields: ExhibitionFields } | { ok: false; error: ExhibitionFormError } {
  const title = text(form, 'title');
  if (!title || title.length > EXHIBITION_LIMITS.title) return { ok: false, error: 'title' };
  const slug = text(form, 'slug').toLowerCase() || slugify(title);
  if (!isSlug(slug)) return { ok: false, error: 'slug' };
  const subtitle = text(form, 'subtitle');
  if (subtitle.length > EXHIBITION_LIMITS.subtitle) return { ok: false, error: 'subtitle' };
  const curatorName = text(form, 'curatorName');
  if (curatorName.length > EXHIBITION_LIMITS.curator) return { ok: false, error: 'curator' };
  const intro = longText(form, 'intro');
  if (intro.length > EXHIBITION_LIMITS.intro) return { ok: false, error: 'intro' };
  const startsOn = text(form, 'startsOn');
  if (!startsOn) return { ok: false, error: 'start' };
  const endsOn = text(form, 'endsOn');
  if (!endsOn) return { ok: false, error: 'end' };
  if (!isIsoDate(startsOn) || !isIsoDate(endsOn) || endsOn < startsOn) return { ok: false, error: 'dates' };
  const postId = text(form, 'postId');
  if (postId && !isUuid(postId)) return { ok: false, error: 'post' };
  return {
    ok: true,
    fields: {
      title,
      slug,
      subtitle: orNull(subtitle),
      curatorName: orNull(curatorName),
      intro: orNull(intro),
      startsOn,
      endsOn,
      postId: orNull(postId),
    },
  };
}

export function parseHallForm(form: FormData): { ok: true; fields: HallFields } | { ok: false; error: HallFormError } {
  const title = text(form, 'title');
  if (!title || title.length > EXHIBITION_LIMITS.hallTitle) return { ok: false, error: 'hall_title' };
  const intro = longText(form, 'intro');
  if (intro.length > EXHIBITION_LIMITS.hallIntro) return { ok: false, error: 'hall_intro' };
  const wall = text(form, 'wallColor');
  if (wall && !isWallColor(wall)) return { ok: false, error: 'wall' };
  return { ok: true, fields: { title, intro: orNull(intro), wallColor: wall ? (wall as WallColor) : null } };
}

export function parseWorkNote(form: FormData): { ok: true; note: string | null } | { ok: false; error: 'note' } {
  const note = text(form, 'note').replace(/\s+/g, ' ');
  if (note.length > EXHIBITION_LIMITS.note) return { ok: false, error: 'note' };
  return { ok: true, note: orNull(note) };
}

export type ExhibitionErrorCode =
  | ExhibitionFormError
  | HallFormError
  | 'note'
  | 'cover'
  | 'image'
  | 'upload'
  | 'slug_taken'
  | 'not_found'
  | 'too_many'
  | 'duplicate'
  | 'hidden';

export const EXHIBITION_ERRORS: Record<ExhibitionErrorCode, string> = {
  title: `Заполните название (до ${EXHIBITION_LIMITS.title} символов).`,
  slug: 'Адрес — латинские буквы, цифры и дефисы, например gory-i-gorod.',
  subtitle: `Подзаголовок — до ${EXHIBITION_LIMITS.subtitle} символов.`,
  curator: `Имя куратора — до ${EXHIBITION_LIMITS.curator} символов.`,
  intro: 'Кураторский текст слишком длинный.',
  start: 'Укажите дату открытия.',
  end: 'Укажите дату закрытия.',
  dates: 'Проверьте даты: закрытие не может быть раньше открытия.',
  post: 'Выберите анонс из списка.',
  hall_title: `Заполните название зала (до ${EXHIBITION_LIMITS.hallTitle} символов).`,
  hall_intro: 'Текст зала слишком длинный.',
  wall: 'Выберите цвет стены из списка.',
  note: `Заметка к работе — до ${EXHIBITION_LIMITS.note} символов.`,
  cover: 'Загрузите обложку.',
  image: 'Не удалось прочитать изображение. Загрузите JPEG, PNG или WebP.',
  upload: 'Не удалось сохранить обложку. Попробуйте ещё раз чуть позже.',
  slug_taken: 'Такой адрес уже занят другой выставкой. Измените его.',
  not_found: 'Не найдено: возможно, это уже удалили.',
  too_many: `В выставке не больше ${MAX_HALLS} залов.`,
  duplicate: 'Эта работа уже есть на выставке.',
  hidden: 'Эту работу нельзя добавить: она не опубликована.',
};

export const isExhibitionErrorCode = (v: unknown): v is ExhibitionErrorCode =>
  typeof v === 'string' && v in EXHIBITION_ERRORS;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/exhibitions.test.ts`
Expected: PASS (все describe-блоки).

- [ ] **Step 7: Commit**

```bash
git add src/lib/exhibitions tests/unit/exhibitions.test.ts
git commit -m "feat: exhibition phases, wall scale and form parsing"
```

---

### Task 3: Админские операции с данными

**Files:**
- Create: `src/lib/exhibitions/admin.ts`
- Test: `tests/integration/exhibitions.test.ts` (дополнить)

**Interfaces:**
- Consumes: таблицы из Task 1; `MAX_HALLS`, `ExhibitionFields`, `HallFields` из Task 2; `VISIBLE_STATUSES` из Task 2.
- Produces:
  - `type Exhibition = typeof exhibitions.$inferSelect`
  - `type ExhibitionInput = ExhibitionFields & { coverUrl: string; status: 'draft' | 'published' }`
  - `listAllExhibitions(db): Promise<Exhibition[]>`
  - `getExhibition(db, id): Promise<Exhibition | undefined>`
  - `saveExhibition(db, id: string | null, input): Promise<{ ok: true; id: string; slug: string } | { ok: false; reason: 'slug_taken' | 'not_found' }>`
  - `setExhibitionStatus(db, id, publish: boolean): Promise<Exhibition | undefined>`
  - `deleteExhibition(db, id): Promise<Exhibition | undefined>`
  - `type AdminWork = { artworkId: string; title: string; artistName: string | null; imageUrl: string; status: string; curatorNote: string | null }`
  - `type AdminHall = { id: string; title: string; intro: string | null; wallColor: string | null; works: AdminWork[] }`
  - `listHallsForAdmin(db, exhibitionId): Promise<AdminHall[]>`
  - `addHall(db, exhibitionId, fields): Promise<{ ok: true; id: string } | { ok: false; reason: 'too_many' | 'not_found' }>`
  - `updateHall(db, hallId, fields): Promise<string | undefined>` — id выставки
  - `deleteHall(db, hallId): Promise<string | undefined>`
  - `moveHall(db, hallId, dir: -1 | 1): Promise<string | undefined>`
  - `addWork(db, hallId, artworkId): Promise<{ ok: true; exhibitionId: string } | { ok: false; reason: 'duplicate' | 'hidden' | 'not_found' }>`
  - `moveWork(db, hallId, artworkId, dir: -1 | 1): Promise<string | undefined>`
  - `removeWork(db, hallId, artworkId): Promise<string | undefined>`
  - `setWorkNote(db, hallId, artworkId, note: string | null): Promise<string | undefined>`
  - `type ArtworkChoice = { id: string; title: string; artistName: string; imageUrl: string; status: string }`
  - `searchArtworkChoices(db, q: string, limit?: number): Promise<ArtworkChoice[]>`
  - `listAnnouncementChoices(db): Promise<{ id: string; title: string }[]>` — посты рубрики `exhibition`

- [ ] **Step 1: Write the failing tests**

Дополнить `tests/integration/exhibitions.test.ts`. Общие фикстуры (продавец, категория, техника, работы) — в начале файла, их же использует Task 4:

```ts
// в импорты добавить:
import { eq, inArray } from 'drizzle-orm';
import { artworks, categories, exhibitions, sellerApplications, techniques, users } from '../../src/db/schema';
import { testTelegramId } from '../helpers/test-telegram-id';
import {
  addHall,
  addWork,
  deleteHall,
  listHallsForAdmin,
  moveHall,
  moveWork,
  removeWork,
  saveExhibition,
  searchArtworkChoices,
  setWorkNote,
  type ExhibitionInput,
} from '../../src/lib/exhibitions/admin';

// ---------- fixtures ----------
type Fx = { sellerId: string; categoryId: string; techniqueId: string };
let fx: Fx | undefined;

async function fixtures(): Promise<Fx> {
  if (fx) return fx;
  const [seller] = await getDb()
    .insert(users)
    .values({ telegramId: testTelegramId(`test_ex_seller_${Date.now()}`), fullName: 'Ex Test Seller', role: 'seller' })
    .returning();
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: 'Тест выставок студия',
    bio: 'Био.',
    telegramContact: '@ex_test',
    status: 'approved',
  });
  const [category] = await getDb().insert(categories).values({ name: `Категория выставок ${Date.now()}` }).returning();
  const [technique] = await getDb().insert(techniques).values({ name: `Техника выставок ${Date.now()}` }).returning();
  fx = { sellerId: seller.id, categoryId: category.id, techniqueId: technique.id };
  return fx;
}

async function artwork(title: string, status: 'published' | 'sold' | 'pending' = 'published', heightCm = 50) {
  const f = await fixtures();
  const [row] = await getDb()
    .insert(artworks)
    .values({
      sellerId: f.sellerId,
      title,
      description: 'Описание.',
      price: 1000,
      heightCm,
      widthCm: 40,
      categoryId: f.categoryId,
      techniqueId: f.techniqueId,
      imageUrl: `https://example.com/${PREFIX}${title}.jpg`,
      status,
    })
    .returning();
  return row.id;
}

const baseInput: ExhibitionInput = {
  title: 'Тест',
  slug: '',
  subtitle: null,
  curatorName: null,
  intro: null,
  startsOn: '2090-01-01',
  endsOn: '2090-01-31',
  postId: null,
  coverUrl: 'https://example.com/cover.jpg',
  status: 'draft',
};

async function exhibition(slug: string, extra: Partial<ExhibitionInput> = {}) {
  const r = await saveExhibition(getDb(), null, { ...baseInput, slug: PREFIX + slug, ...extra });
  if (!r.ok) throw new Error(r.reason);
  return r.id;
}

async function hall(exhibitionId: string, title: string) {
  const r = await addHall(getDb(), exhibitionId, { title, intro: null, wallColor: null });
  if (!r.ok) throw new Error(r.reason);
  return r.id;
}
```

Заменить `afterAll` в существующем `describe` на общий (на уровне файла) и добавить новый `describe`:

```ts
afterAll(async () => {
  await getDb().delete(exhibitions).where(like(exhibitions.slug, `${PREFIX}%`));
  if (fx) {
    await getDb().delete(artworks).where(eq(artworks.sellerId, fx.sellerId));
    await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, fx.sellerId));
    await getDb().delete(users).where(eq(users.id, fx.sellerId));
    await getDb().delete(categories).where(eq(categories.id, fx.categoryId));
    await getDb().delete(techniques).where(eq(techniques.id, fx.techniqueId));
  }
});

describe('exhibition admin', () => {
  it('refuses a taken address', async () => {
    await exhibition('same');
    expect(await saveExhibition(getDb(), null, { ...baseInput, slug: `${PREFIX}same` })).toEqual({
      ok: false,
      reason: 'slug_taken',
    });
  });

  it('allows at most five halls and keeps their order when moved', async () => {
    const ex = await exhibition('halls');
    const ids = [];
    for (const t of ['А', 'Б', 'В', 'Г', 'Д']) ids.push(await hall(ex, t));
    expect(await addHall(getDb(), ex, { title: 'Е', intro: null, wallColor: null })).toEqual({ ok: false, reason: 'too_many' });

    await moveHall(getDb(), ids[1], -1); // Б, А, В, Г, Д
    await moveHall(getDb(), ids[0], -1); // А, Б, В, Г, Д
    expect((await listHallsForAdmin(getDb(), ex)).map((h) => h.title)).toEqual(['А', 'Б', 'В', 'Г', 'Д']);
    await moveHall(getDb(), ids[4], 1); // the last stays last
    await moveHall(getDb(), ids[2], 1); // В down
    expect((await listHallsForAdmin(getDb(), ex)).map((h) => h.title)).toEqual(['А', 'Б', 'Г', 'В', 'Д']);

    await deleteHall(getDb(), ids[0]);
    expect(await hall(ex, 'Е')).toBeTruthy(); // room for one more after a delete
  });

  it('adds a work once per exhibition, refuses hidden ones, moves and removes', async () => {
    const ex = await exhibition('works');
    const h1 = await hall(ex, 'Один');
    const h2 = await hall(ex, 'Два');
    const a = await artwork('a');
    const b = await artwork('b', 'sold');
    const pending = await artwork('p', 'pending');

    expect(await addWork(getDb(), h1, a)).toEqual({ ok: true, exhibitionId: ex });
    expect(await addWork(getDb(), h1, b)).toEqual({ ok: true, exhibitionId: ex });
    expect(await addWork(getDb(), h2, a)).toEqual({ ok: false, reason: 'duplicate' });
    expect(await addWork(getDb(), h1, pending)).toEqual({ ok: false, reason: 'hidden' });

    await moveWork(getDb(), h1, b, -1);
    await setWorkNote(getDb(), h1, a, 'Ранняя работа.');
    let [first] = await listHallsForAdmin(getDb(), ex);
    expect(first.works.map((w) => w.artworkId)).toEqual([b, a]);
    expect(first.works[1].curatorNote).toBe('Ранняя работа.');

    await removeWork(getDb(), h1, b);
    [first] = await listHallsForAdmin(getDb(), ex);
    expect(first.works.map((w) => w.artworkId)).toEqual([a]);
  });

  it('finds published and sold works by title or artist, not pending ones', async () => {
    const a = await artwork('poisk-odin');
    await artwork('poisk-dva', 'pending');
    const found = await searchArtworkChoices(getDb(), 'poisk');
    expect(found.map((w) => w.id)).toEqual([a]);
    expect((await searchArtworkChoices(getDb(), 'Тест выставок студия', 100)).some((w) => w.id === a)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/integration/exhibitions.test.ts`
Expected: FAIL — `src/lib/exhibitions/admin` не найден.

- [ ] **Step 3: Write `admin.ts`**

```ts
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
    works: works.filter((w) => w.hallId === h.id).map(({ hallId: _, ...w }) => w),
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/integration/exhibitions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/exhibitions/admin.ts tests/integration/exhibitions.test.ts
git commit -m "feat: admin data operations for exhibitions, halls and works"
```

---

### Task 4: Публичные запросы

**Files:**
- Create: `src/lib/exhibitions/queries.ts`
- Test: `tests/integration/exhibitions.test.ts` (дополнить)

**Interfaces:**
- Consumes: таблицы (Task 1); `VISIBLE_STATUSES` (Task 2); `ARTIST_AVATAR` из `src/lib/artworks/public-queries.ts`; фикстуры `exhibition`, `hall`, `artwork` из тестов Task 3.
- Produces:
  - `type ExhibitionCard = { id: string; slug: string; title: string; subtitle: string | null; coverUrl: string; startsOn: string; endsOn: string; status: 'draft' | 'published' }`
  - `type WallWork = { id: string; title: string; price: number; status: string; year: number | null; heightCm: number; widthCm: number; widthPx: number | null; heightPx: number | null; imageUrl: string; techniqueName: string; artistId: string; artistName: string; curatorNote: string | null }`
  - `type ViewHall = { id: string; title: string; intro: string | null; wallColor: string | null; works: WallWork[] }`
  - `type ExhibitionViewData = { exhibition: ExhibitionCard & { curatorName: string | null; intro: string | null }; halls: ViewHall[]; artists: { id: string; name: string; avatarUrl: string | null }[] }`
  - `listPublishedExhibitions(db): Promise<ExhibitionCard[]>`
  - `getPublicExhibition(db, slug, today): Promise<ExhibitionViewData | undefined>`
  - `getExhibitionPreview(db, id): Promise<ExhibitionViewData | undefined>`
  - `getOpenExhibitionForHome(db, today): Promise<ExhibitionCard | undefined>`
  - `listOtherExhibitions(db, exceptId, today, limit?): Promise<ExhibitionCard[]>`
  - `getExhibitionLinkForPost(db, postId, today): Promise<{ slug: string; title: string } | undefined>`
  - `listOpenExhibitionsWithArtwork(db, artworkId, today): Promise<{ slug: string; title: string }[]>`
  - `listSitemapExhibitions(db, today): Promise<{ slug: string; changedAt: Date }[]>`

- [ ] **Step 1: Write the failing tests**

```ts
// в импорты добавить:
import {
  getExhibitionPreview,
  getOpenExhibitionForHome,
  getPublicExhibition,
  listOpenExhibitionsWithArtwork,
  listPublishedExhibitions,
} from '../../src/lib/exhibitions/queries';

describe('exhibition public queries', () => {
  const today = '2090-06-15';

  it('shows a published exhibition from its first day, never a draft or an upcoming one', async () => {
    const draft = await exhibition('q-draft', { startsOn: '2090-06-01', endsOn: '2090-06-30' });
    await exhibition('q-soon', { status: 'published', startsOn: '2090-07-01', endsOn: '2090-07-30' });
    await exhibition('q-open', { status: 'published', startsOn: '2090-06-15', endsOn: '2090-06-15' });

    expect(await getPublicExhibition(getDb(), `${PREFIX}q-draft`, today)).toBeUndefined();
    expect(await getPublicExhibition(getDb(), `${PREFIX}q-soon`, today)).toBeUndefined();
    expect((await getPublicExhibition(getDb(), `${PREFIX}q-open`, today))?.exhibition.slug).toBe(`${PREFIX}q-open`);
    // the admin's preview sees drafts
    expect((await getExhibitionPreview(getDb(), draft))?.exhibition.id).toBe(draft);

    // the list has upcoming ones (for «Скоро»), never drafts
    const slugs = (await listPublishedExhibitions(getDb())).map((e) => e.slug);
    expect(slugs).toContain(`${PREFIX}q-soon`);
    expect(slugs).not.toContain(`${PREFIX}q-draft`);
  });

  it('hides works that left the catalog and halls left empty, keeps sold ones', async () => {
    const ex = await exhibition('q-view', { status: 'published', startsOn: '2090-06-01', endsOn: '2090-06-30' });
    const h1 = await hall(ex, 'Полный');
    const h2 = await hall(ex, 'Опустевший');
    const shown = await artwork('q-shown', 'published', 100);
    const sold = await artwork('q-sold', 'sold', 40);
    const gone = await artwork('q-gone');
    for (const [h, a] of [[h1, shown], [h1, sold], [h2, gone]] as const) await addWork(getDb(), h, a);
    // taken off sale after it was hung
    await getDb().update(artworks).set({ status: 'pending' }).where(eq(artworks.id, gone));

    const view = await getPublicExhibition(getDb(), `${PREFIX}q-view`, today);
    expect(view?.halls.map((h) => h.title)).toEqual(['Полный']);
    expect(view?.halls[0].works.map((w) => w.id)).toEqual([shown, sold]);
    expect(view?.halls[0].works[1].status).toBe('sold');
    expect(view?.artists).toHaveLength(1);

    // every work gone: no halls at all, the page says so (Task 7)
    await getDb().update(artworks).set({ status: 'pending' }).where(inArray(artworks.id, [shown, sold]));
    expect((await getPublicExhibition(getDb(), `${PREFIX}q-view`, today))?.halls).toEqual([]);
  });

  it('finds the open exhibition for the home page and for an artwork', async () => {
    const ex = await exhibition('q-home', { status: 'published', startsOn: '2090-06-10', endsOn: '2090-06-20' });
    const h = await hall(ex, 'Зал');
    const a = await artwork('q-home-a');
    await addWork(getDb(), h, a);
    expect((await getOpenExhibitionForHome(getDb(), today))?.slug).toBeDefined();
    expect(await listOpenExhibitionsWithArtwork(getDb(), a, today)).toEqual([{ slug: `${PREFIX}q-home`, title: 'Тест' }]);
    expect(await listOpenExhibitionsWithArtwork(getDb(), a, '2090-06-21')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/integration/exhibitions.test.ts`
Expected: FAIL — `src/lib/exhibitions/queries` не найден.

- [ ] **Step 3: Write `queries.ts`**

```ts
// src/lib/exhibitions/queries.ts
import { and, asc, desc, eq, gte, inArray, lte, ne, type SQL } from 'drizzle-orm';
import type { Db } from '../../db';
import { artworks, exhibitionHalls, exhibitionWorks, exhibitions, sellerApplications, techniques, users } from '../../db/schema';
import { ARTIST_AVATAR } from '../artworks/public-queries';
import { VISIBLE_STATUSES } from './status';

// No Date fields: these go through unstable_cache, which hands back JSON.
export type ExhibitionCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string;
  startsOn: string;
  endsOn: string;
  status: 'draft' | 'published';
};
const CARD = {
  id: exhibitions.id,
  slug: exhibitions.slug,
  title: exhibitions.title,
  subtitle: exhibitions.subtitle,
  coverUrl: exhibitions.coverUrl,
  startsOn: exhibitions.startsOn,
  endsOn: exhibitions.endsOn,
  status: exhibitions.status,
};

const published = eq(exhibitions.status, 'published');
// published and its first day has come (open or closed)
const started = (today: string) => and(published, lte(exhibitions.startsOn, today));
const running = (today: string) => and(started(today), gte(exhibitions.endsOn, today));

export type WallWork = {
  id: string;
  title: string;
  price: number;
  status: string;
  year: number | null;
  heightCm: number;
  widthCm: number;
  widthPx: number | null;
  heightPx: number | null;
  imageUrl: string;
  techniqueName: string;
  artistId: string;
  artistName: string;
  curatorNote: string | null;
};
export type ViewHall = { id: string; title: string; intro: string | null; wallColor: string | null; works: WallWork[] };
export type ExhibitionViewData = {
  exhibition: ExhibitionCard & { curatorName: string | null; intro: string | null };
  halls: ViewHall[];
  artists: { id: string; name: string; avatarUrl: string | null }[];
};

// The exhibition with its halls in order; works the public cannot see are
// skipped, and so are halls left without works.
async function loadView(db: Db, where: SQL | undefined): Promise<ExhibitionViewData | undefined> {
  const [ex] = await db
    .select({ ...CARD, curatorName: exhibitions.curatorName, intro: exhibitions.intro })
    .from(exhibitions)
    .where(where)
    .limit(1);
  if (!ex) return undefined;
  const [halls, works] = await Promise.all([
    db.select().from(exhibitionHalls).where(eq(exhibitionHalls.exhibitionId, ex.id)).orderBy(asc(exhibitionHalls.position)),
    db
      .select({
        hallId: exhibitionWorks.hallId,
        curatorNote: exhibitionWorks.curatorNote,
        id: artworks.id,
        title: artworks.title,
        price: artworks.price,
        status: artworks.status,
        year: artworks.year,
        heightCm: artworks.heightCm,
        widthCm: artworks.widthCm,
        widthPx: artworks.widthPx,
        heightPx: artworks.heightPx,
        imageUrl: artworks.imageUrl,
        techniqueName: techniques.name,
        artistId: artworks.sellerId,
        artistName: sellerApplications.displayName,
        artistAvatar: ARTIST_AVATAR,
      })
      .from(exhibitionWorks)
      .innerJoin(artworks, eq(artworks.id, exhibitionWorks.artworkId))
      .innerJoin(techniques, eq(techniques.id, artworks.techniqueId))
      .innerJoin(sellerApplications, eq(sellerApplications.userId, artworks.sellerId))
      .innerJoin(users, eq(users.id, artworks.sellerId))
      .where(and(eq(exhibitionWorks.exhibitionId, ex.id), inArray(artworks.status, [...VISIBLE_STATUSES])))
      .orderBy(asc(exhibitionWorks.position)),
  ]);
  const viewHalls = halls
    .map((h) => ({
      id: h.id,
      title: h.title,
      intro: h.intro,
      wallColor: h.wallColor,
      works: works.filter((w) => w.hallId === h.id).map(({ hallId: _h, artistAvatar: _a, ...w }) => w),
    }))
    .filter((h) => h.works.length > 0);
  const avatarOf = new Map(works.map((w) => [w.artistId, w.artistAvatar]));
  const artists = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
  for (const h of viewHalls)
    for (const w of h.works)
      if (!artists.has(w.artistId))
        artists.set(w.artistId, { id: w.artistId, name: w.artistName, avatarUrl: avatarOf.get(w.artistId) ?? null });
  return { exhibition: ex, halls: viewHalls, artists: [...artists.values()] };
}

export const getPublicExhibition = (db: Db, slug: string, today: string) =>
  loadView(db, and(started(today), eq(exhibitions.slug, slug)));

// Any status: the admin's preview.
export const getExhibitionPreview = (db: Db, id: string) => loadView(db, eq(exhibitions.id, id));

// Every published one, upcoming too (the list's «Скоро»), newest first.
export async function listPublishedExhibitions(db: Db): Promise<ExhibitionCard[]> {
  return db.select(CARD).from(exhibitions).where(published).orderBy(desc(exhibitions.startsOn), asc(exhibitions.title));
}

export async function getOpenExhibitionForHome(db: Db, today: string): Promise<ExhibitionCard | undefined> {
  const [row] = await db.select(CARD).from(exhibitions).where(running(today)).orderBy(desc(exhibitions.startsOn)).limit(1);
  return row;
}

export async function listOtherExhibitions(db: Db, exceptId: string, today: string, limit = 3): Promise<ExhibitionCard[]> {
  return db
    .select(CARD)
    .from(exhibitions)
    .where(and(started(today), ne(exhibitions.id, exceptId)))
    .orderBy(desc(exhibitions.endsOn))
    .limit(limit);
}

export async function getExhibitionLinkForPost(db: Db, postId: string, today: string) {
  const [row] = await db
    .select({ slug: exhibitions.slug, title: exhibitions.title })
    .from(exhibitions)
    .where(and(started(today), eq(exhibitions.postId, postId)))
    .limit(1);
  return row;
}

export async function listOpenExhibitionsWithArtwork(db: Db, artworkId: string, today: string) {
  return db
    .select({ slug: exhibitions.slug, title: exhibitions.title })
    .from(exhibitionWorks)
    .innerJoin(exhibitions, eq(exhibitions.id, exhibitionWorks.exhibitionId))
    .where(and(running(today), eq(exhibitionWorks.artworkId, artworkId)))
    .orderBy(desc(exhibitions.startsOn));
}

export async function listSitemapExhibitions(db: Db, today: string) {
  return db
    .select({ slug: exhibitions.slug, changedAt: exhibitions.updatedAt })
    .from(exhibitions)
    .where(started(today))
    .orderBy(desc(exhibitions.startsOn));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/integration/exhibitions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/exhibitions/queries.ts tests/integration/exhibitions.test.ts
git commit -m "feat: public exhibition queries with visibility rules"
```

---

### Task 5: Админка — список и форма выставки

**Files:**
- Create: `app/admin/exhibitions/actions.ts`
- Create: `app/admin/exhibitions/page.tsx`
- Create: `app/admin/exhibitions/new/page.tsx`
- Create: `app/admin/exhibitions/[id]/page.tsx` (здесь только форма; редактор залов — Task 6)
- Create: `src/components/admin/exhibition-form.tsx`
- Modify: `src/components/admin/admin-nav.tsx` (`ADMIN_LINKS`)

**Interfaces:**
- Consumes: `parseExhibitionForm`, `EXHIBITION_ERRORS`, `EXHIBITION_LIMITS`, `isExhibitionErrorCode` (Task 2); `exhibitionPhase`, `PHASE_LABEL` (Task 2); `saveExhibition`, `getExhibition`, `listAllExhibitions`, `setExhibitionStatus`, `deleteExhibition`, `listAnnouncementChoices` (Task 3); `requireStaff`, `tryUploadImage`, `dropImages`, `POSTS_BUCKET`, `isUuid`, `dateRange`, `todayInDushanbe`, `slugify`.
- Produces: `exhibitionsChanged(...slugs)` (неэкспортируемая, внутри `actions.ts`, используется в Task 6); `saveExhibitionAction`, `setExhibitionStatusAction`, `removeExhibition` server actions; маршруты `/admin/exhibitions`, `/admin/exhibitions/new`, `/admin/exhibitions/[id]`.

- [ ] **Step 1: Server actions**

```ts
// app/admin/exhibitions/actions.ts
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { parseExhibitionForm, type ExhibitionErrorCode } from '@/src/lib/exhibitions/exhibition-form';
import { deleteExhibition, getExhibition, saveExhibition, setExhibitionStatus } from '@/src/lib/exhibitions/admin';
import { POSTS_BUCKET } from '@/src/lib/uploads/buckets';
import { dropImages, tryUploadImage } from '@/src/lib/uploads/upload-image';

const COVER_SIDE = 1600;

// The lists, the home page block, the journal and the exhibition's own page
// (under its old address too, when it moved). Not exported: every export of a
// 'use server' file becomes a callable action.
function exhibitionsChanged(...slugs: (string | null | undefined)[]) {
  revalidateTag('exhibitions');
  revalidatePath('/admin/exhibitions');
  revalidatePath('/exhibitions');
  revalidatePath('/');
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/exhibitions/${slug}`);
}

const fileOf = (form: FormData, key: string) => {
  const v = form.get(key);
  return v instanceof File && v.size > 0 ? v : null;
};

export type SaveExhibitionState = { error: ExhibitionErrorCode } | null;

// Creates an exhibition or updates the one in the hidden `id`. A new one opens
// its page, where the halls are added; an edit stays there too.
export async function saveExhibitionAction(_prev: SaveExhibitionState, formData: FormData): Promise<SaveExhibitionState> {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  const existing = id && isUuid(id) ? await getExhibition(getDb(), id) : undefined;
  if (id && !existing) return { error: 'not_found' };

  const parsed = parseExhibitionForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const cover = fileOf(formData, 'cover');
  if (!cover && !existing) return { error: 'cover' };
  let coverUrl = existing?.coverUrl ?? '';
  if (cover) {
    const up = await tryUploadImage(POSTS_BUCKET, cover, COVER_SIDE);
    if (up.error !== undefined) return { error: up.error };
    coverUrl = up.url;
  }

  const status = existing?.status ?? 'draft';
  const result = await saveExhibition(getDb(), existing ? id : null, { ...parsed.fields, coverUrl, status });
  if (!result.ok) {
    if (cover) await dropImages(POSTS_BUCKET, [coverUrl]);
    return { error: result.reason };
  }
  if (existing && existing.coverUrl !== coverUrl) await dropImages(POSTS_BUCKET, [existing.coverUrl]);
  exhibitionsChanged(result.slug, existing?.slug);
  redirect(`/admin/exhibitions/${result.id}?saved=1`);
}

export async function setExhibitionStatusAction(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const row = await setExhibitionStatus(getDb(), id, formData.get('publish') === '1');
  exhibitionsChanged(row?.slug);
}

export async function removeExhibition(formData: FormData) {
  await requireStaff('admin');
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const gone = await deleteExhibition(getDb(), id);
  if (gone) await dropImages(POSTS_BUCKET, [gone.coverUrl]);
  exhibitionsChanged(gone?.slug);
  redirect('/admin/exhibitions');
}
```

Заметка: в файле `'use server'` каждый экспорт становится вызываемым server action, поэтому `exhibitionsChanged` не экспортируется; действия Task 6 живут в этом же файле.

- [ ] **Step 2: The form component**

```tsx
// src/components/admin/exhibition-form.tsx
'use client';

import { useActionState, useState } from 'react';
import { Field } from '@/src/components/form/field';
import { CustomSelect } from '@/src/components/sanat/custom-select';
import { SubmitButton } from '@/src/components/form/submit-button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { EXHIBITION_ERRORS, EXHIBITION_LIMITS, type ExhibitionErrorCode } from '@/src/lib/exhibitions/exhibition-form';
import { slugify } from '@/src/lib/journal/post-form';
import { MAX_UPLOAD_BYTES } from '@/src/lib/uploads/shrink-photo';

type Exhibition = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  curatorName: string | null;
  intro: string | null;
  coverUrl: string;
  startsOn: string;
  endsOn: string;
  postId: string | null;
};
type State = { error: ExhibitionErrorCode } | null;

// Title, address, dates, cover, curator and the curator's text (Markdown).
// The address follows the title until the admin types their own.
export function ExhibitionForm({
  action,
  exhibition,
  announcements,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  exhibition?: Exhibition;
  announcements: { id: string; title: string }[];
}) {
  const [state, formAction] = useActionState(action, null);
  const [title, setTitle] = useState(exhibition?.title ?? '');
  const [slug, setSlug] = useState(exhibition?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(exhibition));
  const [tooBig, setTooBig] = useState(false);

  return (
    <form action={formAction} className="mt-6 grid max-w-3xl gap-5">
      {exhibition && <input type="hidden" name="id" value={exhibition.id} />}
      {state?.error && (
        <p role="alert" className="notice err">
          {EXHIBITION_ERRORS[state.error]}
        </p>
      )}
      <Field label="Название">
        <Input
          name="title"
          required
          maxLength={EXHIBITION_LIMITS.title}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label="Адрес страницы">
        <Input
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
        />
      </Field>
      <Field label="Подзаголовок">
        <Input name="subtitle" maxLength={EXHIBITION_LIMITS.subtitle} defaultValue={exhibition?.subtitle ?? ''} />
      </Field>
      <Field label="Куратор">
        <Input name="curatorName" maxLength={EXHIBITION_LIMITS.curator} defaultValue={exhibition?.curatorName ?? ''} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Дата открытия">
          <Input type="date" name="startsOn" required defaultValue={exhibition?.startsOn ?? ''} />
        </Field>
        <Field label="Дата закрытия">
          <Input type="date" name="endsOn" required defaultValue={exhibition?.endsOn ?? ''} />
        </Field>
      </div>
      <Field label="Обложка">
        <Input
          type="file"
          name="cover"
          accept="image/jpeg,image/webp,image/png"
          required={!exhibition}
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > MAX_UPLOAD_BYTES)}
        />
      </Field>
      {tooBig && (
        <p role="alert" className="text-sm text-destructive">
          Файл слишком большой. Выберите JPEG или WebP поменьше.
        </p>
      )}
      {exhibition && (
        // eslint-disable-next-line @next/next/no-img-element -- the stored cover, previewed as is
        <img src={exhibition.coverUrl} alt="" className="banner-thumb" />
      )}
      <CustomSelect
        className="grid gap-1.5 text-sm font-semibold"
        name="postId"
        label="Анонс в журнале"
        options={[{ value: '', label: 'Без анонса' }, ...announcements.map((a) => ({ value: a.id, label: a.title }))]}
        defaultValue={exhibition?.postId ?? ''}
      />
      <Field label="Кураторский текст">
        <Textarea name="intro" rows={10} maxLength={EXHIBITION_LIMITS.intro} defaultValue={exhibition?.intro ?? ''} />
      </Field>
      <div>
        <SubmitButton disabled={tooBig}>{exhibition ? 'Сохранить' : 'Создать выставку'}</SubmitButton>
      </div>
    </form>
  );
}
```

Перед использованием сверить пропсы `CustomSelect` и `SubmitButton` с их файлами (`src/components/sanat/custom-select.tsx`, `src/components/form/submit-button.tsx`) — в `app/admin/journal/page.tsx` они вызываются именно так.

- [ ] **Step 3: Pages**

```tsx
// app/admin/exhibitions/new/page.tsx
import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { listAnnouncementChoices } from '@/src/lib/exhibitions/admin';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ExhibitionForm } from '@/src/components/admin/exhibition-form';
import { saveExhibitionAction } from '../actions';

export const metadata = { title: 'Новая выставка' };

export default async function NewExhibitionPage() {
  const role = await requireStaff('admin');
  const announcements = await listAnnouncementChoices(getDb());
  return (
    <main>
      <AdminNav role={role} />
      <Link href="/admin/exhibitions" className="text-sm text-muted-foreground hover:text-brand">
        ← Все выставки
      </Link>
      <h1 className="mt-3">Новая выставка</h1>
      <p className="mt-2 text-muted-foreground">Залы и работы добавляются после создания.</p>
      <ExhibitionForm action={saveExhibitionAction} announcements={announcements} />
    </main>
  );
}
```

```tsx
// app/admin/exhibitions/[id]/page.tsx  (Task 6 добавит редактор залов под формой)
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { getExhibition, listAnnouncementChoices } from '@/src/lib/exhibitions/admin';
import { EXHIBITION_ERRORS, isExhibitionErrorCode } from '@/src/lib/exhibitions/exhibition-form';
import { exhibitionPhase, PHASE_LABEL } from '@/src/lib/exhibitions/status';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ExhibitionForm } from '@/src/components/admin/exhibition-form';
import { SubmitButton } from '@/src/components/form/submit-button';
import { buttonVariants } from '@/src/components/ui/button';
import { saveExhibitionAction, setExhibitionStatusAction } from '../actions';

export const metadata = { title: 'Выставка' };

export default async function EditExhibitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; hall?: string; q?: string }>;
}) {
  const role = await requireStaff('admin');
  const { id } = await params;
  const sp = await searchParams;
  const exhibition = isUuid(id) ? await getExhibition(getDb(), id) : undefined;
  if (!exhibition) notFound();
  const announcements = await listAnnouncementChoices(getDb());
  const phase = exhibitionPhase(exhibition, todayInDushanbe());
  const published = exhibition.status === 'published';
  const error = isExhibitionErrorCode(sp.error) ? EXHIBITION_ERRORS[sp.error] : null;

  return (
    <main>
      <AdminNav role={role} />
      <Link href="/admin/exhibitions" className="text-sm text-muted-foreground hover:text-brand">
        ← Все выставки
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{PHASE_LABEL[phase]}</p>
          <h1>{exhibition.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/exhibitions/${exhibition.id}/preview`} className={buttonVariants({ variant: 'outline' })} target="_blank">
            Предпросмотр
          </Link>
          <form action={setExhibitionStatusAction}>
            <input type="hidden" name="id" value={exhibition.id} />
            <input type="hidden" name="publish" value={published ? '0' : '1'} />
            <SubmitButton variant={published ? 'outline' : 'default'}>{published ? 'Снять с публикации' : 'Опубликовать'}</SubmitButton>
          </form>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice err mt-6">
          {error}
        </p>
      )}
      {sp.saved && !error && (
        <p role="status" className="notice mt-6">
          Сохранено.
        </p>
      )}
      <ExhibitionForm action={saveExhibitionAction} exhibition={exhibition} announcements={announcements} />
    </main>
  );
}
```

```tsx
// app/admin/exhibitions/page.tsx
import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { listAllExhibitions } from '@/src/lib/exhibitions/admin';
import { exhibitionPhase, PHASE_LABEL } from '@/src/lib/exhibitions/status';
import { dateRange, todayInDushanbe } from '@/src/lib/journal/post-form';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ConfirmDelete } from '@/src/components/admin/confirm-delete';
import { buttonVariants } from '@/src/components/ui/button';
import { removeExhibition } from './actions';

export const metadata = { title: 'Выставки' };

export default async function AdminExhibitionsPage() {
  const role = await requireStaff('admin');
  const list = await listAllExhibitions(getDb());
  const today = todayInDushanbe();
  return (
    <main>
      <AdminNav role={role} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Онлайн-выставки</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">
            Подборки работ из каталога, по залам. Опубликованная выставка появляется на сайте в день открытия, а до
            этого видна в разделе «Скоро».
          </p>
        </div>
        <Link href="/admin/exhibitions/new" className={buttonVariants()}>
          Создать выставку
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Выставок пока нет.</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {list.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-5 rounded-sm bg-card p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small admin thumbnail */}
              <img src={e.coverUrl} alt="" className="banner-thumb" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  {PHASE_LABEL[exhibitionPhase(e, today)]} · {dateRange(e.startsOn, e.endsOn, true)}
                </p>
                <h2 className="text-2xl">{e.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/exhibitions/${e.id}`} className={buttonVariants({ variant: 'outline' })}>
                  Изменить
                </Link>
                <ConfirmDelete action={removeExhibition} id={e.id} what={e.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Admin nav link**

```ts
// src/components/admin/admin-nav.tsx
const ADMIN_LINKS = [
  { href: '/admin/database', label: 'База данных' },
  { href: '/admin/banners', label: 'Баннеры' },
  { href: '/admin/journal', label: 'Афиша и журнал' },
  { href: '/admin/exhibitions', label: 'Выставки' },
];
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: без ошибок.
Затем `npm run dev`, войти как админ (на localhost — через `/sanatadmin`), открыть `/admin/exhibitions/new`, создать выставку с обложкой: редирект на `/admin/exhibitions/<id>?saved=1`, «Сохранено.»; в списке метка «Черновик». Попробовать даты наоборот — «Проверьте даты…».

- [ ] **Step 6: Commit**

```bash
git add app/admin/exhibitions src/components/admin/exhibition-form.tsx src/components/admin/admin-nav.tsx
git commit -m "feat: admin list and form for online exhibitions"
```

---

### Task 6: Админка — залы, работы, предпросмотр

**Files:**
- Modify: `app/admin/exhibitions/actions.ts` (действия залов и работ)
- Create: `app/admin/exhibitions/[id]/halls-editor.tsx`
- Modify: `app/admin/exhibitions/[id]/page.tsx` (подключить редактор)
- Create: `app/admin/exhibitions/[id]/preview/page.tsx` (заглушка-редирект до Task 7 не нужна — см. Step 4)

**Interfaces:**
- Consumes: `addHall`, `updateHall`, `deleteHall`, `moveHall`, `addWork`, `moveWork`, `removeWork`, `setWorkNote`, `listHallsForAdmin`, `searchArtworkChoices`, `getExhibition` (Task 3); `parseHallForm`, `parseWorkNote`, `WALL_COLORS`, `MAX_HALLS`, `EXHIBITION_LIMITS` (Task 2); `exhibitionsChanged` (Task 5); `VISIBLE_STATUSES` (Task 2).
- Produces: server actions `addHallAction`, `updateHallAction`, `deleteHallAction`, `moveHallAction`, `addWorkAction`, `moveWorkAction`, `removeWorkAction`, `setWorkNoteAction`; компонент `HallsEditor({ exhibitionId, hallSearch, q })`.

- [ ] **Step 1: Hall and work actions**

Дописать в `app/admin/exhibitions/actions.ts` (импорты добавить в начало файла):

```ts
import {
  addHall,
  addWork,
  deleteHall,
  moveHall,
  moveWork,
  removeWork,
  setWorkNote,
  updateHall,
} from '@/src/lib/exhibitions/admin';
import { parseHallForm, parseWorkNote } from '@/src/lib/exhibitions/exhibition-form';

const idOf = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? '');
  return isUuid(v) ? v : null;
};
const dirOf = (form: FormData): -1 | 1 => (form.get('dir') === 'up' ? -1 : 1);

// Back to the exhibition's page, with a problem in the address if there was one.
async function backTo(exhibitionId: string | undefined | null, error?: ExhibitionErrorCode): Promise<never> {
  if (!exhibitionId) redirect('/admin/exhibitions?error=not_found');
  const ex = await getExhibition(getDb(), exhibitionId);
  exhibitionsChanged(ex?.slug);
  redirect(`/admin/exhibitions/${exhibitionId}${error ? `?error=${error}` : ''}#halls`);
}

export async function addHallAction(formData: FormData) {
  await requireStaff('admin');
  const exhibitionId = idOf(formData, 'exhibitionId');
  const parsed = parseHallForm(formData);
  if (!parsed.ok) return backTo(exhibitionId, parsed.error);
  if (!exhibitionId) return backTo(null);
  const r = await addHall(getDb(), exhibitionId, parsed.fields);
  return backTo(exhibitionId, r.ok ? undefined : r.reason);
}

export async function updateHallAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const exhibitionId = idOf(formData, 'exhibitionId');
  const parsed = parseHallForm(formData);
  if (!parsed.ok) return backTo(exhibitionId, parsed.error);
  return backTo(hallId ? await updateHall(getDb(), hallId, parsed.fields) : null);
}

export async function deleteHallAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'id');
  return backTo(hallId ? await deleteHall(getDb(), hallId) : null);
}

export async function moveHallAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  return backTo(hallId ? await moveHall(getDb(), hallId, dirOf(formData)) : null);
}

export async function addWorkAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const artworkId = idOf(formData, 'artworkId');
  const exhibitionId = idOf(formData, 'exhibitionId');
  if (!hallId || !artworkId) return backTo(exhibitionId, 'not_found');
  const r = await addWork(getDb(), hallId, artworkId);
  return backTo(exhibitionId, r.ok ? undefined : r.reason);
}

export async function moveWorkAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const artworkId = idOf(formData, 'artworkId');
  return backTo(hallId && artworkId ? await moveWork(getDb(), hallId, artworkId, dirOf(formData)) : null);
}

export async function removeWorkAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const artworkId = idOf(formData, 'artworkId');
  return backTo(hallId && artworkId ? await removeWork(getDb(), hallId, artworkId) : null);
}

export async function setWorkNoteAction(formData: FormData) {
  await requireStaff('admin');
  const hallId = idOf(formData, 'hallId');
  const artworkId = idOf(formData, 'artworkId');
  const exhibitionId = idOf(formData, 'exhibitionId');
  const parsed = parseWorkNote(formData);
  if (!parsed.ok) return backTo(exhibitionId, parsed.error);
  return backTo(hallId && artworkId ? await setWorkNote(getDb(), hallId, artworkId, parsed.note) : null);
}
```

- [ ] **Step 2: The halls editor**

```tsx
// app/admin/exhibitions/[id]/halls-editor.tsx
import Link from 'next/link';
import { getDb } from '@/src/db';
import { listHallsForAdmin, searchArtworkChoices } from '@/src/lib/exhibitions/admin';
import { EXHIBITION_LIMITS, MAX_HALLS, WALL_COLORS } from '@/src/lib/exhibitions/exhibition-form';
import { VISIBLE_STATUSES } from '@/src/lib/exhibitions/status';
import { ConfirmDelete } from '@/src/components/admin/confirm-delete';
import { Field } from '@/src/components/form/field';
import { SubmitButton } from '@/src/components/form/submit-button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import {
  addHallAction,
  addWorkAction,
  deleteHallAction,
  moveHallAction,
  moveWorkAction,
  removeWorkAction,
  setWorkNoteAction,
  updateHallAction,
} from '../actions';

const COLOR_OPTIONS = [['', 'Фон страницы'], ...Object.entries(WALL_COLORS).map(([k, v]) => [k, v.label])] as const;

function HallFields({ title, intro, wallColor }: { title?: string; intro?: string | null; wallColor?: string | null }) {
  return (
    <>
      <Field label="Название зала">
        <Input name="title" required maxLength={EXHIBITION_LIMITS.hallTitle} defaultValue={title ?? ''} />
      </Field>
      <Field label="Текст зала">
        <Textarea name="intro" rows={3} maxLength={EXHIBITION_LIMITS.hallIntro} defaultValue={intro ?? ''} />
      </Field>
      <Field label="Цвет стены">
        <select name="wallColor" defaultValue={wallColor ?? ''} className="h-11 rounded-sm border border-border bg-card px-3">
          {COLOR_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function Move({ action, fields, label }: { action: (f: FormData) => Promise<void>; fields: Record<string, string>; label: string }) {
  return (
    <span className="inline-flex gap-1">
      {(['up', 'down'] as const).map((dir) => (
        <form key={dir} action={action}>
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="dir" value={dir} />
          <SubmitButton variant="outline" size="sm" aria-label={`${label}: ${dir === 'up' ? 'выше' : 'ниже'}`}>
            {dir === 'up' ? '↑' : '↓'}
          </SubmitButton>
        </form>
      ))}
    </span>
  );
}

// The halls in order, each with its works and a catalog search. Plain forms and
// server actions: every change reloads this page.
export async function HallsEditor({ exhibitionId, hallSearch, q }: { exhibitionId: string; hallSearch?: string; q: string }) {
  const halls = await listHallsForAdmin(getDb(), exhibitionId);
  const results = hallSearch && q ? await searchArtworkChoices(getDb(), q) : [];

  return (
    <section id="halls" className="mt-12 grid gap-8" aria-labelledby="halls-t">
      <h2 id="halls-t">Залы</h2>
      {halls.length === 0 && <p className="text-muted-foreground">Залов пока нет. Добавьте первый.</p>}
      {halls.map((h, i) => (
        <article key={h.id} className="grid gap-4 rounded-sm bg-card p-5" aria-label={`Зал ${i + 1}. ${h.title}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl">
              Зал {i + 1}. {h.title}
            </h3>
            <span className="inline-flex flex-wrap gap-2">
              <Move action={moveHallAction} fields={{ hallId: h.id }} label={`Зал ${h.title}`} />
              <ConfirmDelete action={deleteHallAction} id={h.id} what={`зал «${h.title}»`} />
            </span>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">Изменить зал</summary>
            <form action={updateHallAction} className="mt-3 grid gap-4">
              <input type="hidden" name="hallId" value={h.id} />
              <input type="hidden" name="exhibitionId" value={exhibitionId} />
              <HallFields title={h.title} intro={h.intro} wallColor={h.wallColor} />
              <div>
                <SubmitButton variant="outline">Сохранить зал</SubmitButton>
              </div>
            </form>
          </details>

          <ol className="grid gap-3">
            {h.works.map((w) => {
              const hidden = !(VISIBLE_STATUSES as readonly string[]).includes(w.status);
              return (
                <li key={w.artworkId} className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a small admin thumbnail */}
                  <img src={w.imageUrl} alt="" className="h-16 w-16 rounded-sm object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{w.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {w.artistName}
                      {w.status === 'sold' && ' · Продано'}
                      {hidden && <span className="text-destructive"> · Скрыта: не опубликована</span>}
                    </p>
                    <form action={setWorkNoteAction} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="hallId" value={h.id} />
                      <input type="hidden" name="artworkId" value={w.artworkId} />
                      <input type="hidden" name="exhibitionId" value={exhibitionId} />
                      <Input
                        name="note"
                        aria-label={`Заметка куратора: ${w.title}`}
                        placeholder="Заметка куратора"
                        maxLength={EXHIBITION_LIMITS.note}
                        defaultValue={w.curatorNote ?? ''}
                        className="min-w-[16rem] flex-1"
                      />
                      <SubmitButton variant="outline" size="sm">
                        Сохранить
                      </SubmitButton>
                    </form>
                  </div>
                  <Move action={moveWorkAction} fields={{ hallId: h.id, artworkId: w.artworkId }} label={w.title} />
                  <form action={removeWorkAction}>
                    <input type="hidden" name="hallId" value={h.id} />
                    <input type="hidden" name="artworkId" value={w.artworkId} />
                    <SubmitButton variant="ghost" size="sm" aria-label={`Убрать: ${w.title}`}>
                      Убрать
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ol>

          <form method="get" action={`/admin/exhibitions/${exhibitionId}`} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="hall" value={h.id} />
            <Field label={`Найти работу для зала «${h.title}»`} className="min-w-[16rem] flex-1">
              <Input type="search" name="q" defaultValue={hallSearch === h.id ? q : ''} placeholder="Название или художник" />
            </Field>
            <SubmitButton variant="outline">Найти</SubmitButton>
          </form>
          {hallSearch === h.id && q && (
            <ul className="grid gap-2" aria-label="Найденные работы">
              {results.length === 0 && <li className="text-muted-foreground">Ничего не найдено.</li>}
              {results.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a small admin thumbnail */}
                  <img src={r.imageUrl} alt="" className="h-12 w-12 rounded-sm object-cover" loading="lazy" />
                  <span className="flex-1">
                    {r.title} <span className="text-muted-foreground">— {r.artistName}</span>
                  </span>
                  <form action={addWorkAction}>
                    <input type="hidden" name="hallId" value={h.id} />
                    <input type="hidden" name="artworkId" value={r.id} />
                    <input type="hidden" name="exhibitionId" value={exhibitionId} />
                    <SubmitButton size="sm" aria-label={`Добавить: ${r.title}`}>
                      Добавить
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}

      {halls.length < MAX_HALLS ? (
        <form action={addHallAction} className="grid max-w-3xl gap-4 rounded-sm border border-dashed border-border p-5">
          <h3 className="text-xl">Новый зал</h3>
          <input type="hidden" name="exhibitionId" value={exhibitionId} />
          <HallFields />
          <div>
            <SubmitButton>Добавить зал</SubmitButton>
          </div>
        </form>
      ) : (
        <p className="text-muted-foreground">В выставке {MAX_HALLS} залов — больше добавить нельзя.</p>
      )}
    </section>
  );
}
```

Сверить, что `SubmitButton` принимает `size` (он оборачивает `Button` из shadcn с `buttonVariants`). Если не принимает — убрать `size="sm"`.

- [ ] **Step 3: Wire the editor into the page**

В `app/admin/exhibitions/[id]/page.tsx` импортировать `HallsEditor` и под `<ExhibitionForm …/>` добавить:

```tsx
      <HallsEditor
        exhibitionId={exhibition.id}
        hallSearch={isUuid(sp.hall ?? '') ? sp.hall : undefined}
        q={(sp.q ?? '').trim().slice(0, 100)}
      />
```

- [ ] **Step 4: Preview page**

Создаётся в Task 7, Step 6 (нужен `ExhibitionView`). Кнопка «Предпросмотр» до этого отвечает 404 — допустимо между задачами.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Затем вручную на `npm run dev`: добавить 2 зала, найти работу, добавить, переставить ↑/↓, сохранить заметку, убрать. Добавить ту же работу во второй зал — «Эта работа уже есть на выставке.». Создать 5 залов — форма «Новый зал» исчезает.

- [ ] **Step 6: Commit**

```bash
git add app/admin/exhibitions
git commit -m "feat: admin editor for exhibition halls and works"
```

---

### Task 7: Публичная страница выставки — стена и просмотр

**Files:**
- Create: `src/components/exhibitions/work-label.tsx`
- Create: `src/components/exhibitions/exhibition-room.tsx` (client)
- Create: `src/components/exhibitions/exhibition-card.tsx`
- Create: `src/components/exhibitions/exhibition-view.tsx`
- Create: `src/styles/exhibitions.css`; Modify: `app/globals.css` (импорт)
- Create: `app/exhibitions/[slug]/page.tsx`
- Create: `app/admin/exhibitions/[id]/preview/page.tsx`
- Test: `tests/unit/exhibitions.test.ts` (рендер пустого состояния)

**Interfaces:**
- Consumes: `ExhibitionViewData`, `WallWork`, `ExhibitionCard`, `getPublicExhibition`, `getExhibitionPreview`, `listOtherExhibitions` (Task 4); `wallShares`, `workRatio` (Task 2); `exhibitionPhase`, `phaseNote` (Task 2); `WALL_COLORS` (Task 2); `MarkdownBody`, `LikeButton`, `LikeInfo`, `likeInfoFor`, `getCurrentUser`, `pagePreview`, `snippet`, `isStorageUrl`, `prefersReducedMotion`, `dateRange`, `isSlug`, `todayInDushanbe`.
- Produces:
  - `WorkLabel({ work }: { work: WallWork })`
  - `type RoomHall = { id: string; number: number; title: string; intro: ReactNode; wall: string | null; works: (WallWork & { share: number; ratio: number })[] }`
  - `ExhibitionRoom({ halls, likes }: { halls: RoomHall[]; likes: Record<string, LikeInfo> })`
  - `ExhibitionCardView({ card, today, link?: boolean })`; `ExhibitionGrid({ cards, today })`
  - `ExhibitionView({ view, today, likes, others, preview? })`

- [ ] **Step 1: Write the failing render test**

```ts
// tests/unit/exhibitions.test.ts — добавить
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExhibitionView } from '../../src/components/exhibitions/exhibition-view';

describe('ExhibitionView', () => {
  const base = {
    exhibition: {
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'gory',
      title: 'Горы',
      subtitle: null,
      coverUrl: 'https://example.com/c.jpg',
      startsOn: '2026-11-01',
      endsOn: '2026-11-30',
      status: 'published' as const,
      curatorName: null,
      intro: null,
    },
    halls: [],
    artists: [],
  };
  it('says the exposition is being updated when no work is left', () => {
    const html = renderToStaticMarkup(createElement(ExhibitionView, { view: base, today: '2026-11-10', likes: {}, others: [] }));
    expect(html).toContain('Экспозиция обновляется');
  });
  it('marks a closed exhibition', () => {
    const html = renderToStaticMarkup(createElement(ExhibitionView, { view: base, today: '2026-12-02', likes: {}, others: [] }));
    expect(html).toContain('Выставка завершилась 30 ноября');
  });
});
```

Run: `npm run test:unit -- tests/unit/exhibitions.test.ts` → FAIL (модуль не найден).

- [ ] **Step 2: Label and cards**

```tsx
// src/components/exhibitions/work-label.tsx
import type { WallWork } from '@/src/lib/exhibitions/queries';

// The museum label under a work: title, artist, year, technique, size, price.
export function WorkLabel({ work }: { work: WallWork }) {
  return (
    <div className="ex-label">
      <p className="ex-label-t">{work.title}</p>
      <p>
        {work.artistName}
        {work.year && `, ${work.year}`}
      </p>
      <p className="ex-label-m">
        {work.techniqueName} · {work.heightCm}×{work.widthCm} см
      </p>
      <p className="ex-label-p">{work.status === 'sold' ? 'Продано' : `${work.price} TJS`}</p>
      {work.curatorNote && <p className="ex-label-n">{work.curatorNote}</p>}
    </div>
  );
}
```

```tsx
// src/components/exhibitions/exhibition-card.tsx
import Image from 'next/image';
import Link from 'next/link';
import type { ExhibitionCard } from '@/src/lib/exhibitions/queries';
import { exhibitionPhase, phaseNote } from '@/src/lib/exhibitions/status';
import { isStorageUrl } from '@/src/lib/uploads/buckets';

export const EX_CARD_SIZES = '(min-width: 1240px) 600px, (min-width: 640px) 50vw, 100vw';

// A cover with the dates; an upcoming exhibition has no link yet.
export function ExhibitionCardView({ card, today }: { card: ExhibitionCard; today: string }) {
  const phase = exhibitionPhase(card, today);
  const body = (
    <>
      <span className="ex-card-img">
        <Image src={card.coverUrl} alt="" fill sizes={EX_CARD_SIZES} unoptimized={!isStorageUrl(card.coverUrl)} />
      </span>
      <span className="ex-card-meta">
        <span className="ex-card-when">{phaseNote(card, phase)}</span>
        <span className="ex-card-t">{card.title}</span>
        {card.subtitle && <span className="ex-card-s">{card.subtitle}</span>}
      </span>
    </>
  );
  return phase === 'upcoming' ? (
    <div className="ex-card is-soon">{body}</div>
  ) : (
    <Link className="ex-card" href={`/exhibitions/${card.slug}`}>
      {body}
    </Link>
  );
}

export function ExhibitionGrid({ cards, today, big = false }: { cards: ExhibitionCard[]; today: string; big?: boolean }) {
  return (
    <ul className={big ? 'ex-grid big' : 'ex-grid'} role="list">
      {cards.map((c) => (
        <li key={c.id}>
          <ExhibitionCardView card={c} today={today} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: The room (client)**

```tsx
// src/components/exhibitions/exhibition-room.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { WallWork } from '@/src/lib/exhibitions/queries';
import type { LikeInfo } from '@/src/lib/likes/likes';
import { prefersReducedMotion } from '@/src/lib/sanat/reveal';
import { isStorageUrl } from '@/src/lib/uploads/buckets';
import { LikeButton } from '@/src/components/likes/like-button';
import { WorkLabel } from './work-label';

export type RoomWork = WallWork & { share: number; ratio: number };
export type RoomHall = { id: string; number: number; title: string; intro: ReactNode; wall: string | null; works: RoomWork[] };

const GUEST: LikeInfo = { count: 0, liked: false, state: 'guest' };

function Wall({ hall, onOpen }: { hall: RoomHall; onOpen: (id: string) => void }) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: -1 | 1) => {
    const t = track.current;
    if (t) t.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      scroll(e.key === 'ArrowLeft' ? -1 : 1);
    }
  };
  return (
    <div className="ex-wall">
      <button type="button" className="ex-arrow prev" onClick={() => scroll(-1)} aria-label="Листать стену назад">
        ←
      </button>
      <ul ref={track} className="ex-track" tabIndex={0} onKeyDown={onKey} aria-label={`Стена: зал ${hall.number}`}>
        {hall.works.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              className="ex-work"
              style={{ '--s': w.share, '--r': w.ratio } as React.CSSProperties}
              onClick={() => onOpen(w.id)}
              aria-label={`Открыть: ${w.title}, ${w.artistName}`}
            >
              <Image
                src={w.imageUrl}
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 90vw"
                unoptimized={!isStorageUrl(w.imageUrl)}
                draggable={false}
              />
            </button>
            <WorkLabel work={w} />
          </li>
        ))}
      </ul>
      <button type="button" className="ex-arrow next" onClick={() => scroll(1)} aria-label="Листать стену вперёд">
        →
      </button>
    </div>
  );
}

// All halls with their walls, and the work viewer. The open work lives in the
// address (?work=<id>), so it can be shared; Back and Escape close it.
export function ExhibitionRoom({ halls, likes }: { halls: RoomHall[]; likes: Record<string, LikeInfo> }) {
  const all = halls.flatMap((h) => h.works);
  const params = useSearchParams();
  const index = all.findIndex((w) => w.id === params.get('work'));
  const work = index >= 0 ? all[index] : undefined;
  const dialog = useRef<HTMLDialogElement>(null);
  // opened here (so Back undoes it) rather than arriving with ?work=
  const pushed = useRef(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (work && !d.open) d.showModal();
    if (!work && d.open) d.close();
  }, [work]);

  const urlWith = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('work', id);
    else url.searchParams.delete('work');
    return url;
  };
  const open = (id: string) => {
    window.history.pushState(null, '', urlWith(id));
    pushed.current = true;
  };
  const show = (id: string) => window.history.replaceState(null, '', urlWith(id));
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, '', urlWith(null));
  };

  return (
    <>
      {halls.map((h) => (
        <section
          key={h.id}
          className="ex-hall"
          style={h.wall ? ({ '--wall': h.wall } as React.CSSProperties) : undefined}
          aria-labelledby={`hall-${h.id}`}
        >
          <div className="wrap ex-hall-head">
            <p className="eyebrow">Зал {h.number}</p>
            <h2 id={`hall-${h.id}`}>{h.title}</h2>
            {h.intro}
          </div>
          <Wall hall={h} onOpen={open} />
        </section>
      ))}

      <dialog
        ref={dialog}
        className="ex-viewer"
        aria-label={work ? `${work.title}, ${work.artistName}` : 'Просмотр работы'}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {work && (
          <div className="ex-viewer-in">
            <button type="button" className="ex-viewer-x" onClick={close} aria-label="Закрыть">
              ×
            </button>
            <div className="ex-viewer-img" style={{ '--r': work.ratio } as React.CSSProperties}>
              <Image src={work.imageUrl} alt={`${work.title}, ${work.artistName}`} fill sizes="90vw" unoptimized={!isStorageUrl(work.imageUrl)} />
            </div>
            <div className="ex-viewer-side">
              <WorkLabel work={work} />
              <LikeButton artworkId={work.id} info={likes[work.id] ?? GUEST} />
              <Link className="btn wide" href={`/gallery/artwork/${work.id}`}>
                {work.status === 'sold' ? 'Подробнее' : 'Подробнее и купить'}
              </Link>
              <div className="ex-viewer-nav">
                <button type="button" className="btn ghost sm" disabled={index <= 0} onClick={() => show(all[index - 1].id)}>
                  ← Предыдущая
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={index >= all.length - 1}
                  onClick={() => show(all[index + 1].id)}
                >
                  Следующая →
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
```

`React.CSSProperties` — добавить `import type { CSSProperties } from 'react'` и писать `as CSSProperties`, если глобальный `React` не объявлен в проекте.

- [ ] **Step 4: The page view (server)**

```tsx
// src/components/exhibitions/exhibition-view.tsx
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import type { ExhibitionCard, ExhibitionViewData } from '@/src/lib/exhibitions/queries';
import { WALL_COLORS, type WallColor } from '@/src/lib/exhibitions/exhibition-form';
import { exhibitionPhase } from '@/src/lib/exhibitions/status';
import { wallShares, workRatio } from '@/src/lib/exhibitions/wall-scale';
import { dateRange } from '@/src/lib/journal/post-form';
import type { LikeInfo } from '@/src/lib/likes/likes';
import { isStorageUrl } from '@/src/lib/uploads/buckets';
import { MarkdownBody } from '@/src/components/journal/markdown-body';
import { ExhibitionGrid } from './exhibition-card';
import { ExhibitionRoom, type RoomHall } from './exhibition-room';

// The entrance, the curator's text, the halls, the artists and other exhibitions.
export function ExhibitionView({
  view,
  today,
  likes,
  others,
  preview = false,
}: {
  view: ExhibitionViewData;
  today: string;
  likes: Record<string, LikeInfo>;
  others: ExhibitionCard[];
  preview?: boolean;
}) {
  const ex = view.exhibition;
  const phase = exhibitionPhase(ex, today);
  const halls: RoomHall[] = view.halls.map((h, i) => {
    const shares = wallShares(h.works.map((w) => w.heightCm));
    return {
      id: h.id,
      number: i + 1,
      title: h.title,
      intro: h.intro ? <MarkdownBody source={h.intro} /> : null,
      wall: h.wallColor && h.wallColor in WALL_COLORS ? WALL_COLORS[h.wallColor as WallColor].value : null,
      works: h.works.map((w, j) => ({ ...w, share: shares[j], ratio: workRatio(w) })),
    };
  });

  return (
    <main className="ex">
      {preview && <p className="ex-flag">Предпросмотр: так выставку увидят посетители</p>}
      {phase === 'closed' && <p className="ex-flag">Выставка завершилась {dateRange(ex.endsOn)}</p>}
      <header className="ex-hero">
        <Image src={ex.coverUrl} alt="" fill priority sizes="100vw" unoptimized={!isStorageUrl(ex.coverUrl)} className="pimg" />
        <div className="ex-hero-body wrap">
          <p className="eyebrow">Онлайн-выставка · {dateRange(ex.startsOn, ex.endsOn, true)}</p>
          <h1 className="t">{ex.title}</h1>
          {ex.subtitle && <p className="ex-sub">{ex.subtitle}</p>}
          {ex.curatorName && <p className="ex-cur">Куратор: {ex.curatorName}</p>}
          {halls.length > 0 && (
            <a className="btn" href="#enter">
              Войти в выставку ↓
            </a>
          )}
        </div>
      </header>

      <div id="enter" className="wrap stack pg">
        {ex.intro && <MarkdownBody source={ex.intro} />}
        {halls.length === 0 && <p className="empty">Экспозиция обновляется. Загляните чуть позже.</p>}
      </div>

      <Suspense>
        <ExhibitionRoom halls={halls} likes={likes} />
      </Suspense>

      <div className="wrap stack pg">
        {view.artists.length > 0 && (
          <section className="sec" aria-labelledby="ex-artists-t">
            <h2 id="ex-artists-t">Художники выставки</h2>
            <ul className="ex-artists" role="list">
              {view.artists.map((a) => (
                <li key={a.id}>
                  <Link href={`/gallery/artist/${a.id}`}>{a.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {others.length > 0 && (
          <section className="sec" aria-labelledby="ex-others-t">
            <div className="sec-head">
              <h2 id="ex-others-t">Другие выставки</h2>
              <Link className="more" href="/exhibitions">
                Все выставки
              </Link>
            </div>
            <ExhibitionGrid cards={others} today={today} />
          </section>
        )}
      </div>
    </main>
  );
}
```

Аватары художников (`avatarUrl`) выводить через существующий `src/components/user-avatar.tsx`, если его пропсы подходят (проверить файл); иначе только имя — это допустимо для v1.

- [ ] **Step 5: Styles**

Создать `src/styles/exhibitions.css` и подключить в `app/globals.css` строкой `@import '../src/styles/exhibitions.css';` сразу после `site.css`.

```css
/* Online exhibitions: the entrance, walls in scale, labels and the viewer. */
@layer components {
  .ex-flag {
    background: var(--ink);
    color: var(--background);
    text-align: center;
    padding: 10px 16px;
    font-size: 0.9rem;
  }

  .ex-hero {
    position: relative;
    min-height: 82svh;
    display: grid;
    align-items: end;
    color: #fff;
    overflow: hidden;
  }
  .ex-hero .pimg {
    object-fit: cover;
  }
  .ex-hero::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgb(0 0 0 / 0.7), rgb(0 0 0 / 0) 65%);
  }
  .ex-hero-body {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 10px;
    padding-bottom: 48px;
  }
  .ex-hero .eyebrow,
  .ex-sub,
  .ex-cur {
    color: rgb(255 255 255 / 0.88);
  }

  .ex-hall {
    background: var(--wall, var(--background));
    padding: 56px 0 40px;
  }
  .ex-hall-head {
    max-width: 68ch;
    display: grid;
    gap: 8px;
  }

  .ex-wall {
    position: relative;
  }
  .ex-track {
    --wall-h: min(60vh, 560px);
    display: flex;
    align-items: center;
    gap: clamp(32px, 6vw, 96px);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 32px max(16px, calc((100vw - 1180px) / 2)) 12px;
    list-style: none;
    scrollbar-width: thin;
  }
  .ex-track:focus-visible {
    outline: 2px solid var(--sage);
    outline-offset: -2px;
  }
  .ex-track > li {
    flex: none;
    scroll-snap-align: center;
    display: grid;
    justify-items: center;
    gap: 14px;
  }
  .ex-work {
    position: relative;
    display: block;
    height: min(calc(var(--wall-h) * var(--s)), calc(80vw / var(--r)));
    aspect-ratio: var(--r);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
    cursor: zoom-in;
    background: #fff;
  }
  .ex-work img {
    object-fit: contain;
  }
  .ex-arrow {
    position: absolute;
    top: 45%;
    z-index: 1;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .ex-arrow.prev {
    left: 12px;
  }
  .ex-arrow.next {
    right: 12px;
  }

  .ex-label {
    max-width: 28ch;
    text-align: left;
    font-size: 0.9rem;
    line-height: 1.4;
    justify-self: start;
  }
  .ex-label-t {
    font-weight: 700;
  }
  .ex-label-m,
  .ex-label-n {
    color: var(--mute);
  }
  .ex-label-p {
    margin-top: 4px;
  }
  .ex-label-n {
    margin-top: 6px;
    font-style: italic;
  }

  .ex-viewer {
    width: min(1180px, 100vw - 32px);
    max-height: calc(100svh - 32px);
    padding: 0;
    border: 0;
    background: var(--background);
  }
  .ex-viewer::backdrop {
    background: rgb(0 0 0 / 0.75);
  }
  .ex-viewer-in {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 24px;
    padding: 24px;
  }
  .ex-viewer-img {
    position: relative;
    aspect-ratio: var(--r);
    max-height: calc(100svh - 96px);
    width: 100%;
  }
  .ex-viewer-img img {
    object-fit: contain;
  }
  .ex-viewer-side {
    display: grid;
    align-content: start;
    gap: 16px;
  }
  .ex-viewer-x {
    position: absolute;
    top: 8px;
    right: 12px;
    width: 44px;
    height: 44px;
    font-size: 1.6rem;
  }
  .ex-viewer-nav {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ex-grid {
    display: grid;
    gap: 24px;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    list-style: none;
  }
  .ex-grid.big {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr));
  }
  .ex-card {
    display: grid;
    gap: 10px;
  }
  .ex-card-img {
    position: relative;
    display: block;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--secondary);
  }
  .ex-card-img img {
    object-fit: cover;
  }
  .ex-card-meta {
    display: grid;
    gap: 2px;
  }
  .ex-card-when {
    font-size: 0.85rem;
    color: var(--mute);
  }
  .ex-card-t {
    font-family: var(--serif);
    font-size: 1.5rem;
  }
  .ex-card.is-soon .ex-card-img {
    opacity: 0.85;
  }
  .ex-artists {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    list-style: none;
  }

  @media (max-width: 767px) {
    .ex-track {
      --wall-h: 70svh;
      flex-direction: column;
      overflow: visible;
      scroll-snap-type: none;
      padding: 24px 16px 8px;
    }
    .ex-work {
      height: auto;
      width: min(100%, calc(var(--wall-h) * var(--s) * var(--r)));
    }
    .ex-arrow {
      display: none;
    }
    .ex-viewer-in {
      grid-template-columns: 1fr;
      padding: 16px;
    }
  }
}
```

- [ ] **Step 6: Routes**

```tsx
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
```

```tsx
// app/admin/exhibitions/[id]/preview/page.tsx
import { notFound } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { isUuid } from '@/src/lib/gallery/types';
import { getExhibitionPreview } from '@/src/lib/exhibitions/queries';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { ExhibitionView } from '@/src/components/exhibitions/exhibition-view';

export const metadata = { title: 'Предпросмотр выставки', robots: { index: false } };

export default async function ExhibitionPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('admin');
  const { id } = await params;
  const view = isUuid(id) ? await getExhibitionPreview(getDb(), id) : undefined;
  if (!view) notFound();
  return <ExhibitionView view={view} today={todayInDushanbe()} likes={{}} others={[]} preview />;
}
```

- [ ] **Step 7: Run tests and checks**

Run: `npm run test:unit -- tests/unit/exhibitions.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, без ошибок типов и линтера.
Вручную (`npm run dev`): опубликовать выставку с датой открытия сегодня, открыть `/exhibitions/<slug>` на десктопе (стрелки, ←/→ на фокусированной стене, клик → просмотр, «Следующая →», Esc, «назад» в браузере) и в DevTools на ширине 375px (работы вертикально, маленькая меньше большой).

- [ ] **Step 8: Commit**

```bash
git add src/components/exhibitions src/styles/exhibitions.css app/globals.css app/exhibitions app/admin/exhibitions/[id]/preview tests/unit/exhibitions.test.ts
git commit -m "feat: exhibition page with walls in scale and a work viewer"
```

---

### Task 8: Список выставок и навигация

**Files:**
- Create: `app/exhibitions/page.tsx`
- Modify: `src/components/sanat/burger-menu.tsx` (`ITEMS`)
- Modify: `src/components/site-footer.tsx`

**Interfaces:**
- Consumes: `listPublishedExhibitions` (Task 4); `exhibitionPhase` (Task 2); `ExhibitionGrid` (Task 7).
- Produces: маршрут `/exhibitions`.

- [ ] **Step 1: The list page**

```tsx
// app/exhibitions/page.tsx
import { unstable_cache } from 'next/cache';
import { getDb } from '@/src/db';
import { listPublishedExhibitions } from '@/src/lib/exhibitions/queries';
import { exhibitionPhase } from '@/src/lib/exhibitions/status';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { pagePreview } from '@/src/lib/seo';
import { ExhibitionGrid } from '@/src/components/exhibitions/exhibition-card';

const DESCRIPTION = 'Онлайн-выставки: кураторские подборки работ художников, которые можно посмотреть и купить.';
export const metadata = { title: 'Выставки', description: DESCRIPTION, ...pagePreview({ title: 'Выставки', description: DESCRIPTION }) };

const cachedList = unstable_cache(() => listPublishedExhibitions(getDb()), ['exhibitions-list'], {
  revalidate: 60,
  tags: ['exhibitions'],
});

export default async function ExhibitionsPage() {
  const today = todayInDushanbe();
  const all = await cachedList();
  const by = (phase: string) => all.filter((e) => exhibitionPhase(e, today) === phase);
  const [open, soon, past] = [by('open'), by('upcoming').reverse(), by('closed')];

  return (
    <main>
      <div className="wrap stack pg">
        <header>
          <h1 className="t">Выставки</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">{DESCRIPTION}</p>
        </header>
        {all.length === 0 && <p className="empty">Скоро здесь откроется первая выставка.</p>}
        {open.length > 0 && (
          <section className="sec" aria-labelledby="ex-open-t">
            <h2 id="ex-open-t">Сейчас идёт</h2>
            <ExhibitionGrid cards={open} today={today} big />
          </section>
        )}
        {soon.length > 0 && (
          <section className="sec" aria-labelledby="ex-soon-t">
            <h2 id="ex-soon-t">Скоро</h2>
            <ExhibitionGrid cards={soon} today={today} />
          </section>
        )}
        {past.length > 0 && (
          <section className="sec" aria-labelledby="ex-past-t">
            <h2 id="ex-past-t">Прошедшие</h2>
            <ExhibitionGrid cards={past} today={today} />
          </section>
        )}
      </div>
    </main>
  );
}
```

Сверить сигнатуру `pagePreview` в `src/lib/seo.ts` (поле `image` может быть обязательным; если да — передать логотип так же, как это делает `app/journal/page.tsx`).

- [ ] **Step 2: Menu and footer**

```ts
// src/components/sanat/burger-menu.tsx — ITEMS
  { href: '/artists', label: 'Художники', current: (p) => under('/artists')(p) || p.startsWith('/gallery/artist/') },
  { href: '/exhibitions', label: 'Выставки', current: under('/exhibitions') },
  { href: '/journal', label: 'Афиша', current: under('/journal') },
```

```tsx
// src/components/site-footer.tsx — «Покупателям», после «Художники»
            <Link href="/exhibitions">Выставки</Link>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Вручную: `/exhibitions` показывает блоки; «скоро» без ссылки; пункт «Выставки» в меню подсвечен на `/exhibitions/...`.

- [ ] **Step 4: Commit**

```bash
git add app/exhibitions/page.tsx src/components/sanat/burger-menu.tsx src/components/site-footer.tsx
git commit -m "feat: exhibitions list and menu link"
```

---

### Task 9: Связи — главная, журнал, карточка работы, sitemap

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/journal/[slug]/page.tsx`
- Modify: `app/gallery/artwork/[id]/page.tsx`
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: `getOpenExhibitionForHome`, `getExhibitionLinkForPost`, `listOpenExhibitionsWithArtwork`, `listSitemapExhibitions` (Task 4); `ExhibitionCardView` (Task 7).

- [ ] **Step 1: Home page block**

В `app/page.tsx`:

```ts
import { getOpenExhibitionForHome, type ExhibitionCard } from '@/src/lib/exhibitions/queries';
import { ExhibitionCardView } from '@/src/components/exhibitions/exhibition-card';

const openExhibition = unstable_cache((today: string) => getOpenExhibitionForHome(getDb(), today), ['home-exhibition'], {
  revalidate: 60,
  tags: ['exhibitions'],
});
```

Добавить `openExhibition(today)` четвёртым элементом в `Promise.allSettled([...])`, разобрать как остальные:

```ts
  let exhibition: ExhibitionCard | undefined;
  // ...
  if (onShow.status === 'fulfilled') exhibition = onShow.value;
  else console.error('home: failed to load the open exhibition', onShow.reason);
```

И перед секцией «Афиша»:

```tsx
        {exhibition && (
          <section className="sec" aria-labelledby="home-ex-t">
            <div className="sec-head">
              <h2 id="home-ex-t">Сейчас на выставке</h2>
              <Link className="more" href="/exhibitions">
                Все выставки
              </Link>
            </div>
            <ExhibitionCardView card={exhibition} today={today} />
          </section>
        )}
```

- [ ] **Step 2: Journal post button**

В `app/journal/[slug]/page.tsx` после `listRelatedPosts`:

```ts
  const online = await getExhibitionLinkForPost(getDb(), post.id, today).catch(() => undefined);
```

и в `.post-main` первым элементом:

```tsx
              {online && (
                <p>
                  <Link className="btn" href={`/exhibitions/${online.slug}`}>
                    Смотреть онлайн-выставку
                  </Link>
                </p>
              )}
```

- [ ] **Step 3: Artwork badge**

В `app/gallery/artwork/[id]/page.tsx` после `moreByArtist`:

```ts
  const shows = await listOpenExhibitionsWithArtwork(getDb(), artwork.id, todayInDushanbe()).catch(() => []);
```

и после `<p className="by">…</p>`:

```tsx
            {shows.map((s) => (
              <p key={s.slug} className="ex-badge">
                Участвует в выставке <Link href={`/exhibitions/${s.slug}`}>«{s.title}»</Link>
              </p>
            ))}
```

В `src/styles/exhibitions.css` (внутри `@layer components`):

```css
  .ex-badge {
    font-size: 0.9rem;
    color: var(--mute);
  }
  .ex-badge a {
    color: var(--sage);
    text-decoration: underline;
  }
```

- [ ] **Step 4: Sitemap**

```ts
// app/sitemap.ts
import { listSitemapExhibitions } from '@/src/lib/exhibitions/queries';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
// ...
  const [{ works, artists }, posts, shows] = await Promise.all([
    listSitemapEntries(getDb()),
    listSitemapPosts(getDb()),
    listSitemapExhibitions(getDb(), todayInDushanbe()),
  ]);
// в массив, после /journal:
    { url: `${base}/exhibitions`, changeFrequency: 'weekly', priority: 0.7 },
    ...shows.map((s) => ({
      url: `${base}/exhibitions/${s.slug}`,
      lastModified: date(s.changedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: всё зелёное (весь набор unit + integration).
Вручную: главная показывает «Сейчас на выставке» только при открытой выставке; карточка работы с выставки — плашка; пост-анонс — кнопка; `/sitemap.xml` содержит `/exhibitions/...`.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/journal/[slug]/page.tsx app/gallery/artwork/[id]/page.tsx app/sitemap.ts src/styles/exhibitions.css
git commit -m "feat: exhibitions on the home page, in the journal, on artworks and in the sitemap"
```

---

### Task 10: E2E

**Files:**
- Create: `tests/e2e/exhibitions.spec.ts`

**Interfaces:**
- Consumes: `signInAsStaff` (`tests/e2e/helpers/auth.ts`); таблицы и `saveExhibition`, `addHall`, `addWork` (Task 3) для засева; `dropImages`, `POSTS_BUCKET`.

- [ ] **Step 1: Write the tests**

```ts
// tests/e2e/exhibitions.spec.ts
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { eq, like } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { artworks, categories, exhibitions, sellerApplications, techniques, users } from '../../src/db/schema';
import { addHall, addWork, saveExhibition } from '../../src/lib/exhibitions/admin';
import { POSTS_BUCKET } from '../../src/lib/uploads/buckets';
import { dropImages } from '../../src/lib/uploads/upload-image';
import { testTelegramId } from '../helpers/test-telegram-id';
import { signInAsStaff } from './helpers/auth';

const PREFIX = 'e2e-ex-';
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const stamp = Date.now();

let sellerId: string;
let categoryId: string;
let techniqueId: string;
const works: { id: string; title: string }[] = [];

test.beforeAll(async () => {
  const [seller] = await getDb()
    .insert(users)
    .values({ telegramId: testTelegramId(`e2e_ex_${stamp}`), fullName: 'E2E Ex Seller', role: 'seller' })
    .returning();
  sellerId = seller.id;
  await getDb().insert(sellerApplications).values({
    userId: seller.id,
    displayName: `E2E Художник ${stamp}`,
    bio: 'Био.',
    telegramContact: '@e2e_ex',
    status: 'approved',
  });
  categoryId = (await getDb().insert(categories).values({ name: `E2E кат ${stamp}` }).returning())[0].id;
  techniqueId = (await getDb().insert(techniques).values({ name: `E2E тех ${stamp}` }).returning())[0].id;
  for (const [title, h] of [[`Большая гора ${stamp}`, 150], [`Маленький этюд ${stamp}`, 20]] as const) {
    const [row] = await getDb()
      .insert(artworks)
      .values({
        sellerId,
        title,
        description: 'Описание.',
        price: 2500,
        heightCm: h,
        widthCm: 100,
        categoryId,
        techniqueId,
        imageUrl: 'https://example.com/e2e-ex.jpg',
        status: 'published',
      })
      .returning();
    works.push({ id: row.id, title });
  }
});

test.afterAll(async () => {
  const gone = await getDb().delete(exhibitions).where(like(exhibitions.slug, `${PREFIX}%`)).returning();
  await dropImages(POSTS_BUCKET, gone.map((e) => e.coverUrl).filter((u) => !u.includes('example.com')));
  await getDb().delete(artworks).where(eq(artworks.sellerId, sellerId));
  await getDb().delete(sellerApplications).where(eq(sellerApplications.userId, sellerId));
  await getDb().delete(users).where(eq(users.id, sellerId));
  await getDb().delete(categories).where(eq(categories.id, categoryId));
  await getDb().delete(techniques).where(eq(techniques.id, techniqueId));
});

test('the admin builds an exhibition and a visitor walks through it', async ({ page }) => {
  const slug = `${PREFIX}gory-${stamp}`;
  const title = `E2E Горы ${stamp}`;
  const cover = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#617f6c' } }).jpeg().toBuffer();

  await signInAsStaff(page, 'admin');
  await page.goto('/admin/exhibitions/new');
  await page.getByLabel('Название', { exact: true }).fill(title);
  await page.getByLabel('Адрес страницы').fill(slug);
  await page.getByLabel('Дата открытия').fill(inDays(0));
  await page.getByLabel('Дата закрытия').fill(inDays(10));
  await page.getByLabel('Обложка').setInputFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: cover });
  await page.getByLabel('Кураторский текст').fill('Горы как характер.');
  await page.getByRole('button', { name: 'Создать выставку' }).click();
  await expect(page.getByText('Сохранено.')).toBeVisible({ timeout: 20000 });
  const adminUrl = page.url().split('?')[0];

  // a hall, two works found in the catalog
  await page.getByLabel('Название зала').fill('Вершины');
  await page.getByRole('button', { name: 'Добавить зал' }).click();
  await expect(page.getByRole('heading', { name: 'Зал 1. Вершины' })).toBeVisible();
  for (const w of works) {
    await page.getByLabel('Найти работу для зала «Вершины»').fill(w.title);
    await page.getByRole('button', { name: 'Найти' }).click();
    await page.getByRole('button', { name: `Добавить: ${w.title}` }).click();
    await expect(page.getByRole('button', { name: `Убрать: ${w.title}` })).toBeVisible();
  }
  // the same work twice is refused
  await page.getByLabel('Найти работу для зала «Вершины»').fill(works[0].title);
  await page.getByRole('button', { name: 'Найти' }).click();
  await page.getByRole('button', { name: `Добавить: ${works[0].title}` }).click();
  await expect(page.getByText('Эта работа уже есть на выставке.')).toBeVisible();

  // a draft is not public
  await page.context().clearCookies();
  expect((await page.goto(`/exhibitions/${slug}`))?.status()).toBe(404);
  await signInAsStaff(page, 'admin');
  await page.goto(adminUrl);
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByRole('button', { name: 'Снять с публикации' })).toBeVisible();

  // the visitor
  await page.context().clearCookies();
  await page.goto('/exhibitions');
  await page.getByRole('link', { name: new RegExp(title) }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Вершины' })).toBeVisible();

  // the big canvas hangs taller than the study
  const big = page.getByRole('button', { name: new RegExp(`Открыть: ${works[0].title}`) });
  const small = page.getByRole('button', { name: new RegExp(`Открыть: ${works[1].title}`) });
  const [hb, hs] = [(await big.boundingBox())!.height, (await small.boundingBox())!.height];
  expect(hb).toBeGreaterThan(hs * 2);

  await big.click();
  await expect(page).toHaveURL(new RegExp(`work=${works[0].id}`));
  const viewer = page.getByRole('dialog');
  await expect(viewer.getByText('2500 TJS')).toBeVisible();
  await viewer.getByRole('button', { name: 'Следующая →' }).click();
  await expect(page).toHaveURL(new RegExp(`work=${works[1].id}`));
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();

  // a shared link opens the work; a stranger's id opens nothing
  await page.goto(`/exhibitions/${slug}?work=${works[1].id}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goto(`/exhibitions/${slug}?work=00000000-0000-4000-8000-000000000000`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();

  // through to the artwork page
  await page.goto(`/exhibitions/${slug}?work=${works[0].id}`);
  await page.getByRole('dialog').getByRole('link', { name: 'Подробнее и купить' }).click();
  await expect(page).toHaveURL(new RegExp(`/gallery/artwork/${works[0].id}`));
  await expect(page.getByText(`Участвует в выставке «${title}»`)).toBeVisible();
});

test('a closed exhibition stays open to visitors with a notice; an upcoming one is listed but closed', async ({ page }) => {
  const closed = await saveExhibition(getDb(), null, {
    title: `E2E Прошлая ${stamp}`,
    slug: `${PREFIX}past-${stamp}`,
    subtitle: null,
    curatorName: null,
    intro: null,
    startsOn: inDays(-30),
    endsOn: inDays(-2),
    postId: null,
    coverUrl: 'https://example.com/e2e-ex-cover.jpg',
    status: 'published',
  });
  const soon = await saveExhibition(getDb(), null, {
    title: `E2E Будущая ${stamp}`,
    slug: `${PREFIX}soon-${stamp}`,
    subtitle: null,
    curatorName: null,
    intro: null,
    startsOn: inDays(5),
    endsOn: inDays(20),
    postId: null,
    coverUrl: 'https://example.com/e2e-ex-cover.jpg',
    status: 'published',
  });
  if (!closed.ok || !soon.ok) throw new Error('seed failed');
  const hall = await addHall(getDb(), closed.id, { title: 'Архив', intro: null, wallColor: 'stone' });
  if (!hall.ok) throw new Error('seed failed');
  await addWork(getDb(), hall.id, works[0].id);

  await page.goto(`/exhibitions/${closed.slug}`);
  await expect(page.getByText(/Выставка завершилась/)).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`Открыть: ${works[0].title}`) })).toBeVisible();

  await page.goto('/exhibitions');
  await expect(page.getByText(`E2E Будущая ${stamp}`)).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(`E2E Будущая ${stamp}`) })).toHaveCount(0);
  expect((await page.goto(`/exhibitions/${soon.slug}`))?.status()).toBe(404);
});
```

`https://example.com/...` в `imageUrl`/`coverUrl` рендерится с `unoptimized` (не storage URL), поэтому `next/image` не требует remotePatterns для example.com. Если `next.config.ts` всё же падает на неизвестном хосте — посмотреть, как это решено в `tests/e2e/public-gallery-detail-pages.spec.ts`, и сделать так же.

- [ ] **Step 2: Run e2e**

Run: `npm run test:e2e -- tests/e2e/exhibitions.spec.ts`
Expected: 2 passed. При падении — смотреть `test-results/`, чинить код, а не ослаблять проверки.

- [ ] **Step 3: Full suite**

Run: `npm run test:unit && npm run test:e2e && npm run build`
Expected: всё зелёное, сборка проходит.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/exhibitions.spec.ts
git commit -m "test: e2e for building and visiting an online exhibition"
```

---

## Порядок и зависимости

```
Task 1 (схема) → Task 2 (чистые функции) → Task 3 (admin data) → Task 4 (public queries)
   → Task 5 (админка: форма) → Task 6 (админка: залы)
   → Task 7 (страница) → Task 8 (список, меню) → Task 9 (связи) → Task 10 (e2e)
```

Task 2 не зависит от Task 1 и может идти параллельно. Task 5–6 и Task 7–8 зависят только от Task 3–4 и могут идти в любом порядке, но preview-страница (Task 7, Step 6) нужна кнопке из Task 5.
