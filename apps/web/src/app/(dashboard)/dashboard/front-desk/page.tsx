'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { frontDeskApi, bookingsApi, roomsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import {
  BedDouble, Users, Sparkles, Wrench, LogIn, LogOut, Clock,
  Plus, Phone, MapPin, CreditCard, Banknote, ChevronRight,
  LayoutGrid, List, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Guest { id: string; firstName: string; lastName: string; phone?: string; email?: string }
interface Room  { id: string; number: string; name: string; type: string; floor?: number }
interface Booking {
  id: string; confirmationNo: string; checkIn: string; checkOut: string;
  adults: number; children: number; totalAmount: number; paidAmount: number;
  paymentStatus: string; status: string; source: string; walkIn: boolean;
  specialRequests?: string; roomNotes?: string;
  guest: Guest; room: Room;
}
interface RoomMapRoom {
  id: string; number: string; name: string; type: string; status: string; floor?: number;
  basePrice: number; capacity: number;
  booking: (Booking & { guest: Guest }) | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, currency = 'BDT') {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}
function nights(ci: string, co: string) {
  return Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86_400_000);
}

const ROOM_STATUS_COLOR: Record<string, string> = {
  AVAILABLE:   'bg-emerald-100 border-emerald-300 text-emerald-800',
  OCCUPIED:    'bg-blue-100   border-blue-300   text-blue-800',
  CLEANING:    'bg-amber-100  border-amber-300  text-amber-800',
  MAINTENANCE: 'bg-red-100    border-red-300    text-red-800',
  RESERVED:    'bg-purple-100 border-purple-300 text-purple-800',
};
const ROOM_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Available', OCCUPIED: 'Occupied',
  CLEANING: 'Cleaning', MAINTENANCE: 'Maintenance', RESERVED: 'Reserved',
};

