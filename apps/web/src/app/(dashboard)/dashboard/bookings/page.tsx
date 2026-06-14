'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, dashboardApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { NewBookingModal } from '@/components/bookings/NewBookingModal';
import { BookingDetailSheet } from '@/components/bookings/BookingDetailSheet';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Plus, CalendarDays, Search, LogIn, LogOut, Users, TrendingUp, Zap, X } from 'lucide-react';
import { WalkInModal } from '@/components/bookings/WalkInModal';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';

const STATUS_FILTERS = ['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];

// Quick date-range shortcuts
const DATE_SHORTCUTS = [
  { label: 'Today',      dateFrom: () => today(), dateTo: () => today() },
  { label: 'Tomorrow',   dateFrom: () => offset(1), dateTo: () => offset(1) },
  { label: 'This week',  dateFrom: () => weekStart(), dateTo: () => weekEnd() },
  { label: 'This month', dateFrom: () => monthStart(), dateTo: () => monthEnd() },
] as const;

function today()      { return new Date().toISOString().slice(0, 10); }
function offset(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}
function weekStart()  { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); }
function weekEnd()    { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 6); return d.toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function monthEnd()   {
  const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10);
}

type Booking = {
  id: string; confirmationNo: string; status: string; paymentStatus: string;
  checkIn: string; checkOut: string; adults: number; children: number;
  totalAmount: number; paidAmount: number; specialRequests?: string;
  notes?: string; createdAt: string; source?: string;
  guest: { firstName: string; lastName: string; email: string; phone?: string };
  room: { number: string; name: string; type: string };
  payments?: { amount: number; method: string; status: string; processedAt: string }[];
};

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput]   = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
  const [page, setPage]                 = useState(1);
  const [newOpen, setNewOpen]           = useState(false);
  const [walkInOpen, setWalkInOpen]     = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Debounce search so we don't fire on every keystroke
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
    const from = s.dateFrom();
    const to   = s.dateTo();
    setDateFrom(from);
    setDateTo(to);
    setActiveShortcut(s.label);
    setPage(1);
  }, []);

  const clearDateFilter = () => {
    setDateFrom(''); setDateTo(''); setActiveShortcut(null); setPage(1);
  };

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage reservations and check-ins</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            onClick={() => setWalkInOpen(true)}
          >
            <Zap className="h-4 w-4" /> Walk-in
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New Booking
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Today's Arrivals",   value: stats?.todayCheckIns  ?? '—', icon: LogIn,      color: 'bg-green-50 border-green-200',   text: 'text-green-700',  shortcut: 0 },
          { label: "Today's Departures", value: stats?.todayCheckOuts ?? '—', icon: LogOut,     color: 'bg-blue-50 border-blue-200',    text: 'text-blue-700',   shortcut: null },
          { label: 'Active Bookings',    value: stats?.activeBookings ?? '—', icon: Users,      color: 'bg-purple-50 border-purple-200', text: 'text-purple-700', shortcut: null },
          { label: 'Month Revenue',      value: stats != null ? formatCurrency(stats.monthlyRevenue) : '—', icon: TrendingUp, color: 'bg-resort-50 border-resort-200', text: 'text-resort-700', shortcut: null },
        ].map(({ label, value, icon: Icon, color, text, shortcut }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 ${color} ${shortcut !== null ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={shortcut !== null ? () => applyShortcut(DATE_SHORTCUTS[shortcut]) : undefined}
            title={shortcut !== null ? `Filter to ${DATE_SHORTCUTS[shortcut].label.toLowerCase()}` : undefined}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${text}`} />
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${text}`}>{value as string}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Row 1: Search + Status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              placeholder="Search guest, email, confirmation #..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-resort-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {s.replace(/_/g, ' ') || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Date filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick shortcuts */}
          {DATE_SHORTCUTS.map((s) => (
            <button
              key={s.label}
              onClick={() => activeShortcut === s.label ? clearDateFilter() : applyShortcut(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                activeShortcut === s.label
                  ? 'bg-resort-600 text-white border-resort-600'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}

          {/* Custom date range */}
          <div className="flex items-center gap-1.5 ml-1">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActiveShortcut(null); setPage(1); }}
              className="h-8 w-36 text-xs"
              placeholder="From"
            />
            <span className="text-xs text-gray-400">→</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActiveShortcut(null); setPage(1); }}
              className="h-8 w-36 text-xs"
              placeholder="To"
              min={dateFrom}
            />
            {hasDateFilter && (
              <button
                onClick={clearDateFilter}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Clear date filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Active filter summary */}
          {hasDateFilter && (
            <span className="text-xs text-resort-600 dark:text-resort-400 font-medium">
              {dateFrom === dateTo && dateFrom
                ? `Showing: ${formatDate(dateFrom)}`
                : `${dateFrom ? formatDate(dateFrom) : '…'} → ${dateTo ? formatDate(dateTo) : '…'}`
              }
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px">
              {[...Array(5)].map((_, i) => <div key={i} className="h-[72px] bg-gray-50 dark:bg-gray-800 animate-pulse border-b" />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <CalendarDays className="h-14 w-14 text-gray-200 mb-4" />
              <p className="font-medium text-gray-500">No bookings found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput || statusFilter || hasDateFilter
                  ? 'Try adjusting your filters'
                  : 'Create your first booking to get started'}
              </p>
              {!searchInput && !statusFilter && !hasDateFilter && (
                <Button className="mt-4 gap-2" onClick={() => setNewOpen(true)}>
                  <Plus className="h-4 w-4" /> New Booking
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Confirmation</th>
                    <th className="px-5 py-3 text-left">Guest</th>
                    <th className="px-5 py-3 text-left">Room</th>
                    <th className="px-5 py-3 text-left">Dates</th>
                    <th className="px-5 py-3 text-left">Amount</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Payment</th>
                    <th className="px-5 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {bookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold text-resort-600">{booking.confirmationNo}</span>
                        {booking.source === 'WALK_IN' && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            <Zap className="h-2.5 w-2.5" />Walk-in
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.guest.firstName} {booking.guest.lastName}</p>
                        <p className="text-xs text-muted-foreground">{booking.guest.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium dark:text-gray-200">{booking.room.name}</p>
                        <p className="text-xs text-muted-foreground">#{booking.room.number}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm dark:text-gray-200">{formatDate(booking.checkIn)}</p>
                        <p className="text-xs text-muted-foreground">→ {formatDate(booking.checkOut)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold dark:text-gray-200">{formatCurrency(Number(booking.totalAmount))}</p>
                        {Number(booking.paidAmount) < Number(booking.totalAmount) && (
                          <p className="text-xs text-red-500">{formatCurrency(Number(booking.totalAmount) - Number(booking.paidAmount))} due</p>
                        )}
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={booking.status} /></td>
                      <td className="px-5 py-4"><StatusBadge status={booking.paymentStatus} /></td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {booking.status === 'CONFIRMED' && (
                            <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50 text-xs"
                              onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}>
                              Check In
                            </Button>
                          )}
                          {booking.status === 'CHECKED_IN' && (
                            <Button size="sm" variant="outline" className="text-blue-700 border-blue-200 hover:bg-blue-50 text-xs"
                              onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}>
                              Check Out
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total} bookings
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
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
