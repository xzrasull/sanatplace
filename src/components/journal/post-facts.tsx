import { dateRange } from '@/src/lib/journal/post-form';

// Dates, time, place and price of an exhibition or event; empty ones are left out.
export function PostFacts({
  startsOn,
  endsOn,
  timeText,
  place,
  priceText,
}: {
  startsOn: string | null;
  endsOn: string | null;
  timeText: string | null;
  place: string | null;
  priceText: string | null;
}) {
  const facts = [
    ['Даты', startsOn ? dateRange(startsOn, endsOn, true) : null],
    ['Время', timeText],
    ['Место', place],
    ['Стоимость', priceText],
  ].filter((f): f is [string, string] => Boolean(f[1]));
  if (facts.length === 0) return null;
  return (
    <dl className="pfacts">
      {facts.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
