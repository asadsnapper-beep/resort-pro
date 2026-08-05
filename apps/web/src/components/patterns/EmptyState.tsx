import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ElementType;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-48 flex-col items-center justify-center rounded-none border-2 border-dashed border-rp-border-md bg-rp-surface px-6 py-10 text-center', className)}>
      {Icon && <Icon className="mb-3 h-7 w-7 text-rp-faint" />}
      <p className="text-sm font-semibold text-rp-text">{title}</p>
      {description && <p className="mt-1 max-w-md text-rp-body text-rp-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
