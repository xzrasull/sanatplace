// src/components/exhibitions/exhibition-view.tsx
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import type { ExhibitionCard, ExhibitionViewData } from '@/src/lib/exhibitions/queries';
import { WALL_COLORS, type WallColor } from '@/src/lib/exhibitions/exhibition-form';
import { exhibitionPhase } from '@/src/lib/exhibitions/status';
import { wallShares, workRatio } from '@/src/lib/exhibitions/wall-scale';
import { dateRange } from '@/src/lib/journal/post-form';
import type { LikeInfo } from '@/src/lib/likes/likes';
import { isStorageUrl } from '@/src/lib/uploads/buckets';
import { MarkdownBody } from '@/src/components/journal/markdown-body';
import { ExhibitionGrid } from './exhibition-card';
import { ExhibitionRoom, type RoomHall } from './exhibition-room';

// The entrance, the curator's text, the halls, the artists and other exhibitions.
export function ExhibitionView({
  view,
  today,
  likes,
  others,
  preview = false,
}: {
  view: ExhibitionViewData;
  today: string;
  likes: Record<string, LikeInfo>;
  others: ExhibitionCard[];
  preview?: boolean;
}) {
  const ex = view.exhibition;
  const phase = exhibitionPhase(ex, today);
  const halls: RoomHall[] = view.halls.map((h, i) => {
    const shares = wallShares(h.works.map((w) => w.heightCm));
    return {
      id: h.id,
      number: i + 1,
      title: h.title,
      intro: h.intro ? <MarkdownBody source={h.intro} /> : null,
      wall: h.wallColor && Object.hasOwn(WALL_COLORS, h.wallColor) ? WALL_COLORS[h.wallColor as WallColor].value : null,
      works: h.works.map((w, j) => ({ ...w, share: shares[j], ratio: workRatio(w) })),
    };
  });

  return (
    <main className="ex">
      {preview && <p className="ex-flag">Предпросмотр: так выставку увидят посетители</p>}
      {phase === 'closed' && <p className="ex-flag">Выставка завершилась {dateRange(ex.endsOn)}</p>}
      <header className="ex-hero">
        <Image src={ex.coverUrl} alt="" fill priority sizes="100vw" unoptimized={!isStorageUrl(ex.coverUrl)} className="pimg" />
        <div className="ex-hero-body wrap">
          <p className="eyebrow">Онлайн-выставка · {dateRange(ex.startsOn, ex.endsOn, true)}</p>
          <h1 className="t">{ex.title}</h1>
          {ex.subtitle && <p className="ex-sub">{ex.subtitle}</p>}
          {ex.curatorName && <p className="ex-cur">Куратор: {ex.curatorName}</p>}
          {halls.length > 0 && (
            <a className="btn" href="#enter">
              Войти в выставку ↓
            </a>
          )}
        </div>
      </header>

      <div id="enter" className="wrap stack pg">
        {ex.intro && <MarkdownBody source={ex.intro} />}
        {halls.length === 0 && <p className="empty">Экспозиция обновляется. Загляните чуть позже.</p>}
      </div>

      <Suspense>
        <ExhibitionRoom halls={halls} likes={likes} />
      </Suspense>

      <div className="wrap stack pg">
        {view.artists.length > 0 && (
          <section className="sec" aria-labelledby="ex-artists-t">
            <h2 id="ex-artists-t">Художники выставки</h2>
            <ul className="ex-artists" role="list">
              {view.artists.map((a) => (
                <li key={a.id}>
                  <Link href={`/gallery/artist/${a.id}`}>{a.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {others.length > 0 && (
          <section className="sec" aria-labelledby="ex-others-t">
            <div className="sec-head">
              <h2 id="ex-others-t">Другие выставки</h2>
              <Link className="more" href="/exhibitions">
                Все выставки
              </Link>
            </div>
            <ExhibitionGrid cards={others} today={today} />
          </section>
        )}
      </div>
    </main>
  );
}
