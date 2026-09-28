import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  dateRange,
  isOver,
  isSlug,
  parsePostForm,
  publishedDate,
  slugify,
  todayInDushanbe,
} from '../../src/lib/journal/post-form';
import { MarkdownBody } from '../../src/components/journal/markdown-body';

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('slugify', () => {
  it('transliterates Russian and Tajik titles into an address', () => {
    expect(slugify('Свет и цвет: импрессионисты')).toBe('svet-i-tsvet-impressionisty');
    expect(slugify('Мастер-класс «Акварель для начинающих»')).toBe('master-klass-akvarel-dlya-nachinayuschih');
    expect(slugify('Ҳунари Ҷаҳон 2026')).toBe('hunari-jahon-2026');
  });
  it('gives a valid slug or an empty string', () => {
    expect(isSlug(slugify('  Ван Гог в письмах!  '))).toBe(true);
    expect(slugify('!!!')).toBe('');
    expect(slugify('а'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('parsePostForm', () => {
  const exhibition = {
    category: 'exhibition',
    title: 'Ночь в живописи',
    startsOn: '2026-11-01',
    endsOn: '2026-11-30',
    place: 'Галерея sanatplace, Душанбе',
  };

  it('takes an exhibition with a slug made from the title', () => {
    const r = parsePostForm(form(exhibition));
    expect(r.ok && r.fields).toMatchObject({ slug: 'noch-v-zhivopisi', startsOn: '2026-11-01', endsOn: '2026-11-30' });
  });
  it('needs a rubric, a title and a start date for dated rubrics', () => {
    expect(parsePostForm(form({ ...exhibition, category: 'poem' }))).toEqual({ ok: false, error: 'category' });
    expect(parsePostForm(form({ ...exhibition, title: ' ' }))).toEqual({ ok: false, error: 'title' });
    expect(parsePostForm(form({ ...exhibition, startsOn: '' }))).toEqual({ ok: false, error: 'start' });
  });
  it('refuses an end before the start', () => {
    expect(parsePostForm(form({ ...exhibition, endsOn: '2026-10-01' }))).toEqual({ ok: false, error: 'dates' });
  });
  it('drops event fields from news and articles', () => {
    const r = parsePostForm(form({ ...exhibition, category: 'news', signupUrl: 'https://t.me/x' }));
    expect(r.ok && r.fields).toMatchObject({ startsOn: null, endsOn: null, place: null, signupUrl: null });
  });
  it('checks the address, the excerpt length and the sign-up link', () => {
    expect(parsePostForm(form({ ...exhibition, slug: 'Bad slug' }))).toEqual({ ok: false, error: 'slug' });
    expect(parsePostForm(form({ ...exhibition, excerpt: 'x'.repeat(201) }))).toEqual({ ok: false, error: 'excerpt' });
    expect(parsePostForm(form({ ...exhibition, signupUrl: 'javascript:alert(1)' }))).toEqual({ ok: false, error: 'url' });
  });
  it('treats a one-day event as having no end date', () => {
    const r = parsePostForm(form({ ...exhibition, category: 'event', endsOn: '2026-11-01' }));
    expect(r.ok && r.fields.endsOn).toBeNull();
  });
});

describe('dates', () => {
  it('writes periods the way the reference does', () => {
    expect(dateRange('2026-10-10')).toBe('10 октября');
    expect(dateRange('2026-10-03', '2026-10-24')).toBe('3 – 24 октября');
    expect(dateRange('2026-10-03', '2026-10-24', true)).toBe('3 – 24 октября 2026 г.');
    expect(dateRange('2026-10-20', '2026-11-05')).toBe('20 октября – 5 ноября');
    expect(dateRange('2026-12-20', '2027-01-10', true)).toBe('20 декабря 2026 г. – 10 января 2027 г.');
  });
  it('uses Dushanbe time for "today" and publication dates', () => {
    expect(todayInDushanbe(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10-01');
    expect(publishedDate(new Date('2026-09-23T21:00:00Z'))).toBe('24 сентября 2026 г.');
  });
  it('marks exhibitions and events over after their last day', () => {
    const ev = { category: 'event' as const, startsOn: '2026-10-10', endsOn: null };
    expect(isOver(ev, '2026-10-10')).toBe(false);
    expect(isOver(ev, '2026-10-11')).toBe(true);
    expect(isOver({ ...ev, endsOn: '2026-10-20' }, '2026-10-11')).toBe(false);
    expect(isOver({ category: 'news', startsOn: null, endsOn: null }, '2030-01-01')).toBe(false);
  });
});

describe('MarkdownBody', () => {
  const html = (source: string) => renderToStaticMarkup(createElement(MarkdownBody, { source }));

  it('renders Markdown with headings starting at H2', () => {
    const out = html('# Заголовок\n\nТекст **жирный**\n\n- пункт');
    expect(out).toContain('<h2');
    expect(out).not.toContain('<h1');
    expect(out).toContain('<strong>жирный</strong>');
    expect(out).toContain('<li>пункт</li>');
  });
  it('drops raw HTML and script links', () => {
    const out = html('<script>alert(1)</script>\n\n<b onclick="x()">hi</b> [клик](javascript:alert(1))');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('javascript:');
  });
  it('opens links to other sites in a new tab', () => {
    expect(html('[сайт](https://example.com)')).toContain('target="_blank"');
  });
});
