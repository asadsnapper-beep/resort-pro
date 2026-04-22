'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, dashboardApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { NewBookingModal } from '@/components/bookings/NewBookingModal';
import { BookingDetailSheet } from '@/components/bookings/BookingDetailSheet';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Plus, CalendarDays, Search, LogIn, LogOut, Users, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';

const STATUS_FILTERS = ['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];

type Booking = {
  id: string; confirmationNo: string; status: string; paymentStatus: string;
  checkIn: string; checkOut: string; adults: number; children: number;
  totalAmount: number; paidAmount: number; specialRequests?: string;
  notes?: string; createdAt: string;
  guest: { firstName: string; lastName: string; email: string; phone?: string };
  room: { number: string; name: string; type: string };
  payments?: { amount: number; method: string; status: string; processedAt: string }[];
};

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', statusFilter, page],
    queryFn: () => bookingsApi.list({ status: statusFilter || undefined, page, limit: 20 }),
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

  const allBookings: Booking[] = data?.data?.data ?? [];
  const stats = statsData?.data?.data?.stats;
  const pagination = data?.data?.pagination;

  const bookings = allBookings.filter((b) =>
    search === '' ||
    b.confirmationNo.toLowerCase().includes(search.toLowerCase()) ||
    `${b.guest.firstName} ${b.guest.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    b.guest.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage reservations and check-ins</p>
        </div>
        <Button className="gap-2" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> New Booking
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Today's Arrivals", value: stats?.todayCheckIns ?? '—', icon: LogIn, color: 'bg-green-50 border-green-200', text: 'text-green-700' },
          { label: "Today's Departures", value: stats?.todayCheckOuts ?? '—', icon: LogOut, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'Active Bookings', value: stats?.activeBookings ?? '—', icon: Users, color: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
          { label: 'Month Revenue', value: stats != null ? formatCurrency(stats.monthlyRevenue) : '—', icon: TrendingUp, color: 'bg-resort-50 border-resort-200', text: 'text-resort-700' },
        ].map(({ label, value, icon: Icon, color, text }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${text}`} />
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${text}`}>{value as string}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by guest or confirmation #..." className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s ? 'bg-resort-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.replace(/_/g, ' ') || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px">
              {[...Array(5)].map((_, i) => <div key={i} className="h-[72px] bg-gray-50 animate-pulse border-b" />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <CalendarDays className="h-14 w-14 text-gray-200 mb-4" />
              <p className="font-medium text-gray-500">No bookings found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || statusFilter ? 'Try adjusting your filters' : 'Create your first booking to get started'}
              </p>
              {!search && !statusFilter && (
                <Button className="mt-4 gap-2" onClick={() => setNewOpen(true)}>
                  <Plus className="h-4 w-4" /> New Booking
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                <tbody className="divide-y">
                  {bookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold text-resort-600">{booking.confirmationNo}</span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900">{booking.guest.firstName} {booking.guest.lastName}</p>
                        <p className="text-xs text-muted-foreground">{booking.guest.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium">{booking.room.name}</p>
                        <p className="text-xs text-muted-foreground">#{booking.room.number}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm">{formatDate(booking.checkIn)}</p>
                        <p className="text-xs text-muted-foreground">→ {formatDate(booking.checkOut)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold">{formatCurrency(Number(booking.totalAmount))}</p>
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

      {/* New Booking Modal */}
      <NewBookingModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        loading={createMutation.isPending}
        onSubmit={(data) => createMutation.mutate(data)}
      />

      {/* Detail Sheet */}
      <BookingDetailSheet
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
}
