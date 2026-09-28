'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Field, FIELD_CLASS } from '@/src/components/form/field';
import { CustomSelect } from '@/src/components/sanat/custom-select';
import { MarkdownBody } from '@/src/components/journal/markdown-body';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { POST_CATEGORIES, type PostCategory } from '@/src/lib/journal/categories';
import {
  CATEGORY_NAME,
  dateRange,
  isDated,
  POST_ERRORS,
  POST_LIMITS,
  slugify,
  type PostErrorCode,
} from '@/src/lib/journal/post-form';
import { cropCover } from '@/src/lib/uploads/crop-cover';
import { MAX_UPLOAD_BYTES } from '@/src/lib/uploads/shrink-photo';

type Post = {
  id: string;
  slug: string;
  category: PostCategory;
  title: string;
  excerpt: string | null;
  body: string | null;
  coverUrl: string;
  startsOn: string | null;
  endsOn: string | null;
  timeText: string | null;
  place: string | null;
  priceText: string | null;
  signupUrl: string | null;
  artistId: string | null;
  isFeatured: boolean;
  status: 'draft' | 'published';
  sourceNote: string | null;
};
type State = { error: PostErrorCode } | null;

const kb = (bytes: number) => `${Math.round(bytes / 1024)} КБ`;

// Markdown buttons: wrap the selection, or start the selected lines.
type Tool = { label: string; title: string; wrap?: [string, string]; line?: string; placeholder: string };
const TOOLS: Tool[] = [
  { label: 'Ж', title: 'Жирный', wrap: ['**', '**'], placeholder: 'жирный текст' },
  { label: 'К', title: 'Курсив', wrap: ['*', '*'], placeholder: 'курсив' },
  { label: 'H2', title: 'Подзаголовок', line: '## ', placeholder: 'Подзаголовок' },
  { label: '•', title: 'Список', line: '- ', placeholder: 'пункт списка' },
  { label: 'Ссылка', title: 'Ссылка', wrap: ['[', '](https://)'], placeholder: 'текст ссылки' },
];

function applyTool(area: HTMLTextAreaElement, tool: Tool) {
  const { selectionStart: s, selectionEnd: e, value } = area;
  const picked = value.slice(s, e) || tool.placeholder;
  if (tool.wrap) {
    const [a, b] = tool.wrap;
    area.setRangeText(`${a}${picked}${b}`, s, e, 'end');
    area.setSelectionRange(s + a.length, s + a.length + picked.length);
  } else {
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const text = (value.slice(lineStart, e) || tool.placeholder)
      .split('\n')
      .map((l) => (l.startsWith(tool.line!) ? l : tool.line + l))
      .join('\n');
    area.setRangeText(text, lineStart, e, 'end');
  }
  area.focus();
}

