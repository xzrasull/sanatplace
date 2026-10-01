import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { CATEGORY_NAME, CATEGORY_TABS, dateRange, isDated, isPostCategory, POST_ERRORS } from '@/src/lib/journal/post-form';
import { listAllPosts, type Post } from '@/src/lib/journal/posts';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ConfirmDelete } from '@/src/components/admin/confirm-delete';
import { FilterForm } from '@/src/components/admin/filter-form';
import { CustomSelect } from '@/src/components/sanat/custom-select';
import { SubmitButton } from '@/src/components/form/submit-button';
import { Input } from '@/src/components/ui/input';
import { buttonVariants } from '@/src/components/ui/button';
import { removePost, setPostStatusAction } from './actions';

export const metadata = { title: 'Афиша и журнал' };

const created = (d: Date) =>
  d.toLocaleDateString('ru-RU', { timeZone: 'Asia/Dushanbe', day: 'numeric', month: 'short', year: 'numeric' });

function when(p: Post) {
  if (isDated(p.category) && p.startsOn) return dateRange(p.startsOn, p.endsOn, true);
  return null;
}

export default async function AdminJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; s?: string; q?: string; saved?: string; error?: string }>;
}) {
  const role = await requireStaff('admin');
  const params = await searchParams;
  const category = isPostCategory(params.c) ? params.c : undefined;
  const status = params.s === 'draft' || params.s === 'published' ? params.s : undefined;
  const q = (params.q ?? '').trim().slice(0, 100);
  const list = await listAllPosts(getDb(), { category, status, q: q || undefined });
  const error = params.error && params.error in POST_ERRORS ? POST_ERRORS[params.error as keyof typeof POST_ERRORS] : null;

  return (
    <main>
      <AdminNav role={role} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Афиша и журнал</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">
            Выставки, события, новости и статьи. Черновики видны только здесь; опубликованные сразу появляются в разделе
            «Афиша» и, если это ближайшее событие, на главной.
          </p>
        </div>
        <Link href="/admin/journal/new" className={buttonVariants()}>
          Создать материал
        </Link>
      </div>

      {error && (
        <p role="alert" className="notice err mt-6">
          {error}
        </p>
      )}
      {params.saved && !error && (
        <p role="status" className="notice mt-6">
          {params.saved === 'published' ? 'Опубликовано.' : 'Черновик сохранён.'}
        </p>
      )}

      <FilterForm className="mt-6 flex flex-wrap items-end gap-3" role="search" aria-label="Фильтр материалов">
        <CustomSelect
          className="grid min-w-[12rem] gap-1.5 text-sm font-semibold"
          name="c"
          label="Рубрика"
          options={CATEGORY_TABS.map((t) => ({ value: t.value, label: t.label }))}
          defaultValue={category ?? ''}
        />
        <CustomSelect
          className="grid min-w-[12rem] gap-1.5 text-sm font-semibold"
          name="s"
          label="Статус"
          options={[
            { value: '', label: 'Все' },
            { value: 'draft', label: 'Черновики' },
            { value: 'published', label: 'Опубликованные' },
          ]}
          defaultValue={status ?? ''}
        />
        <label className="grid min-w-[14rem] flex-1 gap-1.5 text-sm font-semibold">
          <span>Поиск по названию</span>
          <Input type="search" name="q" defaultValue={q} />
        </label>
        <SubmitButton variant="outline">Найти</SubmitButton>
      </FilterForm>

      {list.length === 0 ? (
        <p className="mt-8 text-muted-foreground">{category || status || q ? 'Ничего не найдено.' : 'Материалов пока нет.'}</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {list.map((p) => {
            const published = p.status === 'published';
            const dates = when(p);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-5 rounded-sm bg-card p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small admin thumbnail */}
                <img src={p.coverUrl} alt="" className="banner-thumb" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">
                    {CATEGORY_NAME[p.category]}
                    {dates && ` · ${dates}`}
                    {p.isFeatured && ' · главный материал'}
                  </p>
                  <h2 className="text-2xl">{p.title}</h2>
                  <p className="mt-1 text-sm">
                    <span className={published ? 'text-brand' : 'text-muted-foreground'}>
                      {published ? 'Опубликовано' : 'Черновик'}
                    </span>
                    <span className="text-muted-foreground"> · создан {created(p.createdAt)}</span>
                    {p.sourceNote && <span className="text-muted-foreground"> · {p.sourceNote}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {published && (
                    <Link href={`/journal/${p.slug}`} className={buttonVariants({ variant: 'ghost' })} target="_blank">
                      На сайте
                    </Link>
                  )}
                  <form action={setPostStatusAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="publish" value={published ? '0' : '1'} />
                    <SubmitButton
                      variant={published ? 'outline' : 'default'}
                      aria-label={`${published ? 'Снять с публикации' : 'Опубликовать'}: ${p.title}`}
                    >
                      {published ? 'Снять с публикации' : 'Опубликовать'}
                    </SubmitButton>
                  </form>
                  <Link href={`/admin/journal/${p.id}`} className={buttonVariants({ variant: 'outline' })}>
                    Изменить
                  </Link>
                  <ConfirmDelete action={removePost} id={p.id} what={p.title} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
