import { POST_CATEGORIES, type PostCategory } from './categories';
import { isUuid } from '../gallery/types';
import { isSafeLink } from '../home/banner-form';

// «Афиша и журнал»: rubrics, addresses (slugs), dates and the admin's form.

export const CATEGORY_NAME: Record<PostCategory, string> = {
  exhibition: 'Выставка',
  event: 'Событие',
  news: 'Новость',
  article: 'Статья',
};
// the rubric chips on /journal, `?c=` in the address
export const CATEGORY_TABS: { value: PostCategory | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'exhibition', label: 'Выставки' },
  { value: 'event', label: 'События' },
  { value: 'news', label: 'Новости' },
  { value: 'article', label: 'Статьи' },
];

export const isPostCategory = (v: unknown): v is PostCategory =>
  typeof v === 'string' && (POST_CATEGORIES as readonly string[]).includes(v);

// Exhibitions and events have dates, a place and sign-up; news and articles don't.
export const isDated = (c: PostCategory) => c === 'exhibition' || c === 'event';

export const POST_LIMITS = {
  title: 160,
  slug: 80,
  excerpt: 200,
  body: 50_000,
  short: 120,
  url: 500,
  note: 500,
} as const;

// Russian and Tajik letters in Latin, for addresses.
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ғ: 'gh', ӣ: 'i', қ: 'q', ӯ: 'u', ҳ: 'h', ҷ: 'j',
};

// «Свет и цвет: импрессионисты» → "svet-i-tsvet-impressionisty"
export function slugify(text: string): string {
  const latin = [...text.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join('');
  const slug = latin
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, POST_LIMITS.slug).replace(/-+$/, '');
}

export const isSlug = (s: string) => s.length <= POST_LIMITS.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

// ---------- dates ----------

// Today in Dushanbe as YYYY-MM-DD, the format of starts_on / ends_on.
export function todayInDushanbe(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dushanbe' }).format(now);
}

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString('ru-RU', { timeZone: 'UTC', ...opts });