// ── Check-In Modal ─────────────────────────────────────────────────────────────
function CheckInModal({ booking, onClose, onSuccess }: {
  booking: Booking; onClose: () => void; onSuccess: () => void;
}) {
  const { tenant } = useAuthStore();
  const qc = useQueryClient();
  const [deposit, setDeposit]     = useState('');
  const [roomNotes, setRoomNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => bookingsApi.checkIn(booking.id, {
      deposit:   deposit   ? Number(deposit)  : undefined,
      roomNotes: roomNotes || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Guest checked in!', description: `${booking.guest.firstName} ${booking.guest.lastName} — Room ${booking.room.number}` });
      qc.invalidateQueries({ queryKey: ['front-desk-today'] });
      qc.invalidateQueries({ queryKey: ['front-desk-map'] });
      onSuccess();
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast({ title: 'Error', description: e.response?.data?.error || 'Check-in failed', variant: 'destructive' });
    },
  });

  const balance = Number(booking.totalAmount) - Number(booking.paidAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Check In</h2>
            <p className="text-sm text-gray-500">{booking.guest.firstName} {booking.guest.lastName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Booking summary */}
          <div className="rounded-xl bg-resort-50 border border-resort-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Booking</span>
              <span className="font-mono font-bold text-gray-900">#{booking.confirmationNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Room</span>
              <span className="font-semibold">{booking.room.number} — {booking.room.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Stay</span>
              <span>{new Date(booking.checkIn).toLocaleDateString()} → {new Date(booking.checkOut).toLocaleDateString()} ({nights(booking.checkIn, booking.checkOut)} nights)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Guests</span>
              <span>{booking.adults} adults{booking.children > 0 ? `, ${booking.children} children` : ''}</span>
            </div>
            {balance > 0 && (
              <div className="flex justify-between font-semibold text-amber-700 border-t border-resort-200 pt-2">
                <span>Balance due</span>
                <span>{fmt(balance, tenant?.currency)}</span>
              </div>
            )}
          </div>

          {/* Deposit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Deposit collected (optional)
            </label>
            <div className="relative">
              <Banknote className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="number" value={deposit} onChange={e => setDeposit(e.target.value)}
                placeholder="0"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes (key card, requests…)
            </label>
            <textarea
              value={roomNotes} onChange={e => setRoomNotes(e.target.value)}
              rows={2} placeholder="e.g. Key card #3 issued. Guest requested extra pillow."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 resize-none"
            />
          </div>

          {booking.specialRequests && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <span className="font-semibold">Special request: </span>{booking.specialRequests}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-resort-700 hover:bg-resort-800 text-white" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Checking in…' : 'Confirm Check-In'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Check-Out Modal ────────────────────────────────────────────────────────────
function CheckOutModal({ booking, onClose, onSuccess }: {
  booking: Booking; onClose: () => void; onSuccess: () => void;
}) {
  const { tenant } = useAuthStore();
  const qc = useQueryClient();
  const [extraPayment, setExtraPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');

  const balance = Math.max(0, Number(booking.totalAmount) - Number(booking.paidAmount));

  const mutation = useMutation({
    mutationFn: () => bookingsApi.checkOut(booking.id, {
      additionalPayment: extraPayment ? Number(extraPayment) : undefined,
      paymentMethod,
    }),
    onSuccess: (res) => {
      const summary = (res as { data: { data: { checkoutSummary: { balanceDue: number } } } }).data?.data?.checkoutSummary;
      toast({ title: 'Checked out!', description: summary?.balanceDue ? `Balance remaining: ${fmt(summary.balanceDue, tenant?.currency)}` : 'All settled. Have a great stay!' });
      qc.invalidateQueries({ queryKey: ['front-desk-today'] });
      qc.invalidateQueries({ queryKey: ['front-desk-map'] });
      onSuccess();
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast({ title: 'Error', description: e.response?.data?.error || 'Check-out failed', variant: 'destructive' });
    },
  });

  const n = nights(booking.checkIn, booking.checkOut);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Check Out</h2>
            <p className="text-sm text-gray-500">{booking.guest.firstName} {booking.guest.lastName} · Room {booking.room.number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Bill summary */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Room ({n} nights)</span>
              <span>{fmt(Number(booking.totalAmount), tenant?.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
              <span>Total</span>
              <span>{fmt(Number(booking.totalAmount), tenant?.currency)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>Already paid</span>
              <span>-{fmt(Number(booking.paidAmount), tenant?.currency)}</span>
            </div>
            <div className={`flex justify-between font-bold text-base border-t border-gray-200 pt-2 ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
              <span>Balance due</span>
              <span>{fmt(balance, tenant?.currency)}</span>
            </div>
          </div>

          {/* Collect payment */}
          {balance > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Collect payment</label>
              <input
                type="number" value={extraPayment} onChange={e => setExtraPayment(e.target.value)}
                placeholder={String(balance)} defaultValue={balance}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500"
              />
              <div className="flex gap-2">
                {(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                      paymentMethod === m ? 'border-resort-600 bg-resort-50 text-resort-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {m === 'CASH' ? '💵 Cash' : m === 'CARD' ? '💳 Card' : '🏦 Bank'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-gray-900 hover:bg-gray-800 text-white" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Processing…' : 'Confirm Check-Out'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Walk-In Modal ──────────────────────────────────────────────────────────────
function WalkInModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { tenant } = useAuthStore();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    guestName: '', guestPhone: '', adults: 1, children: 0,
    roomId: '', checkIn: today, checkOut: tomorrow,
    paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'LATER',
    advanceAmount: '', roomNotes: '',
  });

  const { data: roomData } = useQuery({
    queryKey: ['rooms-available'],
    queryFn: () => roomsApi.availability(form.checkIn, form.checkOut).then(r => r.data.data),
  });

  const n = nights(form.checkIn, form.checkOut);
  const selectedRoom = (roomData as { id: string; number: string; name: string; basePrice: number }[] | undefined)?.find(r => r.id === form.roomId);
  const estimatedTotal = selectedRoom ? Number(selectedRoom.basePrice) * Math.max(n, 1) : 0;

  const mutation = useMutation({
    mutationFn: () => bookingsApi.walkIn({ ...form, advanceAmount: form.advanceAmount ? Number(form.advanceAmount) : undefined }),
    onSuccess: () => {
      toast({ title: 'Walk-in checked in!', description: `${form.guestName} — Room assigned` });
      qc.invalidateQueries({ queryKey: ['front-desk-today'] });
      qc.invalidateQueries({ queryKey: ['front-desk-map'] });
      onSuccess();
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast({ title: 'Error', description: e.response?.data?.error || 'Walk-in failed', variant: 'destructive' });
    },
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">New Walk-In</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Guest */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Guest name *</label>
              <input value={form.guestName} onChange={e => set('guestName', e.target.value)}
                placeholder="Rahman Ahmed"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input value={form.guestPhone} onChange={e => set('guestPhone', e.target.value)}
                placeholder="01712-345678"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adults</label>
                <input type="number" min={1} value={form.adults} onChange={e => set('adults', Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Children</label>
                <input type="number" min={0} value={form.children} onChange={e => set('children', Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500" />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-in</label>
              <input type="date" value={form.checkIn} onChange={e => set('checkIn', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-out</label>
              <input type="date" value={form.checkOut} onChange={e => set('checkOut', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500" />
            </div>
          </div>

          {/* Room */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Room *</label>
            <select value={form.roomId} onChange={e => set('roomId', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 bg-white">
              <option value="">Select available room…</option>
              {(roomData as { id: string; number: string; name: string; basePrice: number }[] | undefined)?.map(r => (
                <option key={r.id} value={r.id}>
                  Room {r.number} — {r.name} ({fmt(Number(r.basePrice), tenant?.currency)}/night)
                </option>
              ))}
            </select>
          </div>

          {/* Estimated total */}
          {estimatedTotal > 0 && (
            <div className="rounded-xl bg-resort-50 border border-resort-200 p-3 text-sm flex justify-between">
              <span className="text-gray-500">{n} night{n !== 1 ? 's' : ''} × {fmt(Number(selectedRoom?.basePrice), tenant?.currency)}</span>
              <span className="font-bold text-resort-800">{fmt(estimatedTotal, tenant?.currency)}</span>
            </div>
          )}

          {/* Payment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Advance payment</label>
            <input type="number" value={form.advanceAmount} onChange={e => set('advanceAmount', e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 mb-2" />
            <div className="flex gap-2">
              {(['CASH', 'CARD', 'BANK_TRANSFER', 'LATER'] as const).map(m => (
                <button key={m} onClick={() => set('paymentMethod', m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                    form.paymentMethod === m ? 'border-resort-600 bg-resort-50 text-resort-700' : 'border-gray-200 text-gray-500'
                  }`}>
                  {m === 'CASH' ? '💵' : m === 'CARD' ? '💳' : m === 'BANK_TRANSFER' ? '🏦' : '⏳'} {m === 'BANK_TRANSFER' ? 'Bank' : m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea value={form.roomNotes} onChange={e => set('roomNotes', e.target.value)}
              rows={2} placeholder="Key card issued, special requests…"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 resize-none" />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-resort-700 hover:bg-resort-800 text-white"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.guestName || !form.roomId}>
            {mutation.isPending ? 'Checking in…' : 'Check In Guest'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Booking Card ───────────────────────────────────────────────────────────────
function BookingCard({ booking, onCheckIn, onCheckOut }: {
  booking: Booking;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
}) {
  const { tenant } = useAuthStore();
  const balance = Math.max(0, Number(booking.totalAmount) - Number(booking.paidAmount));
  const n = nights(booking.checkIn, booking.checkOut);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-gray-900">{booking.guest.firstName} {booking.guest.lastName}</span>
            {booking.walkIn && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">Walk-in</span>}
            {booking.source === 'BOOKING_COM' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Booking.com</span>}
            {booking.source === 'AIRBNB' && <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">Airbnb</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              Room {booking.room.number}
            </span>
            {booking.guest.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {booking.guest.phone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {booking.adults + booking.children} guests
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {n} night{n !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>#{booking.confirmationNo}</span>
            <span>{new Date(booking.checkIn).toLocaleDateString()} → {new Date(booking.checkOut).toLocaleDateString()}</span>
          </div>
          {balance > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {fmt(balance, tenant?.currency)} due
            </div>
          )}
          {booking.specialRequests && (
            <p className="mt-2 text-xs text-gray-400 truncate">📝 {booking.specialRequests}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {onCheckIn && (
            <Button size="sm" className="bg-resort-700 hover:bg-resort-800 text-white text-xs px-3 h-8" onClick={onCheckIn}>
              <LogIn className="h-3.5 w-3.5 mr-1" /> Check In
            </Button>
          )}
          {onCheckOut && (
            <Button size="sm" variant="outline" className="text-xs px-3 h-8 border-gray-900 text-gray-900 hover:bg-gray-50" onClick={onCheckOut}>
              <LogOut className="h-3.5 w-3.5 mr-1" /> Check Out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Room Map ───────────────────────────────────────────────────────────────────
function RoomMap({ onCheckIn, onCheckOut }: {
  onCheckIn: (b: Booking) => void;
  onCheckOut: (b: Booking) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['front-desk-map'],
    queryFn: () => frontDeskApi.roomMap().then(r => r.data.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading room map…</div>;

  const floors = (data as { floors: { floor: number; rooms: RoomMapRoom[] }[] } | undefined)?.floors ?? [];

  return (
    <div className="space-y-8">
      {floors.map(({ floor, rooms }) => (
        <div key={floor}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Floor {floor}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {rooms.map(room => (
              <div key={room.id}
                className={`relative rounded-2xl border-2 p-3 cursor-default select-none transition-all ${ROOM_STATUS_COLOR[room.status] ?? 'bg-gray-100 border-gray-300 text-gray-800'}`}>
                <div className="font-bold text-lg leading-none">{room.number}</div>
                <div className="text-xs opacity-70 mt-0.5 truncate">{room.name}</div>
                <div className="text-xs font-semibold mt-2">{ROOM_STATUS_LABEL[room.status] ?? room.status}</div>
                {room.booking && (
                  <div className="mt-2 text-xs opacity-80 truncate">
                    {room.booking.guest.firstName} {room.booking.guest.lastName}
                  </div>
                )}
                {room.booking?.status === 'CONFIRMED' && (
                  <button onClick={() => onCheckIn(room.booking as unknown as Booking)}
                    className="mt-2 w-full text-xs py-1 rounded-lg bg-resort-600 text-white font-semibold hover:bg-resort-700 transition-colors">
                    Check In
                  </button>
                )}
                {room.booking?.status === 'CHECKED_IN' && (
                  <button onClick={() => onCheckOut(room.booking as unknown as Booking)}
                    className="mt-2 w-full text-xs py-1 rounded-lg bg-gray-800 text-white font-semibold hover:bg-gray-900 transition-colors">
                    Check Out
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {floors.length === 0 && (
        <div className="text-center py-12 text-gray-400">No rooms found</div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FrontDeskPage() {
  const [tab,          setTab]          = useState<'arrivals' | 'departures' | 'inhouse'>('arrivals');
  const [view,         setView]         = useState<'list' | 'map'>('list');
  const [checkInFor,   setCheckInFor]   = useState<Booking | null>(null);
  const [checkOutFor,  setCheckOutFor]  = useState<Booking | null>(null);
  const [walkInOpen,   setWalkInOpen]   = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['front-desk-today'],
    queryFn: () => frontDeskApi.today().then(r => r.data.data),
    refetchInterval: 60_000,
  });

  const d = data as {
    date: string;
    roomStats: { total: number; occupied: number; available: number; cleaning: number; outOfOrder: number };
    totalGuests: number;
    arrivals:   { count: number; pending: number; bookings: Booking[] };
    departures: { count: number; pending: number; bookings: Booking[] };
    inHouse:    { count: number; bookings: Booking[] };
  } | undefined;

  const stats = d?.roomStats;

  const STAT_CARDS = [
    { label: 'Total Rooms',  value: stats?.total,     icon: BedDouble, color: 'text-gray-600',   bg: 'bg-gray-50' },
    { label: 'Occupied',     value: stats?.occupied,  icon: Users,     color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Available',    value: stats?.available, icon: Sparkles,  color: 'text-emerald-600',bg: 'bg-emerald-50' },
    { label: 'Cleaning',     value: stats?.cleaning,  icon: Sparkles,  color: 'text-amber-600',  bg: 'bg-amber-50' },
    { label: 'Maintenance',  value: stats?.outOfOrder,icon: Wrench,    color: 'text-red-600',    bg: 'bg-red-50' },
  ];

  const TABS = [
    { id: 'arrivals'   as const, label: 'Arrivals',   count: d?.arrivals.count,   badge: d?.arrivals.pending   },
    { id: 'departures' as const, label: 'Departures', count: d?.departures.count, badge: d?.departures.pending },
    { id: 'inhouse'    as const, label: 'In-House',   count: d?.inHouse.count,    badge: undefined              },
  ];

  const currentBookings =
    tab === 'arrivals'   ? d?.arrivals.bookings   :
    tab === 'departures' ? d?.departures.bookings  :
    d?.inHouse.bookings ?? [];

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-resort-200 border-t-resort-700" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Front Desk</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {d?.date ? new Date(d.date).toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            {d?.totalGuests ? ` · ${d.totalGuests} guests in-house` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setView('list')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView('map')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${view === 'map' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button className="bg-resort-700 hover:bg-resort-800 text-white flex items-center gap-2" onClick={() => setWalkInOpen(true)}>
            <Plus className="h-4 w-4" /> Walk-In
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-2xl border border-gray-100 ${bg} p-4 flex items-center gap-3`}>
            <div className={`h-9 w-9 rounded-xl bg-white flex items-center justify-center shadow-sm`}>
              <Icon className={`h-4.5 w-4.5 ${color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{value ?? 0}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Arrivals quick-stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Today's Arrivals",   value: d?.arrivals.count,    sub: `${d?.arrivals.pending ?? 0} pending`, color: 'bg-resort-700 text-white' },
          { label: "Today's Departures", value: d?.departures.count,  sub: `${d?.departures.pending ?? 0} pending`, color: 'bg-gray-900 text-white' },
          { label: 'Guests In-House',    value: d?.inHouse.count,     sub: `${d?.totalGuests ?? 0} total guests`, color: 'bg-blue-600 text-white' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className={`rounded-2xl p-5 ${color}`}>
            <div className="text-4xl font-bold">{value ?? 0}</div>
            <div className="text-sm font-semibold mt-1 opacity-90">{label}</div>
            <div className="text-xs opacity-60 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Content: List or Map */}
      {view === 'map' ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-900 mb-6">Room Map</h2>
          <RoomMap
            onCheckIn={b => setCheckInFor(b)}
            onCheckOut={b => setCheckOutFor(b)}
          />
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-gray-100">
            {Object.entries(ROOM_STATUS_LABEL).map(([status, label]) => (
              <div key={status} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border-2 ${ROOM_STATUS_COLOR[status]}`}>
                {label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-4">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id ? 'border-resort-700 text-resort-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
                {t.count !== undefined && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    tab === t.id ? 'bg-resort-100 text-resort-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {t.count}
                  </span>
                )}
                {(t.badge ?? 0) > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
                    {t.badge} pending
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Booking list */}
          <div className="p-4 space-y-3">
            {(currentBookings?.length ?? 0) === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <BedDouble className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {tab === 'arrivals'   ? 'No arrivals today' :
                   tab === 'departures' ? 'No departures today' :
                   'No guests currently in-house'}
                </p>
              </div>
            ) : (
              (currentBookings ?? []).map(b => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onCheckIn={tab === 'arrivals'   ? () => setCheckInFor(b)  : undefined}
                  onCheckOut={tab === 'departures' || tab === 'inhouse' ? () => setCheckOutFor(b) : undefined}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {checkInFor  && <CheckInModal  booking={checkInFor}  onClose={() => setCheckInFor(null)}  onSuccess={() => setCheckInFor(null)}  />}
      {checkOutFor && <CheckOutModal booking={checkOutFor} onClose={() => setCheckOutFor(null)} onSuccess={() => setCheckOutFor(null)} />}
      {walkInOpen  && <WalkInModal onClose={() => setWalkInOpen(false)} onSuccess={() => setWalkInOpen(false)} />}
    </div>
  );
}
