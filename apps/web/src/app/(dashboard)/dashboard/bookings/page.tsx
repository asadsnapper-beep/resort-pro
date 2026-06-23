'use client';

import { useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, dashboardApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { NewBookingModal } from '@/components/bookings/NewBookingModal';
import { BookingDetailSheet } from '@/components/bookings/BookingDetailSheet';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Plus, CalendarDays, Search, LogIn, LogOut, Users, TrendingUp, Zap, X } from 'lucide-react';
import { WalkInModal } from '@/components/bookings/WalkInModal';
import { useDebounce } from '@/hooks/use-debounce';

const STATUS_FILTERS = ['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
const STATUS_LABELS: Record<string, string> = {
  '': 'All', PENDING: 'Pending', CONFIRMED: 'Confirmed',
  CHECKED_IN: 'In House', CHECKED_OUT: 'Checked Out', CANCELLED: 'Cancelled',
};

const DATE_SHORTCUTS = [
  { label: 'Today',      dateFrom: () => today(), dateTo: () => today() },
  { label: 'Tomorrow',   dateFrom: () => offset(1), dateTo: () => offset(1) },
  { label: 'This week',  dateFrom: () => weekStart(), dateTo: () => weekEnd() },
  { label: 'This month', dateFrom: () => monthStart(), dateTo: () => monthEnd() },
] as const;

function today()      { return new Date().toISOString().slice(0, 10); }
function offset(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function weekStart()  { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); }
function weekEnd()    { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 6); return d.toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function monthEnd()   { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10); }

type Booking = {
  id: string; confirmationNo: string; status: string; paymentStatus: string;
  checkIn: string; checkOut: string; adults: number; children: number;
  totalAmount: number; paidAmount: number; specialRequests?: string;
  notes?: string; createdAt: string; source?: string;
  guest: { firstName: string; lastName: string; email: string; phone?: string };
  room: { number: string; name: string; type: string };
  payments?: { amount: number; method: string; status: string; processedAt: string }[];
};

