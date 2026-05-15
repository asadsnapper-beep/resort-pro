'use client';

import { useState, useEffect, useRef } from 'react';
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

interface ActiveGateways {
  tenantId: string;
  bkash: boolean;
  ssl: boolean;
  stripe: boolean;
  manual: boolean;
  currency: string;
}

type PaymentMethod = 'MANUAL' | 'BKASH' | 'SSL' | 'STRIPE';

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

// Load Stripe.js from CDN (only once)
let stripeJsLoaded = false;
let stripeJsPromise: Promise<void> | null = null;
function loadStripeJs(): Promise<void> {
  if (stripeJsLoaded) return Promise.resolve();
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => { stripeJsLoaded = true; resolve(); };
    document.head.appendChild(script);
  });
  return stripeJsPromise;
}

/* ── StripeCardForm ──────────────────────────────────────────────────────────── */
function StripeCardForm({
  clientSecret, primaryColor, onSuccess, onError,
}: {
  clientSecret: string;
  primaryColor: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!pubKey || !cardRef.current) return;

    loadStripeJs().then(() => {
      const stripe = (window as any).Stripe(pubKey);
      const elements = stripe.elements({ clientSecret });
      const paymentElement = elements.create('payment', {
        layout: 'tabs',
        defaultValues: {},
      });
      paymentElement.mount(cardRef.current!);
      paymentElement.on('ready', () => setCardReady(true));
      stripeRef.current = stripe;
      elementsRef.current = elements;
    });
  }, [clientSecret]);

  const handlePay = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setProcessing(true);
    const { error } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href + '?payment=success' },
      redirect: 'if_required',
    });
    if (error) {
      onError(error.message ?? 'Payment failed');
      setProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="space-y-4">
      <div ref={cardRef} className="min-h-[120px]">
        {!cardReady && (
          <div className="flex items-center justify-center h-24 rounded-xl border border-gray-200 text-sm text-gray-400">
            Loading secure payment form...
          </div>
        )}
      </div>
      {cardReady && (
        <button
          onClick={handlePay}
          disabled={processing}
          className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: primaryColor }}
        >
          {processing ? 'Processing...' : 'Pay Now'}
        </button>
      )}
    </div>
  );
}

/* ── PaymentMethodCard ───────────────────────────────────────────────────────── */
function PaymentMethodCard({
  id, label, description, icon, selected, onSelect, accentColor,
}: {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
  accentColor: string;
}) {
  return (
    <div
      onClick={onSelect}
      className="rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm flex items-center gap-4"
      style={{
        borderColor: selected ? accentColor : '#e5e7eb',
        backgroundColor: selected ? `${accentColor}0d` : 'white',
      }}
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="font-semibold text-sm text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div
        className="h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
        style={{ borderColor: selected ? accentColor : '#d1d5db' }}
      >
        {selected && <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />}
      </div>
    </div>
  );
}

