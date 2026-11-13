'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { PublicStatusShell } from '@/components/brand/PublicStatusShell';

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifyStatus = 'loading' | 'success' | 'failed' | 'pending' | 'error';

interface VerifyResult {
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED';
  gatewayPaymentId?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  error?: string;
  confirmationNo?: string;
}

// ─── Verify Inner ─────────────────────────────────────────────────────────────

function VerifyInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const gateway   = searchParams.get('gateway') ?? '';
  const bookingId = searchParams.get('bookingId') ?? '';
  const slug      = searchParams.get('slug') ?? '';

  // Gateway-specific return params
  const paymentID = searchParams.get('paymentID')    // bKash
    ?? searchParams.get('tran_id')                   // SSLCommerz
    ?? searchParams.get('razorpay_payment_id')       // Razorpay
    ?? searchParams.get('order_id')                  // PayHere / Razorpay order
    ?? searchParams.get('oid')                       // eSewa
    ?? searchParams.get('pidx')                      // Khalti
    ?? searchParams.get('payment_intent')            // Stripe
    ?? searchParams.get('gatewayPaymentId')          // generic
    ?? '';

  const [pageStatus, setPageStatus] = useState<VerifyStatus>('loading');
  const [result,     setResult]     = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!gateway || !bookingId) {
      setPageStatus('error');
      return;
    }

    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    // Build queryParams from all search params
    const queryParams: Record<string, string> = {};
    searchParams.forEach((val, key) => { queryParams[key] = val; });

    axios.post(`${API}/api/payments/checkout/verify`, {
      gateway,
      gatewayPaymentId: paymentID || bookingId,
      orderId: bookingId,
      queryParams,
    })
      .then(res => {
        const data = res.data.data as VerifyResult;
        setResult(data);
        switch (data.status) {
          case 'SUCCESS':   setPageStatus('success'); break;
          case 'FAILED':
          case 'CANCELLED': setPageStatus('failed');  break;
          case 'PENDING':
          default:          setPageStatus('pending'); break;
        }
      })
      .catch(err => {
        setResult({ status: 'FAILED', error: err?.response?.data?.error ?? 'Verification failed' });
        setPageStatus('failed');
      });
  }, [gateway, bookingId, paymentID]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Loading ────────────────────────────────────────────────────────────
  if (pageStatus === 'loading') {
    return (
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-[#f7fee7] flex items-center justify-center mx-auto mb-5">
          <Loader2 className="h-10 w-10 animate-spin text-lime-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Verifying Payment</h1>
        <p className="text-sm text-gray-500">Please wait while we confirm your payment...</p>
      </div>
    );
  }

  // ─── Error (missing params) ──────────────────────────────────────────────
  if (pageStatus === 'error') {
    return (
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h1>
        <p className="text-sm text-gray-500 mb-6">This payment verification link is invalid or expired.</p>
        {slug && (
          <button
            onClick={() => router.push(`/${slug}`)}
            className="inline-flex items-center gap-2 rounded-full bg-lime-400 px-5 py-2.5 text-sm font-extrabold text-resort-900 hover:bg-lime-300">
            Return to Resort
          </button>
        )}
      </div>
    );
  }

  // ─── Success ─────────────────────────────────────────────────────────────
  if (pageStatus === 'success') {
    return (
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
        {result?.gatewayPaymentId && (
          <p className="text-sm text-gray-500 mb-1">
            Transaction ID: <span className="font-mono text-gray-700">{result.transactionId ?? result.gatewayPaymentId}</span>
          </p>
        )}
        {result?.amount && result?.currency && (
          <p className="text-sm text-gray-500 mb-4">
            Amount paid: <strong className="text-gray-700">{result.currency} {result.amount.toLocaleString()}</strong>
          </p>
        )}
        <div className="mb-6 rounded-2xl border border-lime-200 bg-lime-50 p-4 text-sm text-resort-900">
          <p className="font-semibold mb-1">Booking Confirmed!</p>
          <p>Thank you for your payment. You will receive a confirmation email shortly.</p>
          <p className="text-xs text-[#0e223c]/70 mt-1">Bookings ID: <span className="font-mono">{bookingId}</span></p>
        </div>
        <div className="space-y-2">
          {slug && (
            <button
              onClick={() => router.push(`/${slug}`)}
              className="w-full rounded-full bg-lime-400 py-3 text-sm font-extrabold text-resort-900 transition-colors hover:bg-lime-300">
              Return to Resort Website
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Failed / Cancelled ──────────────────────────────────────────────────
  if (pageStatus === 'failed') {
    return (
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Payment Failed</h1>
        <p className="text-sm text-gray-500 mb-4">
          {result?.error ?? 'Your payment could not be completed. No charges have been made.'}
        </p>
        <div className="space-y-2">
          {slug && bookingId && (
            <button
              onClick={() => router.push(`/${slug}/checkout?bookingId=${bookingId}`)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-lime-400 py-3 text-sm font-extrabold text-resort-900 transition-colors hover:bg-lime-300">
              <RotateCcw className="w-4 h-4" /> Try Again
            </button>
          )}
          {slug && (
            <button
              onClick={() => router.push(`/${slug}`)}
              className="w-full rounded-xl border border-gray-200 text-gray-600 py-3 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Return to Resort Website
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Pending ─────────────────────────────────────────────────────────────
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
        <AlertCircle className="w-10 h-10 text-amber-400" />
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Payment Pending</h1>
      <p className="text-sm text-gray-500 mb-4">
        Your payment is being processed. We'll send you a confirmation email once it's verified.
      </p>
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 mb-5">
        Booking ID: <span className="font-mono">{bookingId}</span>
      </div>
      {slug && (
        <button
          onClick={() => router.push(`/${slug}`)}
          className="w-full rounded-full bg-lime-400 py-3 text-sm font-extrabold text-resort-900 transition-colors hover:bg-lime-300">
          Return to Resort Website
        </button>
      )}
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export default function VerifyPage() {
  return (
    <PublicStatusShell eyebrow="Secure checkout" title="Confirming your payment." description="We’re checking the payment gateway and will update your booking automatically." icon={<CheckCircle2 className="h-6 w-6" />}>
        <Suspense fallback={
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-lime-600" />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        }>
          <VerifyInner />
        </Suspense>
    </PublicStatusShell>
  );
}
