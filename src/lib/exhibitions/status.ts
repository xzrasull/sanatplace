import { dateRange } from '../journal/post-form';

// Where an exhibition is in its life, by Dushanbe dates (YYYY-MM-DD compare as strings).
export type ExhibitionPhase = 'draft' | 'upcoming' | 'open' | 'closed';

export function exhibitionPhase(
  e: { status: 'draft' | 'published'; startsOn: string; endsOn: string },
  today: string,
): ExhibitionPhase {
  if (e.status === 'draft') return 'draft';
  if (today < e.startsOn) return 'upcoming';
  return today > e.endsOn ? 'closed' : 'open';
}

export const PHASE_LABEL: Record<ExhibitionPhase, string> = {
  draft: 'Черновик',
  upcoming: 'Скоро',
  open: 'Идёт',
  closed: 'Закрыта',
};

// "Откроется 1 ноября", "до 30 ноября", "Завершилась 30 ноября"
export function phaseNote(e: { startsOn: string; endsOn: string }, phase: ExhibitionPhase): string {
  if (phase === 'upcoming') return `Откроется ${dateRange(e.startsOn)}`;
  if (phase === 'closed') return `Завершилась ${dateRange(e.endsOn)}`;
  return `до ${dateRange(e.endsOn)}`;
}

// Works an exhibition shows; anything else on it is skipped quietly.
export const VISIBLE_STATUSES = ['published', 'sold'] as const;
