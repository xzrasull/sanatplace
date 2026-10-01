// app/admin/exhibitions/[id]/halls-editor.tsx
import { getDb } from '@/src/db';
import { listHallsForAdmin, searchArtworkChoices } from '@/src/lib/exhibitions/admin';
import { EXHIBITION_LIMITS, MAX_HALLS, WALL_COLORS } from '@/src/lib/exhibitions/exhibition-form';
import { VISIBLE_STATUSES } from '@/src/lib/exhibitions/status';
import { ConfirmDelete } from '@/src/components/admin/confirm-delete';
import { Field } from '@/src/components/form/field';
import { SubmitButton } from '@/src/components/form/submit-button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import {
  addHallAction,
  addWorkAction,
  deleteHallAction,
  moveHallAction,
  moveWorkAction,
  removeWorkAction,
  setWorkNoteAction,
  updateHallAction,
} from '../actions';

const COLOR_OPTIONS = [['', 'Фон страницы'], ...Object.entries(WALL_COLORS).map(([k, v]) => [k, v.label])] as const;

function HallFields({ title, intro, wallColor }: { title?: string; intro?: string | null; wallColor?: string | null }) {
  return (
    <>
      <Field label="Название зала">
        <Input name="title" required maxLength={EXHIBITION_LIMITS.hallTitle} defaultValue={title ?? ''} />
      </Field>
      <Field label="Текст зала">
        <Textarea name="intro" rows={3} maxLength={EXHIBITION_LIMITS.hallIntro} defaultValue={intro ?? ''} />
      </Field>
      <Field label="Цвет стены">
        <select name="wallColor" defaultValue={wallColor ?? ''} className="h-11 rounded-sm border border-border bg-card px-3">
          {COLOR_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function Move({ action, fields, label }: { action: (f: FormData) => Promise<void>; fields: Record<string, string>; label: string }) {
  return (
    <span className="inline-flex gap-1">
      {(['up', 'down'] as const).map((dir) => (
        <form key={dir} action={action}>
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="dir" value={dir} />
          <SubmitButton variant="outline" size="sm" aria-label={`${label}: ${dir === 'up' ? 'выше' : 'ниже'}`}>
            {dir === 'up' ? '↑' : '↓'}
          </SubmitButton>
        </form>
      ))}
    </span>
  );
}

// The halls in order, each with its works and a catalog search. Plain forms and
// server actions: every change reloads this page.
export async function HallsEditor({ exhibitionId, hallSearch, q }: { exhibitionId: string; hallSearch?: string; q: string }) {
  const halls = await listHallsForAdmin(getDb(), exhibitionId);
  const results = hallSearch && q ? await searchArtworkChoices(getDb(), q) : [];

  return (
    <section id="halls" className="mt-12 grid gap-8" aria-labelledby="halls-t">
      <h2 id="halls-t">Залы</h2>
      {halls.length === 0 && <p className="text-muted-foreground">Залов пока нет. Добавьте первый.</p>}
      {halls.map((h, i) => (
        <article key={h.id} className="grid gap-4 rounded-sm bg-card p-5" aria-label={`Зал ${i + 1}. ${h.title}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl">
              Зал {i + 1}. {h.title}
            </h3>
            <span className="inline-flex flex-wrap gap-2">
              <Move action={moveHallAction} fields={{ hallId: h.id }} label={`Зал ${h.title}`} />
              <ConfirmDelete action={deleteHallAction} id={h.id} what={`зал «${h.title}»`} />
            </span>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">Изменить зал</summary>
            <form action={updateHallAction} className="mt-3 grid gap-4">
              <input type="hidden" name="hallId" value={h.id} />
              <input type="hidden" name="exhibitionId" value={exhibitionId} />
              <HallFields title={h.title} intro={h.intro} wallColor={h.wallColor} />
              <div>
                <SubmitButton variant="outline">Сохранить зал</SubmitButton>
              </div>
            </form>
          </details>

          <ol className="grid gap-3">
            {h.works.map((w) => {
              const hidden = !(VISIBLE_STATUSES as readonly string[]).includes(w.status);
              return (
                <li key={w.artworkId} className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a small admin thumbnail */}
                  <img src={w.imageUrl} alt="" className="h-16 w-16 rounded-sm object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{w.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {w.artistName}
                      {w.status === 'sold' && ' · Продано'}
                      {hidden && <span className="text-destructive"> · Скрыта: не опубликована</span>}
                    </p>
                    <form action={setWorkNoteAction} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="hallId" value={h.id} />
                      <input type="hidden" name="artworkId" value={w.artworkId} />
                      <input type="hidden" name="exhibitionId" value={exhibitionId} />
                      <Input
                        name="note"
                        aria-label={`Заметка куратора: ${w.title}`}
                        placeholder="Заметка куратора"
                        maxLength={EXHIBITION_LIMITS.note}
                        defaultValue={w.curatorNote ?? ''}
                        className="min-w-[16rem] flex-1"
                      />
                      <SubmitButton variant="outline" size="sm">
                        Сохранить
                      </SubmitButton>
                    </form>
                  </div>
                  <Move action={moveWorkAction} fields={{ hallId: h.id, artworkId: w.artworkId }} label={w.title} />
                  <form action={removeWorkAction}>
                    <input type="hidden" name="hallId" value={h.id} />
                    <input type="hidden" name="artworkId" value={w.artworkId} />
                    <SubmitButton variant="ghost" size="sm" aria-label={`Убрать: ${w.title}`}>
                      Убрать
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ol>

          <form method="get" action={`/admin/exhibitions/${exhibitionId}`} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="hall" value={h.id} />
            <Field label={`Найти работу для зала «${h.title}»`} className="min-w-[16rem] flex-1">
              <Input type="search" name="q" defaultValue={hallSearch === h.id ? q : ''} placeholder="Название или художник" />
            </Field>
            <SubmitButton variant="outline">Найти</SubmitButton>
          </form>
          {hallSearch === h.id && q && (
            <ul className="grid gap-2" aria-label="Найденные работы">
              {results.length === 0 && <li className="text-muted-foreground">Ничего не найдено.</li>}
              {results.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a small admin thumbnail */}
                  <img src={r.imageUrl} alt="" className="h-12 w-12 rounded-sm object-cover" loading="lazy" />
                  <span className="flex-1">
                    {r.title} <span className="text-muted-foreground">— {r.artistName}</span>
                  </span>
                  <form action={addWorkAction}>
                    <input type="hidden" name="hallId" value={h.id} />
                    <input type="hidden" name="artworkId" value={r.id} />
                    <input type="hidden" name="exhibitionId" value={exhibitionId} />
                    <SubmitButton size="sm" aria-label={`Добавить: ${r.title}`}>
                      Добавить
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}

      {halls.length < MAX_HALLS ? (
        <form action={addHallAction} className="grid max-w-3xl gap-4 rounded-sm border border-dashed border-border p-5">
          <h3 className="text-xl">Новый зал</h3>
          <input type="hidden" name="exhibitionId" value={exhibitionId} />
          <HallFields />
          <div>
            <SubmitButton>Добавить зал</SubmitButton>
          </div>
        </form>
      ) : (
        <p className="text-muted-foreground">В выставке {MAX_HALLS} залов — больше добавить нельзя.</p>
      )}
    </section>
  );
}
