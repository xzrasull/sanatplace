import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/src/lib/auth/staff';
import { getDb } from '@/src/db';
import { findApprovedArtist } from '@/src/lib/artworks/admin-operations';
import { listPublicArtists } from '@/src/lib/artworks/public-queries';
import { listCategories } from '@/src/lib/catalog/categories';
import { listTechniques } from '@/src/lib/catalog/techniques';
import { isUuid } from '@/src/lib/gallery/types';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { ArtworkForm } from '@/src/components/artwork/artwork-form';
import { addArtworkForArtist } from '../actions';

export const metadata = { title: 'Добавить работу за художника', robots: { index: false } };

type Props = { searchParams: Promise<{ seller?: string; error?: string; added?: string }> };

// The admin adds a painting for an artist who asked: first the artist, then
// the same form the artist has in their cabinet.
export default async function AddArtworkForArtistPage({ searchParams }: Props) {
  const role = await requireStaff('admin');
  const { seller, error, added } = await searchParams;

  if (!seller) {
    const artists = await listPublicArtists(getDb());
    return (
      <main>
        <AdminNav role={role} />
        <h1>Добавить работу за художника</h1>
        <p className="mt-2 text-muted-foreground">Выберите художника. Работа появится у него в кабинете и сразу в каталоге.</p>
        {artists.length === 0 && <p className="mt-4 text-muted-foreground">Одобренных художников пока нет.</p>}
        <ul className="mt-6 grid max-w-2xl gap-2">
          {artists.map((a) => (
            <li key={a.id}>
              <Link className="btn sm" href={`/admin/artworks/new?seller=${a.id}`}>
                {a.displayName}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const artist = isUuid(seller) ? await findApprovedArtist(getDb(), seller) : undefined;
  if (!artist) notFound();
  const [categories, techniques] = await Promise.all([listCategories(getDb()), listTechniques(getDb())]);

  return (
    <main>
      <AdminNav role={role} />
      <p className="mt-2">
        <Link href="/admin/artworks/new">← Другой художник</Link>
      </p>
      <h1>Добавить работу за художника: {artist.displayName}</h1>
      <p className="mt-2 text-muted-foreground">
        Работа будет от имени художника и сразу появится в каталоге, без модерации. Художнику придёт сообщение в Telegram.
      </p>
      {added && isUuid(added) && (
        <p role="status" className="notice mt-4 max-w-2xl">
          Работа добавлена и опубликована. <Link href={`/gallery/artwork/${added}`}>Посмотреть</Link>. Можно добавить следующую.
        </p>
      )}
      <ArtworkForm
        // a new form after each save, so the next painting starts empty
        key={added ?? 'new'}
        action={addArtworkForArtist.bind(null, artist.id)}
        categories={categories}
        techniques={techniques}
        submitLabel="Добавить и опубликовать"
        imageLabel="Фото"
        imageRequired
        error={error}
      />
    </main>
  );
}
