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
