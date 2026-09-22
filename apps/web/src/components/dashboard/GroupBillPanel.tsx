'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Wallet } from 'lucide-react';
import { billingApi } from '@/lib/api';

interface GroupBillLine {
  tenantId: string;
  name: string;
  plan: string;
  listPrice: number;
  amount: number;
}

interface GroupBill {
  groupName: string;
  available: boolean;
  reason?: string;
  interval?: 'month' | 'year';
  currency?: string;
  lines?: GroupBillLine[];
  total?: number;
}

/**
 * Pay for every resort in one go.
 *
 * bKash has no subscriptions, so this is not a different kind of billing — it
 * is one payment instead of four, for the sum of what each resort already
 * owes. Each keeps its own plan and its own price, so the lines are shown
 * rather than a single number: an owner paying for four resorts should be able
 * to see which of them the money is going to.
 *
 * Renders nothing unless the owner has a group with something to combine,
 * which is nearly nobody.
 */
export function GroupBillPanel() {
  const t = useTranslations('common') as (key: string) => string;
  const say = (key: string, fallback: string) => {
    const value = t(`groupBill.${key}`);
    return value.endsWith(`groupBill.${key}`) ? fallback : value;
  };

  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['group-bill', interval],
    queryFn: () => billingApi.group(interval).then((r) => (r.data?.data ?? null) as GroupBill | null),
    retry: false,
  });

  if (!data) return null;

  if (!data.available) {
    // Worth saying only when something can be done about it.
    if (data.reason !== 'ENTERPRISE_IN_GROUP') return null;
    return (
      <div className="rounded-rp-card border border-rp-border bg-rp-surface p-6 shadow-rp-card">
        <p className="text-rp-body text-rp-muted">
          {say('enterprise', 'One of your resorts is on a negotiated plan, so these cannot be billed together yet. Contact support and we will sort it out.')}
        </p>
      </div>
    );
  }

  const taka = (n: number) => `৳${n.toLocaleString()}`;

  const pay = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const res = await billingApi.createBkashGroupCheckout(interval);
      window.location.href = res.data.data.url;
    } catch (err) {
      setFailed((err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? say('failed', 'Could not start the payment. Try again.'));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-rp-card border border-rp-border bg-rp-surface p-6 shadow-rp-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-rp-btn bg-rp-teal-bg">
            <Wallet className="h-5 w-5 text-rp-brand" />
          </span>
          <div>
            <h2 className="text-rp-heading font-semibold text-rp-text">
              {say('title', 'Pay for all your resorts at once')}
            </h2>
            <p className="text-rp-body text-rp-muted">
              {say('subtitle', 'One bKash payment instead of one for each.')}
            </p>
          </div>
        </div>

        <div className="flex gap-1" role="group" aria-label={say('interval', 'Billing period')}>
          {(['month', 'year'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
              className={`rounded-rp-btn px-3 py-1.5 text-rp-meta font-medium ${
                interval === value
                  ? 'bg-rp-teal-bg text-rp-brand'
                  : 'border border-rp-border-md text-rp-muted'
              }`}
            >
              {value === 'month' ? say('monthly', 'Monthly') : say('yearly', 'Yearly')}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-rp-border">
        {(data.lines ?? []).map((line) => (
          <li key={line.tenantId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-rp-body text-rp-text">{line.name}</span>
              <span className="block text-rp-micro text-rp-muted">{line.plan.toLowerCase()}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-rp-body text-rp-text">{taka(line.amount)}</span>
              {line.amount < line.listPrice && (
                <span className="block text-rp-micro text-rp-muted line-through">{taka(line.listPrice)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rp-border pt-3">
        <span className="text-rp-body font-semibold text-rp-text">
          {say('total', 'Total')} {taka(data.total ?? 0)}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void pay()}
          className="rounded-rp-btn bg-rp-brand px-4 py-2 text-rp-body font-semibold text-white disabled:opacity-60"
        >
          {busy ? say('starting', 'Opening bKash…') : say('pay', 'Pay with bKash')}
        </button>
      </div>

      {failed && <p role="alert" className="text-rp-meta text-rp-danger">{failed}</p>}
    </div>
  );
}
