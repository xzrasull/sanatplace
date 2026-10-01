// src/components/exhibitions/exhibition-card.tsx
import Image from 'next/image';
import Link from 'next/link';
import type { ExhibitionCard } from '@/src/lib/exhibitions/queries';
import { exhibitionPhase, phaseNote } from '@/src/lib/exhibitions/status';
import { isStorageUrl } from '@/src/lib/uploads/buckets';

export const EX_CARD_SIZES = '(min-width: 1240px) 600px, (min-width: 640px) 50vw, 100vw';

// A cover with the dates; an upcoming exhibition has no link yet.
export function ExhibitionCardView({ card, today }: { card: ExhibitionCard; today: string }) {
  const phase = exhibitionPhase(card, today);
  const body = (
    <>
      <span className="ex-card-img">
        <Image src={card.coverUrl} alt="" fill sizes={EX_CARD_SIZES} unoptimized={!isStorageUrl(card.coverUrl)} />
      </span>
      <span className="ex-card-meta">
        <span className="ex-card-when">{phaseNote(card, phase)}</span>
        <span className="ex-card-t">{card.title}</span>
        {card.subtitle && <span className="ex-card-s">{card.subtitle}</span>}
      </span>
    </>
  );
  return phase === 'upcoming' ? (
    <div className="ex-card is-soon">{body}</div>
  ) : (
    <Link className="ex-card" href={`/exhibitions/${card.slug}`}>
      {body}
    </Link>
  );
}

export function ExhibitionGrid({ cards, today, big = false }: { cards: ExhibitionCard[]; today: string; big?: boolean }) {
  return (
    <ul className={big ? 'ex-grid big' : 'ex-grid'} role="list">
      {cards.map((c) => (
        <li key={c.id}>
          <ExhibitionCardView card={c} today={today} />
        </li>
      ))}
    </ul>
  );
}
