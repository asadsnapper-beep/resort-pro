'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CheckCircle2, Loader2, AlertCircle, CreditCard, Building2,
  Calendar, Moon, Users, ChevronRight, Shield, Info, ArrowLeft,
} from 'lucide-react';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingSummary {
  id: string;
  confirmationNo: string;
  status: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: number;
  currency: { code: string; symbol: string; name: string };
  room: { name: string; type: string } | null;
  guest: { name: string; email: string | null } | null;
  tenant: { name: string; slug: string; manualInstructions: string | null };
}

interface GatewayOption {
  id: string;
  name: string;
  logo: string;
  methods: string[];
  redirectFlow: boolean;
}

interface TenantGateways {
  activeGateway: string;
  enabledMethods: string[];
  currency: { code: string; symbol: string };
  gateways: GatewayOption[];
  manualInstructions: string | null;
}

// ─── Gateway logo/color map ───────────────────────────────────────────────────

const GW_STYLE: Record<string, { bg: string; border: string; logoText: string; color: string }> = {
  bkash:      { bg: 'bg-pink-50',    border: 'border-pink-200',   logoText: '৳',   color: 'text-pink-600' },
  nagad:      { bg: 'bg-orange-50',  border: 'border-orange-200', logoText: 'ন',   color: 'text-orange-600' },
  sslcommerz: { bg: 'bg-green-50',   border: 'border-green-200',  logoText: 'SSL', color: 'text-green-700' },
  razorpay:   { bg: 'bg-blue-50',    border: 'border-blue-200',   logoText: 'R',   color: 'text-blue-700' },
  payhere:    { bg: 'bg-teal-50',    border: 'border-teal-200',   logoText: 'PH',  color: 'text-teal-700' },
  esewa:      { bg: 'bg-emerald-50', border: 'border-emerald-200',logoText: 'e',   color: 'text-emerald-700' },
  khalti:     { bg: 'bg-violet-50',  border: 'border-violet-200', logoText: 'K',   color: 'text-violet-700' },
  stripe:     { bg: 'bg-indigo-50',  border: 'border-indigo-200', logoText: '💳',  color: 'text-indigo-600' },
  manual:     { bg: 'bg-gray-50',    border: 'border-gray-200',   logoText: '🏨',  color: 'text-gray-600' },
};

const GW_DESCRIPTION: Record<string, string> = {
  bkash:      'Pay with bKash mobile wallet',
  nagad:      'Pay with Nagad digital wallet',
  sslcommerz: 'Cards, mobile banking, internet banking',
  razorpay:   'UPI, cards, net banking, wallets',
  payhere:    'Cards, bank slips, Sampath Vishwa',
  esewa:      'Pay with eSewa digital wallet',
  khalti:     'Khalti wallet, cards, bank transfer',
  stripe:     'Visa, Mastercard, Amex, Apple Pay',
  manual:     'Pay cash or bank transfer at hotel',
};