const BOOKING_STATUS_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  CONFIRMED:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Confirmed'   },
  CHECKED_IN:  { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'In House'    },
  CHECKED_OUT: { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Checked Out' },
  PENDING:     { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', label: 'Pending'     },
  CANCELLED:   { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)',  text: '#c43c3c', label: 'Cancelled'   },
  NO_SHOW:     { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'No Show'     },
};

const PAYMENT_STATUS_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  PAID:        { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Paid'        },
  PARTIAL:     { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Partial'     },
  PENDING:     { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', label: 'Unpaid'      },
  REFUNDED:    { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Refunded'    },
};

function StatusPill({ status, map }: { status: string; map: typeof BOOKING_STATUS_PILL }) {
  const s = map[status] ?? map.PENDING;
  return (
    <span className="inline-block whitespace-nowrap rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
      style={{ background: s.bg, borderColor: s.border, color: s.text }}>
      {s.label}
    </span>
  );
}

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput]   = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
  const [page, setPage]                 = useState(1);
  const [newOpen, setNewOpen]           = useState(false);
  const [walkInOpen, setWalkInOpen]     = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const search = useDebounce(searchInput, 350);

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', statusFilter, search, dateFrom, dateTo, page],
    queryFn: () => bookingsApi.list({
      status:   statusFilter || undefined,
      search:   search       || undefined,
      dateFrom: dateFrom     || undefined,
      dateTo:   dateTo       || undefined,
      page,
      limit: 20,
    }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => bookingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking confirmed!', description: 'Guest reservation has been created.' });
      setNewOpen(false);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast({ title: 'Booking failed', description: err?.response?.data?.error || 'Please try again', variant: 'destructive' });
    },
  });

  const bookings: Booking[] = data?.data?.data ?? [];
  const stats = statsData?.data?.data?.stats;
  const pagination = data?.data?.pagination;

  const applyShortcut = useCallback((s: typeof DATE_SHORTCUTS[number]) => {
    setDateFrom(s.dateFrom()); setDateTo(s.dateTo());
    setActiveShortcut(s.label); setPage(1);
  }, []);

  const clearDateFilter = () => { setDateFrom(''); setDateTo(''); setActiveShortcut(null); setPage(1); };
  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Bookings</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Manage reservations and check-ins</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setWalkInOpen(true)}
            className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--rp-amber-bg)', color: '#b89040' }}
          >
            <Zap className="h-[13px] w-[13px]" strokeWidth={2.3} />
            Walk-in
          </button>
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80"
            style={{ background: 'var(--rp-btn-accent)' }}
          >
            <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} />
            New Booking
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Today's Arrivals",   value: stats?.todayCheckIns  ?? '—', icon: LogIn,      family: 'teal',  shortcut: 0 },
          { label: "Today's Departures", value: stats?.todayCheckOuts ?? '—', icon: LogOut,     family: 'teal',  shortcut: null },
          { label: 'Active Bookings',    value: stats?.activeBookings ?? '—', icon: Users,      family: 'gold',  shortcut: null },
          { label: 'Month Revenue',      value: stats != null ? formatCurrency(stats.monthlyRevenue) : '—', icon: TrendingUp, family: 'coral', shortcut: null },
        ].map(({ label, value, icon: Icon, family, shortcut }) => {
          const iconStyle = {
            teal:  { bg: 'var(--rp-teal-bg)', color: '#23766a' },
            gold:  { bg: 'var(--rp-amber-bg)', color: '#b89040' },
            coral: { bg: 'var(--rp-coral-bg)', color: '#b8724a' },
          }[family]!;
          return (
            <div
              key={label}
              className={`flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px] bg-white dark:bg-white/5 ${shortcut !== null ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
              onClick={shortcut !== null ? () => applyShortcut(DATE_SHORTCUTS[shortcut]) : undefined}
            >
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                style={{ background: iconStyle.bg }}>
                <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color: iconStyle.color }} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a]">{label}</div>
                <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#18231f]">{String(value)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="space-y-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8aa29a]" />
            <input
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              placeholder="Search guest, email, confirmation #..."
              className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[8px] pl-9 pr-4 text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20"
            />
          </div>
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className="rounded-[8px] border px-[12px] py-[6px] text-[12px] font-medium transition-colors"
                style={statusFilter === s
                  ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#1b342f' }
                  : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#94b8b0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Date filters */}
        <div className="flex flex-wrap items-center gap-2">
          {DATE_SHORTCUTS.map((s) => (
            <button
              key={s.label}
              onClick={() => activeShortcut === s.label ? clearDateFilter() : applyShortcut(s)}
              className="rounded-[8px] border px-[12px] py-[6px] text-[12px] font-medium transition-colors"
              style={activeShortcut === s.label
                ? { background: 'var(--rp-teal-bg)', color: '#23766a', borderColor: 'rgba(35,118,106,0.2)' }
                : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#94b8b0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}
            >
              {s.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActiveShortcut(null); setPage(1); }}
              className="h-[34px] w-36 rounded-[8px] border border-black/5 bg-[#f4f1eb] px-2 text-[12px] text-[#18231f] focus:outline-none focus:ring-1 focus:ring-resort-600/20"
            />
            <span className="text-[11px] text-[#8aa29a]">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => { setDateTo(e.target.value); setActiveShortcut(null); setPage(1); }}
              className="h-[34px] w-36 rounded-[8px] border border-black/5 bg-[#f4f1eb] px-2 text-[12px] text-[#18231f] focus:outline-none focus:ring-1 focus:ring-resort-600/20"
            />
            {hasDateFilter && (
              <button
                onClick={clearDateFilter}
                className="rounded-[8px] border border-black/5 bg-[#f4f1eb] p-1.5 text-[#8aa29a] hover:bg-[#ece9e2] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {hasDateFilter && (
            <span className="text-[12px] font-medium text-[#23766a]">
              {dateFrom === dateTo && dateFrom
                ? `Showing: ${formatDate(dateFrom)}`
                : `${dateFrom ? formatDate(dateFrom) : '…'} → ${dateTo ? formatDate(dateTo) : '…'}`}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[14px] border overflow-hidden bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="space-y-px">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[68px] animate-pulse" style={{ background: i % 2 === 0 ? 'var(--rp-surface-2)' : 'var(--rp-surface)' }} />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f4f1]">
              <CalendarDays className="h-7 w-7 text-[#c5bdb4]" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-[#18231f]">No bookings found</p>
              <p className="mt-1 text-[13px] text-[#8aa29a]">
                {searchInput || statusFilter || hasDateFilter
                  ? 'Try adjusting your filters'
                  : 'Create your first booking to get started'}
              </p>
            </div>
            {!searchInput && !statusFilter && !hasDateFilter && (
              <button
                onClick={() => setNewOpen(true)}
                className="mt-1 flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0]"
                style={{ background: 'var(--rp-btn-accent)' }}
              >
                <Plus className="h-[13px] w-[13px]" /> New Booking
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a]"
                  style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                  <th className="px-5 py-3 text-left">Confirmation</th>
                  <th className="px-5 py-3 text-left">Guest</th>
                  <th className="px-5 py-3 text-left">Room</th>
                  <th className="px-5 py-3 text-left">Dates</th>
                  <th className="px-5 py-3 text-left">Amount</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Payment</th>
                  <th className="px-5 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking, idx) => (
                  <tr
                    key={booking.id}
                    className="cursor-pointer border-b transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5 dark:hover:bg-white/5"
                    style={{ borderColor: 'rgba(0,0,0,0.04)' }}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <td className="px-5 py-[14px]">
                      <span className="font-mono text-[12px] font-bold text-[#23766a]">{booking.confirmationNo}</span>
                      {booking.source === 'WALK_IN' && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-[6px] border border-[rgba(184,144,64,0.2)] bg-[#f4ecda] px-[8px] py-[3px] text-[10px] font-bold text-[#b89040]">
                          <Zap className="h-2.5 w-2.5" />Walk-in
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-[14px]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-[#e3f2ef] text-[11px] font-semibold text-[#23766a]">
                          {booking.guest.firstName[0]}{booking.guest.lastName[0]}
                        </div>
                        <div>
                          <p className="text-[13.5px] font-medium text-[#18231f]">{booking.guest.firstName} {booking.guest.lastName}</p>
                          <p className="text-[11.5px] text-[#8aa29a]">{booking.guest.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-[14px]">
                      <p className="text-[13.5px] font-medium text-[#18231f]">{booking.room.name}</p>
                      <p className="text-[11.5px] text-[#8aa29a]">#{booking.room.number}</p>
                    </td>
                    <td className="px-5 py-[14px]">
                      <p className="text-[13px] text-[#18231f]">{formatDate(booking.checkIn)}</p>
                      <p className="text-[11.5px] text-[#8aa29a]">→ {formatDate(booking.checkOut)}</p>
                    </td>
                    <td className="px-5 py-[14px]">
                      <p className="text-[13.5px] font-semibold text-[#18231f]">{formatCurrency(Number(booking.totalAmount))}</p>
                      {Number(booking.paidAmount) < Number(booking.totalAmount) && (
                        <p className="text-[11.5px] text-[#c43c3c]">{formatCurrency(Number(booking.totalAmount) - Number(booking.paidAmount))} due</p>
                      )}
                    </td>
                    <td className="px-5 py-[14px]">
                      <StatusPill status={booking.status} map={BOOKING_STATUS_PILL} />
                    </td>
                    <td className="px-5 py-[14px]">
                      <StatusPill status={booking.paymentStatus} map={PAYMENT_STATUS_PILL} />
                    </td>
                    <td className="px-5 py-[14px]" onClick={(e) => e.stopPropagation()}>
                      {booking.status === 'CONFIRMED' && (
                        <button
                          className="rounded-[7px] border px-[10px] py-[5px] text-[11.5px] font-medium transition-colors hover:opacity-80"
                          style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}
                        >
                          Check In
                        </button>
                      )}
                      {booking.status === 'CHECKED_IN' && (
                        <button
                          className="rounded-[7px] border px-[10px] py-[5px] text-[11.5px] font-medium transition-colors hover:opacity-80"
                          style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)', color: '#b89040' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}
                        >
                          Check Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#8aa29a]">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total} bookings
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-[8px] border px-4 py-[7px] text-[12.5px] font-medium transition-colors disabled:opacity-40 bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}
            >
              Previous
            </button>
            <button
              disabled={page === pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-[8px] border px-4 py-[7px] text-[12.5px] font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {walkInOpen && <WalkInModal onClose={() => setWalkInOpen(false)} />}
      <NewBookingModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        loading={createMutation.isPending}
        onSubmit={(data) => createMutation.mutate(data)}
      />
      <BookingDetailSheet
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
}
