import { requireStaff } from '@/src/lib/auth/staff';
import { staffPasswordDates } from '@/src/lib/auth/staff-accounts';
import { MIN_STAFF_PASSWORD_LENGTH, STAFF_ACCOUNTS } from '@/src/lib/auth/staff-password';
import { AdminNav } from '@/src/components/admin/admin-nav';
import { Field } from '@/src/components/form/field';
import { Input } from '@/src/components/ui/input';
import { SubmitButton } from '@/src/components/form/submit-button';
import { changeStaffPassword } from './actions';

export const metadata = {
  title: 'Доступы',
};

const ROLE_NAMES = { admin: 'Администратор', moderator: 'Модератор' } as const;

const ERRORS: Record<string, string> = {
  short: `Новый пароль слишком короткий: нужно не меньше ${MIN_STAFF_PASSWORD_LENGTH} символов.`,
  mismatch: 'Новый пароль и повтор не совпадают.',
  current: 'Ваш текущий пароль введён неверно.',
  save: 'Не удалось сохранить пароль. Попробуйте ещё раз чуть позже.',
};

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Dushanbe',
});

// Admin only: set a new password for the admin or the moderator login.
export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string; for?: string }>;
}) {
  const role = await requireStaff('admin');
  const { done, error, for: errorFor } = await searchParams;
  const { ready, changed } = await staffPasswordDates();

  return (
    <main>
      <AdminNav role={role} />
      <h1>Доступы</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Смена пароля для входа в админку. После смены все, кто вошёл под этим логином раньше, будут выведены из
        админки и должны войти с новым паролем.
      </p>
      {!ready && (
        <p role="alert" className="notice err mt-4 max-w-xl">
          Таблица паролей в базе ещё не создана, поэтому сменить пароль пока нельзя. Сейчас действуют пароли из
          настроек Vercel.
        </p>
      )}
      <div className="mt-6 grid max-w-xl gap-6">
        {STAFF_ACCOUNTS.map((account) => {
          const at = changed.get(account.login);
          return (
            <section
              key={account.login}
              aria-labelledby={`staff-${account.login}`}
              className="rounded-sm border border-border bg-card p-5 sm:p-6"
            >
              <h2 id={`staff-${account.login}`} className="text-xl">
                {ROLE_NAMES[account.role]} · логин <code>{account.login}</code>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {at ? `Пароль изменён ${dateFormat.format(at)}` : 'Пароль из настроек Vercel, в админке не менялся'}
              </p>
              {done === account.login && (
                <p role="status" className="notice mt-4">
                  Пароль изменён.
                </p>
              )}
              {error && errorFor === account.login && ERRORS[error] && (
                <p role="alert" className="notice err mt-4">
                  {ERRORS[error]}
                </p>
              )}
              <form action={changeStaffPassword} className="mt-4 grid gap-4">
                <input type="hidden" name="login" value={account.login} />
                {/* lets password managers tie the new password to this login */}
                <input type="text" name="username" value={account.login} autoComplete="username" readOnly hidden />
                <Field label={`Новый пароль (не меньше ${MIN_STAFF_PASSWORD_LENGTH} символов)`}>
                  <Input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    minLength={MIN_STAFF_PASSWORD_LENGTH}
                    required
                  />
                </Field>
                <Field label="Повторите новый пароль">
                  <Input
                    type="password"
                    name="repeat"
                    autoComplete="new-password"
                    minLength={MIN_STAFF_PASSWORD_LENGTH}
                    required
                  />
                </Field>
                <Field label="Ваш текущий пароль администратора">
                  <Input type="password" name="current" autoComplete="current-password" required />
                </Field>
                <SubmitButton className="justify-self-start" disabled={!ready}>
                  Сменить пароль
                </SubmitButton>
              </form>
            </section>
          );
        })}
      </div>
    </main>
  );
}
