'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { catalogHref, type CatalogParams } from '@/src/lib/catalog-href';
import type { CatalogOptions } from '@/src/lib/gallery/catalog';
import { startNavProgress } from '@/src/components/sanat/instant-feedback';
import { CustomSelect } from '@/src/components/sanat/custom-select';

export type ActiveTag = { label: string; href: string };

const SORTS = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'asc', label: 'Сначала дешевле' },
  { value: 'desc', label: 'Сначала дороже' },
  { value: 'az', label: 'По названию' },
];

function Chevron() {
  return (
    <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 9l7 7 7-7" />
    </svg>
  );
}

// Search on top, and one "Фильтры" button (with the number of active filters)
// that unfolds everything else: category chips with counts, technique, artist,
// sort and price. Chips and selects apply at once; prices apply with the button
// or Enter; the search applies as you type. Active filters show as tags under
// the search, each with a ✕. Without JavaScript it is a plain GET form.
export function CatalogFilters({
  options,
  values,
  activeCount,
  tags,
  query,
}: {
  options: CatalogOptions;
  values: CatalogParams;
  activeCount: number;
  tags: ActiveTag[];
  query: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // the one technique/artist/sort list that is open, if any
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const toggle = (v: boolean) => {
    setOpen(v);
    if (!v) setOpenSelect(null);
  };
  const selectProps = (name: string) => ({
    open: open && openSelect === name,
    onOpenChange: (v: boolean) => setOpenSelect((cur) => (v ? name : cur === name ? null : cur)),
    onChange: () => apply(),
  });

  // The search box is controlled so typing keeps focus while the page updates;
  // it follows the URL when the query changes elsewhere (e.g. the header search).
  const [q, setQ] = useState(values.q ?? '');
  const [urlQ, setUrlQ] = useState(values.q ?? '');
  if ((values.q ?? '') !== urlQ) {
    setUrlQ(values.q ?? '');
    setQ(values.q ?? '');
  }

  const hrefFromForm = () => {
    const data = new FormData(form.current!);
    const params: CatalogParams = {};
    for (const [key, value] of data) if (typeof value === 'string') params[key as keyof CatalogParams] = value;
    return catalogHref(params, 1);
  };
  const apply = (replace = false) => {
    const href = hrefFromForm();
    if (href !== location.pathname + location.search) startNavProgress();
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  useEffect(() => {
    if (q.trim() === (values.q ?? '').trim()) return;
    const t = window.setTimeout(() => apply(true), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text schedules a search
  }, [q]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // the "Применить" button folds the panel; Enter in a field keeps it as it is
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    if (submitter?.hasAttribute('data-apply')) toggle(false);
    apply();
  };

  const allCount = options.categories.reduce((n, c) => n + c.count, 0);

  return (
    <div className="fblock">
      <form ref={form} action="/gallery" className="fform" onSubmit={onSubmit} aria-label="Поиск и фильтры">
        <div className="toolbar">
          <input
            className="grow"
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию или художнику"
            aria-label="Поиск по каталогу"
            autoComplete="off"
          />
          <button
            className="btn sm fbtn"
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => toggle(!open)}
          >
            Фильтры
            {activeCount > 0 && (
              <span className="fcount">
                <span className="sr-only">, выбрано: </span>
                {activeCount}
              </span>
            )}
            <Chevron />
          </button>
        </div>
        <div className="panel fpanel" id={panelId} hidden={!open} key={query}>
          <fieldset className="field wide">
            <legend className="lbl">Категория</legend>
            <div className="chips">
              <label className="chip">
                <input
                  className="sr-only"
                  type="radio"
                  name="categoryId"
                  value=""
                  defaultChecked={!values.categoryId}
                  onChange={() => apply()}
                />
                Все <small>{allCount}</small>
              </label>
              {options.categories.map((c) => (
                <label className="chip" key={c.id}>
                  <input
                    className="sr-only"
                    type="radio"
                    name="categoryId"
                    value={c.id}
                    defaultChecked={values.categoryId === c.id}
                    onChange={() => apply()}
                  />
                  {c.name} <small>{c.count}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <CustomSelect
            name="techniqueId"
            label="Техника"
            options={[{ value: '', label: 'Все техники' }, ...options.techniques.map((t) => ({ value: t.id, label: t.name }))]}
            defaultValue={values.techniqueId ?? ''}
            {...selectProps('techniqueId')}
          />
          <CustomSelect
            name="artistId"
            label="Художник"
            options={[{ value: '', label: 'Все художники' }, ...options.artists.map((a) => ({ value: a.id, label: a.name }))]}
            defaultValue={values.artistId ?? ''}
            {...selectProps('artistId')}
          />
          <CustomSelect name="sort" label="Сортировка" options={SORTS} defaultValue={values.sort ?? 'new'} {...selectProps('sort')} />
          <label className="field">
            <span>Цена от, TJS</span>
            <input type="number" name="minPrice" min="0" inputMode="numeric" placeholder="0" defaultValue={values.minPrice ?? ''} />
          </label>
          <label className="field">
            <span>Цена до, TJS</span>
            <input type="number" name="maxPrice" min="0" inputMode="numeric" placeholder="10000" defaultValue={values.maxPrice ?? ''} />
          </label>
          <div className="factions">
            <button className="btn" type="submit" data-apply="">
              Применить фильтры
            </button>
            <Link href="/gallery" className="btn alt" scroll={false}>
              Сбросить
            </Link>
          </div>
        </div>
      </form>
      {tags.length > 0 && (
        <div className="chips tags">
          {tags.map((t) => (
            <Link key={t.label} className="chip on x" href={t.href} scroll={false} aria-label={`Убрать: ${t.label}`}>
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
