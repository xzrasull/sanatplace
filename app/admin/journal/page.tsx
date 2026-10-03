import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { listAllExhibitions, type Exhibition } from '@/src/lib/exhibitions/admin';
import { exhibitionPhase, PHASE_LABEL } from '@/src/lib/exhibitions/status';
import { ONLINE_EXHIBITION } from '@/src/lib/journal/afisha';
import {
  CATEGORY_NAME,
  CATEGORY_TABS,
  dateRange,
  isDated,
  isPostCategory,
  POST_ERRORS,
  todayInDushanbe,
} from '@/src/lib/journal/post-form';
import { listAllPosts, type Post } from '@/src/lib/journal/posts';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ConfirmDelete } from '@/src/components/admin/confirm-delete';
import { FilterForm } from '@/src/components/admin/filter-form';
import { CustomSelect } from '@/src/components/sanat/custom-select';
import { SubmitButton } from '@/src/components/form/submit-button';
import { Input } from '@/src/components/ui/input';
import { buttonVariants } from '@/src/components/ui/button';
import { removeExhibition, setExhibitionStatusAction } from '../exhibitions/actions';
import { removePost, setPostStatusAction } from './actions';

export const metadata = { title: 'Афиша и журнал' };

const created = (d: Date) =>
  d.toLocaleDateString('ru-RU', { timeZone: 'Asia/Dushanbe', day: 'numeric', month: 'short', year: 'numeric' });

function when(p: Post) {
  if (isDated(p.category) && p.startsOn) return dateRange(p.startsOn, p.endsOn, true);
  return null;
}

type Row = { post: Post; show?: undefined } | { show: Exhibition; post?: undefined };
const createdAt = (r: Row) => (r.post ?? r.show).createdAt;

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
  // online exhibitions stand among the posts, under "Все" and "Выставки"
  const [posts, shows] = await Promise.all([
    listAllPosts(getDb(), { category, status, q: q || undefined }),
    !category || category === 'exhibition' ? listAllExhibitions(getDb(), { status, q: q || undefined }) : [],
  ]);
  const list: Row[] = [...posts.map((post) => ({ post })), ...shows.map((show) => ({ show }))].sort(
    (a, b) => createdAt(b).getTime() - createdAt(a).getTime(),
  );
  const today = todayInDushanbe();
  const error = params.error && params.error in POST_ERRORS ? POST_ERRORS[params.error as keyof typeof POST_ERRORS] : null;

  return (
    <main>
      <AdminNav role={role} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Афиша и журнал</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">
            Выставки (онлайн и офлайн), события, новости и статьи. Черновики видны только здесь; опубликованные сразу
            появляются в разделе «Афиша» и, если это ближайшее событие, на главной.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/journal/exhibition" className={buttonVariants()}>
            Добавить выставку
          </Link>
          <Link href="/admin/journal/new" className={buttonVariants({ variant: 'outline' })}>
            Создать материал
          </Link>
        </div>
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
          {list.map((row) => {
            if (row.show) return <ExhibitionRow key={row.show.id} show={row.show} today={today} />;
            const p = row.post;
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

// An online exhibition in the list: the same buttons, its own editor.
function ExhibitionRow({ show: e, today }: { show: Exhibition; today: string }) {
  const published = e.status === 'published';
  const phase = exhibitionPhase(e, today);
  return (
    <li className="flex flex-wrap items-center gap-5 rounded-sm bg-card p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small admin thumbnail */}
      <img src={e.coverUrl} alt="" className="banner-thumb" loading="lazy" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">
          {ONLINE_EXHIBITION} · {dateRange(e.startsOn, e.endsOn, true)}
        </p>
        <h2 className="text-2xl">{e.title}</h2>
        <p className="mt-1 text-sm">
          <span className={published ? 'text-brand' : 'text-muted-foreground'}>
            {published ? `Опубликовано · ${PHASE_LABEL[phase].toLowerCase()}` : 'Черновик'}
          </span>
          <span className="text-muted-foreground"> · создан {created(e.createdAt)}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(phase === 'open' || phase === 'closed') && (
          <Link href={`/exhibitions/${e.slug}`} className={buttonVariants({ variant: 'ghost' })} target="_blank">
            На сайте
          </Link>
        )}
        <form action={setExhibitionStatusAction}>
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="publish" value={published ? '0' : '1'} />
          <SubmitButton
            variant={published ? 'outline' : 'default'}
            aria-label={`${published ? 'Снять с публикации' : 'Опубликовать'}: ${e.title}`}
          >
            {published ? 'Снять с публикации' : 'Опубликовать'}
          </SubmitButton>
        </form>
        <Link href={`/admin/exhibitions/${e.id}`} className={buttonVariants({ variant: 'outline' })}>
          Изменить
        </Link>
        <ConfirmDelete action={removeExhibition} id={e.id} what={e.title} />
      </div>
    </li>
  );
}
