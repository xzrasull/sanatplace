import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache, type ReactNode } from 'react';
import { pagePreview, snippet } from '@/src/lib/seo';
import { getDb } from '@/src/db';
import { getPublishedArtworkById } from '@/src/lib/artworks/public-queries';
import { listOpenExhibitionsWithArtwork } from '@/src/lib/exhibitions/queries';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { telegramHref } from '@/src/lib/telegram';
import { getCurrentUser } from '@/src/lib/auth/session';
import { likeInfoFor } from '@/src/lib/likes/likes';
import { moreByArtist } from '@/src/lib/gallery/catalog';
import { isUuid } from '@/src/lib/gallery/types';
import { ArtworkFrame } from '@/src/components/artwork/artwork-frame';
import { ArtworkGrid } from '@/src/components/artwork/artwork-grid';
import { BuyBar } from '@/src/components/artwork/buy-bar';
import { LikeButton } from '@/src/components/likes/like-button';

type Shown = {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  ratio: number;
  sold: boolean;
  categoryId: string;
  categoryName: string;
  techniqueName: string;
  year: number | null;
  size: string;
  artistId: string;
  artistName: string;
  telegram?: string | null;
};

// One lookup per request, shared by the page and its link preview. Only a
// uuid can reach the database.
const loadArtwork = cache(async (id: string): Promise<Shown | undefined> => {
  if (!isUuid(id)) return undefined;
  const a = await getPublishedArtworkById(getDb(), id);
  if (!a) return undefined;
  // the stored photo's real proportions, else the painting's size in cm
  const ratio =
    a.widthPx && a.heightPx
      ? a.widthPx / a.heightPx
      : a.widthCm > 0 && a.heightCm > 0
        ? a.widthCm / a.heightCm
        : 4 / 5;
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    price: a.price,
    imageUrl: a.imageUrl,
    ratio,
    sold: a.status === 'sold',
    categoryId: a.categoryId,
    categoryName: a.categoryName,
    techniqueName: a.techniqueName,
    year: a.year,
    size: `${a.heightCm}×${a.widthCm} см`,
    artistId: a.sellerId,
    artistName: a.sellerDisplayName,
    telegram: a.sellerTelegramContact,
  };
});

// Link preview: "Title — Artist", price · size · technique, and the photo itself.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const artwork = await loadArtwork((await params).id);
  if (!artwork) return {};
  const title = `${artwork.title} — ${artwork.artistName}`;
  const facts = [artwork.sold ? 'Продано' : `${artwork.price} TJS`, artwork.size, artwork.techniqueName].join(' · ');
  const description = snippet(`${facts}. ${artwork.description}`);
  return {
    title,
    description,
    ...pagePreview({ title, description, image: { url: artwork.imageUrl, alt: artwork.title } }),
  };
}

export default async function ArtworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artwork, viewer] = await Promise.all([loadArtwork(id), getCurrentUser()]);
  if (!artwork) notFound();

  const more = await moreByArtist(getDb(), artwork.artistId, artwork.id);
  const shows = await listOpenExhibitionsWithArtwork(getDb(), artwork.id, todayInDushanbe()).catch(() => []);
  const likes = await likeInfoFor(getDb(), [{ id: artwork.id, sellerId: artwork.artistId }, ...more], viewer?.id ?? null);
  const telegram = telegramHref(artwork.telegram ?? null);
  const categoryHref = `/gallery?categoryId=${encodeURIComponent(artwork.categoryId)}`;
  const artistHref = `/gallery/artist/${artwork.artistId}`;

  // Guests sign in first and come back here; the artist is reached in Telegram.
  let contact: ReactNode;
  if (artwork.sold) contact = <span className="buybar-note">Работа продана</span>;
  else if (!viewer)
    contact = (
      <Link className="btn btn-tg" href={`/sign-in?next=${encodeURIComponent(`/gallery/artwork/${artwork.id}`)}`}>
        Написать в Telegram
      </Link>
    );
  else if (telegram)
    contact = (
      <a className="btn btn-tg" href={telegram} target="_blank" rel="noopener noreferrer">
        Написать в Telegram
      </a>
    );
  else if (artwork.telegram) contact = <span className="buybar-note">Telegram: {artwork.telegram}</span>;

  return (
    <main className="has-buybar">
      <div className="wrap stack pg">
        <nav className="crumbs" aria-label="Путь">
          <Link href="/">Главная</Link>
          <span aria-hidden="true">/</span>
          <Link href="/gallery">Каталог</Link>
          <span aria-hidden="true">/</span>
          <Link href={categoryHref}>{artwork.categoryName}</Link>
        </nav>
        <div className="work">
          <ArtworkFrame src={artwork.imageUrl} alt={`${artwork.title}, ${artwork.artistName}`} ratio={artwork.ratio}>
            <LikeButton artworkId={artwork.id} info={likes[artwork.id]} size="big" />
          </ArtworkFrame>
          <div className="panel info">
            <div className="chips">
              <Link className="chip" href={categoryHref}>
                {artwork.categoryName}
              </Link>
            </div>
            <h1 className="t">{artwork.title}</h1>
            <p className="by">
              Художник: <Link href={artistHref}>{artwork.artistName}</Link>
            </p>
            {shows.map((s) => (
              <p key={s.slug} className="ex-badge">
                Участвует в выставке <Link href={`/exhibitions/${s.slug}`}>«{s.title}»</Link>
              </p>
            ))}
            {artwork.sold ? <p className="stock sold">Продано</p> : <p className="stock">В наличии</p>}
            <dl className="spec">
              <dt>Размеры</dt>
              <dd>{artwork.size}</dd>
              <dt>Категория</dt>
              <dd>{artwork.categoryName}</dd>
              <dt>Техника</dt>
              <dd>{artwork.techniqueName}</dd>
              {artwork.year && (
                <>
                  <dt>Год</dt>
                  <dd>{artwork.year}</dd>
                </>
              )}
              <dt>Художник</dt>
              <dd>
                <Link href={artistHref}>{artwork.artistName}</Link>
              </dd>
            </dl>
            {artwork.description && (
              <>
                <h2 className="sub">Описание</h2>
                <p className="desc">{artwork.description}</p>
              </>
            )}
            <p className="small">
              Оплату и доставку вы обсуждаете напрямую с художником. Для связи нужно войти через Telegram.
            </p>
          </div>
        </div>
        {more.length > 0 && (
          <section className="sec" aria-labelledby="more-title">
            <div className="sec-head">
              <h2 id="more-title">Ещё от художника</h2>
            </div>
            <ArtworkGrid artworks={more} likes={likes} />
          </section>
        )}
      </div>
      <BuyBar price={artwork.sold ? 'Продано' : `${artwork.price} TJS`}>{contact}</BuyBar>
    </main>
  );
}
