import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-800',
        warning: 'border-transparent bg-yellow-100 text-yellow-800',
        info: 'border-transparent bg-blue-100 text-blue-800',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  const colorMap: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    AVAILABLE: 'success', CONFIRMED: 'info', CHECKED_IN: 'success', COMPLETED: 'success',
    RESOLVED: 'success', PAID: 'success', OCCUPIED: 'info', MAINTENANCE: 'warning',
    RESERVED: 'default', PENDING: 'warning', OPEN: 'destructive', IN_PROGRESS: 'info',
    CANCELLED: 'destructive', NO_SHOW: 'destructive', FAILED: 'destructive', PARTIAL: 'warning',
    CHECKED_OUT: 'secondary', CLOSED: 'secondary', SKIPPED: 'secondary', REFUNDED: 'secondary',
  };
  return <Badge variant={colorMap[status] || 'secondary'}>{label}</Badge>;
}

export { Badge, badgeVariants };
