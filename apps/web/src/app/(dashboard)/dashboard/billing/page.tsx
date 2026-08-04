'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { billingApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  CreditCard, CheckCircle2, AlertTriangle, Clock, Zap,
  Building2, ExternalLink, Receipt, Loader2, Star, ArrowRight, MessageCircle,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
import { PLAN_PRICING, PUBLIC_PLAN_ORDER, type PlanKey } from '@resort-pro/types';

type PlanConfig = {
  key: string; name: string; price: number; annualPrice?: number;
  roomLimit: number; staffLimit: number; aiMonthlyTokenCap: number;
  flags: string[]; features: string[];
};

type BillingStatus = {
  plan: string; planStatus: string; trialDaysLeft: number;
  isTrialing: boolean; isActive: boolean; isPastDue: boolean;
  isCanceled: boolean; currentPeriodEnd: string | null;
  trialEndsAt: string | null; hasStripeCustomer: boolean;
  hasSubscription: boolean;
  isLaunchOffer?: boolean;
  isStripeTestMode?: boolean;
  bkashEnabled?: boolean;
  bkashPricesBdt?: Record<string, number>;
  planConfigs?: PlanConfig[];
  entitlement?: { roomLimit: number; staffLimit: number; aiMonthlyTokenCap: number; flags: Record<string, boolean> };
};

type Invoice = {
  id: string; number: string | null; amount: string;
  currency: string; status: string; date: string;
  pdfUrl: string | null; hostedUrl: string | null;
};

function StatusPill({ status, trialDaysLeft, isLaunchOffer }: { status: string; trialDaysLeft: number; isLaunchOffer?: boolean }) {
  if (status === 'trialing') return (
    <span className="inline-flex items-center gap-1.5 rounded-rp-xs border border-rp-border-md bg-rp-amber-bg px-2 py-1 text-rp-micro font-semibold text-rp-gold">
      <Clock className="h-3 w-3" /> {isLaunchOffer ? 'Launch offer' : 'Access active'} — {trialDaysLeft} days left
    </span>
  );
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1.5 rounded-rp-xs border border-rp-border-md bg-rp-teal-bg px-2 py-1 text-rp-micro font-semibold text-rp-brand">
      <CheckCircle2 className="h-3 w-3" /> Active
    </span>
  );
  if (status === 'past_due') return (
    <span className="inline-flex items-center gap-1.5 rounded-rp-xs border border-rp-border-md bg-rp-red-bg px-2 py-1 text-rp-micro font-semibold text-rp-danger">
      <AlertTriangle className="h-3 w-3" /> Past Due
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-rp-xs border border-rp-border-md bg-rp-surface-3 px-2 py-1 text-rp-micro font-semibold text-rp-muted">
      {status}
    </span>
  );
}

