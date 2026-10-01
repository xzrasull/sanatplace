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
const isWallColor = (v: string): v is WallColor => Object.hasOwn(WALL_COLORS, v);

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
const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  // an impossible day (02-30) rolls over to another date, so it no longer matches
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

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
  typeof v === 'string' && Object.hasOwn(EXHIBITION_ERRORS, v);
