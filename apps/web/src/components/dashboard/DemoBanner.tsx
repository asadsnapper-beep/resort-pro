'use client';

import { useAuthStore } from '@/store/auth';
import { Sparkles, X, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';

export function DemoBanner() {
  const { tenant } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const locale = useLocale();
  const isBn = locale === 'bn';

  if (!tenant?.isDemo || dismissed) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[14px] border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.25)' }}>
      <div className="flex items-start gap-3 sm:items-center">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: '#d4a853' }}>
          <Sparkles className="h-[15px] w-[15px] text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold" style={{ color: '#7a5c2a' }}>
            {isBn ? 'আপনি ResortPro ডেমো দেখছেন' : "You're exploring the ResortPro Demo"}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: '#b89040' }}>
            {isBn
              ? 'এটি একটি demo environment — সব data sample। আপনার real resort manage করতে sign up করুন।'
              : 'This is a demo environment with sample data. Sign up to manage your real resort.'}
          </p>
        </div>
        {/* Dismiss sits beside the text on mobile so it's always reachable */}
        <button
          onClick={() => setDismissed(true)}
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10 sm:hidden"
          style={{ color: '#b89040' }}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/auth/register"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] px-3 py-2 text-[12px] font-semibold transition-colors hover:opacity-90 sm:w-auto sm:py-1.5"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
        >
          <ExternalLink className="h-3 w-3" />
          Start Free Trial
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="hidden h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:bg-black/10 sm:flex"
          style={{ color: '#b89040' }}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
