import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<Tone, string> = {
  brand: 'bg-rp-teal-bg text-rp-brand',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-rp-amber-bg text-amber-700 dark:text-amber-300',
  danger: 'bg-rp-red-bg text-rp-danger',
  neutral: 'bg-rp-surface-3 text-rp-muted',
};

/** Dense operational metric card for the Super Admin console. */
export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  trend,
  tone = 'brand',
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ElementType;
  description?: ReactNode;
  trend?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <section className={cn('rounded-none border-2 border-rp-border bg-rp-surface p-4 shadow-none', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-rp-meta font-medium text-rp-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-rp-text">{value}</p>
        </div>
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-none', TONE[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {(description || trend) && (
        <div className="mt-3 flex min-h-4 items-center justify-between gap-2 text-rp-meta">
          <span className="truncate text-rp-muted">{description}</span>
          {trend && <span className="shrink-0 font-medium text-rp-brand">{trend}</span>}
        </div>
      )}
    </section>
  );
}

/** A responsive full-width metric grid; page content must not add max-width. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}