// "10 октября", "3 – 24 октября", "1 октября – 30 ноября"; `withYear` adds the year.
export function dateRange(startsOn: string, endsOn?: string | null, withYear = false): string {
  const full: Intl.DateTimeFormatOptions = withYear
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'long' };
  const a = day(startsOn);
  if (!endsOn || endsOn === startsOn) return fmt(a, full);
  const b = day(endsOn);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  if (sameYear && a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()} – ${fmt(b, full)}`;
  const left = sameYear ? fmt(a, { day: 'numeric', month: 'long' }) : fmt(a, full);
  return `${left} – ${fmt(b, full)}`;
}

// "24 сентября 2026", for news and articles (in Dushanbe time)
export function publishedDate(at: Date): string {
  return at.toLocaleDateString('ru-RU', { timeZone: 'Asia/Dushanbe', day: 'numeric', month: 'long', year: 'numeric' });
}

// An exhibition or event is over once its last day has passed.
export function isOver(p: { category: PostCategory; startsOn: string | null; endsOn: string | null }, today: string) {
  const last = p.endsOn ?? p.startsOn;
  return isDated(p.category) && last !== null && last < today;
}

// ---------- the admin's form ----------

export type PostFields = {
  category: PostCategory;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timeText: string | null;
  place: string | null;
  priceText: string | null;
  signupUrl: string | null;
  artistId: string | null;
  isFeatured: boolean;
  sourceNote: string | null;
};

export type PostFormError =
  | 'category'
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'body'
  | 'dates'
  | 'start'
  | 'short'
  | 'url'
  | 'artist'
  | 'note';

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
};
const orNull = (s: string) => (s ? s : null);
const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(day(s).getTime());

export function parsePostForm(form: FormData): { ok: true; fields: PostFields } | { ok: false; error: PostFormError } {
  const category = text(form, 'category');
  if (!isPostCategory(category)) return { ok: false, error: 'category' };
  const title = text(form, 'title');
  if (!title || title.length > POST_LIMITS.title) return { ok: false, error: 'title' };
  const slug = text(form, 'slug').toLowerCase() || slugify(title);
  if (!isSlug(slug)) return { ok: false, error: 'slug' };
  const excerpt = text(form, 'excerpt').replace(/\s+/g, ' ');
  if (excerpt.length > POST_LIMITS.excerpt) return { ok: false, error: 'excerpt' };
  const body = typeof form.get('body') === 'string' ? String(form.get('body')).replace(/\r\n/g, '\n').trim() : '';
  if (body.length > POST_LIMITS.body) return { ok: false, error: 'body' };

  const artistId = text(form, 'artistId');
  if (artistId && !isUuid(artistId)) return { ok: false, error: 'artist' };
  const sourceNote = text(form, 'sourceNote');
  if (sourceNote.length > POST_LIMITS.note) return { ok: false, error: 'note' };

  // dates, time, place, price and sign-up belong to exhibitions and events only
  let startsOn: string | null = null;
  let endsOn: string | null = null;
  let timeText = '';
  let place = '';
  let priceText = '';
  let signupUrl = '';
  if (isDated(category)) {
    const s = text(form, 'startsOn');
    const e = text(form, 'endsOn');
    if (!s) return { ok: false, error: 'start' };
    if (!isIsoDate(s) || (e && !isIsoDate(e))) return { ok: false, error: 'dates' };
    if (e && e < s) return { ok: false, error: 'dates' };
    startsOn = s;
    endsOn = e && e !== s ? e : null;
    timeText = text(form, 'timeText');
    place = text(form, 'place');
    priceText = text(form, 'priceText');
    for (const v of [timeText, place, priceText]) if (v.length > POST_LIMITS.short) return { ok: false, error: 'short' };
    signupUrl = text(form, 'signupUrl');
    if (signupUrl && (signupUrl.length > POST_LIMITS.url || !isSafeLink(signupUrl))) return { ok: false, error: 'url' };
  }

  return {
    ok: true,
    fields: {
      category,
      title,
      slug,
      excerpt: orNull(excerpt),
      body: orNull(body),
      startsOn,
      endsOn,
      timeText: orNull(timeText),
      place: orNull(place),
      priceText: orNull(priceText),
      signupUrl: orNull(signupUrl),
      artistId: orNull(artistId),
      isFeatured: form.get('isFeatured') === 'on',
      sourceNote: orNull(sourceNote),
    },
  };
}

export type PostErrorCode = PostFormError | 'cover' | 'image' | 'upload' | 'slug_taken' | 'not_found';

export const POST_ERRORS: Record<PostErrorCode, string> = {
  category: 'Выберите рубрику.',
  title: `Заполните заголовок (до ${POST_LIMITS.title} символов).`,
  slug: 'Адрес — латинские буквы, цифры и дефисы, например svet-i-tsvet.',
  excerpt: `Короткое описание — до ${POST_LIMITS.excerpt} символов.`,
  body: 'Текст слишком длинный.',
  start: 'Укажите дату начала.',
  dates: 'Проверьте даты: дата конца не может быть раньше даты начала.',
  short: `Время, место и стоимость — до ${POST_LIMITS.short} символов каждое.`,
  url: 'Ссылка для записи должна начинаться с https:// или с «/».',
  artist: 'Выберите художника из списка.',
  note: `Заметка — до ${POST_LIMITS.note} символов.`,
  cover: 'Загрузите обложку.',
  image: 'Не удалось прочитать изображение. Загрузите JPEG, PNG или WebP.',
  upload: 'Не удалось сохранить обложку. Попробуйте ещё раз чуть позже.',
  slug_taken: 'Такой адрес уже занят другим материалом. Измените его.',
  not_found: 'Материал не найден: возможно, его уже удалили.',
};
