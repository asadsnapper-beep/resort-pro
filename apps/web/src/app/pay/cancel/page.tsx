'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { PublicStatusShell } from '@/components/brand/PublicStatusShell';

function CancelContent() {
  const params = useSearchParams();
  const booking = params.get('booking');

  return (
    <PublicStatusShell eyebrow="Payment cancelled" title="No charge was made." description="Your booking is still on hold. Contact the resort whenever you’re ready to continue." icon={<XCircle className="h-6 w-6" />}>
      <div className="text-center">
        {booking && (
          <p className="text-gray-500 mb-1">
            Booking reference: <strong className="text-gray-800 font-mono">{booking}</strong>
          </p>
        )}
        <p className="mb-8 text-sm leading-6 text-slate-500">
          No payment was made. Your booking is still on hold. Please contact the resort if you need assistance.
        </p>
        <div className="rounded-2xl border border-black/5 bg-[#f8f6f1] p-4 text-sm text-slate-600">
          If you'd like to complete your payment, please ask the resort to send you a new payment link.
        </div>
      </div>
    </PublicStatusShell>
  );
}

export default function PayCancelPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-resort-900">
      <div className="text-white">Loading…</div>
    </div>}>
      <CancelContent />
    </Suspense>
  );
}
