'use client';

import type { ComponentProps } from 'react';

// A GET filter form that applies a choice at once: picking in a select (a
// native one or a CustomSelect) sends it; typing in the search box still waits
// for Enter or the button.
export function FilterForm(props: ComponentProps<'form'>) {
  return (
    <form
      {...props}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
      onInput={(e) => {
        if (e.target instanceof HTMLElement && e.target.classList.contains('csel-in')) e.currentTarget.requestSubmit();
      }}
    />
  );
}
