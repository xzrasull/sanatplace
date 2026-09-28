'use client';

import { useId, useRef, type ComponentProps, type ReactNode } from 'react';
import { SubmitButton } from '@/src/components/form/submit-button';

// «Выйти» that asks first: the button opens a small window, and only its own
// «Выйти» sends the form. «Остаться» has the focus, so a stray Enter keeps the
// session; Escape and a click on the dimmed page close the window too.
export function SignOutButton({
  action,
  className,
  children = 'Выйти',
  note = 'Чтобы вернуться, нужно будет снова войти через Telegram.',
}: {
  action: ComponentProps<'form'>['action'];
  className?: string;
  children?: ReactNode;
  note?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => dialog.current?.close();

  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {children}
      </button>
      <dialog
        ref={dialog}
        className="confirm"
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        // the menu around listens for Escape too: this one only closes the window
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.stopPropagation();
        }}
      >
        <div className="confirm-body">
          <span className="confirm-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
            </svg>
          </span>
          <h2 id={titleId}>Выйти из аккаунта?</h2>
          <p>{note}</p>
          <form action={action} method={typeof action === 'string' ? 'post' : undefined} className="confirm-actions">
            <button type="button" className="btn alt" onClick={close} autoFocus>
              Остаться
            </button>
            <SubmitButton plain className="btn">
              Выйти
            </SubmitButton>
          </form>
        </div>
      </dialog>
    </>
  );
}
