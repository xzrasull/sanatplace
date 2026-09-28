'use client';

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Field, FIELD_CLASS } from '@/src/components/form/field';
import { CustomSelect } from '@/src/components/sanat/custom-select';
import { SlideBody } from '@/src/components/home/slide-body';
import { Input } from '@/src/components/ui/input';
import { BANNER_LIMITS, DEFAULT_OVERLAY, toLocalDateTime } from '@/src/lib/home/banner-form';
import type { Banner, HeroSlide } from '@/src/lib/home/banners';
import { MAX_UPLOAD_BYTES, shrinkPhoto } from '@/src/lib/uploads/shrink-photo';
import { SubmitButton } from '@/src/components/form/submit-button';

type Option = { id: string; title: string; artist: string };

// Image sides the browser shrinks to before upload (the server does it again).
const SIDE = { image: 1920, imageMobile: 1200 } as const;

const kb = (bytes: number) => `${Math.round(bytes / 1024)} КБ`;

// One image field: the file is shrunk in the browser first (the form can't be
// sent while that runs), and the preview shows it at once.
function ImageField({
  name,
  label,
  hint,
  required,
  onPicked,
}: {
  name: keyof typeof SIDE;
  label: string;
  hint: string;
  required: boolean;
  onPicked: (url: string | null) => void;
}) {
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.setCustomValidity('');
    if (!file) {
      setStatus(null);
      return onPicked(null);
    }
    input.setCustomValidity('Подождите, изображение готовится');
    setStatus({ text: 'Готовим изображение…' });
    const shrunk = await shrinkPhoto(file, SIDE[name]).catch(() => null);
    input.setCustomValidity('');
    const chosen = shrunk?.file ?? file;
    if (shrunk && chosen !== file) {
      const list = new DataTransfer();
      list.items.add(chosen);
      input.files = list.files;
    }
    if (chosen.size > MAX_UPLOAD_BYTES) {
      input.value = '';
      onPicked(null);
      return setStatus({ text: 'Файл слишком большой. Выберите JPEG или WebP поменьше.', error: true });
    }
    onPicked(URL.createObjectURL(chosen));
    setStatus({ text: shrunk ? `Готово: ${shrunk.width}×${shrunk.height}, ${kb(chosen.size)}` : `Выбрано: ${kb(chosen.size)}` });
  };

  return (
    <Field label={label}>
      <Input type="file" name={name} accept="image/jpeg,image/webp,image/png" required={required} onChange={onChange} />
      <span className="text-sm font-normal text-muted-foreground">{hint}</span>
      {status && (
        <span role={status.error ? 'alert' : 'status'} className={status.error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {status.text}
        </span>
      )}
    </Field>
  );
}

function overlayStyle(o: number) {
  return {
    '--o1': Math.min(0.95, (0.55 * o) / 45).toFixed(3),
    '--o2': Math.min(0.95, (0.38 * o) / 45).toFixed(3),
    '--o3': Math.min(0.95, (0.65 * o) / 45).toFixed(3),
  } as CSSProperties;
}

