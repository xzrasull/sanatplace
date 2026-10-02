// src/components/exhibitions/exhibition-hall.tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
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
  const room = useRef<HTMLDivElement>(null);
  const api = useRef<HallApi | null>(null);
  const hall = halls[n];
  const layout = useMemo(() => roomLayout(hall.works), [hall]);
  const last = hall.works.length - 1;

  useEffect(() => setCanFull(!!document.fullscreenEnabled), []);

  const toHall = (k: number) => {
    api.current = null;
    setFocus(-1);
    setN(k);
    const url = new URL(window.location.href);
    url.searchParams.set('hall', String(k + 1));
    window.history.replaceState(null, '', url);
  };
  const go = (i: number) => api.current?.walkTo(i);
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
      />

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
        Тяните, чтобы осмотреться. Нажмите на картину или на пол, чтобы подойти.
        <span className="ex-3d-keys"> Ходить: WASD и стрелки.</span>
      </p>

      <nav className="ex-room-nav" aria-label="От работы к работе">
        <button type="button" className="ex-room-btn" disabled={focus <= 0} onClick={() => go(focus - 1)} aria-label="Предыдущая работа">
          ←
        </button>
        {focus < last ? (
          <button type="button" className="ex-room-btn" onClick={() => go(focus + 1)}>
            {focus < 0 ? 'К первой работе →' : 'Следующая работа →'}
          </button>
        ) : n < halls.length - 1 ? (
          <button type="button" className="ex-room-btn" onClick={() => toHall(n + 1)}>
            Следующий зал →
          </button>
        ) : (
          <Link className="ex-room-btn" href={back}>
            Выйти из выставки
          </Link>
        )}
      </nav>
    </div>
  );
}
