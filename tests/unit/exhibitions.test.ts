import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExhibitionView } from '../../src/components/exhibitions/exhibition-view';
import { exhibitionPhase, phaseNote } from '../../src/lib/exhibitions/status';
import { workRatio } from '../../src/lib/exhibitions/wall-scale';
import { hallIndex } from '../../src/lib/exhibitions/hall-data';
import { roomLayout, type Hung, type RoomLayout } from '../../src/lib/exhibitions/room-layout';
import { parseExhibitionForm, parseHallForm, parseWorkNote, isExhibitionErrorCode } from '../../src/lib/exhibitions/exhibition-form';
import { exhibitionAsCard, mergeAfisha } from '../../src/lib/journal/afisha';
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

describe('hallIndex', () => {
  it('reads ?hall=N as a 1-based hall, else the first', () => {
    expect(hallIndex('2', 3)).toBe(1);
    expect(hallIndex(['3'], 3)).toBe(2);
    expect(hallIndex('4', 3)).toBe(0);
    expect(hallIndex('0', 3)).toBe(0);
    expect(hallIndex('1.5', 3)).toBe(0);
    expect(hallIndex(undefined, 3)).toBe(0);
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
  it('refuses impossible dates and accepts a leap day', () => {
    expect(parseExhibitionForm(form({ ...ok, startsOn: '2026-02-30' }))).toEqual({ ok: false, error: 'dates' });
    expect(parseExhibitionForm(form({ ...ok, startsOn: '2026-13-45' }))).toEqual({ ok: false, error: 'dates' });
    expect(parseExhibitionForm(form({ ...ok, startsOn: '2028-02-29', endsOn: '2028-03-01' })).ok).toBe(true);
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
  it('rejects prototype keys in wallColor', () => {
    expect(parseHallForm(form({ title: 'Горы', wallColor: 'constructor' }))).toEqual({ ok: false, error: 'wall' });
  });
});

describe('isExhibitionErrorCode', () => {
  it('rejects prototype keys', () => {
    expect(isExhibitionErrorCode('toString')).toBe(false);
  });
  it('accepts valid error codes', () => {
    expect(isExhibitionErrorCode('dates')).toBe(true);
  });
  it('rejects undefined and other types', () => {
    expect(isExhibitionErrorCode(undefined)).toBe(false);
  });
});

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
  it('leads into the 3D halls, one link per hall', () => {
    const hall = { id: 'h1', title: 'Вершины', intro: null, wallColor: null, works: [] };
    const html = renderToStaticMarkup(
      createElement(ExhibitionView, { view: { ...base, halls: [hall, { ...hall, id: 'h2', title: 'Долины' }] }, today: '2026-11-10', others: [], hallHref: '/exhibitions/gory/hall' }),
    );
    expect(html).toContain('href="/exhibitions/gory/hall"');
    expect(html).toContain('href="/exhibitions/gory/hall?hall=2"');
    expect(html).toContain('Долины');
  });
  it('says the exposition is being updated when no work is left', () => {
    const html = renderToStaticMarkup(createElement(ExhibitionView, { view: base, today: '2026-11-10', others: [], hallHref: '/exhibitions/gory/hall' }));
    expect(html).toContain('Экспозиция обновляется');
  });
  it('marks a closed exhibition', () => {
    const html = renderToStaticMarkup(createElement(ExhibitionView, { view: base, today: '2026-12-02', others: [], hallHref: '/exhibitions/gory/hall' }));
    expect(html).toContain('Выставка завершилась 30 ноября');
  });
});

describe('roomLayout', () => {
  const works = (n: number, heightCm = 80, ratio = 0.8) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, heightCm, ratio }));
  // which wall a work hangs on, and where along it
  const onSideWall = (h: Hung) => Math.abs(Math.abs(h.rotY) - Math.PI / 2) < 0.01;
  const along = (h: Hung) => (onSideWall(h) ? h.z : h.x);

  it('a few works fit the smallest room (10 × 7 m), on the far wall, in real size', () => {
    const l = roomLayout(works(2, 150, 2 / 3));
    expect([l.width, l.depth]).toEqual([10, 7]);
    expect(l.works.map((w) => w.id)).toEqual(['w0', 'w1']);
    expect(l.works.every((w) => w.z < -3.4 && w.rotY === 0)).toBe(true);
    expect(l.works[0].h).toBeCloseTo(1.5);
    expect(l.works[0].w).toBeCloseTo(1);
  });

  it('many works grow the room; none overlap or leave their wall, and the visitor stands inside', () => {
    const many = [...works(25), ...works(5, 200, 1.5)].map((w, i) => ({ ...w, id: `w${i}` }));
    const l: RoomLayout = roomLayout(many);
    expect(l.width).toBeGreaterThan(10);
    expect(l.works.map((w) => w.id)).toEqual(many.map((w) => w.id));
    const byWall = new Map<string, Hung[]>();
    for (const h of l.works) byWall.set(h.rotY.toFixed(2), [...(byWall.get(h.rotY.toFixed(2)) ?? []), h]);
    for (const hung of byWall.values()) {
      const len = onSideWall(hung[0]) ? l.depth : l.width;
      const spans = hung.map((h) => [along(h) - h.w / 2, along(h) + h.w / 2]).sort((a, b) => a[0] - b[0]);
      expect(spans[0][0]).toBeGreaterThanOrEqual(-len / 2);
      expect(spans.at(-1)![1]).toBeLessThanOrEqual(len / 2);
      for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThan(spans[i - 1][1]);
    }
    for (const h of l.works) {
      expect(Math.abs(h.standX)).toBeLessThanOrEqual(l.width / 2);
      expect(Math.abs(h.standZ)).toBeLessThanOrEqual(l.depth / 2);
      expect(h.y + h.h / 2).toBeLessThan(l.height);
    }
  });

  it('an empty hall is the smallest room', () => {
    expect(roomLayout([])).toMatchObject({ width: 10, depth: 7, works: [] });
  });
});