// ─── Format amount ────────────────────────────────────────────────────────────
function formatAmt(amount: number, symbol: string) {
  return `${symbol}${amount.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Checkout Inner (needs useSearchParams) ───────────────────────────────────
function CheckoutInner({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const bookingId    = searchParams.get('bookingId');

  const [booking,  setBooking]  = useState<BookingSummary | null>(null);
  const [gateways, setGateways] = useState<TenantGateways | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [paying,   setPaying]   = useState(false);
  const [manualMsg, setManualMsg] = useState<string | null>(null);

  // ── Fetch booking + gateways ─────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) {
      setError('Missing booking ID. Please go back and try again.');
      setLoading(false);
      return;
    }

    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    Promise.all([
      axios.get(`${API}/api/payments/checkout/booking/${bookingId}`),
      axios.get(`${API}/api/payments/gateways/tenant/${slug}`),
    ])
      .then(([bookRes, gwRes]) => {
        const bk = bookRes.data.data as BookingSummary;
        const gw = gwRes.data.data  as TenantGateways;
        setBooking(bk);
        setGateways(gw);
        // Default selection
        if (gw.gateways.length > 0) setSelected(gw.gateways[0].id);
        else if (gw.enabledMethods.includes('manual')) setSelected('manual');
      })
      .catch(err => {
        const msg = err?.response?.data?.error ?? 'Failed to load checkout. Please try again.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [bookingId, slug]);

  // ── Pay button ───────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!bookingId || !selected) return;
    setPaying(true);
    setError(null); // clear any previous error before each attempt
    try {
      const origin    = window.location.origin;
      const returnUrl = `${origin}/pay/verify?gateway=${selected}&bookingId=${bookingId}&slug=${slug}`;

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/payments/checkout/init`,
        { bookingId, gateway: selected, returnUrl },
      );
      const result = res.data.data;

      if (result.type === 'manual') {
        setManualMsg(result.message ?? 'Please pay at the hotel on arrival.');
      } else if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        // inline (Stripe) — for now redirect to verify with session token
        const verifyUrl = `${origin}/pay/verify?gateway=${selected}&bookingId=${bookingId}&slug=${slug}&sessionId=${result.gatewayPaymentId ?? ''}`;
        router.push(verifyUrl);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Payment initiation failed. Please try again.';
      setError(msg);
      setPaying(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a6b5e] via-[#145a4f] to-[#0d3d36] flex items-center justify-center">
        <div className="text-center text-white/80">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a6b5e] via-[#145a4f] to-[#0d3d36] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={() => router.back()}
            className="flex items-center gap-2 mx-auto text-sm text-[#1a6b5e] hover:underline">
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
        </div>
      </div>
    );
  }

  // Already paid
  if (booking?.paymentStatus === 'PAID') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a6b5e] via-[#145a4f] to-[#0d3d36] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Already Paid</h2>
          <p className="text-sm text-gray-500">Booking #{booking.confirmationNo} has already been paid.</p>
        </div>
      </div>
    );
  }

  // Manual payment success
  if (manualMsg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a6b5e] via-[#145a4f] to-[#0d3d36] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#f0faf8] rounded-full flex items-center justify-center mx-auto mb-5">
            <Building2 className="w-8 h-8 text-[#1a6b5e]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
          <p className="text-sm text-gray-500 mb-1">Reference: <strong className="font-mono text-gray-700">{booking?.confirmationNo}</strong></p>
          <div className="mt-4 rounded-xl bg-[#f0faf8] border border-[#b2ddd6] p-4 text-sm text-[#1a6b5e] text-left">
            <p className="font-semibold mb-1">Payment Instructions</p>
            <p className="whitespace-pre-line">{manualMsg}</p>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Please present this booking reference on arrival.
          </p>
        </div>
      </div>
    );
  }

  // Gateways already includes 'manual' if enabled — deduplicate
  const allMethods: Array<GatewayOption & { isManual?: boolean }> = (gateways?.gateways ?? []);

  const sym = booking?.currency?.symbol ?? gateways?.currency?.symbol ?? '৳';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a6b5e] via-[#145a4f] to-[#0d3d36]">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-white/70 text-xs">{booking?.tenant.name}</p>
            <h1 className="text-white font-bold text-lg leading-tight">Secure Checkout</h1>
          </div>
          <div className="ml-auto flex items-center gap-1 text-white/60 text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>SSL Secured</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8">
        <div className="max-w-lg mx-auto space-y-4">

          {/* Booking Summary Card */}
          {booking && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-white border border-white/20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-white/60 mb-0.5">Booking Reference</p>
                  <p className="font-mono font-bold text-lg">{booking.confirmationNo}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60 mb-0.5">Total Amount</p>
                  <p className="text-2xl font-bold text-[#d4a853]">{formatAmt(booking.totalAmount, sym)}</p>
                </div>
              </div>

              <div className="h-px bg-white/20 mb-3" />

              <div className="grid grid-cols-2 gap-3 text-sm">
                {booking.room && (
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-white/50 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white/50 text-xs">Room</p>
                      <p className="font-medium">{booking.room.name}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-white/50 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white/50 text-xs">Check-in</p>
                    <p className="font-medium">{new Date(booking.checkIn).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Moon className="w-4 h-4 text-white/50 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white/50 text-xs">Nights</p>
                    <p className="font-medium">{booking.nights} night{booking.nights !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-white/50 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white/50 text-xs">Guests</p>
                    <p className="font-medium">{booking.adults} adult{booking.adults !== 1 ? 's' : ''}{booking.children > 0 ? ` + ${booking.children} child` : ''}</p>
                  </div>
                </div>
              </div>

              {booking.guest && (
                <>
                  <div className="h-px bg-white/20 my-3" />
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                      {booking.guest.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{booking.guest.name}</p>
                      {booking.guest.email && <p className="text-xs text-white/50">{booking.guest.email}</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Payment Methods */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 className="font-bold text-gray-800 text-base">Select Payment Method</h2>
              <p className="text-xs text-gray-500 mt-0.5">Choose how you'd like to pay</p>
            </div>

            {allMethods.length === 0 ? (
              <div className="px-5 pb-5 flex items-start gap-3 rounded-lg bg-amber-50 mx-5 mb-5 p-4 border border-amber-200">
                <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  No payment methods are currently configured. Please contact the resort directly.
                </p>
              </div>
            ) : (
              <div className="px-4 pb-2 space-y-2">
                {allMethods.map(gw => {
                  const style = GW_STYLE[gw.id] ?? GW_STYLE.manual;
                  const isSelected = selected === gw.id;
                  return (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => setSelected(gw.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-[#1a6b5e] bg-[#f0faf8] shadow-sm'
                          : 'border-transparent bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {/* Logo */}
                      <div className={`w-10 h-10 rounded-xl ${style.bg} ${style.border} border flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-sm font-bold ${style.color}`}>{style.logoText}</span>
                      </div>
                      {/* Name & description */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${isSelected ? 'text-[#1a6b5e]' : 'text-gray-800'}`}>
                          {gw.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{GW_DESCRIPTION[gw.id] ?? gw.methods.join(', ')}</p>
                      </div>
                      {/* Radio indicator */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-[#1a6b5e]' : 'border-gray-300'
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#1a6b5e]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Manual instructions preview */}
            {selected === 'manual' && gateways?.manualInstructions && (
              <div className="mx-5 mb-4 rounded-xl bg-[#f0faf8] border border-[#b2ddd6] p-3">
                <p className="text-xs font-medium text-[#1a6b5e] mb-1">Payment Instructions</p>
                <p className="text-xs text-[#1a6b5e]/80 whitespace-pre-line">{gateways.manualInstructions}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Pay button */}
            <div className="px-5 pb-5 pt-1">
              <button
                type="button"
                onClick={handlePay}
                disabled={paying || !selected || allMethods.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1a6b5e] hover:bg-[#145a4f] active:bg-[#0d3d36] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 transition-colors shadow-lg shadow-[#1a6b5e]/30"
              >
                {paying ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    {selected === 'manual'
                      ? 'Confirm Booking'
                      : `Pay ${booking ? formatAmt(booking.totalAmount, sym) : ''} →`}
                    {!paying && selected !== 'manual' && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" />
                Your payment is secured with 256-bit SSL encryption
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export default function CheckoutPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#1a6b5e] via-[#145a4f] to-[#0d3d36] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/70" />
      </div>
    }>
      <CheckoutInner slug={params.slug} />
    </Suspense>
  );
}
