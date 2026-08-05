import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FormField({ label, help, error, required, children, className }: { label: ReactNode; help?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-rp-label font-bold text-rp-text">{label}{required && <span className="ml-1 text-rp-danger">*</span>}</span>
      {children}
      {error ? <span className="mt-1 block text-rp-meta text-rp-danger">{error}</span> : help && <span className="mt-1 block text-rp-meta text-rp-muted">{help}</span>}
    </label>
  );
}
