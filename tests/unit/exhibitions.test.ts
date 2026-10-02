import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExhibitionView } from '../../src/components/exhibitions/exhibition-view';
import { exhibitionPhase, phaseNote } from '../../src/lib/exhibitions/status';
import { MIN_SHARE, wallShares, workRatio } from '../../src/lib/exhibitions/wall-scale';
import { roomLayout, type Hung, type RoomLayout } from '../../src/lib/exhibitions/room-layout';
import { parseExhibitionForm, parseHallForm, parseWorkNote, isExhibitionErrorCode } from '../../src/lib/exhibitions/exhibition-form';
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
  it('says the exposition is being updated when no work is left', () => {
    const html = renderToStaticMarkup(createElement(ExhibitionView, { view: base, today: '2026-11-10', likes: {}, others: [] }));
    expect(html).toContain('Экспозиция обновляется');
  });
  it('marks a closed exhibition', () => {
    const html = renderToStaticMarkup(createElement(ExhibitionView, { view: base, today: '2026-12-02', likes: {}, others: [] }));
    expect(html).toContain('Выставка завершилась 30 ноября');
  });
});

describe('roomLayout', () => {
  const works = (n: number, heightCm = 80, ratio = 0.8) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, heightCm, ratio }));
  // which wall a work hangs on, and where along it
  const onSideWall = (h: Hung) => Math.abs(Math.abs(h.rotY) - Math.PI / 2) < 0.01;
  const along = (h: Hung) => (onSideWall(h) ? h.z : h.x);

  it('a few works fit the smallest room, on the far wall, in real size', () => {
    const l = roomLayout(works(2, 150, 2 / 3));
    expect([l.width, l.depth]).toEqual([7, 5]);
    expect(l.works.map((w) => w.id)).toEqual(['w0', 'w1']);
    expect(l.works.every((w) => w.z < -2.4 && w.rotY === 0)).toBe(true);
    expect(l.works[0].h).toBeCloseTo(1.5);
    expect(l.works[0].w).toBeCloseTo(1);
  });

  it('many works grow the room; none overlap or leave their wall, and the visitor stands inside', () => {
    const many = [...works(25), ...works(5, 200, 1.5)].map((w, i) => ({ ...w, id: `w${i}` }));
    const l: RoomLayout = roomLayout(many);
    expect(l.width).toBeGreaterThan(7);
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
    expect(roomLayout([])).toMatchObject({ width: 7, depth: 5, works: [] });
  });
});
