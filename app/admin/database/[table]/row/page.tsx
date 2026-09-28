import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/src/db';
import { requireStaff } from '@/src/lib/auth/staff';
import { DB_TABLES, columnsOf, display, getRow, isTableName, type ColumnInfo } from '@/src/lib/admin/db-editor';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { removeRow, saveRow } from '../../actions';
import { SubmitButton } from '@/src/components/form/submit-button';
import { CustomSelect } from '@/src/components/sanat/custom-select';

export const metadata = { title: 'База данных', robots: { index: false, follow: false } };

const control = 'w-full rounded-sm border border-input bg-transparent px-4 py-2.5 text-base';

const TYPE_LABEL: Record<ColumnInfo['kind'], string> = {
  uuid: 'uuid',
  text: 'текст',
  integer: 'целое',
  bigint: 'целое',
  boolean: 'да/нет',
  timestamp: 'дата и время, UTC',
  enum: 'список',
};

function Field({ c, value, inserting }: { c: ColumnInfo; value: unknown; inserting: boolean }) {
  const name = `f:${c.key}`;
  const text = display(c, value);
  const optional = !c.notNull || (inserting && c.hasDefault);
  const note = [TYPE_LABEL[c.kind], c.primary && 'ключ', !c.notNull && 'можно пусто → NULL', inserting && c.hasDefault && 'пусто → по умолчанию']
    .filter(Boolean)
    .join(' · ');

  const label = (
    <span className="flex flex-wrap items-baseline gap-x-3">
      <code>{c.name}</code>
      <span className="text-xs text-muted-foreground">{note}</span>
    </span>
  );

  if (c.kind === 'enum' || c.kind === 'boolean') {
    const values = c.kind === 'enum' ? (c.enumValues ?? []) : ['true', 'false'];
    return (
      <CustomSelect
        className="grid gap-1.5"
        name={name}
        label={label}
        options={[
          ...(optional ? [{ value: '', label: inserting && c.hasDefault ? '(по умолчанию)' : 'NULL' }] : []),
          ...values.map((o) => ({
            value: o,
            label: c.kind === 'boolean' ? (o === 'true' ? 'да (true)' : 'нет (false)') : o,
          })),
        ]}
        defaultValue={text}
        required={!optional}
      />
    );
  }

  let input;
  if (c.kind === 'text') {
    input = <textarea name={name} defaultValue={text} rows={text.length > 80 ? 5 : 2} className={control} />;
  } else {
    input = (
      <input
        name={name}
        defaultValue={text}
        className={control}
        type={c.kind === 'timestamp' ? 'datetime-local' : c.kind === 'uuid' ? 'text' : 'number'}
        step={c.kind === 'timestamp' ? 1 : undefined}
        spellCheck={false}
        required={!optional}
      />
    );
  }
  return (
    <label className="grid gap-1.5">
      {label}
      {input}
    </label>
  );
}

// One row of any table: edit and save, or delete. `?new=1` adds a row.
export default async function RowPage({
  params,
  searchParams,
}: {
  params: Promise<{ table: string }>;
  searchParams: Promise<{ key?: string; new?: string; error?: string; saved?: string }>;
}) {
  const role = await requireStaff('admin');
  const { table } = await params;
  if (!isTableName(table)) notFound();
  const sp = await searchParams;
  const inserting = Boolean(sp.new) || !sp.key;
  let row: Record<string, unknown> | undefined;
  if (!inserting) {
    try {
      row = await getRow(getDb(), table, sp.key!);
    } catch {
      notFound();
    }
    if (!row) notFound();
  }
  const columns = columnsOf(table);

  return (
    <main className="max-w-3xl">
      <AdminNav role={role} />
      <p className="text-sm text-muted-foreground">
        <Link href="/admin/database" className="hover:text-brand">
          База данных
        </Link>{' '}
        /{' '}
        <Link href={`/admin/database/${table}`} className="hover:text-brand">
          {DB_TABLES[table].label}
        </Link>
      </p>
      <h1 className="mt-2">{inserting ? 'Новая запись' : 'Запись'}</h1>
      {sp.error && (
        <p role="alert" className="mt-4 rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {sp.error}
        </p>
      )}
      {sp.saved && (
        <p role="status" className="mt-4 rounded-sm bg-accent px-4 py-2 text-sm">
          Сохранено.
        </p>
      )}

      <form action={saveRow} className="mt-6 grid gap-5 rounded-sm border border-border bg-card p-6">
        <input type="hidden" name="table" value={table} />
        {!inserting && <input type="hidden" name="key" value={sp.key} />}
        {columns.map((c) => (
          <Field key={c.key} c={c} value={row?.[c.key]} inserting={inserting} />
        ))}
        <div className="flex flex-wrap gap-3">
          <SubmitButton size="lg">
            {inserting ? 'Добавить' : 'Сохранить'}
          </SubmitButton>
          <Link href={`/admin/database/${table}`} className="inline-flex min-h-10 items-center px-2 text-muted-foreground hover:text-brand">
            К таблице
          </Link>
        </div>
      </form>

      {!inserting && (
        <form action={removeRow} className="mt-6 grid gap-4 rounded-sm border border-destructive/40 p-6">
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="key" value={sp.key} />
          <h2 className="text-lg">Удалить запись</h2>
          <p className="text-sm text-muted-foreground">
            Удаление нельзя отменить. Связанные записи (например, лайки картины) удалятся вместе с ней, если так
            настроена база; иначе база откажет и покажет причину.
          </p>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="confirm" required className="size-5" />
            Да, удалить эту запись
          </label>
          <div>
            <SubmitButton variant="destructive" size="lg">
              Удалить
            </SubmitButton>
          </div>
        </form>
      )}
    </main>
  );
}
