// src/components/exhibitions/exhibition-room.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { WallWork } from '@/src/lib/exhibitions/queries';
import type { LikeInfo } from '@/src/lib/likes/likes';
import { prefersReducedMotion } from '@/src/lib/sanat/reveal';
import { isStorageUrl } from '@/src/lib/uploads/buckets';
import { LikeButton } from '@/src/components/likes/like-button';
import { ExhibitionStage } from './exhibition-stage';
import { WorkLabel } from './work-label';

export type RoomWork = WallWork & { share: number; ratio: number };
export type RoomHall = { id: string; number: number; title: string; intro: ReactNode; wall: string | null; works: RoomWork[] };

const GUEST: LikeInfo = { count: 0, liked: false, state: 'guest' };
const MODE_KEY = 'ex-mode';
type Mode = '3d' | 'wall';

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
};

function Wall({ hall, onOpen }: { hall: RoomHall; onOpen: (id: string) => void }) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: -1 | 1) => {
    const t = track.current;
    if (t) t.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  // A vertical wheel turns the wall sideways while it can still go that way;
  // at either end the page scrolls as usual. Native listener: React's is passive.
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    const onWheel = (e: WheelEvent) => {
      if (t.scrollWidth <= t.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = t.scrollWidth - t.clientWidth;
      if ((e.deltaY < 0 && t.scrollLeft <= 0) || (e.deltaY > 0 && t.scrollLeft >= max - 1)) return;
      e.preventDefault();
      t.scrollLeft += e.deltaY;
    };
    t.addEventListener('wheel', onWheel, { passive: false });
    return () => t.removeEventListener('wheel', onWheel);
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      scroll(e.key === 'ArrowLeft' ? -1 : 1);
    }
  };
  return (
    <div className="ex-wall">
      <button type="button" className="ex-arrow prev" onClick={() => scroll(-1)} aria-label="Листать стену назад">
        ←
      </button>
      <ul ref={track} className="ex-track" tabIndex={0} onKeyDown={onKey} aria-label={`Стена: зал ${hall.number}`}>
        {hall.works.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              className="ex-work"
              style={{ '--s': w.share, '--r': w.ratio } as CSSProperties}
              onClick={() => onOpen(w.id)}
              aria-label={`Открыть: ${w.title}, ${w.artistName}`}
            >
              <Image
                src={w.imageUrl}
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 90vw"
                unoptimized={!isStorageUrl(w.imageUrl)}
                draggable={false}
              />
            </button>
            <WorkLabel work={w} />
          </li>
        ))}
      </ul>
      <button type="button" className="ex-arrow next" onClick={() => scroll(1)} aria-label="Листать стену вперёд">
        →
      </button>
    </div>
  );
}

// The halls, as a 3D room (where WebGL works) or as walls, and the work viewer. The open work lives in the
// address (?work=<id>), so it can be shared; Back and Escape close it.
export function ExhibitionRoom({ halls, likes }: { halls: RoomHall[]; likes: Record<string, LikeInfo> }) {
  const all = halls.flatMap((h) => h.works);
  const workId = useSearchParams()?.get('work') ?? null;
  const index = all.findIndex((w) => w.id === workId);
  const work = index >= 0 ? all[index] : undefined;
  const dialog = useRef<HTMLDialogElement>(null);
  // opened here (so Back undoes it) rather than arriving with ?work=
  const pushed = useRef(false);
  const [mode, setMode] = useState<Mode>('3d');
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    const ok = hasWebGL();
    setWebgl(ok);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(MODE_KEY);
    } catch {}
    if (!ok || saved === 'wall') setMode('wall');
  }, []);
  const choose = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (work && !d.open) d.showModal();
    if (!work && d.open) d.close();
  }, [work]);

  const urlWith = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('work', id);
    else url.searchParams.delete('work');
    return url;
  };
  const open = (id: string) => {
    window.history.pushState(null, '', urlWith(id));
    pushed.current = true;
  };
  const show = (id: string) => window.history.replaceState(null, '', urlWith(id));
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, '', urlWith(null));
  };

  return (
    <>
      {webgl && halls.length > 0 && (
        <div className="wrap ex-mode" role="group" aria-label="Как смотреть выставку">
          <button type="button" className="btn sm" aria-pressed={mode === '3d'} onClick={() => choose('3d')}>
            3D-зал
          </button>
          <button type="button" className="btn sm" aria-pressed={mode === 'wall'} onClick={() => choose('wall')}>
            Стеной
          </button>
        </div>
      )}
      {mode === '3d' && halls.length > 0 && <ExhibitionStage halls={halls} onOpen={open} />}
      {mode === 'wall' && halls.map((h) => (
        <section
          key={h.id}
          className="ex-hall"
          style={h.wall ? ({ '--wall': h.wall } as CSSProperties) : undefined}
          aria-labelledby={`hall-${h.id}`}
        >
          <div className="wrap ex-hall-head">
            <p className="eyebrow">Зал {h.number}</p>
            <h2 id={`hall-${h.id}`}>{h.title}</h2>
            {h.intro}
          </div>
          <Wall hall={h} onOpen={open} />
        </section>
      ))}

      <dialog
        ref={dialog}
        className="ex-viewer"
        aria-label={work ? `${work.title}, ${work.artistName}` : 'Просмотр работы'}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {work && (
          <div className="ex-viewer-in">
            <button type="button" className="ex-viewer-x" onClick={close} aria-label="Закрыть">
              ×
            </button>
            <div className="ex-viewer-img" style={{ '--r': work.ratio } as CSSProperties}>
              <Image src={work.imageUrl} alt={`${work.title}, ${work.artistName}`} fill sizes="90vw" unoptimized={!isStorageUrl(work.imageUrl)} />
            </div>
            <div className="ex-viewer-side">
              <WorkLabel work={work} />
              <LikeButton artworkId={work.id} info={likes[work.id] ?? GUEST} />
              <Link className="btn wide" href={`/gallery/artwork/${work.id}`}>
                {work.status === 'sold' ? 'Подробнее' : 'Подробнее и купить'}
              </Link>
              <div className="ex-viewer-nav">
                <button type="button" className="btn sm" disabled={index <= 0} onClick={() => show(all[index - 1].id)}>
                  ← Предыдущая
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={index >= all.length - 1}
                  onClick={() => show(all[index + 1].id)}
                >
                  Следующая →
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