describe('online exhibitions in the journal', () => {
  const show = { id: 'e1', slug: 'gory', title: 'Горы', subtitle: 'Живопись', coverUrl: 'https://example.com/c.jpg', status: 'published' as const };
  const post = (id: string, day: string) => ({
    id,
    slug: id,
    category: 'news' as const,
    title: id,
    excerpt: null,
    coverUrl: 'https://example.com/p.jpg',
    startsOn: null,
    endsOn: null,
    place: null,
    publishedAt: new Date(`${day}T10:00:00+05:00`),
  });

  it('an open one links to its page, an upcoming one has no link yet', () => {
    const open = exhibitionAsCard({ ...show, startsOn: '2026-11-01', endsOn: '2026-11-30' }, '2026-11-10');
    expect(open).toMatchObject({ href: '/exhibitions/gory', tag: 'Онлайн-выставка', category: 'exhibition', excerpt: 'Живопись' });
    expect(open.when).toBeUndefined();
    const soon = exhibitionAsCard({ ...show, startsOn: '2026-11-01', endsOn: '2026-11-30' }, '2026-10-20');
    expect(soon.href).toBeNull();
    expect(soon.when).toBe('Скоро · 1 – 30 ноября');
  });

  it('stands among the posts by its first day, within the limit', () => {
    const posts = [post('new', '2026-11-05'), post('old', '2026-10-01')];
    const shows = [{ ...show, startsOn: '2026-11-01', endsOn: '2026-11-30' }];
    expect(mergeAfisha(posts, shows, '2026-11-10', 12).map((c) => c.id)).toEqual(['new', 'e1', 'old']);
    expect(mergeAfisha(posts, shows, '2026-11-10', 2).map((c) => c.id)).toEqual(['new', 'e1']);
    expect(mergeAfisha(posts, [], '2026-11-10', 12)).toBe(posts);
  });
});
