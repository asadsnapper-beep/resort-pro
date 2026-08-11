'use client';

import { useTheme } from 'next-themes';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PageShell, PageHeader } from '@/components/patterns';
import { invoiceApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  FileText, Search, Plus, TrendingUp, CheckCircle2,
  Clock, AlertTriangle, ChevronRight, Receipt, ChevronLeft,
} from 'lucide-react';

interface InvoiceSummary {
  id: string; invoiceNumber: string; guestName: string; guestEmail?: string;
  status: string; total: number; paidAmount: number; createdAt: string;
  dueDate?: string;
  booking?: { id: string; confirmationNo: string } | null;
  items: { id: string }[];
}

interface Stats {
  totalInvoiced: number; totalCount: number; collected: number; paidCount: number;
  outstanding: number; thisMonth: number; thisMonthCount: number;
}

const STATUS_PILL: Record<string, { label: string; bg: string; border: string; text: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',       text: 'var(--rp-text-subtle)', icon: <FileText className="h-3 w-3" /> },
  SENT:      { label: 'Sent',      bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',   text: '#183153', icon: <Clock className="h-3 w-3" /> },
  PAID:      { label: 'Paid',      bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',   text: '#183153', icon: <CheckCircle2 className="h-3 w-3" /> },
  PARTIAL:   { label: 'Partial',   bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',   text: '#b89040', icon: <TrendingUp className="h-3 w-3" /> },
  OVERDUE:   { label: 'Overdue',   bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)',   text: '#c43c3c', icon: <AlertTriangle className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelled', bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',       text: 'var(--rp-text-muted)', icon: null },
};

const FILTERS = ['All', 'DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE'] as const;

export default function InvoicesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();
  const { tenant } = useAuthStore();
  const currency = tenant?.currency ?? 'BDT';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('All');
  const [page, setPage]     = useState(1);

  const params: Record<string, string> = { page: String(page) };
  if (status !== 'All') params.status = status;
  if (search)           params.search = search;

  const { data: listData, isLoading } = useQuery({
    queryKey: ['invoices', params],
    queryFn:  () => invoiceApi.list(params),
  });

  const { data: statsData } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn:  () => invoiceApi.stats(),
  });

  // GET /invoices returns { success, data: Invoice[], pagination: {...} } — a flat
  // array plus a sibling pagination object (see utils/response.ts `paginated()`),
  // not the nested `{ data: { items, total, ... } }` shape this used to assume.
  // That mismatch made this page always resolve an empty list regardless of how
  // many invoices actually existed.
  const invoices: InvoiceSummary[] = listData?.data?.data ?? [];
  const pagination = listData?.data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };
  const stats: Stats = statsData?.data?.data ?? { totalInvoiced: 0, totalCount: 0, collected: 0, paidCount: 0, outstanding: 0, thisMonth: 0, thisMonthCount: 0 };

  const fmt = (n: number) => `${currency} ${Number(n).toLocaleString()}`;

  return (
    <PageShell gap={4}>
      {/* Header */}
      <PageHeader
        title="Invoices"
        subtitle="Manage guest invoices and payments"
        align="end"
        actions={
          <button
            onClick={() => router.push('/dashboard/invoices/new')}
            className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#f8fafc] transition-opacity hover:opacity-80"
            style={{ background: 'var(--rp-btn-accent)' }}
          >
            <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} /> New Invoice
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Invoiced', value: fmt(stats.totalInvoiced), sub: `${stats.totalCount} invoices`,   bg: 'var(--rp-teal-bg)', color: '#183153', icon: FileText   },
          { label: 'Collected',      value: fmt(stats.collected),     sub: `${stats.paidCount} paid`,        bg: 'var(--rp-teal-bg)', color: '#183153', icon: CheckCircle2 },
          { label: 'Outstanding',    value: fmt(stats.outstanding),   sub: 'unpaid balance',                 bg: 'var(--rp-red-bg)', color: '#c43c3c', icon: AlertTriangle },
          { label: 'This Month',     value: fmt(stats.thisMonth),     sub: `${stats.thisMonthCount} invoice${stats.thisMonthCount !== 1 ? 's' : ''}`, bg: 'var(--rp-amber-bg)', color: '#b89040', icon: TrendingUp },
        ].map(({ label, value, sub, bg, color, icon: Icon }) => (
          <div key={label} className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px] bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: bg }}>
              <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color }} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#64748b]">{label}</div>
              <div className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[#183153] truncate">{value}</div>
              <div className="text-[11px] text-[#64748b]">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748b]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or invoice #…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[8px] pl-9 pr-4 text-[13px] text-[#183153] placeholder:text-[#64748b] focus:outline-none focus:ring-1 focus:ring-resort-600/20"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button key={f} onClick={() => { setStatus(f); setPage(1); }}
              className="rounded-[8px] border px-[12px] py-[7px] text-[12px] font-medium transition-colors"
              style={status === f
                ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#183153' }
                : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#a9c1d0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}>
              {f === 'All' ? 'All' : STATUS_PILL[f]?.label ?? f}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="overflow-hidden rounded-[14px] border bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="space-y-px p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-[10px]" style={{ background: 'var(--rp-surface-3)' }} />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f4f1]">
              <Receipt className="h-7 w-7 text-[#94a3b8]" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#183153]">No invoices found</p>
              <p className="mt-1 text-[12.5px] text-[#64748b]">Invoices are auto-created when bookings are confirmed.</p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]"
                style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                <th className="px-5 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Guest</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Booking</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const cfg = STATUS_PILL[inv.status] ?? STATUS_PILL.DRAFT;
                const outstanding = inv.total - inv.paidAmount;
                return (
                  <tr key={inv.id}
                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    className="cursor-pointer border-b transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                    style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                    <td className="px-5 py-[14px]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#e5f0f7]">
                          <FileText className="h-[13px] w-[13px] text-[#183153]" strokeWidth={2} />
                        </div>
                        <div>
                          <p className="font-mono text-[13px] font-bold text-[#183153]">{inv.invoiceNumber}</p>
                          <p className="text-[11.5px] text-[#64748b]">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-[14px]">
                      <p className="text-[13.5px] font-medium text-[#183153]">{inv.guestName}</p>
                      {inv.guestEmail && <p className="mt-px max-w-[180px] truncate text-[11.5px] text-[#64748b]">{inv.guestEmail}</p>}
                    </td>
                    <td className="hidden px-4 py-[14px] md:table-cell">
                      {inv.booking ? (
                        <span className="rounded-[6px] border border-[rgba(24,49,83,0.2)] bg-[#e5f0f7] px-[8px] py-[3px] font-mono text-[11.5px] font-bold text-[#183153]">
                          {inv.booking.confirmationNo}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#64748b]">Manual</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-[14px] lg:table-cell">
                      <p className="text-[13px] text-[#183153]">{new Date(inv.createdAt).toLocaleDateString()}</p>
                      {inv.dueDate && (
                        <p className="text-[11.5px] text-[#b89040]">Due {new Date(inv.dueDate).toLocaleDateString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-[14px] text-right">
                      <p className="text-[13.5px] font-semibold text-[#183153]">{fmt(inv.total)}</p>
                      {outstanding > 0 && inv.status !== 'DRAFT' && (
                        <p className="text-[11.5px] text-[#c43c3c]">Due {fmt(outstanding)}</p>
                      )}
                    </td>
                    <td className="px-4 py-[14px] text-center">
                      <span className="inline-flex items-center gap-1 rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
                        style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-[14px]">
                      <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#64748b]">
            Showing {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total} invoices
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border disabled:opacity-40"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const n = page <= 3 ? i + 1 : page + i - 2;
              if (n < 1 || n > pagination.totalPages) return null;
              return (
                <button key={n} onClick={() => setPage(n)}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border text-[12.5px] font-medium transition-colors"
                  style={n === page
                    ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#183153' }
                    : { borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>
                  {n}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border disabled:opacity-40"
              style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
