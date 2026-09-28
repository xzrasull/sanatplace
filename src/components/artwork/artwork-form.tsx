import { Field, FIELD_CLASS } from '@/src/components/form/field';
import { CustomSelect } from '@/src/components/sanat/custom-select';
import { ArtworkImage } from '@/src/components/artwork/artwork-image';
import { ArtworkPhotoInput } from '@/src/components/artwork/artwork-photo-input';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { SubmitButton } from '@/src/components/form/submit-button';

type Option = { id: string; name: string };
type Defaults = {
  title: string;
  description: string;
  price: number;
  heightCm: number;
  widthCm: number;
  categoryId: string;
  techniqueId: string;
  imageUrl: string;
  year?: number | null;
};

export function ArtworkForm({
  action,
  categories,
  techniques,
  submitLabel,
  imageLabel,
  imageRequired,
  defaults,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Option[];
  techniques: Option[];
  submitLabel: string;
  imageLabel: string;
  imageRequired: boolean;
  defaults?: Defaults;
  error?: string;
}) {
  return (
    <>
      {error === 'invalid' && (
        <p
          role="alert"
          className="mt-4 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Проверьте, что все поля заполнены корректно.
        </p>
      )}
      {error === 'image' && (
        <p
          role="alert"
          className="mt-4 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Не удалось прочитать фото. Сохраните его в формате JPG или PNG и загрузите снова.
        </p>
      )}
      {error === 'upload' && (
        <p
          role="alert"
          className="mt-4 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Не удалось сохранить фото на сервере. Попробуйте ещё раз чуть позже.
        </p>
      )}
      <form action={action} className="mt-6 grid max-w-xl grid-cols-[minmax(0,1fr)] gap-5 rounded-sm border border-border bg-card p-5 sm:p-6">
        <Field label="Название">
          <Input type="text" name="title" defaultValue={defaults?.title} required />
        </Field>
        <Field label="Описание">
          <Textarea name="description" rows={5} defaultValue={defaults?.description} required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Цена (сомони)">
            <Input type="number" name="price" min="1" defaultValue={defaults?.price} required />
          </Field>
          <Field label="Высота (см)">
            <Input type="number" name="heightCm" min="1" defaultValue={defaults?.heightCm} required />
          </Field>
          <Field label="Ширина (см)">
            <Input type="number" name="widthCm" min="1" defaultValue={defaults?.widthCm} required />
          </Field>
        </div>
        <Field label="Год написания (необязательно)">
          <Input
            type="number"
            name="year"
            min="1000"
            max={new Date().getFullYear()}
            inputMode="numeric"
            placeholder="Например, 2024"
            defaultValue={defaults?.year ?? ''}
          />
        </Field>
        <CustomSelect
          className={FIELD_CLASS}
          name="categoryId"
          label="Категория"
          options={[
            ...(defaults ? [] : [{ value: '', label: 'Выберите категорию' }]),
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          defaultValue={defaults?.categoryId ?? ''}
          required
        />
        <CustomSelect
          className={FIELD_CLASS}
          name="techniqueId"
          label="Техника"
          options={[
            ...(defaults ? [] : [{ value: '', label: 'Выберите технику' }]),
            ...techniques.map((t) => ({ value: t.id, label: t.name })),
          ]}
          defaultValue={defaults?.techniqueId ?? ''}
          required
        />
        {defaults && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Текущее изображение</p>
            <ArtworkImage src={defaults.imageUrl} alt="" className="w-32" sizes="128px" />
          </div>
        )}
        <Field label={imageLabel}>
          <ArtworkPhotoInput required={imageRequired} />
        </Field>
        <SubmitButton size="lg" className="justify-self-start">
          {submitLabel}
        </SubmitButton>
      </form>
    </>
  );
}
