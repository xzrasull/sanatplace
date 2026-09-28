'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type SelectOption = { value: string; label: string };

// Opening one list closes any other on the page.
const OPEN_EVENT = 'csel:open';

// A select drawn in the site's style: a pill button that opens a listbox under
// it. The value travels in an input named `name` (invisible, but it takes part
// in the form's validation), so the form reads it like a native select; a
// choice sends a bubbling `input` event, as a native select does.
//
// Keys on the button: ↓ ↑ Enter Space open the list. In the list: ↓ ↑ move,
// Home End jump to the first or last option, Enter Space choose, Escape closes
// and returns focus to the button, Tab closes. A click outside closes it too.
// The parent may own the open state (`open` + `onOpenChange`), e.g. to close
// the lists together with a panel.
export function CustomSelect({
  name,
  label,
  options,
  defaultValue,
  className,
  labelClassName,
  required,
  open: openProp,
  onOpenChange,
  onChange,
}: {
  name: string;
  label: ReactNode;
  options: SelectOption[];
  defaultValue?: string;
  className?: string;
  labelClassName?: string;
  required?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(() =>
    options.some((o) => o.value === defaultValue) ? defaultValue! : (options[0]?.value ?? ''),
  );
  const [ownOpen, setOwnOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const open = openProp ?? ownOpen;
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const labelId = `${id}-l`;
  const buttonId = `${id}-b`;
  const listId = `${id}-o`;

  const setOpen = (v: boolean) => {
    if (v) document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    if (onOpenChange) onOpenChange(v);
    else setOwnOpen(v);
  };

  const current = options.find((o) => o.value === value) ?? options[0];
  const items = () => Array.from(list.current?.querySelectorAll<HTMLLIElement>('[role="option"]') ?? []);
  const focusAt = (i: number) => {
    const all = items();
    all[Math.max(0, Math.min(all.length - 1, i))]?.focus();
  };

  // while open: focus the chosen option (it scrolls into view with it), and
  // close on a click outside or when another list opens
  useEffect(() => {
    if (!open) return;
    const all = items();
    const i = all.findIndex((el) => el.dataset.value === value);
    all[Math.max(0, i)]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener(OPEN_EVENT, onOther);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener(OPEN_EVENT, onOther);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only opening moves the focus
  }, [open]);

  const choose = (v: string) => {
    setOpen(false);
    button.current?.focus();
    if (v === value) return;
    setValue(v);
    setInvalid(false);
    // the form may be read right away, before React re-renders the input
    if (input.current) {
      input.current.value = v;
      input.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
    onChange?.(v);
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLLIElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusAt(i + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusAt(i - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusAt(all.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (i >= 0) choose(all[i].dataset.value ?? '');
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        button.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className={className}>
      <span id={labelId} className={labelClassName}>
        {label}
      </span>
      <div className="csel" ref={root}>
        <button
          ref={button}
          id={buttonId}
          type="button"
          className="csel-btn"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${labelId} ${buttonId}`}
          data-invalid={invalid || undefined}
          onClick={() => setOpen(!open)}
          onKeyDown={onButtonKey}
        >
          <span className={required && value === '' ? 'csel-v csel-ph' : 'csel-v'}>{current?.label}</span>
          <svg className="csel-ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>
        <input
          ref={input}
          className="csel-in"
          name={name}
          value={value}
          onChange={() => {}}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          onInvalid={() => setInvalid(true)}
        />
        <ul
          ref={list}
          id={listId}
          className="csel-list"
          role="listbox"
          aria-labelledby={labelId}
          hidden={!open}
          onKeyDown={onListKey}
        >
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              tabIndex={-1}
              data-value={o.value}
              aria-selected={o.value === value}
              onClick={() => choose(o.value)}
              onMouseMove={(e) => {
                if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true });
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