export function PostForm({
  action,
  post,
  artists,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  post?: Post;
  artists: { id: string; name: string }[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const original = useRef<File | null>(null);
  const [state, dispatch, pending] = useActionState(action, null);
  const [dirty, setDirty] = useState(false);
  const [category, setCategory] = useState<PostCategory>(post?.category ?? 'exhibition');
  const [slug, setSlug] = useState(post?.slug ?? '');
  // a new post's address follows the title until the admin edits it
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [excerptLen, setExcerptLen] = useState(post?.excerpt?.length ?? 0);
  const [startsOn, setStartsOn] = useState(post?.startsOn ?? '');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [cover, setCover] = useState<string | null>(post?.coverUrl ?? null);
  const [position, setPosition] = useState(50);
  const [coverStatus, setCoverStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [card, setCard] = useState({ title: post?.title ?? '', excerpt: post?.excerpt ?? '', place: post?.place ?? '', endsOn: post?.endsOn ?? '', body: post?.body ?? '' });
  const error = state?.error ? POST_ERRORS[state.error] : null;

  // what the preview shows follows every keystroke
  const refresh = () => {
    const f = new FormData(form.current!);
    const s = (k: string) => String(f.get(k) ?? '').trim();
    setCard({ title: s('title'), excerpt: s('excerpt'), place: s('place'), endsOn: s('endsOn'), body: String(f.get('body') ?? '') });
  };

  // leaving with unsaved changes: the browser asks on reload or close, and a
  // click on a link inside the site asks here
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a || a.getAttribute('target') === '_blank' || e.defaultPrevented) return;
      if (!window.confirm('Изменения не сохранены. Уйти со страницы?')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  // a problem from the server: show it at the top; the changes are still unsaved
  useEffect(() => {
    if (!state?.error) return;
    setDirty(true);
    form.current?.querySelector('[role=alert]')?.scrollIntoView({ block: 'center' });
  }, [state]);

  // The form is sent from here (not as a form action), so React keeps what was
  // typed when the server sends back an error.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(e.currentTarget, submitter);
    setDirty(false);
    startTransition(() => dispatch(data));
  };

  const recrop = async (file: File, pos: number) => {
    const input = coverInput.current!;
    input.setCustomValidity('Подождите, обложка готовится');
    setCoverStatus({ text: 'Готовим обложку…' });
    const cut = await cropCover(file, pos / 100).catch(() => null);
    input.setCustomValidity('');
    const chosen = cut?.file ?? file;
    if (chosen.size > MAX_UPLOAD_BYTES) {
      input.value = '';
      original.current = null;
      setCover(post?.coverUrl ?? null);
      return setCoverStatus({ text: 'Файл слишком большой. Выберите JPEG или WebP поменьше.', error: true });
    }
    const list = new DataTransfer();
    list.items.add(chosen);
    input.files = list.files;
    setCover(URL.createObjectURL(chosen));
    setCoverStatus({ text: cut ? `Готово: ${cut.width}×${cut.height}, ${kb(chosen.size)}` : `Выбрано: ${kb(chosen.size)}` });
  };

  const onCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    // the input now holds the cropped copy; a fresh pick replaces the original
    if (!file || file === original.current) return;
    original.current = file;
    setPosition(50);
    await recrop(file, 50);
  };

  const dated = isDated(category);
  const cardDate = dated
    ? startsOn
      ? dateRange(startsOn, card.endsOn || null)
      : 'Дата'
    : new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <form
        ref={form}
        onSubmit={onSubmit}
        onInput={() => {
          setDirty(true);
          refresh();
        }}
        onChange={refresh}
        className="grid grid-cols-[minmax(0,1fr)] content-start gap-5 rounded-sm bg-card p-5 sm:p-6"
      >
        {post && <input type="hidden" name="id" value={post.id} />}
        {error && (
          <p role="alert" className="notice err">
            {error}
          </p>
        )}

        <CustomSelect
          className={FIELD_CLASS}
          name="category"
          label="Рубрика"
          options={POST_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_NAME[c] }))}
          defaultValue={category}
          onChange={(v) => setCategory(v as PostCategory)}
          required
        />

        <Field label="Заголовок">
          <Input
            name="title"
            required
            maxLength={POST_LIMITS.title}
            defaultValue={post?.title ?? ''}
            onChange={(e) => !slugTouched && setSlug(slugify(e.currentTarget.value))}
          />
        </Field>
        <Field label="Адрес страницы">
          <Input
            name="slug"
            value={slug}
            maxLength={POST_LIMITS.slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Латинские буквы, цифры и дефисы"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.currentTarget.value.toLowerCase());
            }}
          />
          <span className="text-sm font-normal text-muted-foreground">sanatplace.vercel.app/journal/{slug || '…'}</span>
        </Field>
        <Field label={`Короткое описание (${excerptLen} из ${POST_LIMITS.excerpt})`}>
          <Textarea
            name="excerpt"
            rows={2}
            maxLength={POST_LIMITS.excerpt}
            defaultValue={post?.excerpt ?? ''}
            onChange={(e) => setExcerptLen(e.currentTarget.value.length)}
          />
          <span className="text-sm font-normal text-muted-foreground">Показывается в карточке и под заголовком материала.</span>
        </Field>

        <Field label={post ? 'Обложка (оставьте пустой, чтобы не менять)' : 'Обложка'}>
          <Input ref={coverInput} type="file" name="cover" accept="image/jpeg,image/webp,image/png" required={!post} onChange={onCover} />
          <span className="text-sm font-normal text-muted-foreground">
            Обрезается до 16:9 и ужимается до 1600 px. Лучше всего 1600×900, JPEG или WebP.
          </span>
          {coverStatus && (
            <span
              role={coverStatus.error ? 'alert' : 'status'}
              className={coverStatus.error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
            >
              {coverStatus.text}
            </span>
          )}
        </Field>
        {cover && (
          <div className="grid gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob or the stored cover, previewed as is */}
            <img src={cover} alt="Обложка" className="aspect-video w-full rounded-sm object-cover" />
            {original.current && (
              <Field label="Кадр: сдвиг вверх–вниз (или влево–вправо)">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={position}
                  onChange={(e) => setPosition(Number(e.currentTarget.value))}
                  onPointerUp={() => original.current && recrop(original.current, position)}
                  onKeyUp={() => original.current && recrop(original.current, position)}
                  className="accent-[var(--sage)]"
                />
              </Field>
            )}
          </div>
        )}

        {dated && (
          <fieldset className="grid gap-5 rounded-sm border border-border p-4">
            <legend className="px-1 text-sm font-medium">Когда и где</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Дата начала">
                <Input
                  type="date"
                  name="startsOn"
                  required
                  defaultValue={post?.startsOn ?? ''}
                  onChange={(e) => setStartsOn(e.currentTarget.value)}
                />
              </Field>
              <Field label="Дата конца (для однодневного пусто)">
                <Input type="date" name="endsOn" min={startsOn || undefined} defaultValue={post?.endsOn ?? ''} />
              </Field>
            </div>
            <Field label="Время">
              <Input name="timeText" maxLength={POST_LIMITS.short} defaultValue={post?.timeText ?? ''} placeholder="ежедневно, 11:00–19:00" />
            </Field>
            <Field label="Место">
              <Input name="place" maxLength={POST_LIMITS.short} defaultValue={post?.place ?? ''} placeholder="Галерея sanatplace, Душанбе" />
            </Field>
            <Field label="Стоимость">
              <Input name="priceText" maxLength={POST_LIMITS.short} defaultValue={post?.priceText ?? ''} placeholder="Вход свободный" />
            </Field>
            <Field label="Ссылка для записи (необязательно)">
              <Input type="url" name="signupUrl" maxLength={POST_LIMITS.url} defaultValue={post?.signupUrl ?? ''} placeholder="https://t.me/…" />
              <span className="text-sm font-normal text-muted-foreground">
                Если пусто, кнопка «Записаться в Telegram» откроет чат с администратором.
              </span>
            </Field>
          </fieldset>
        )}

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Текст (Markdown)</span>
            <div role="tablist" aria-label="Текст" className="flex gap-1">
              {(['write', 'preview'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`min-h-9 rounded-full px-4 text-sm ${tab === t ? 'bg-[var(--sage)] text-white' : 'border border-border'}`}
                >
                  {t === 'write' ? 'Текст' : 'Предпросмотр'}
                </button>
              ))}
            </div>
          </div>
          <div hidden={tab !== 'write'} className="grid gap-2">
            <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Оформление текста">
              {TOOLS.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  title={t.title}
                  aria-label={t.title}
                  onClick={() => {
                    applyTool(bodyRef.current!, t);
                    setDirty(true);
                    refresh();
                  }}
                  className={`min-h-9 min-w-9 rounded-md border border-border px-2 text-sm ${t.label === 'Ж' ? 'font-bold' : ''} ${t.label === 'К' ? 'italic' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Textarea
              ref={bodyRef}
              name="body"
              rows={14}
              maxLength={POST_LIMITS.body}
              defaultValue={post?.body ?? ''}
              aria-label="Текст материала"
              className="font-mono text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Абзацы разделяйте пустой строкой. ## — заголовок, - — пункт списка, **жирный**, *курсив*.
            </span>
          </div>
          {tab === 'preview' && (
            <div className="rounded-sm bg-white p-5">
              {card.body.trim() ? <MarkdownBody source={card.body} /> : <p className="text-muted-foreground">Текста пока нет.</p>}
            </div>
          )}
        </div>

        <CustomSelect
          className={FIELD_CLASS}
          name="artistId"
          label="Связанный художник (необязательно)"
          options={[{ value: '', label: 'Без художника' }, ...artists.map((a) => ({ value: a.id, label: a.name }))]}
          defaultValue={post?.artistId ?? ''}
        />
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isFeatured" defaultChecked={post?.isFeatured ?? false} />
          Главный материал (крупно вверху «Афиши»; у остальных снимется)
        </label>
        <Field label="Кто попросил разместить (видно только в админке)">
          <Input name="sourceNote" maxLength={POST_LIMITS.note} defaultValue={post?.sourceNote ?? ''} placeholder="@username, 24 сентября" />
        </Field>

        <div className="flex flex-wrap gap-3">
          {post?.status === 'published' ? (
            <>
              <Button type="submit" name="intent" value="publish" size="lg" disabled={pending}>
                Сохранить
              </Button>
              <Button type="submit" name="intent" value="draft" size="lg" variant="outline" disabled={pending}>
                Снять с публикации
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" name="intent" value="draft" size="lg" variant="outline" disabled={pending}>
                Сохранить черновик
              </Button>
              <Button type="submit" name="intent" value="publish" size="lg" disabled={pending}>
                Опубликовать
              </Button>
            </>
          )}
          {pending && (
            <span role="status" className="self-center text-sm text-muted-foreground">
              Сохраняем…
            </span>
          )}
        </div>
      </form>

      <div className="grid content-start gap-5 lg:sticky lg:top-6">
        <h2 className="text-2xl">Карточка в афише</h2>
        <div className="post-preview" inert>
          <article className="pcard">
            <div className="pthumb">
              {/* eslint-disable-next-line @next/next/no-img-element -- previewed as is */}
              {cover && <img className="pimg" src={cover} alt="" />}
              <span className="ptag">{CATEGORY_NAME[category]}</span>
            </div>
            <div className="pmeta">
              <p className="pdate">{cardDate}</p>
              <h3>{card.title || 'Заголовок материала'}</h3>
              {card.excerpt && <p className="pex">{card.excerpt}</p>}
              {dated && card.place && <p className="pplace">{card.place}</p>}
            </div>
          </article>
        </div>
        <p className="text-sm text-muted-foreground">
          Прошедшие выставки и события остаются на сайте с пометкой «Завершено» и без кнопки записи.
        </p>
      </div>
    </div>
  );
}
