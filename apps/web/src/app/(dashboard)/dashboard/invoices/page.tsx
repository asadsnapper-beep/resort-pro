'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { invoiceApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Search, Plus, TrendingUp, CheckCircle2,
  Clock, AlertTriangle, ChevronRight, Receipt,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  guestName: string;
  guestEmail?: string;
  status: string;
  total: number;
  paidAmount: number;
  createdAt: string;
  dueDate?: string;
  booking?: { id: string; confirmationNo: string } | null;
  items: { id: string }[];
}

interface Stats {
  totalInvoiced: number;
  totalCount: number;
  collected: number;
  paidCount: number;
  outstanding: number;
}

/* ── Status config ─────────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600',    icon: <FileText className="h-3 w-3" /> },
  SENT:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700',    icon: <Clock className="h-3 w-3" /> },
  PAID:      { label: 'Paid',      color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="h-3 w-3" /> },
  PARTIAL:   { label: 'Partial',   color: 'bg-amber-100 text-amber-700',  icon: <TrendingUp className="h-3 w-3" /> },
  OVERDUE:   { label: 'Overdue',   color: 'bg-red-100 text-red-700',      icon: <AlertTriangle className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-400',    icon: null },
};

const FILTERS = ['All', 'DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE'] as const;

/* ════════════════════════════════════════════════════════════════════════════ */
export default function InvoicesPage() {
  const router   = useRouter();
  const { tenant } = useAuthStore();
  const currency = tenant?.currency ?? 'BDT';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('All');

  const params: Record<string, string> = {};
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

  const invoices: InvoiceSummary[] = listData?.data?.data?.items ?? [];
  const stats: Stats = statsData?.data?.data ?? { totalInvoiced: 0, totalCount: 0, collected: 0, paidCount: 0, outstanding: 0 };

  const fmt = (n: number) => `${currency} ${Number(n).toLocaleString()}`;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage guest invoices and payments</p>
        </div>
        <Button className="gap-2" onClick={() => router.push('/dashboard/invoices/new')}>
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced', value: fmt(stats.totalInvoiced), sub: `${stats.totalCount} invoices`, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Collected',      value: fmt(stats.collected),     sub: `${stats.paidCount} paid`,      color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Outstanding',    value: fmt(stats.outstanding),   sub: 'unpaid balance',               color: 'text-red-600',   bg: 'bg-red-50' },
          { label: 'This Month',     value: fmt(stats.totalInvoiced), sub: 'all time',                     color: 'text-blue-700',  bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border p-4`}>
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or invoice #…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setStatus(f)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                status === f
                  ? 'bg-resort-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No invoices found</p>
            <p className="text-xs text-muted-foreground mt-1">Invoices are auto-created when bookings are confirmed.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Invoice</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Guest</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden md:table-cell">Booking</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Amount</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(inv => {
                const cfg   = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.DRAFT;
                const outstanding = inv.total - inv.paidAmount;
                return (
                  <tr key={inv.id}
                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-resort-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-resort-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 font-mono text-sm">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{inv.guestName}</p>
                      {inv.guestEmail && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{inv.guestEmail}</p>}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {inv.booking
                        ? <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{inv.booking.confirmationNo}</span>
                        : <span className="text-xs text-muted-foreground">Manual</span>
                      }
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                      {inv.dueDate && <p className="text-xs text-amber-600">Due {new Date(inv.dueDate).toLocaleDateString()}</p>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-semibold text-gray-900">{fmt(inv.total)}</p>
                      {outstanding > 0 && inv.status !== 'DRAFT' && (
                        <p className="text-xs text-red-500">Due {fmt(outstanding)}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
