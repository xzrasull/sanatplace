// src/components/exhibitions/work-label.tsx
import type { WallWork } from '@/src/lib/exhibitions/queries';

// The museum label under a work: title, artist, year, technique, size, price.
export function WorkLabel({ work }: { work: WallWork }) {
  return (
    <div className="ex-label">
      <p className="ex-label-t">{work.title}</p>
      <p>
        {work.artistName}
        {work.year && `, ${work.year}`}
      </p>
      <p className="ex-label-m">
        {work.techniqueName} · {work.heightCm}×{work.widthCm} см
      </p>
      <p className="ex-label-p">{work.status === 'sold' ? 'Продано' : `${work.price} TJS`}</p>
      {work.curatorNote && <p className="ex-label-n">{work.curatorNote}</p>}
    </div>
  );
}
