'use client';

import { useAuthStore } from '@/store/auth';
import { Sparkles, X, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export function DemoBanner() {
  const { tenant } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  if (!tenant?.isDemo || dismissed) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400">
          <Sparkles className="h-4 w-4 text-amber-900" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-900">
            You're exploring the ResortPro Demo
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            এটি একটি demo environment — সব data sample। আপনার real resort manage করতে sign up করুন।
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/auth/register"
          className="inline-flex items-center gap-1.5 rounded-xl bg-resort-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-resort-700 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Start Free Trial
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1 text-amber-600 hover:bg-amber-100 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
