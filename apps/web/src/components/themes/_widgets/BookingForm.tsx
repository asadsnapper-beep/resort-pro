'use client';

import { useState } from 'react';
import { Calendar, Bed, CheckCircle, Wifi, Car, Coffee, Waves, Dumbbell, Utensils, Shield, Wind } from 'lucide-react';
import type { WidgetProps, ResortRoom } from '../types';

/* ── Types ───────────────────────────────────────────────────────────────────── */
export interface BookingFormProps extends WidgetProps {
  rooms: ResortRoom[];
  checkInTime?: string;
  checkOutTime?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialRoomId?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

const AMENITY_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi, parking: Car, breakfast: Coffee, pool: Waves,
  gym: Dumbbell, restaurant: Utensils, security: Shield, ac: Wind,
};

function AmenityIcon({ amenity }: { amenity: string }) {
  const lower = amenity.toLowerCase();
  const Icon = Object.entries(AMENITY_ICONS).find(([k]) => lower.includes(k))?.[1] ?? CheckCircle;
  return <Icon className="h-3.5 w-3.5" />;
}

/* ── BookingForm ─────────────────────────────────────────────────────────────── */
export function BookingForm({
  slug, primaryColor, accentColor, currency, rooms,
  checkInTime, checkOutTime,
  initialCheckIn, initialCheckOut, initialRoomId,
}: BookingFormProps) {
  const today = new Date().toISOString().split('T')[0];

  const [step, setStep] = useState<'dates' | 'rooms' | 'details' | 'success'>(
    initialCheckIn && initialCheckOut && initialRoomId ? 'details' : 'dates',
  );
  const [checkIn, setCheckIn]   = useState(initialCheckIn ?? '');
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? '');
  const [adults, setAdults]     = useState(2);

  const [availableRooms, setAvailableRooms] = useState<ResortRoom[]>(
    initialRoomId ? rooms.filter(r => r.id === initialRoomId) : [],
  );
  const [selectedRoom, setSelectedRoom] = useState<ResortRoom | null>(
    initialRoomId ? (rooms.find(r => r.id === initialRoomId) ?? null) : null,
  );

  const [loadingRooms, setLoadingRooms] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '' });
  const [submitting, setSubmitting]   = useState(false);
  const [confirmation, setConfirmation] = useState<{
    confirmationNo: string; totalAmount: number; nights: number;
  } | null>(null);
  const [error, setError] = useState('');

  /* ── API calls ─────────────────────────────────────────────────────────────── */
  const checkAvailability = async () => {
    if (!checkIn || !checkOut) { setError('Please select dates'); return; }
    setError(''); setLoadingRooms(true);
    try {
      const res  = await fetch(`${API_BASE}/site/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
      const json = await res.json();
      setAvailableRooms(json.data || []);
      setStep('rooms');
    } catch { setError('Failed to check availability'); }
    setLoadingRooms(false);
  };

  const submitBooking = async () => {
    if (!selectedRoom || !form.firstName || !form.lastName || !form.email) {
      setError('Please fill all required fields'); return;
    }
    setError(''); setSubmitting(true);
    try {
      const res  = await fetch(`${API_BASE}/site/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, roomId: selectedRoom.id, checkIn, checkOut, adults }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Booking failed'); setSubmitting(false); return; }
      setConfirmation(json.data);
      setStep('success');
    } catch { setError('Something went wrong. Please try again.'); }
    setSubmitting(false);
  };

  const resetForm = () => {
    setStep('dates'); setCheckIn(''); setCheckOut('');
    setSelectedRoom(null); setConfirmation(null);
    setForm({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '' });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
      {/* Step Indicator */}
      <div className="flex border-b">
        {[
          { id: 'dates',   label: '1. Dates' },
          { id: 'rooms',   label: '2. Room' },
          { id: 'details', label: '3. Details' },
        ].map(({ id, label }) => (
          <div key={id} className="flex-1 py-4 text-center text-sm font-medium transition-colors"
            style={{
              borderBottom: step === id ? `3px solid ${primaryColor}` : '3px solid transparent',
              color: step === id ? primaryColor : '#9ca3af',
            }}>
            {label}
          </div>
        ))}
      </div>

      <div className="p-8">
        {/* Step 1: Dates */}
        {step === 'dates' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-In Date</label>
                <input type="date" value={checkIn} min={today} onChange={e => setCheckIn(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-Out Date</label>
                <input type="date" value={checkOut} min={checkIn || today} onChange={e => setCheckOut(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Guests</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setAdults(Math.max(1, adults - 1))}
                  className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-50 transition-colors">−</button>
                <span className="text-lg font-semibold w-8 text-center">{adults}</span>
                <button onClick={() => setAdults(Math.min(10, adults + 1))}
                  className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-50 transition-colors">+</button>
                <span className="text-sm text-gray-500">{adults === 1 ? '1 adult' : `${adults} adults`}</span>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button onClick={checkAvailability} disabled={loadingRooms}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}>
              {loadingRooms ? 'Checking...' : <><Calendar className="h-4 w-4" /> Check Availability</>}
            </button>
          </div>
        )}

        {/* Step 2: Room Selection */}
        {step === 'rooms' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">
                {availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''} available
              </p>
              <button onClick={() => setStep('dates')} className="text-sm underline text-gray-400 hover:text-gray-600">
                ← Change dates
              </button>
            </div>

            {availableRooms.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 font-medium">No rooms available for these dates</p>
                <button onClick={() => setStep('dates')} className="mt-3 text-sm underline" style={{ color: primaryColor }}>
                  Try different dates
                </button>
              </div>
            ) : (
              availableRooms.map(room => {
                const nights = checkIn && checkOut
                  ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
                  : 1;
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <div key={room.id} onClick={() => setSelectedRoom(room)}
                    className="rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md"
                    style={{
                      borderColor: isSelected ? primaryColor : '#e5e7eb',
                      backgroundColor: isSelected ? `${primaryColor}08` : 'white',
                    }}>
                    <div className="flex gap-4">
                      {room.images[0] && (
                        <img src={room.images[0]} alt={room.name}
                          className="w-24 h-20 object-cover rounded-xl flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900">{room.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {room.type.replace('_', ' ')} · Up to {room.maxOccupancy} guests
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-lg" style={{ color: primaryColor }}>
                              {fmt(Number(room.basePrice), currency)}
                            </p>
                            <p className="text-xs text-gray-400">per night</p>
                            {nights > 1 && (
                              <p className="text-xs font-medium text-gray-600 mt-0.5">
                                {fmt(Number(room.basePrice) * nights, currency)} total
                              </p>
                            )}
                          </div>
                        </div>
                        {room.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {room.amenities.slice(0, 4).map(a => (
                              <span key={a}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-600">
                                <AmenityIcon amenity={a} /> {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: primaryColor }}>✓ Selected</span>
                        <button onClick={(e) => { e.stopPropagation(); setStep('details'); }}
                          className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg transition-all hover:opacity-90"
                          style={{ backgroundColor: primaryColor }}>
                          Continue →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Step 3: Guest Details */}
        {step === 'details' && selectedRoom && (
          <div className="space-y-5">
            <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: `${primaryColor}10` }}>
              <Bed className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
              <div>
                <p className="font-semibold text-sm">{selectedRoom.name}</p>
                <p className="text-xs text-gray-500">
                  {checkIn} → {checkOut} · {adults} guest{adults !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setStep('rooms')} className="ml-auto text-xs underline text-gray-400">
                Change
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'firstName', label: 'First Name', ph: 'John' },
                { key: 'lastName',  label: 'Last Name',  ph: 'Smith' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label} *</label>
                  <input
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.ph}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <input type="email" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="john@example.com"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Special Requests</label>
              <textarea
                value={form.specialRequests}
                onChange={e => setForm(p => ({ ...p, specialRequests: e.target.value }))}
                rows={2} placeholder="Dietary needs, room preferences, celebrations..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none" />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button onClick={submitBooking} disabled={submitting}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}>
              {submitting
                ? 'Confirming...'
                : `Confirm Booking · ${fmt(
                    Number(selectedRoom.basePrice) * Math.max(1,
                      Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
                    ),
                    currency,
                  )}`}
            </button>
          </div>
        )}

        {/* Success */}
        {step === 'success' && confirmation && (
          <div className="text-center py-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4"
              style={{ backgroundColor: `${primaryColor}15` }}>
              <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Booking Confirmed!</h3>
            <p className="mt-2 text-gray-500">We'll contact you shortly to finalize your reservation.</p>
            <div className="mt-6 rounded-2xl p-5 text-left space-y-2" style={{ backgroundColor: `${primaryColor}08` }}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Confirmation #</span>
                <span className="font-mono font-bold" style={{ color: primaryColor }}>{confirmation.confirmationNo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Nights</span>
                <span className="font-medium">{confirmation.nights}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-lg">{fmt(confirmation.totalAmount, currency)}</span>
              </div>
            </div>
            <button onClick={resetForm} className="mt-6 text-sm underline" style={{ color: primaryColor }}>
              Make another reservation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
