'use client';

import { useState } from 'react';
import { X, CalendarDays, Users, CreditCard, BedDouble, MessageSquare, CheckCircle, XCircle, LogIn, LogOut, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  confirmationNo: string;
  status: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  specialRequests?: string;
  notes?: string;
  createdAt: string;
  guest: { firstName: string; lastName: string; email: string; phone?: string };
  room: { number: string; name: string; type: string };
  payments?: { amount: number; method: string; status: string; processedAt: string; reference?: string }[];
}

interface Props {
  booking: Booking | null;
  onClose: () => void;
}

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE'];

export function BookingDetailSheet({ booking, onClose }: Props) {
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');

  const checkIn = useMutation({
    mutationFn: () => bookingsApi.checkIn(booking!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); toast({ title: 'Guest checked in!' }); onClose(); },
    onError: () => toast({ title: 'Error', description: 'Check-in failed', variant: 'destructive' }),
  });

  const checkOut = useMutation({
    mutationFn: () => bookingsApi.checkOut(booking!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); toast({ title: 'Guest checked out' }); onClose(); },
    onError: () => toast({ title: 'Error', description: 'Check-out failed', variant: 'destructive' }),
  });

  const cancel = useMutation({
    mutationFn: () => bookingsApi.cancel(booking!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); toast({ title: 'Booking cancelled' }); onClose(); },
    onError: () => toast({ title: 'Error', description: 'Cancel failed', variant: 'destructive' }),
  });

  const addPayment = useMutation({
    mutationFn: () => bookingsApi.addPayment(booking!.id, { amount: Number(payAmount), method: payMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: `Payment of ${formatCurrency(Number(payAmount))} recorded` });
      setShowPayment(false); setPayAmount('');
    },
    onError: () => toast({ title: 'Error', description: 'Payment failed', variant: 'destructive' }),
  });

  if (!booking) return null;

  const nights = Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24));
  const outstanding = Number(booking.totalAmount) - Number(booking.paidAmount);
  const paymentPct = Math.min(100, Math.round((Number(booking.paidAmount) / Number(booking.totalAmount)) * 100));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <p className="font-mono text-sm font-bold text-resort-600">{booking.confirmationNo}</p>
            <p className="text-xs text-muted-foreground">Created {formatDate(booking.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} />
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Guest */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-resort-100 text-base font-bold text-resort-700">
                {booking.guest.firstName[0]}{booking.guest.lastName[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{booking.guest.firstName} {booking.guest.lastName}</p>
                <p className="text-sm text-muted-foreground">{booking.guest.email}</p>
                {booking.guest.phone && <p className="text-sm text-muted-foreground">{booking.guest.phone}</p>}
              </div>
            </div>

            {/* Stay Details */}
            <div className="rounded-xl bg-gray-50 divide-y overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><LogIn className="h-3 w-3" /> Check-in</p>
                  <p className="mt-1 font-semibold text-sm">{formatDate(booking.checkIn)}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><LogOut className="h-3 w-3" /> Check-out</p>
                  <p className="mt-1 font-semibold text-sm">{formatDate(booking.checkOut)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x">
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Nights</p>
                  <p className="mt-1 font-bold">{nights}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground"><Users className="inline h-3 w-3" /> Guests</p>
                  <p className="mt-1 font-bold">{booking.adults + (booking.children ?? 0)}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground"><BedDouble className="inline h-3 w-3" /> Room</p>
                  <p className="mt-1 font-bold text-xs">#{booking.room.number}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">Room</p>
              <p className="font-semibold">{booking.room.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{booking.room.type.toLowerCase()}</p>
            </div>

            {/* Payment */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Payment</h3>
                <StatusBadge status={booking.paymentStatus} />
              </div>

              <div className="rounded-xl bg-gray-50 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{formatCurrency(Number(booking.totalAmount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-semibold text-green-600">{formatCurrency(Number(booking.paidAmount))}</span>
                </div>
                {outstanding > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="font-semibold text-red-500">{formatCurrency(outstanding)}</span>
                  </div>
                )}
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${paymentPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{paymentPct}% paid</p>
                </div>
              </div>

              {/* Payment history */}
              {booking.payments && booking.payments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {booking.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium capitalize">{p.method.toLowerCase().replace('_', ' ')}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{formatDate(p.processedAt)}</span>
                      </div>
                      <span className="font-semibold text-green-600">+{formatCurrency(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add payment */}
              {outstanding > 0 && !showPayment && (
                <button
                  onClick={() => { setShowPayment(true); setPayAmount(outstanding.toString()); }}
                  className="mt-3 flex items-center gap-1.5 text-sm text-resort-600 hover:text-resort-700 font-medium"
                >
                  <Plus className="h-4 w-4" /> Record Payment
                </button>
              )}
              {showPayment && (
                <div className="mt-3 space-y-3 rounded-xl border border-resort-200 bg-resort-50 p-4">
                  <p className="text-sm font-medium text-resort-700">Record Payment</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Amount ($)</label>
                      <Input value={payAmount} onChange={e => setPayAmount(e.target.value)} type="number" step="0.01" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Method</label>
                      <select
                        value={payMethod}
                        onChange={e => setPayMethod(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={addPayment.isPending} onClick={() => addPayment.mutate()} disabled={!payAmount}>
                      Save Payment
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Special Requests */}
            {booking.specialRequests && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-1">
                  <MessageSquare className="h-3.5 w-3.5" /> Special Requests
                </p>
                <p className="text-sm text-amber-800">{booking.specialRequests}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="border-t px-6 py-4 space-y-2">
          {booking.status === 'CONFIRMED' && (
            <Button className="w-full gap-2" onClick={() => checkIn.mutate()} loading={checkIn.isPending}>
              <LogIn className="h-4 w-4" /> Check In Guest
            </Button>
          )}
          {booking.status === 'CHECKED_IN' && (
            <Button className="w-full gap-2" onClick={() => checkOut.mutate()} loading={checkOut.isPending}>
              <LogOut className="h-4 w-4" /> Check Out Guest
            </Button>
          )}
          {['PENDING', 'CONFIRMED'].includes(booking.status) && (
            <Button variant="outline" className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => cancel.mutate()} loading={cancel.isPending}>
              <XCircle className="h-4 w-4" /> Cancel Booking
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
