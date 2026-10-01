import { unstable_cache } from 'next/cache';
import { getDb } from '@/src/db';
import { listPublishedExhibitions } from '@/src/lib/exhibitions/queries';
import { exhibitionPhase } from '@/src/lib/exhibitions/status';
import { todayInDushanbe } from '@/src/lib/journal/post-form';
import { pagePreview } from '@/src/lib/seo';
import { ExhibitionGrid } from '@/src/components/exhibitions/exhibition-card';

const DESCRIPTION = 'Онлайн-выставки: кураторские подборки работ художников, которые можно посмотреть и купить.';
export const metadata = { title: 'Выставки', description: DESCRIPTION, ...pagePreview({ title: 'Выставки', description: DESCRIPTION }) };

const cachedList = unstable_cache(() => listPublishedExhibitions(getDb()), ['exhibitions-list'], {
  revalidate: 60,
  tags: ['exhibitions'],
});

export default async function ExhibitionsPage() {
  const today = todayInDushanbe();
  const all = await cachedList();
  const by = (phase: string) => all.filter((e) => exhibitionPhase(e, today) === phase);
  const [open, soon, past] = [by('open'), by('upcoming').reverse(), by('closed')];

  return (
    <main>
      <div className="wrap stack pg">
        <header>
          <h1 className="t">Выставки</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">{DESCRIPTION}</p>
        </header>
        {all.length === 0 && <p className="empty">Скоро здесь откроется первая выставка.</p>}
        {open.length > 0 && (
          <section className="sec" aria-labelledby="ex-open-t">
            <h2 id="ex-open-t">Сейчас идёт</h2>
            <ExhibitionGrid cards={open} today={today} big />
          </section>
        )}
        {soon.length > 0 && (
          <section className="sec" aria-labelledby="ex-soon-t">
            <h2 id="ex-soon-t">Скоро</h2>
            <ExhibitionGrid cards={soon} today={today} />
          </section>
        )}
        {past.length > 0 && (
          <section className="sec" aria-labelledby="ex-past-t">
            <h2 id="ex-past-t">Прошедшие</h2>
            <ExhibitionGrid cards={past} today={today} />
          </section>
        )}
      </div>
    </main>
  );
}