function PlanCard({ plan, onSelect, onBkash, loading, bkashEnabled, bkashPriceBdt }: {
  plan: PlanConfig;
  onSelect: (key: PlanKey) => void;
  onBkash: (key: PlanKey) => void;
  loading: string | null;
  bkashEnabled?: boolean;
  bkashPriceBdt?: number;
}) {
  const planKey = plan.key as PlanKey;
  const isPro = planKey === 'PROFESSIONAL';
  const pricing = PLAN_PRICING[planKey];
  const Icon = isPro ? Star : Zap;

  return (
    <div className={`relative flex flex-col gap-4 rounded-rp-card border-2 bg-rp-surface p-6 ${isPro ? 'border-rp-brand shadow-rp-pop' : 'border-rp-border-md'}`}>
      {isPro && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-rp-brand px-3 py-1 text-rp-micro font-bold text-white">MOST POPULAR</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-rp-btn ${isPro ? 'bg-rp-brand text-white' : 'bg-rp-surface-3 text-rp-muted'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-rp-text">{pricing.displayName}</h3>
          <p className="text-rp-meta text-rp-muted">
            Up to {pricing.roomLimit} rooms
          </p>
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-4xl font-bold leading-none text-rp-text">
          ${pricing.monthlyUsd}
        </span>
        <span className="mb-1 text-rp-body text-rp-muted">/month</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {plan.features.map(f => (
          <li key={f} className="flex items-center gap-2 text-rp-body text-rp-accent">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-rp-brand" />
            {f}
          </li>
        ))}
      </ul>
      <button onClick={() => onSelect(planKey)} disabled={loading !== null}
        className={`flex w-full items-center justify-center gap-2 rounded-rp-ctrl py-2 text-rp-body font-medium transition-colors disabled:opacity-60 ${isPro ? 'bg-rp-brand text-white hover:bg-rp-brand-hover' : 'border-2 border-rp-brand text-rp-brand hover:bg-rp-surface-3'}`}>
          {loading === planKey
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ArrowRight className="h-4 w-4" />}
          Upgrade to {pricing.displayName}
      </button>
      {bkashEnabled && (
        <button onClick={() => onBkash(planKey)} disabled={loading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-rp-ctrl bg-pink-600 py-2 text-rp-body font-semibold text-white transition-colors hover:bg-pink-700 disabled:opacity-60">
          {loading === `bkash-${planKey}`
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : null}
          Pay with bKash{bkashPriceBdt ? ` — ৳${bkashPriceBdt.toLocaleString()}/mo` : ''}
        </button>
      )}
    </div>
  );
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [billing, setBilling]           = useState<BillingStatus | null>(null);
  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [loadingPlan, setLoadingPlan]   = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [pageLoading, setPageLoading]   = useState(true);

  useEffect(() => {
    if (searchParams.get('success') === '1')  toast({ title: '🎉 Subscription activated!', description: 'Your plan has been upgraded successfully.' });
    if (searchParams.get('canceled') === '1') toast({ title: 'Checkout cancelled', description: 'No changes were made.', variant: 'destructive' });
  }, [searchParams]);

  useEffect(() => {
    Promise.all([billingApi.getStatus(), billingApi.getInvoices()])
      .then(([statusRes, invoicesRes]) => {
        setBilling(statusRes.data.data);
        setInvoices(invoicesRes.data.data || []);
      })
      .catch(() => toast({ title: 'Error loading billing info', variant: 'destructive' }))
      .finally(() => setPageLoading(false));
  }, []);

  const handleUpgrade = async (planKey: PlanKey) => {
    setLoadingPlan(planKey);
    try {
      const res = await billingApi.createCheckout(planKey);
      window.location.href = res.data.data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to start checkout';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setLoadingPlan(null);
    }
  };

  const handleBkash = async (planKey: PlanKey) => {
    setLoadingPlan(`bkash-${planKey}`);
    try {
      const res = await billingApi.createBkashCheckout(planKey, 'month');
      window.location.href = res.data.data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not start bKash payment';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await billingApi.createPortal();
      window.location.href = res.data.data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to open billing portal';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setPortalLoading(false);
    }
  };

  if (pageLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-rp-brand" />
    </div>
  );

  const currentPlan = (billing?.plan && billing.plan in PLAN_PRICING ? billing.plan : 'FREE') as PlanKey;
  const currentPricing = PLAN_PRICING[currentPlan];
  const plansByKey = new Map((billing?.planConfigs ?? []).map((plan) => [plan.key, plan]));
  const currentPlanIndex = PUBLIC_PLAN_ORDER.indexOf(currentPlan);
  const upgradePlans = (currentPlanIndex === -1 ? [] : PUBLIC_PLAN_ORDER
    .filter((planKey) => PUBLIC_PLAN_ORDER.indexOf(planKey) > currentPlanIndex))
    .map((planKey) => plansByKey.get(planKey))
    .filter((plan): plan is PlanConfig => Boolean(plan));

  return (
    <PageShell gap={8}>
      {/* Header */}
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your plan and payment details"
      />

      {/* Current plan card */}
      <div className="rounded-rp-card border border-rp-border bg-rp-surface p-6 shadow-rp-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-rp-btn bg-rp-teal-bg">
              <Building2 className="h-6 w-6 text-rp-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-rp-text">
                  {currentPricing.displayName}
                </h2>
                {billing && <StatusPill status={billing.planStatus} trialDaysLeft={billing.trialDaysLeft} isLaunchOffer={billing.isLaunchOffer} />}
              </div>
              {billing?.currentPeriodEnd && billing.isActive && (
                <p className="mt-0.5 text-rp-meta text-rp-muted">
                  Renews on {new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              {billing?.isTrialing && billing.trialEndsAt && (
                <p className="mt-0.5 text-rp-meta text-rp-muted">
                  {billing.isLaunchOffer ? 'Launch offer ends' : 'Access ends'} {new Date(billing.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          {billing?.hasSubscription && (
            <button onClick={handlePortal} disabled={portalLoading}
              className="flex items-center gap-2 rounded-rp-ctrl border border-rp-border-md px-4 py-2 text-rp-body font-medium text-rp-subtle transition-colors hover:bg-rp-surface-3 disabled:opacity-60">
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Manage Subscription
            </button>
          )}
        </div>

        {billing?.isTrialing && billing.trialDaysLeft <= 7 && (
          <div className="mt-5 flex items-start gap-3 rounded-rp-btn border border-rp-border-md bg-rp-amber-bg p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rp-gold" />
            <div>
              <p className="text-rp-body font-semibold text-rp-text">
                Complimentary access ends in {billing.trialDaysLeft} day{billing.trialDaysLeft !== 1 ? 's' : ''}
              </p>
              <p className="mt-0.5 text-rp-meta text-rp-muted">
                Choose your next plan before this access ends to avoid interruption.
              </p>
            </div>
          </div>
        )}

        {billing?.isPastDue && (
          <div className="mt-5 flex items-start gap-3 rounded-rp-btn border border-rp-border-md bg-rp-red-bg p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rp-danger" />
            <div>
              <p className="text-rp-body font-semibold text-rp-danger">Payment failed</p>
              <p className="mt-0.5 text-rp-meta text-rp-muted">
                Please update your payment method to avoid service interruption.
              </p>
            </div>
          </div>
        )}
      </div>

      {billing?.isStripeTestMode && (
        <div className="flex items-start gap-3 rounded-rp-btn border border-rp-border-md bg-rp-teal-bg p-4">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-rp-brand" />
          <div>
            <p className="text-rp-body font-semibold text-rp-brand">Test Mode Active</p>
            <p className="mt-0.5 text-rp-meta text-rp-accent">
              Use test card <strong>4242 4242 4242 4242</strong>, any future expiry, any 3-digit CVC. No real charges will be made.
            </p>
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <h2 className="mb-1 text-xl font-semibold text-rp-text">Upgrade when you need more capacity</h2>
        <p className="mb-6 text-rp-body text-rp-muted">Your current plan stays in place. Choose a higher plan only when your operation needs it.</p>
        {upgradePlans.length > 0 ? (
          <div className={`grid grid-cols-1 gap-5 ${upgradePlans.length === 1 ? 'max-w-md' : 'md:grid-cols-2'}`}>
            {upgradePlans.map(plan => (
              <PlanCard key={plan.key} plan={plan}
                onSelect={handleUpgrade} onBkash={handleBkash} loading={loadingPlan}
                bkashEnabled={billing?.bkashEnabled} bkashPriceBdt={billing?.bkashPricesBdt?.[plan.key]} />
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-rp-btn border border-rp-border bg-rp-surface-2 p-4 text-rp-body text-rp-muted">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-rp-brand" />
            <p>You are on the highest self-serve plan. For custom needs or a legacy Enterprise arrangement, please contact ResortPro support.</p>
          </div>
        )}
      </div>

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div>
          <h2 className="font-display text-[19px] font-semibold mb-4 text-[#183153] dark:text-[#f8fafc]">Invoice History</h2>
          <div className="rounded-[14px] border bg-white overflow-hidden"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {['Invoice', 'Date', 'Amount', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#a9c1d0]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-[#fafaf8] transition-colors"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-5 py-3.5 text-[12.5px] font-mono text-[#64748b] dark:text-[#a9c1d0]">
                      {inv.number || inv.id.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">
                      {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-[#183153] dark:text-[#f8fafc]">
                      {inv.currency} {inv.amount}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold capitalize"
                        style={inv.status === 'paid'
                          ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }
                          : inv.status === 'open'
                          ? { background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)', color: '#b89040' }
                          : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {inv.pdfUrl && (
                        <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12.5px] hover:underline"
                          style={{ color: '#183153' }}>
                          <Receipt className="h-3.5 w-3.5" /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invoices.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border p-10 text-center"
          style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
          <Receipt className="h-10 w-10" style={{ color: '#e0dbd3' }} />
          <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">
            No invoices yet. They will appear here after your first payment.
          </p>
        </div>
      )}
    </PageShell>
  );
}
