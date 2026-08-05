import { cn } from '@/lib/utils';

export function TabBar<T extends string>({ tabs, value, onChange, className }: { tabs: Array<{ value: T; label: string; count?: number }>; value: T; onChange: (value: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('flex overflow-x-auto border-b border-rp-border', className)}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return <button key={tab.value} role="tab" aria-selected={selected} onClick={() => onChange(tab.value)} className={cn('inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors', selected ? 'border-rp-brand text-rp-brand' : 'border-transparent text-rp-muted hover:text-rp-text')}>
          {tab.label}{tab.count !== undefined && <span className={cn('rounded-full px-1.5 py-0.5 text-rp-micro', selected ? 'bg-rp-teal-bg' : 'bg-rp-surface-3')}>{tab.count}</span>}
        </button>;
      })}
    </div>
  );
}
