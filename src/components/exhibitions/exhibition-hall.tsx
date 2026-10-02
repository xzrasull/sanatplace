// src/components/exhibitions/exhibition-hall.tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { HallData } from '@/src/lib/exhibitions/hall-data';
import { roomLayout } from '@/src/lib/exhibitions/room-layout';
import type { HallApi } from './hall-3d';

// three.js comes only with this page
const Hall3D = dynamic(() => import('./hall-3d'), {
  ssr: false,
  loading: () => <div className="ex-3d-canvas ex-3d-wait">Открываем зал…</div>,
});

const DEFAULT_WALL = '#fbfaf7';

// The exhibition's halls over the whole screen, one at a time: the 3D room with
// the labels on its walls, the halls as tabs and arrows from work to work.
export function ExhibitionHall({ title, back, halls, start }: { title: string; back: string; halls: HallData[]; start: number }) {
  const [n, setN] = useState(start);
  const [focus, setFocus] = useState(-1);
  const [canFull, setCanFull] = useState(false);
  const [touched, setTouched] = useState(false); // the hint goes once the visitor has moved
  const router = useRouter();
  const room = useRef<HTMLDivElement>(null);
  const api = useRef<HallApi | null>(null);
  const hall = halls[n];
  const layout = useMemo(() => roomLayout(hall.works), [hall]);
  const last = hall.works.length - 1;

  useEffect(() => setCanFull(!!document.fullscreenEnabled), []);

  const toHall = (k: number) => {
    api.current = null;
    target.current = -1;
    setFocus(-1);
    setN(k);
    const url = new URL(window.location.href);
    url.searchParams.set('hall', String(k + 1));
    window.history.replaceState(null, '', url);
  };
  // the work the visitor is at: the one in front, else the last one walked to
  const target = useRef(-1);
  const at = focus >= 0 ? focus : target.current;
  const go = (i: number) => {
    target.current = i;
    api.current?.walkTo(i);
  };
  const prev = () => (at > 0 ? go(at - 1) : n > 0 && toHall(n - 1));
  const next = () => (at < last ? go(at + 1) : n < halls.length - 1 && toHall(n + 1));
  const nextLabel = at < 0 ? 'К первой работе' : at < last ? 'Следующая работа' : n < halls.length - 1 ? 'Следующий зал' : null;
  const prevLabel = at > 0 ? 'Предыдущая работа' : n > 0 ? 'Предыдущий зал' : null;
  // the cross: held down, it walks or turns like the keyboard's arrows
  const pad = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      api.current?.hold(key, true);
    },
    onPointerUp: () => api.current?.hold(key, false),
    onPointerCancel: () => api.current?.hold(key, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const full = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void room.current?.requestFullscreen();
  };

  return (
    <div
      ref={room}
      className="ex-room"
      style={{ '--wall': hall.wall ?? DEFAULT_WALL } as CSSProperties}
      onPointerDown={() => setTouched(true)}
      onKeyDown={() => setTouched(true)}
    >
      <Hall3D
        key={hall.id}
        layout={layout}
        works={hall.works}
        wall={hall.wall ?? DEFAULT_WALL}
        label={`Зал ${hall.number} «${hall.title}» в 3D: работ — ${hall.works.length}`}
        onFocus={setFocus}
        onReady={(a) => (api.current = a)}
        onMore={(i) => router.push(`/gallery/artwork/${hall.works[i].id}`)}
      />
      {/* the labels on the walls, for the keyboard and screen readers */}
      <ul className="sr-only" aria-label="Работы зала">
        {hall.works.map((w) => (
          <li key={w.id}>
            <Link href={`/gallery/artwork/${w.id}`}>
              Подробнее: {w.title}, {w.artistName}
            </Link>
          </li>
        ))}
      </ul>

      <header className="ex-room-top">
        <Link className="ex-room-btn" href={back}>
          ← <span className="ex-room-ex">{title}</span>
        </Link>
        {halls.length > 1 && (
          <nav className="ex-room-tabs" aria-label="Залы выставки">
            {halls.map((h, k) => (
              <button key={h.id} type="button" className="ex-room-btn" aria-current={k === n ? 'true' : undefined} onClick={() => toHall(k)}>
                {`Зал ${h.number}`}
                <span className="ex-room-ht">{`. ${h.title}`}</span>
              </button>
            ))}
          </nav>
        )}
        {canFull && (
          <button type="button" className="ex-room-btn ex-room-full" onClick={full} aria-label="Во весь экран">
            ⛶
          </button>
        )}
      </header>

      <h1 className="sr-only">
        {title}. Зал {hall.number}: {hall.title}
      </h1>
      <p className="ex-room-hint" hidden={touched}>
        <span className="ex-hint-touch">Стрелки ‹ › — к соседней картине. Крестовина — ходить. Пальцем — осмотреться.</span>
        <span className="ex-hint-mouse">Стрелки ‹ › — к соседней картине. Тяните мышью, чтобы осмотреться. Ходить: WASD.</span>
      </p>

      {prevLabel && (
        <button type="button" className="ex-room-side prev" onClick={prev} aria-label={prevLabel}>
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      {nextLabel && (
        <button type="button" className="ex-room-side next" onClick={next} aria-label={nextLabel}>
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}

      <div className="ex-room-nav">
        {at >= 0 && (
          <p className="ex-room-btn ex-room-count" aria-live="polite">
            {at + 1} / {hall.works.length}
          </p>
        )}
        {at < 0 && nextLabel && (
          <button type="button" className="ex-room-btn" onClick={next}>
            К первой работе →
          </button>
        )}
        {at === last && nextLabel && (
          <button type="button" className="ex-room-btn" onClick={next}>
            Следующий зал →
          </button>
        )}
        {at === last && !nextLabel && (
          <Link className="ex-room-btn" href={back}>
            Выйти из выставки
          </Link>
        )}
      </div>

      <div className="ex-pad" role="group" aria-label="Ходить по залу">
        <button type="button" className="up" aria-label="Идти вперёд" {...pad('w')}>
          ▲
        </button>
        <button type="button" className="left" aria-label="Повернуть налево" {...pad('arrowleft')}>
          ◀
        </button>
        <button type="button" className="right" aria-label="Повернуть направо" {...pad('arrowright')}>
          ▶
        </button>
        <button type="button" className="down" aria-label="Идти назад" {...pad('s')}>
          ▼
        </button>
      </div>
    </div>
  );
}
