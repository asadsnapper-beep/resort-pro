'use client';

import { useQuery } from '@tanstack/react-query';
import { shareholdersApi } from '@/lib/api';
import { TrendingUp, Loader2, Wallet, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MeData {
  ownershipPercent: number;
  joinedAt: string;
  netProfitThisMonth: number;
  estimatedShareThisMonth: number;
}

interface PayoutEntry {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  note: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer', BKASH: 'bKash', CASH: 'Cash', OTHER: 'Other',
};

export default function MySharesPage() {
  const { data: me, isLoading: meLoading } = useQuery<MeData>({
    queryKey: ['shareholder-me'],
    queryFn: () => shareholdersApi.me().then((r) => r.data.data),
  });

  const { data: payoutsData, isLoading: payoutsLoading } = useQuery<PayoutEntry[]>({
    queryKey: ['shareholder-me-payouts'],
    queryFn: () => shareholdersApi.myPayouts().then((r) => r.data.data),
  });

  const payouts = payoutsData ?? [];

  if (meLoading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#9bbdb7' }} />
    </div>
  );

  if (!me) return (
    <div className="max-w-2xl rounded-[14px] border bg-white p-8 text-center" style={{ borderColor: 'var(--rp-border)' }}>
      <p className="text-[13.5px] text-[#8aa29a] dark:text-[#94b8b0]">Kono shareholder profile paoa jayni. Owner-er sathe jogajog koro.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
          <TrendingUp className="h-4 w-4" style={{ color: '#23766a' }} />
        </div>
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f] dark:text-[#dfd9d0]">
            My Shares
          </h1>
          <p className="text-[13px] text-[#7a9890] dark:text-[#94b8b0]">
            Nijer ownership, share estimate, ar payout history
          </p>
        </div>
      </div>

      {/* Summary card */}
      <div className="rounded-[14px] p-6 text-white" style={{ background: '#1b342f', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#62847c]">Ownership</p>
            <p className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.03em] text-[#ece7df]">{me.ownershipPercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#62847c]">Joined</p>
            <p className="mt-1 text-[13.5px] text-[#dfd9d0]">{new Date(me.joinedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</p>
          </div>
        </div>
        <div className="rounded-[10px] p-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] text-[#94b8b0]">This month&apos;s estimated share (based on ৳{me.netProfitThisMonth.toLocaleString()} net profit)</p>
          <p className="mt-1 text-[24px] font-semibold text-[#ece7df]">{formatCurrency(me.estimatedShareThisMonth)}</p>
          <p className="mt-1 text-[11px] text-[#62847c]">Estimate — actual payout may differ, owner confirm korbe</p>
        </div>
      </div>

      {/* Payout history */}
      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div className="px-5 py-4" style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <h2 className="text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">Payout History</h2>
        </div>
        {payoutsLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#9bbdb7' }} />
          </div>
        ) : payouts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
              <Wallet className="h-7 w-7 text-[#c5bdb4] dark:text-[#6e8580]" />
            </div>
            <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Ekhono kono payout record kora hoyni.</p>
          </div>
        ) : (
          <div>
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-[9px] shrink-0" style={{ background: 'var(--rp-amber-bg)' }}>
                  <Calendar className="h-4 w-4" style={{ color: '#b89040' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{formatCurrency(p.amount)}</p>
                  <p className="text-[12px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">
                    {new Date(p.paidAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })} · {METHOD_LABEL[p.method] ?? p.method}
                    {p.note && <span> · {p.note}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
