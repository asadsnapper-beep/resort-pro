import type { Key, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';

export type DataColumn<Row> = {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  className?: string;
  headerClassName?: string;
};

/** Accessible, dense table shell for staff data. Sorting/paging stays page-owned. */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  loading = false,
  emptyTitle = 'Nothing to show yet',
  emptyDescription,
  footer,
  className,
}: {
  columns: DataColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => Key;
  onRowClick?: (row: Row) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  footer?: ReactNode;
  className?: string;
}) {
  if (loading) {
    return <div className={cn('h-56 animate-pulse rounded-none border-2 border-rp-border bg-rp-surface', className)} />;
  }
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className={className} />;
  }
  return (
    <div className={cn('overflow-hidden rounded-none border-2 border-rp-border bg-rp-surface shadow-none', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead className="bg-rp-surface-2">
            <tr>{columns.map((column) => <th key={column.id} className={cn('whitespace-nowrap border-b-2 border-rp-border px-4 py-3 text-rp-micro font-bold uppercase tracking-[0.08em] text-rp-muted', column.headerClassName)}>{column.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => <tr key={getRowKey(row)} onClick={() => onRowClick?.(row)} className={cn('border-b border-rp-border last:border-0', onRowClick && 'cursor-pointer hover:bg-rp-surface-2')}>
              {columns.map((column) => <td key={column.id} className={cn('px-4 py-3 text-rp-body text-rp-text', column.className)}>{column.cell(row)}</td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-rp-border px-4 py-3">{footer}</div>}
    </div>
  );
}
