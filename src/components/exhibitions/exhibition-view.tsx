// src/components/exhibitions/exhibition-view.tsx
import Image from 'next/image';
import Link from 'next/link';
import type { ExhibitionCard, ExhibitionViewData } from '@/src/lib/exhibitions/queries';
import { exhibitionPhase } from '@/src/lib/exhibitions/status';
import { dateRange } from '@/src/lib/journal/post-form';
import { isStorageUrl } from '@/src/lib/uploads/buckets';
import { MarkdownBody } from '@/src/components/journal/markdown-body';
import { ExhibitionGrid } from './exhibition-card';

// The entrance, the curator's text, the halls with links into the 3D rooms,
// the artists and other exhibitions.
export function ExhibitionView({
  view,
  today,
  others,
  hallHref,
  preview = false,
}: {
  view: ExhibitionViewData;
  today: string;
  others: ExhibitionCard[];
  hallHref: string; // the 3D halls page
  preview?: boolean;
}) {
  const ex = view.exhibition;
  const phase = exhibitionPhase(ex, today);
  const halls = view.halls;

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
            <Link className="btn" href={hallHref}>
              Войти в выставку →
            </Link>
          )}
        </div>
      </header>

      <div className="wrap stack pg">
        {ex.intro && <MarkdownBody source={ex.intro} />}
        {halls.length === 0 && <p className="empty">Экспозиция обновляется. Загляните чуть позже.</p>}
        {halls.length > 0 && (
          <section className="sec" aria-labelledby="ex-halls-t">
            <h2 id="ex-halls-t">Залы</h2>
            <ol className="ex-halls" role="list">
              {halls.map((h, i) => (
                <li key={h.id}>
                  <p className="eyebrow">
                    Зал {i + 1} · работ: {h.works.length}
                  </p>
                  <h3>{h.title}</h3>
                  {h.intro && <MarkdownBody source={h.intro} />}
                  <Link className="btn sm" href={`${hallHref}?hall=${i + 1}`}>
                    Войти в зал →
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
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
              <Link className="more" href="/journal?c=exhibition">
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
