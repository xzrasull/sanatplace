// src/components/exhibitions/exhibition-stage.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { roomLayout } from '@/src/lib/exhibitions/room-layout';
import type { HallApi } from './hall-3d';
import type { RoomHall } from './exhibition-room';
import { WorkLabel } from './work-label';

// three.js comes only with this, so pages without a 3D hall stay light
const Hall3D = dynamic(() => import('./hall-3d'), {
  ssr: false,
  loading: () => <div className="ex-3d-canvas ex-3d-wait">Открываем зал…</div>,
});

const DEFAULT_WALL = '#fbfaf7';

// One hall at a time as a 3D room, with the halls as tabs and, under it, the
// label of the work in front of the visitor and buttons to walk from work to work.
export function ExhibitionStage({ halls, onOpen }: { halls: RoomHall[]; onOpen: (id: string) => void }) {
  const [n, setN] = useState(0);
  const [focus, setFocus] = useState(-1);
  const [canFull, setCanFull] = useState(false);
  const [touched, setTouched] = useState(false); // the hint goes once the visitor has moved
  const stage = useRef<HTMLDivElement>(null);
  const api = useRef<HallApi | null>(null);
  const hall = halls[n];
  const layout = useMemo(() => roomLayout(hall.works), [hall]);
  const images = useMemo(() => hall.works.map((w) => w.imageUrl), [hall]);
  const work = focus >= 0 ? hall.works[focus] : undefined;
  const last = hall.works.length - 1;

  useEffect(() => setCanFull(!!document.fullscreenEnabled), []);

  const toHall = (k: number) => {
    api.current = null;
    setFocus(-1);
    setN(k);
  };
  const go = (i: number) => api.current?.walkTo(i);
  const full = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen();
  };

  return (
    <section className="ex-hall ex-3d" style={{ '--wall': hall.wall ?? DEFAULT_WALL } as CSSProperties} aria-labelledby="ex-3d-t">
      <div className="wrap ex-hall-head">
        {halls.length > 1 && (
          <nav className="ex-3d-tabs" aria-label="Залы выставки">
            {halls.map((h, k) => (
              <button key={h.id} type="button" className="btn sm" aria-current={k === n ? 'true' : undefined} onClick={() => toHall(k)}>
                Зал {h.number}. {h.title}
              </button>
            ))}
          </nav>
        )}
        <p className="eyebrow">
          Зал {hall.number}
          {halls.length > 1 && ` из ${halls.length}`}
        </p>
        <h2 id="ex-3d-t">{hall.title}</h2>
        {hall.intro}
      </div>

      <div ref={stage} className="ex-3d-stage" onPointerDown={() => setTouched(true)} onKeyDown={() => setTouched(true)}>
        <Hall3D
          key={hall.id}
          layout={layout}
          images={images}
          wall={hall.wall ?? DEFAULT_WALL}
          label={`Зал ${hall.number} «${hall.title}» в 3D: работ — ${hall.works.length}`}
          onFocus={setFocus}
          onOpen={(i) => onOpen(hall.works[i].id)}
          onReady={(a) => (api.current = a)}
        />
        <p className="ex-3d-hint" hidden={touched}>
          Тяните, чтобы осмотреться. Нажмите на картину или на пол, чтобы подойти.
          <span className="ex-3d-keys"> Ходить: WASD и стрелки.</span>
        </p>
        {canFull && (
          <button type="button" className="ex-3d-full" onClick={full} aria-label="Во весь экран">
            ⛶
          </button>
        )}
      </div>

      <div className="wrap ex-3d-bar">
        <div aria-live="polite">{work ? <WorkLabel work={work} /> : <p className="ex-3d-none">Подойдите к картине, чтобы прочитать подпись.</p>}</div>
        <div className="ex-3d-nav">
          <button type="button" className="btn sm" disabled={focus <= 0} onClick={() => go(focus - 1)}>
            ← Предыдущая работа
          </button>
          {focus < last ? (
            <button type="button" className="btn sm" onClick={() => go(focus + 1)}>
              {focus < 0 ? 'К первой работе →' : 'Следующая работа →'}
            </button>
          ) : (
            n < halls.length - 1 && (
              <button type="button" className="btn sm" onClick={() => toHall(n + 1)}>
                Следующий зал →
              </button>
            )
          )}
          {work && (
            <button type="button" className="btn sm ex-3d-more" onClick={() => onOpen(work.id)}>
              Подробнее
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