export function BannerForm({
  action,
  banner,
  artworks,
}: {
  action: (formData: FormData) => void | Promise<void>;
  banner?: Banner;
  artworks: Option[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const [desktop, setDesktop] = useState<string | null>(banner?.imageUrl ?? null);
  const [mobile, setMobile] = useState<string | null>(banner?.imageMobileUrl ?? null);
  const [removeMobile, setRemoveMobile] = useState(false);
  const [tz, setTz] = useState('');
  const [preview, setPreview] = useState<Omit<HeroSlide, 'id'>>(() => ({
    imageUrl: banner?.imageUrl ?? '',
    imageMobileUrl: banner?.imageMobileUrl ?? null,
    eyebrow: banner?.eyebrow ?? null,
    title: banner?.title ?? '',
    subtitle: banner?.subtitle ?? null,
    overlay: banner?.overlay ?? DEFAULT_OVERLAY,
    buttons: [],
  }));

  // the browser's time zone, so the show window means the admin's local time
  useEffect(() => setTz(String(new Date().getTimezoneOffset())), []);

  // the preview follows every keystroke
  const refresh = () => {
    const f = new FormData(form.current!);
    const s = (k: string) => String(f.get(k) ?? '').trim();
    const buttons: HeroSlide['buttons'] = [];
    if (s('buttonLabel') || s('artworkId')) buttons.push({ label: s('buttonLabel') || 'Смотреть картину', href: '/' });
    if (s('button2Label')) buttons.push({ label: s('button2Label'), href: '/' });
    setPreview((p) => ({
      ...p,
      eyebrow: s('eyebrow') || null,
      title: s('title') || 'Заголовок баннера',
      subtitle: s('subtitle') || null,
      overlay: Number(s('overlay') || DEFAULT_OVERLAY),
      buttons,
    }));
  };
  useEffect(refresh, []);

  const shownMobile = removeMobile ? null : mobile;
  const picture = (src: string | null) =>
    // eslint-disable-next-line @next/next/no-img-element -- a local blob or the stored image, previewed as is
    src ? <img className="bgi" src={src} alt="" /> : null;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form
        ref={form}
        action={action}
        onInput={refresh}
        onChange={refresh}
        className="grid grid-cols-[minmax(0,1fr)] content-start gap-5 rounded-sm bg-card p-5 sm:p-6"
      >
        {banner && <input type="hidden" name="id" value={banner.id} />}
        <input type="hidden" name="tzOffset" value={tz} />

        <ImageField
          name="image"
          label={banner ? 'Изображение (оставьте пустым, чтобы не менять)' : 'Изображение'}
          hint="Рекомендуется 1920×900, JPEG или WebP до 500 КБ."
          required={!banner}
          onPicked={(url) => setDesktop(url ?? banner?.imageUrl ?? null)}
        />
        <ImageField
          name="imageMobile"
          label="Вертикальное изображение для телефона (необязательно)"
          hint="Рекомендуется 800×1200, JPEG или WebP до 500 КБ. Без него телефон покажет обычное изображение."
          required={false}
          onPicked={(url) => {
            setMobile(url ?? banner?.imageMobileUrl ?? null);
            if (url) setRemoveMobile(false);
          }}
        />
        {banner?.imageMobileUrl && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="removeMobile" checked={removeMobile} onChange={(e) => setRemoveMobile(e.target.checked)} />
            Убрать вертикальное изображение
          </label>
        )}

        <Field label="Надпись над заголовком">
          <Input name="eyebrow" maxLength={BANNER_LIMITS.eyebrow} defaultValue={banner?.eyebrow ?? ''} placeholder="Например, Новое поступление" />
        </Field>
        <Field label="Заголовок">
          <Input name="title" required maxLength={BANNER_LIMITS.title} defaultValue={banner?.title ?? ''} />
        </Field>
        <Field label="Подзаголовок">
          <Input name="subtitle" maxLength={BANNER_LIMITS.subtitle} defaultValue={banner?.subtitle ?? ''} />
        </Field>

        <CustomSelect
          className={FIELD_CLASS}
          name="artworkId"
          label="Картина (необязательно: первая кнопка откроет её)"
          options={[{ value: '', label: 'Без картины' }, ...artworks.map((a) => ({ value: a.id, label: `${a.title} — ${a.artist}` }))]}
          defaultValue={banner?.artworkId ?? ''}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Первая кнопка: подпись">
            <Input name="buttonLabel" maxLength={BANNER_LIMITS.label} defaultValue={banner?.buttonLabel ?? ''} placeholder="Смотреть картину" />
          </Field>
          <Field label="Первая кнопка: ссылка">
            <Input name="buttonUrl" maxLength={BANNER_LIMITS.url} defaultValue={banner?.buttonUrl ?? ''} placeholder="/gallery" />
          </Field>
          <Field label="Вторая кнопка: подпись">
            <Input name="button2Label" maxLength={BANNER_LIMITS.label} defaultValue={banner?.button2Label ?? ''} />
          </Field>
          <Field label="Вторая кнопка: ссылка">
            <Input name="button2Url" maxLength={BANNER_LIMITS.url} defaultValue={banner?.button2Url ?? ''} placeholder="/artists" />
          </Field>
        </div>
        <p className="-mt-2 text-sm text-muted-foreground">
          Ссылка на страницу сайта начинается с «/», например /gallery. Если выбрана картина, первая кнопка ведёт на неё.
        </p>

        <Field label={`Затемнение: ${preview.overlay}%`}>
          <input
            type="range"
            name="overlay"
            min={0}
            max={80}
            step={5}
            defaultValue={banner?.overlay ?? DEFAULT_OVERLAY}
            className="accent-[var(--sage)]"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Показывать с (необязательно)">
            <Input type="datetime-local" name="startsAt" defaultValue={toLocalDateTime(banner?.startsAt ?? null)} />
          </Field>
          <Field label="Показывать до (необязательно)">
            <Input type="datetime-local" name="endsAt" defaultValue={toLocalDateTime(banner?.endsAt ?? null)} />
          </Field>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={banner?.isActive ?? true} />
          Активен
        </label>
        <SubmitButton size="lg" className="justify-self-start">
          {banner ? 'Сохранить' : 'Добавить баннер'}
        </SubmitButton>
      </form>

      <div className="grid content-start gap-5 lg:sticky lg:top-6">
        <h2 className="text-2xl">Предпросмотр</h2>
        <div className="banner-preview" aria-label="Предпросмотр на компьютере" inert>
          <div className="slide on" style={overlayStyle(preview.overlay)}>
            <SlideBody slide={preview} picture={picture(desktop)} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">На телефоне:</p>
        <div className="banner-preview w-[min(260px,70%)]" aria-label="Предпросмотр на телефоне" inert>
          <div className="slide on aspect-[2/3]!" style={overlayStyle(preview.overlay)}>
            <SlideBody slide={preview} picture={picture(shownMobile ?? desktop)} />
          </div>
        </div>
      </div>
    </div>
  );
}
