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
