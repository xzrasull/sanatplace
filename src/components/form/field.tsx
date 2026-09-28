import type { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

// how a form field lays out its label and control (CustomSelect takes it too)
export const FIELD_CLASS = 'grid gap-1.5 text-sm font-medium';

// A wrapping <label>: label text first, control second. Playwright's
// getByLabel relies on this structure.
export function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn(FIELD_CLASS, className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}
