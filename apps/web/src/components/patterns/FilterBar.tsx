import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  activeFilters = [],
  onRemoveFilter,
  onReset,
  className,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  activeFilters?: Array<{ key: string; label: string }>;
  onRemoveFilter?: (key: string) => void;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('rounded-none border-2 border-rp-border bg-rp-surface p-3 shadow-none', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {onSearchChange && (
          <label className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rp-faint" />
            <input value={search ?? ''} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} className="h-9 w-full rounded-none border border-rp-border-md bg-rp-surface px-9 text-sm text-rp-text outline-none placeholder:text-rp-faint focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg" />
          </label>
        )}
        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        {onReset && (activeFilters.length > 0 || search) && <button onClick={onReset} className="text-rp-meta font-semibold text-rp-brand hover:text-rp-brand-hover">Reset</button>}
      </div>
      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-rp-border pt-3">
          {activeFilters.map((filter) => (
            <button key={filter.key} onClick={() => onRemoveFilter?.(filter.key)} className="inline-flex items-center gap-1 rounded-none bg-rp-teal-bg px-2 py-1 text-rp-micro font-medium text-rp-brand">
              {filter.label}<X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
