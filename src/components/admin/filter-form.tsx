'use client';

import type { ComponentProps } from 'react';

// A GET filter form that applies a choice at once: picking in a select sends
// it (typing in the search box still waits for Enter or the button).
export function FilterForm(props: ComponentProps<'form'>) {
  return (
    <form
      {...props}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    />
  );
}
