'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export type SelectOption = { value: string; label: string };

// A select drawn in the site's style: a pill button that opens a listbox under
// it. The value travels in a hidden input named `name`, so the surrounding form
// reads it like a native select. Whether the list is open is up to the parent,
// which keeps at most one list open at a time.
//
// Keys on the button: ↓ ↑ Enter Space open the list. In the list: ↓ ↑ move,
// Home End jump to the first or last option, Enter Space choose, Escape closes
// and returns focus to the button, Tab closes. A click outside closes it too.
export function CustomSelect({
  name,
  label,
  options,
  defaultValue,
  open,
  onOpenChange,
  onChange,
}: {
  name: string;
  label: string;
  options: SelectOption[];
  defaultValue: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const labelId = `${id}-l`;
  const buttonId = `${id}-b`;
  const listId = `${id}-o`;

  const current = options.find((o) => o.value === value) ?? options[0];
  const items = () => Array.from(list.current?.querySelectorAll<HTMLLIElement>('[role="option"]') ?? []);
  const focusAt = (i: number) => {
    const all = items();
    all[Math.max(0, Math.min(all.length - 1, i))]?.focus();
  };

  // on opening, focus the chosen option (it scrolls into view with it)
  useEffect(() => {
    if (!open) return;
    const all = items();
    const i = all.findIndex((el) => el.dataset.value === value);
    all[Math.max(0, i)]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only opening moves the focus
  }, [open]);

  const choose = (v: string) => {
    onOpenChange(false);
    button.current?.focus();
    if (v === value) return;
    // the form is read right away, before React re-renders the input
    if (input.current) input.current.value = v;
    setValue(v);
    onChange?.(v);
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      onOpenChange(true);
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
        onOpenChange(false);
        button.current?.focus();
        break;
      case 'Tab':
        onOpenChange(false);
        break;
    }
  };

  return (
    <div className="field">
      <span id={labelId}>{label}</span>
      <div className="csel" ref={root}>
        <input ref={input} type="hidden" name={name} value={value} />
        <button
          ref={button}
          id={buttonId}
          type="button"
          className="csel-btn"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${labelId} ${buttonId}`}
          onClick={() => onOpenChange(!open)}
          onKeyDown={onButtonKey}
        >
          <span className="csel-v">{current?.label}</span>
          <svg className="csel-ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>
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
