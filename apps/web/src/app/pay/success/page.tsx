'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { PublicStatusShell } from '@/components/brand/PublicStatusShell';

function SuccessContent() {
  const params = useSearchParams();
  const booking = params.get('booking');

  return (
    <PublicStatusShell eyebrow="Payment complete" title="You’re all set." description="Your reservation payment has been securely processed." icon={<CheckCircle2 className="h-6 w-6" />}>
      <div className="text-center">
        {booking && (
          <p className="text-gray-500 mb-1">
            Booking reference: <strong className="text-gray-800 font-mono">{booking}</strong>
          </p>
        )}
        <p className="mb-8 text-sm leading-6 text-slate-500">
          Your payment has been processed. You will receive a confirmation email shortly.
        </p>
        <div className="space-y-3">
          <div className="rounded-2xl border border-lime-200 bg-lime-50 p-4 text-sm font-medium text-resort-900">
            Thank you for your payment. We look forward to welcoming you!
          </div>
        </div>
      </div>
    </PublicStatusShell>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-resort-900">
      <div className="text-white">Loading…</div>
    </div>}>
      <SuccessContent />
    </Suspense>
  );
}
