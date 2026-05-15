'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, roomsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  X, UserPlus, BedDouble, Loader2, CheckCircle2,
  CreditCard, Banknote, Clock, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WalkInForm {
  // Dates
  checkIn: string;
  checkOut: string;
  // Guest
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  // Stay
  roomId: string;
  adults: number;
  children: number;
  notes: string;
  // Options
  paymentMethod: 'CASH' | 'CARD' | 'PENDING';
  autoCheckIn: boolean;
  skipEmail: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

interface Props {
  onClose: () => void;
}

export function WalkInModal({ onClose }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<WalkInForm>({
    checkIn: today(),
    checkOut: tomorrow(),
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roomId: '',
    adults: 1,
    children: 0,
    notes: '',
    paymentMethod: 'CASH',
    autoCheckIn: true,
    skipEmail: true,
  });

  const set = <K extends keyof WalkInForm>(k: K, v: WalkInForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // Load available rooms when dates change
  const { data: roomsRes, isLoading: roomsLoading } = useQuery({
    queryKey: ['walkin-rooms', form.checkIn, form.checkOut],
    queryFn: () => roomsApi.availability(form.checkIn, form.checkOut),
    enabled: !!form.checkIn && !!form.checkOut && form.checkOut > form.checkIn,
    select: r => r.data.data as { id: string; name: string; number: string; type: string; basePrice: number; maxOccupancy: number }[],
  });

  const rooms = roomsRes ?? [];

  // Auto-select first room if none selected
  useEffect(() => {
    if (rooms.length > 0 && !form.roomId) {
      set('roomId', rooms[0].id);
    }
    // Clear selection if room no longer available
    if (form.roomId && rooms.length > 0 && !rooms.find(r => r.id === form.roomId)) {
      set('roomId', rooms[0]?.id ?? '');
    }
  }, [rooms]);

  const selectedRoom = rooms.find(r => r.id === form.roomId);
  const nights = form.checkIn && form.checkOut
    ? Math.max(1, Math.ceil((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000))
    : 1;
  const totalAmount = selectedRoom ? Number(selectedRoom.basePrice) * nights : 0;

  const { mutate, isPending } = useMutation({
    mutationFn: () => bookingsApi.create({
      roomId: form.roomId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: form.adults,
      children: form.children,
      notes: form.notes || undefined,
      source: 'WALK_IN',
      skipEmail: form.skipEmail,
      autoCheckIn: form.autoCheckIn,
      paymentMethod: form.paymentMethod === 'PENDING' ? undefined : form.paymentMethod,
      guestFirstName: form.firstName,
      guestLastName: form.lastName,
      guestEmail: form.email || undefined,
      guestPhone: form.phone || undefined,
    }),
    onSuccess: (res) => {
      const booking = res.data.data;
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      toast({
        title: `✅ Walk-in booked! — ${booking.confirmationNo}`,
        description: `${form.firstName} ${form.lastName} · Room ${booking.room?.number ?? ''} · ${nights}n${form.autoCheckIn ? ' · Checked in' : ''}`,
      });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast({
        title: 'Booking failed',
        description: err?.response?.data?.error ?? 'Please check the form and try again',
        variant: 'destructive',
      });
    },
  });

  const isValid = form.firstName && form.lastName && form.roomId && form.checkIn && form.checkOut && form.checkOut > form.checkIn;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Walk-in Booking</h2>
              <p className="text-xs text-muted-foreground">Quick check-in for guests at the front desk</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Dates row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Check-in Date</label>
              <Input
                type="date"
                value={form.checkIn}
                min={today()}
                onChange={e => set('checkIn', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Check-out Date</label>
              <Input
                type="date"
                value={form.checkOut}
                min={form.checkIn || today()}
                onChange={e => set('checkOut', e.target.value)}
              />
            </div>
          </div>

          {/* Room selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Room
              {roomsLoading && <span className="ml-2 text-resort-500 normal-case font-normal">Loading...</span>}
              {!roomsLoading && rooms.length === 0 && form.checkIn && form.checkOut && (
                <span className="ml-2 text-red-500 normal-case font-normal">No rooms available</span>
              )}
            </label>
            {rooms.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => set('roomId', room.id)}
                    className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      form.roomId === room.id
                        ? 'border-resort-500 bg-resort-50 dark:bg-resort-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <BedDouble className={`h-4 w-4 ${form.roomId === room.id ? 'text-resort-600' : 'text-gray-400'}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{room.name}</p>
                        <p className="text-xs text-gray-500">#{room.number} · Max {room.maxOccupancy} guests</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-resort-700 dark:text-resort-400">{formatCurrency(Number(room.basePrice))}</p>
                      <p className="text-xs text-gray-400">/night</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-6 text-center text-sm text-muted-foreground">
                {roomsLoading ? 'Checking availability...' : 'Select dates to see available rooms'}
              </div>
            )}
          </div>

          {/* Guest info */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Guest Information
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First name *"
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
              />
              <Input
                placeholder="Last name *"
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
              />
              <Input
                type="tel"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
              <Input
                type="email"
                placeholder="Email (optional)"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>
          </div>

          {/* Guests + notes */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Adults</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.adults}
                onChange={e => set('adults', parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Children</label>
              <Input
                type="number"
                min={0}
                max={10}
                value={form.children}
                onChange={e => set('children', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Notes</label>
              <Input
                placeholder="Special requests..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Payment Method</label>
            <div className="flex gap-2">
              {(['CASH', 'CARD', 'PENDING'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => set('paymentMethod', method)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${
                    form.paymentMethod === method
                      ? 'border-resort-500 bg-resort-50 dark:bg-resort-900/20 text-resort-700 dark:text-resort-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {method === 'CASH' && <Banknote className="h-4 w-4" />}
                  {method === 'CARD' && <CreditCard className="h-4 w-4" />}
                  {method === 'PENDING' && <Clock className="h-4 w-4" />}
                  {method === 'PENDING' ? 'Pay Later' : method.charAt(0) + method.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoCheckIn}
                onChange={e => set('autoCheckIn', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-resort-600 focus:ring-resort-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Auto check-in</p>
                <p className="text-xs text-muted-foreground">Set status to Checked In immediately · Room marked Occupied</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.skipEmail}
                onChange={e => set('skipEmail', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-resort-600 focus:ring-resort-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Skip confirmation email</p>
                <p className="text-xs text-muted-foreground">Guest is already here — no need to send email</p>
              </div>
            </label>
          </div>

          {/* Summary bar */}
          {selectedRoom && (
            <div className="rounded-xl border border-resort-200 dark:border-resort-800 bg-resort-50 dark:bg-resort-900/20 px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">{selectedRoom.name}</span>
                {' · '}
                {nights} night{nights !== 1 ? 's' : ''}
                {' · '}
                {form.paymentMethod === 'PENDING' ? 'Pay later' : form.paymentMethod.charAt(0) + form.paymentMethod.slice(1).toLowerCase()}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-resort-700 dark:text-resort-400">{formatCurrency(totalAmount)}</p>
                <p className="text-xs text-muted-foreground">
                  {form.paymentMethod !== 'PENDING' ? 'Paid in full' : 'Balance due'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
            disabled={!isValid || isPending || rooms.length === 0}
            onClick={() => mutate()}
          >
            {isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CheckCircle2 className="h-4 w-4" />}
            {isPending ? 'Creating...' : form.autoCheckIn ? 'Book & Check In' : 'Create Booking'}
          </Button>
        </div>
      </div>
    </div>
  );
}
