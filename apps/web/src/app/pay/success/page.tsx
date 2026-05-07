'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

function SuccessContent() {
  const params = useSearchParams();
  const booking = params.get('booking');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a6b5e] via-[#145a4f] to-[#0d3d36] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        {booking && (
          <p className="text-gray-500 mb-1">
            Booking reference: <strong className="text-gray-800 font-mono">{booking}</strong>
          </p>
        )}
        <p className="text-gray-500 text-sm mb-8">
          Your payment has been processed. You will receive a confirmation email shortly.
        </p>
        <div className="space-y-3">
          <div className="p-4 bg-[#f0faf8] rounded-xl text-sm text-[#1a6b5e]">
            Thank you for your payment. We look forward to welcoming you!
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a6b5e] flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>}>
      <SuccessContent />
    </Suspense>
  );
}
