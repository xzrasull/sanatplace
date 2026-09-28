import Link from 'next/link';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { listAllArtworks, listPendingArtworks } from '@/src/lib/artworks/admin-operations';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ConfirmDelete } from '@/src/components/admin/confirm-delete';
import { ArtworkImage } from '@/src/components/artwork/artwork-image';
import { StatusBadge } from '@/src/components/artwork/status-badge';
import { Input } from '@/src/components/ui/input';
import { approveArtwork, rejectArtwork, removeArtwork } from './actions';
import { SubmitButton } from '@/src/components/form/submit-button';

const ALL_LIMIT = 100;

export default async function AdminArtworksPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const role = await requireStaff();
  const q = ((await searchParams).q ?? '').trim().slice(0, 100);

  const [pending, all] = await Promise.all([
    listPendingArtworks(getDb()),
    role === 'admin' ? listAllArtworks(getDb(), { q, limit: ALL_LIMIT }) : Promise.resolve([]),
  ]);

  return (
    <main>
      <AdminNav role={role} />
      <h1>Картины на модерации</h1>
      {pending.length === 0 && <p className="mt-4 text-muted-foreground">Нет картин на модерации.</p>}
      <div className="mt-6 grid gap-4">
        {pending.map((artwork) => (
          <section key={artwork.id} className="flex flex-col gap-4 rounded-sm border border-border bg-card p-5 sm:flex-row">
            <ArtworkImage src={artwork.imageUrl} alt="" className="w-full sm:w-40 sm:shrink-0" sizes="160px" />
            <div className="min-w-0 flex-1">
              <h2>{artwork.title}</h2>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{artwork.description}</p>
              <p className="mt-3 text-sm font-semibold text-brand">
                {artwork.price} TJS · {artwork.heightCm}×{artwork.widthCm} см
              </p>
              <p className="text-sm text-muted-foreground">
                {artwork.categoryName} · {artwork.techniqueName}
              </p>
              <p className="text-sm text-muted-foreground">Художник: {artwork.sellerDisplayName}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <form action={approveArtwork}>
                  <input type="hidden" name="artworkId" value={artwork.id} />
                  <SubmitButton>Одобрить</SubmitButton>
                </form>
                <form action={rejectArtwork} className="flex w-full gap-2 sm:w-auto sm:flex-1">
                  <input type="hidden" name="artworkId" value={artwork.id} />
                  <Input type="text" name="reason" placeholder="Причина отказа" aria-label="Причина отказа" />
                  <SubmitButton variant="outline">
                    Отклонить
                  </SubmitButton>
                </form>
              </div>
            </div>
          </section>
        ))}
      </div>

      {role === 'admin' && (
        <section className="mt-12" aria-labelledby="all-artworks">
          <h2 id="all-artworks">Все картины</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Удаление убирает картину отовсюду: из каталога, со страницы художника, из избранного и коллажа на главной, а
            её фото — из хранилища. Отменить нельзя.
          </p>
          <form className="mt-4 flex flex-wrap items-end gap-3" role="search" aria-label="Поиск картин">
            <label className="grid min-w-[14rem] flex-1 gap-1.5 text-sm font-medium">
              <span>Название или художник</span>
              <Input type="search" name="q" defaultValue={q} />
            </label>
            <SubmitButton variant="outline">Найти</SubmitButton>
          </form>
          {all.length === 0 ? (
            <p className="mt-4 text-muted-foreground">{q ? 'Ничего не нашлось.' : 'Картин пока нет.'}</p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {all.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-4 rounded-sm border border-border bg-card p-3"
                >
                  <ArtworkImage src={a.imageUrl} alt="" className="w-16 shrink-0" sizes="64px" />
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.sellerDisplayName ?? 'Художник без профиля'} · {a.price} TJS
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                  <Link className="text-sm underline" href={`/gallery/artwork/${a.id}`} target="_blank">
                    Открыть
                  </Link>
                  <ConfirmDelete action={removeArtwork} id={a.id} what={a.title} />
                </li>
              ))}
            </ul>
          )}
          {all.length === ALL_LIMIT && (
            <p className="mt-3 text-sm text-muted-foreground">
              Показаны последние {ALL_LIMIT}. Уточните поиск, чтобы найти остальные.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
