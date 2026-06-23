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
    <div className="mb-4 flex items-center justify-between gap-4 rounded-[14px] border px-4 py-3"
      style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.25)' }}>
      <div className="flex items-center gap-3">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: '#d4a853' }}>
          <Sparkles className="h-[15px] w-[15px] text-white" />
        </div>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: '#7a5c2a' }}>
            You&apos;re exploring the ResortPro Demo
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: '#b89040' }}>
            এটি একটি demo environment — সব data sample। আপনার real resort manage করতে sign up করুন।
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/auth/register"
          className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-semibold transition-colors hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
        >
          <ExternalLink className="h-3 w-3" />
          Start Free Trial
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:bg-black/10"
          style={{ color: '#b89040' }}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
