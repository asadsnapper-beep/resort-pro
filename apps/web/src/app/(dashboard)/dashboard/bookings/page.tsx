'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Plus, CalendarDays, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', statusFilter, page],
    queryFn: () => bookingsApi.list({ status: statusFilter || undefined, page, limit: 20 }),
  });

  const checkIn = useMutation({
    mutationFn: (id: string) => bookingsApi.checkIn(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); toast({ title: 'Guest checked in!' }); },
    onError: () => toast({ title: 'Error', description: 'Check-in failed', variant: 'destructive' }),
  });

  const checkOut = useMutation({
    mutationFn: (id: string) => bookingsApi.checkOut(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); toast({ title: 'Guest checked out. Housekeeping task created.' }); },
    onError: () => toast({ title: 'Error', description: 'Check-out failed', variant: 'destructive' }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); toast({ title: 'Booking cancelled' }); },
    onError: () => toast({ title: 'Error', description: 'Cancel failed', variant: 'destructive' }),
  });

  const bookings = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage reservations and check-ins</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Booking
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-resort-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.replace(/_/g, ' ') || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-gray-200 animate-pulse" />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CalendarDays className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-muted-foreground">No bookings found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <th className="px-6 py-3 text-left">Confirmation</th>
                    <th className="px-6 py-3 text-left">Guest</th>
                    <th className="px-6 py-3 text-left">Room</th>
                    <th className="px-6 py-3 text-left">Dates</th>
                    <th className="px-6 py-3 text-left">Amount</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Payment</th>
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map((booking: Record<string, unknown>) => (
                    <tr key={booking.id as string} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono font-medium text-muted-foreground">{booking.confirmationNo as string}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{(booking.guest as { firstName: string; lastName: string })?.firstName} {(booking.guest as { firstName: string; lastName: string })?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{(booking.guest as { email: string })?.email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">{(booking.room as { name: string })?.name}</td>
                      <td className="px-6 py-4 text-sm">
                        <p>{formatDate(booking.checkIn as string)}</p>
                        <p className="text-muted-foreground">→ {formatDate(booking.checkOut as string)}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{formatCurrency(booking.totalAmount as number)}</td>
                      <td className="px-6 py-4"><StatusBadge status={booking.status as string} /></td>
                      <td className="px-6 py-4"><StatusBadge status={booking.paymentStatus as string} /></td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {booking.status === 'CONFIRMED' && (
                            <Button size="sm" variant="outline" onClick={() => checkIn.mutate(booking.id as string)}>
                              Check In
                            </Button>
                          )}
                          {booking.status === 'CHECKED_IN' && (
                            <Button size="sm" variant="outline" onClick={() => checkOut.mutate(booking.id as string)}>
                              Check Out
                            </Button>
                          )}
                          {['PENDING', 'CONFIRMED'].includes(booking.status as string) && (
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => cancel.mutate(booking.id as string)}>
                              Cancel
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
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
