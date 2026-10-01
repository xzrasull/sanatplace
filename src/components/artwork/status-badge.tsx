import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'На модерации', className: 'bg-[#f3e6c8] text-[#6b4e12] border-transparent' },
  published: { label: 'Опубликовано', className: 'bg-[#dfead6] text-[#2f5a1e] border-transparent' },
  rejected: { label: 'Отклонено', className: 'bg-[#f3d9d4] text-[#8a2a1e] border-transparent' },
  sold: { label: 'Продано', className: 'bg-secondary text-foreground border-transparent' },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, className: '' };
  return <Badge className={cn('font-semibold', entry.className)}>{entry.label}</Badge>;
}
