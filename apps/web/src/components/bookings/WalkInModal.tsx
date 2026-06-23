'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, roomsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  X, UserPlus, BedDouble, Loader2, CheckCircle2,
  CreditCard, Banknote, Clock, Zap,
} from 'lucide-react';

interface WalkInForm {
  checkIn: string;
  checkOut: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roomId: string;
  adults: number;
  children: number;
  notes: string;
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

const inp = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const lbl = 'block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5 text-[#8aa29a]';

export function WalkInModal({ onClose }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<WalkInForm>({
    checkIn: today(), checkOut: tomorrow(),
    firstName: '', lastName: '', email: '', phone: '',
    roomId: '', adults: 1, children: 0, notes: '',
    paymentMethod: 'CASH', autoCheckIn: true, skipEmail: true,
  });

  const set = <K extends keyof WalkInForm>(k: K, v: WalkInForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const { data: roomsRes, isLoading: roomsLoading } = useQuery({
    queryKey: ['walkin-rooms', form.checkIn, form.checkOut],
    queryFn: () => roomsApi.availability(form.checkIn, form.checkOut),
    enabled: !!form.checkIn && !!form.checkOut && form.checkOut > form.checkIn,
    select: r => r.data.data as { id: string; name: string; number: string; type: string; basePrice: number; maxOccupancy: number }[],
  });

  const rooms = roomsRes ?? [];

  useEffect(() => {
    if (rooms.length > 0 && !form.roomId) set('roomId', rooms[0].id);
    if (form.roomId && rooms.length > 0 && !rooms.find(r => r.id === form.roomId))
      set('roomId', rooms[0]?.id ?? '');
  }, [rooms]);

  const selectedRoom = rooms.find(r => r.id === form.roomId);
  const nights = form.checkIn && form.checkOut
    ? Math.max(1, Math.ceil((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000))
    : 1;
  const totalAmount = selectedRoom ? Number(selectedRoom.basePrice) * nights : 0;

  const { mutate, isPending } = useMutation({
    mutationFn: () => bookingsApi.create({
      roomId: form.roomId, checkIn: form.checkIn, checkOut: form.checkOut,
      adults: form.adults, children: form.children,
      notes: form.notes || undefined, source: 'WALK_IN',
      skipEmail: form.skipEmail, autoCheckIn: form.autoCheckIn,
      paymentMethod: form.paymentMethod === 'PENDING' ? undefined : form.paymentMethod,
      guestFirstName: form.firstName, guestLastName: form.lastName,
      guestEmail: form.email || undefined, guestPhone: form.phone || undefined,
    }),
    onSuccess: (res) => {
      const booking = res.data.data;
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      toast({
        title: `Walk-in booked — ${booking.confirmationNo}`,
        description: `${form.firstName} ${form.lastName} · Room ${booking.room?.number ?? ''} · ${nights}n${form.autoCheckIn ? ' · Checked in' : ''}`,
      });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast({ title: 'Booking failed', description: err?.response?.data?.error ?? 'Please check the form and try again', variant: 'destructive' });
    },
  });

  const isValid = form.firstName && form.lastName && form.roomId && form.checkIn && form.checkOut && form.checkOut > form.checkIn;

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(27,52,47,0.5)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '660px', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', borderRadius: '18px', background: isDark ? '#1a2e2a' : 'var(--rp-surface)', boxShadow: '0 32px 80px rgba(27,52,47,0.35)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: 'var(--rp-btn-accent)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap style={{ width: '16px', height: '16px', color: '#d4a853' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 500, color: 'var(--rp-btn-accent-text)', margin: 0 }}>Walk-in Booking</h2>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Quick check-in for front desk</p>
            </div>
          </div>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className={lbl}>Check-in</label>
              <input type="date" value={form.checkIn} min={today()} onChange={e => set('checkIn', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Check-out</label>
              <input type="date" value={form.checkOut} min={form.checkIn || today()} onChange={e => set('checkOut', e.target.value)} className={inp} />
            </div>
          </div>

          {/* Room */}
          <div>
            <label className={lbl}>
              Room
              {roomsLoading && <span style={{ marginLeft: '6px', color: '#23766a', textTransform: 'none', fontWeight: 400 }}>Loading…</span>}
              {!roomsLoading && rooms.length === 0 && form.checkIn && form.checkOut && (
                <span style={{ marginLeft: '6px', color: '#c43c3c', textTransform: 'none', fontWeight: 400 }}>No rooms available</span>
              )}
            </label>
            {rooms.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {rooms.map(room => {
                  const active = form.roomId === room.id;
                  return (
                    <button key={room.id} type="button" onClick={() => set('roomId', room.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '10px', border: `2px solid ${active ? '#23766a' : 'var(--rp-border-md)'}`, background: active ? 'var(--rp-teal-soft)' : 'var(--rp-surface-2)', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.12s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BedDouble style={{ width: '15px', height: '15px', color: active ? '#23766a' : 'var(--rp-text-faint)' }} />
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--rp-text)', margin: 0 }}>{room.name}</p>
                          <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: 0 }}>#{room.number} · Max {room.maxOccupancy}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: active ? '#23766a' : 'var(--rp-text)', margin: 0 }}>{formatCurrency(Number(room.basePrice))}</p>
                        <p style={{ fontSize: '11.5px', color: 'var(--rp-text-faint)', margin: 0 }}>/night</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ borderRadius: '10px', border: '1.5px dashed rgba(0,0,0,0.1)', padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--rp-text-faint)' }}>
                {roomsLoading ? 'Checking availability…' : 'Select dates to see available rooms'}
              </div>
            )}
          </div>

          {/* Guest Info */}
          <div>
            <label className={lbl} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus style={{ width: '12px', height: '12px' }} /> Guest
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input placeholder="First name *" value={form.firstName} onChange={e => set('firstName', e.target.value)} className={inp} />
              <input placeholder="Last name *" value={form.lastName} onChange={e => set('lastName', e.target.value)} className={inp} />
              <input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={e => set('phone', e.target.value)} className={inp} />
              <input type="email" placeholder="Email (optional)" value={form.email} onChange={e => set('email', e.target.value)} className={inp} />
            </div>
          </div>

          {/* Counts + notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr', gap: '12px' }}>
            <div>
              <label className={lbl}>Adults</label>
              <input type="number" min={1} max={10} value={form.adults} onChange={e => set('adults', parseInt(e.target.value) || 1)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Children</label>
              <input type="number" min={0} max={10} value={form.children} onChange={e => set('children', parseInt(e.target.value) || 0)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <input placeholder="Special requests…" value={form.notes} onChange={e => set('notes', e.target.value)} className={inp} />
            </div>
          </div>

          {/* Payment */}
          <div>
            <label className={lbl}>Payment Method</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['CASH', 'CARD', 'PENDING'] as const).map(method => {
                const active = form.paymentMethod === method;
                return (
                  <button key={method} type="button" onClick={() => set('paymentMethod', method)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '9px', border: `2px solid ${active ? '#23766a' : 'var(--rp-border-md)'}`, background: active ? 'var(--rp-teal-soft)' : 'var(--rp-surface-2)', padding: '9px', fontSize: '12.5px', fontWeight: 600, color: active ? '#23766a' : 'var(--rp-text-muted)', cursor: 'pointer', transition: 'all 0.12s' }}>
                    {method === 'CASH' && <Banknote style={{ width: '14px', height: '14px' }} />}
                    {method === 'CARD' && <CreditCard style={{ width: '14px', height: '14px' }} />}
                    {method === 'PENDING' && <Clock style={{ width: '14px', height: '14px' }} />}
                    {method === 'PENDING' ? 'Pay Later' : method.charAt(0) + method.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div style={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.07)', background: 'var(--rp-surface-2)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'autoCheckIn' as const, label: 'Auto check-in', sub: 'Set status to Checked In immediately' },
              { key: 'skipEmail'   as const, label: 'Skip confirmation email', sub: 'Guest is already here — no email needed' },
            ].map(({ key, label, sub }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form[key] as boolean} onChange={e => set(key, e.target.checked)}
                  style={{ marginTop: '2px', width: '15px', height: '15px', accentColor: '#23766a' }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--rp-text)', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', marginTop: '2px' }}>{sub}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Summary */}
          {selectedRoom && (
            <div style={{ borderRadius: '12px', border: '1px solid rgba(35,118,106,0.2)', background: 'var(--rp-teal-soft)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', color: 'var(--rp-text-accent)' }}>
                <span style={{ fontWeight: 600, color: 'var(--rp-text)' }}>{selectedRoom.name}</span>
                {' · '}{nights} night{nights !== 1 ? 's' : ''}
                {' · '}{form.paymentMethod === 'PENDING' ? 'Pay later' : form.paymentMethod.charAt(0) + form.paymentMethod.slice(1).toLowerCase()}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '17px', fontWeight: 700, color: '#23766a', margin: 0 }}>{formatCurrency(totalAmount)}</p>
                <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: 0 }}>{form.paymentMethod !== 'PENDING' ? 'Paid in full' : 'Balance due'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, display: 'flex', gap: '10px', padding: '14px 24px', borderTop: '1px solid rgba(0,0,0,0.06)', background: 'var(--rp-surface-2)' }}>
          <button onClick={onClose} disabled={isPending}
            style={{ flex: 1, borderRadius: '9px', border: '1px solid rgba(0,0,0,0.09)', background: 'transparent', fontSize: '13px', fontWeight: 500, color: 'var(--rp-text-subtle)', padding: '9px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button disabled={!isValid || isPending || rooms.length === 0} onClick={() => mutate()}
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '9px', border: 'none', background: isValid && !isPending && rooms.length > 0 ? '#1b342f' : 'var(--rp-text-faint)', color: 'var(--rp-btn-accent-text)', fontSize: '13px', fontWeight: 500, padding: '9px', cursor: isValid && !isPending ? 'pointer' : 'not-allowed' }}>
            {isPending ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 style={{ width: '14px', height: '14px' }} />}
            {isPending ? 'Creating…' : form.autoCheckIn ? 'Book & Check In' : 'Create Booking'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