/* ── BookingForm ─────────────────────────────────────────────────────────────── */
export function BookingForm({
  slug, primaryColor, accentColor, currency, rooms,
  checkInTime, checkOutTime,
  initialCheckIn, initialCheckOut, initialRoomId,
}: BookingFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const color = primaryColor || '#1a6b5e';
  const accent = accentColor || primaryColor || '#1a6b5e';

  const [step, setStep] = useState<'dates' | 'rooms' | 'details' | 'payment' | 'success'>(
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
  const [error, setError] = useState('');

  // Payment state
  const [bookingId, setBookingId] = useState('');
  const [confirmation, setConfirmation] = useState<{
    confirmationNo: string; totalAmount: number; nights: number;
  } | null>(null);
  const [activeGateways, setActiveGateways] = useState<ActiveGateways | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('MANUAL');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const [showStripeForm, setShowStripeForm] = useState(false);

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

  // Step 3 → 4: create booking (PENDING) + load gateways
  const proceedToPayment = async () => {
    if (!selectedRoom || !form.firstName || !form.lastName || !form.email) {
      setError('Please fill all required fields'); return;
    }
    setError(''); setSubmitting(true);
    try {
      // 1. Create booking as PENDING
      const bookRes = await fetch(`${API_BASE}/site/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, roomId: selectedRoom.id, checkIn, checkOut, adults }),
      });
      const bookJson = await bookRes.json();
      if (!bookRes.ok) { setError(bookJson.error || 'Booking failed'); setSubmitting(false); return; }

      const { id, confirmationNo, totalAmount, nights } = bookJson.data;
      setBookingId(id);
      setConfirmation({ confirmationNo, totalAmount, nights });

      // 2. Fetch active gateways
      const gwRes = await fetch(`${API_BASE}/api/payments/settings/active/${slug}`);
      const gwJson = await gwRes.json();
      if (gwRes.ok) {
        setActiveGateways(gwJson.data);
        // Default to bKash if available
        if (gwJson.data?.bkash) setSelectedPayment('BKASH');
        else if (gwJson.data?.ssl) setSelectedPayment('SSL');
        else if (gwJson.data?.stripe) setSelectedPayment('STRIPE');
        else setSelectedPayment('MANUAL');
      }

      setStep('payment');
    } catch { setError('Something went wrong. Please try again.'); }
    setSubmitting(false);
  };

  // Step 4: confirm payment
  const confirmPayment = async () => {
    if (!bookingId) return;
    setError(''); setPaymentProcessing(true);

    try {
      if (selectedPayment === 'MANUAL') {
        // Manual — booking already created as PENDING, just show success
        setStep('success');
        setPaymentProcessing(false);
        return;
      }

      if (selectedPayment === 'BKASH') {
        const res  = await fetch(`${API_BASE}/api/payments/bkash/initiate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'bKash initiation failed'); setPaymentProcessing(false); return; }
        window.location.href = json.data.bkashURL;
        return;
      }

      if (selectedPayment === 'SSL') {
        const res  = await fetch(`${API_BASE}/api/payments/ssl/initiate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'SSL Commerce initiation failed'); setPaymentProcessing(false); return; }
        window.location.href = json.data.gatewayUrl;
        return;
      }

      if (selectedPayment === 'STRIPE') {
        const res  = await fetch(`${API_BASE}/api/payments/stripe/intent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'Stripe initiation failed'); setPaymentProcessing(false); return; }
        setStripeClientSecret(json.data.clientSecret);
        setShowStripeForm(true);
        setPaymentProcessing(false);
        return;
      }
    } catch { setError('Something went wrong. Please try again.'); }
    setPaymentProcessing(false);
  };

  const resetForm = () => {
    setStep('dates'); setCheckIn(''); setCheckOut('');
    setSelectedRoom(null); setConfirmation(null); setBookingId('');
    setActiveGateways(null); setStripeClientSecret(''); setShowStripeForm(false);
    setForm({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '' });
  };

  const nights = checkIn && checkOut
    ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    : 1;

  const totalCost = selectedRoom ? Number(selectedRoom.basePrice) * nights : 0;

  const STEP_LABELS = ['1. Dates', '2. Room', '3. Details', '4. Payment'];
  const STEP_IDS    = ['dates', 'rooms', 'details', 'payment'];

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
      {/* Step Indicator */}
      {step !== 'success' && (
        <div className="flex border-b">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex-1 py-4 text-center text-sm font-medium transition-colors"
              style={{
                borderBottom: step === STEP_IDS[i] ? `3px solid ${color}` : '3px solid transparent',
                color: step === STEP_IDS[i] ? color : '#9ca3af',
              }}>
              {label}
            </div>
          ))}
        </div>
      )}

      <div className="p-8">
        {/* Step 1: Dates */}
        {step === 'dates' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-In Date</label>
                <input type="date" value={checkIn} min={today} onChange={e => setCheckIn(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': color } as React.CSSProperties} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-Out Date</label>
                <input type="date" value={checkOut} min={checkIn || today} onChange={e => setCheckOut(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': color } as React.CSSProperties} />
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
              style={{ backgroundColor: color }}>
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
                <button onClick={() => setStep('dates')} className="mt-3 text-sm underline" style={{ color }}>
                  Try different dates
                </button>
              </div>
            ) : (
              availableRooms.map(room => {
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <div key={room.id} onClick={() => setSelectedRoom(room)}
                    className="rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md"
                    style={{
                      borderColor: isSelected ? color : '#e5e7eb',
                      backgroundColor: isSelected ? `${color}08` : 'white',
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
                            <p className="font-bold text-lg" style={{ color }}>
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
                        <span className="text-xs font-semibold" style={{ color }}>✓ Selected</span>
                        <button onClick={(e) => { e.stopPropagation(); setStep('details'); }}
                          className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg transition-all hover:opacity-90"
                          style={{ backgroundColor: color }}>
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
            <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: `${color}10` }}>
              <Bed className="h-5 w-5 flex-shrink-0" style={{ color }} />
              <div>
                <p className="font-semibold text-sm">{selectedRoom.name}</p>
                <p className="text-xs text-gray-500">
                  {checkIn} → {checkOut} · {adults} guest{adults !== 1 ? 's' : ''}
                  <span className="ml-2 font-medium" style={{ color }}>{fmt(totalCost, currency)}</span>
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
                  placeholder="+880 1700 000000"
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

            <button onClick={proceedToPayment} disabled={submitting}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: color }}>
              {submitting ? 'Please wait...' : 'Continue to Payment →'}
            </button>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 'payment' && confirmation && (
          <div className="space-y-5">
            {/* Order summary */}
            <div className="rounded-xl p-4" style={{ backgroundColor: `${color}0a` }}>
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Order Summary</p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{selectedRoom?.name}</span>
                <span className="font-medium">{nights} night{nights !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Ref: {confirmation.confirmationNo}</span>
                <span className="text-lg font-bold" style={{ color }}>{fmt(confirmation.totalAmount, currency)}</span>
              </div>
            </div>

            {/* Payment methods */}
            {!showStripeForm ? (
              <>
                <p className="text-sm font-semibold text-gray-800">Select Payment Method</p>
                <div className="space-y-3">
                  {activeGateways?.bkash && (
                    <PaymentMethodCard
                      id="BKASH" label="bKash"
                      description="Pay via bKash mobile banking"
                      icon="🟢" selected={selectedPayment === 'BKASH'}
                      onSelect={() => setSelectedPayment('BKASH')} accentColor={accent}
                    />
                  )}
                  {activeGateways?.ssl && (
                    <PaymentMethodCard
                      id="SSL" label="SSL Commerce"
                      description="Visa, Mastercard, Nagad, Rocket & more"
                      icon="💳" selected={selectedPayment === 'SSL'}
                      onSelect={() => setSelectedPayment('SSL')} accentColor={accent}
                    />
                  )}
                  {activeGateways?.stripe && (
                    <PaymentMethodCard
                      id="STRIPE" label="Card (International)"
                      description="Visa, Mastercard, American Express"
                      icon="🌐" selected={selectedPayment === 'STRIPE'}
                      onSelect={() => setSelectedPayment('STRIPE')} accentColor={accent}
                    />
                  )}
                  <PaymentMethodCard
                    id="MANUAL" label="Pay at Hotel"
                    description="Pay in cash or card upon arrival — booking held as pending"
                    icon="🏨" selected={selectedPayment === 'MANUAL'}
                    onSelect={() => setSelectedPayment('MANUAL')} accentColor={accent}
                  />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  onClick={confirmPayment}
                  disabled={paymentProcessing}
                  className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: color }}
                >
                  {paymentProcessing
                    ? 'Processing...'
                    : selectedPayment === 'MANUAL'
                      ? 'Confirm Booking (Pay at Hotel)'
                      : `Pay ${fmt(confirmation.totalAmount, currency)} →`}
                </button>

                <button onClick={() => setStep('details')} className="w-full text-xs text-gray-400 underline text-center">
                  ← Back to details
                </button>
              </>
            ) : (
              /* Stripe inline card form */
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🌐</span>
                  <p className="text-sm font-semibold text-gray-800">Secure Card Payment</p>
                  <span className="ml-auto text-xs text-gray-400">🔒 SSL encrypted</span>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <StripeCardForm
                  clientSecret={stripeClientSecret}
                  primaryColor={color}
                  onSuccess={() => setStep('success')}
                  onError={(msg) => setError(msg)}
                />
                <button onClick={() => setShowStripeForm(false)} className="w-full text-xs text-gray-400 underline text-center">
                  ← Choose different payment method
                </button>
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {step === 'success' && confirmation && (
          <div className="text-center py-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4"
              style={{ backgroundColor: `${color}15` }}>
              <CheckCircle className="h-8 w-8" style={{ color }} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {selectedPayment === 'MANUAL' ? 'Booking Received!' : 'Payment Confirmed!'}
            </h3>
            <p className="mt-2 text-gray-500">
              {selectedPayment === 'MANUAL'
                ? 'Our team will contact you to confirm your reservation.'
                : 'Your booking has been confirmed. Check your email for details.'}
            </p>
            <div className="mt-6 rounded-2xl p-5 text-left space-y-2" style={{ backgroundColor: `${color}08` }}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Confirmation #</span>
                <span className="font-mono font-bold" style={{ color }}>{confirmation.confirmationNo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Nights</span>
                <span className="font-medium">{confirmation.nights}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-lg">{fmt(confirmation.totalAmount, currency)}</span>
              </div>
              {selectedPayment !== 'MANUAL' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment</span>
                  <span className="text-green-600 font-medium">✓ Paid</span>
                </div>
              )}
            </div>
            <button onClick={resetForm} className="mt-6 text-sm underline" style={{ color }}>
              Make another reservation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
