'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';
import { billingApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  CreditCard, CheckCircle2, AlertTriangle, Clock, Zap,
  Shield, Building2, ExternalLink, Receipt, Loader2, Star, ArrowRight,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

type PlanKey = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

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

function StatusPill({ status, trialDaysLeft }: { status: string; trialDaysLeft: number }) {
  if (status === 'trialing') return (
    <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
      style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)', color: '#b89040' }}>
      <Clock className="h-3 w-3" /> Trial — {trialDaysLeft} days left
    </span>
  );
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
      style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
      <CheckCircle2 className="h-3 w-3" /> Active
    </span>
  );
  if (status === 'past_due') return (
    <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
      style={{ background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }}>
      <AlertTriangle className="h-3 w-3" /> Past Due
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
      style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
      {status}
    </span>
  );
}

function PlanCard({ plan, currentPlan, onSelect, onBkash, loading, bkashEnabled, bkashPriceBdt }: {
  plan: PlanConfig; currentPlan: string;
  onSelect: (key: PlanKey) => void;
  onBkash: (key: PlanKey) => void;
  loading: string | null;
  bkashEnabled?: boolean;
  bkashPriceBdt?: number;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const planKey = plan.key as PlanKey;
  const isCurrent = currentPlan.toUpperCase() === planKey;
  const isPro = planKey === 'PROFESSIONAL';
  const iconMap: Record<string, React.ReactNode> = {
    FREE:         <Zap className="h-5 w-5" />,
    STARTER:      <Zap className="h-5 w-5" />,
    PROFESSIONAL: <Star className="h-5 w-5" />,
    ENTERPRISE:   <Shield className="h-5 w-5" />,
  };

  return (
    <div className="relative flex flex-col gap-4 rounded-[16px] border-2 p-6 transition-all"
      style={isPro
        ? { borderColor: '#183153', boxShadow: '0 4px 24px rgba(24,49,83,0.12)' }
        : isCurrent
        ? { borderColor: 'rgba(184,144,64,0.4)', background: isDark ? 'rgba(184,144,64,0.05)' : '#fffdf6' }
        : { borderColor: 'var(--rp-border-md)' }}>
      {isPro && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: '#183153', color: 'var(--rp-btn-accent-text)' }}>MOST POPULAR</span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3.5 right-4">
          <span className="rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: '#b89040', color: '#fff' }}>CURRENT PLAN</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px]"
          style={isPro ? { background: '#183153', color: 'var(--rp-btn-accent-text)' } : { background: 'var(--rp-surface-3)', color: 'var(--rp-text-muted)' }}>
          {iconMap[planKey] ?? <Zap className="h-5 w-5" />}
        </div>
        <div>
          <h3 className="font-bold text-[15px] text-[#183153] dark:text-[#f8fafc]">{plan.name}</h3>
          <p className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">
            {plan.roomLimit === -1 ? 'Unlimited rooms' : `Up to ${plan.roomLimit} rooms`}
          </p>
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-[36px] font-bold leading-none text-[#183153] dark:text-[#f8fafc]">
          {plan.price === 0 ? 'Free' : `$${plan.price}`}
        </span>
        {plan.price > 0 && <span className="text-[13px] text-[#64748b] dark:text-[#a9c1d0] mb-1">/month</span>}
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {plan.features.map(f => (
          <li key={f} className="flex items-center gap-2 text-[13px] text-[#475569] dark:text-[#9db4c4]">
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#183153' }} />
            {f}
          </li>
        ))}
      </ul>
      {planKey !== 'FREE' && (
        <button onClick={() => onSelect(planKey)} disabled={isCurrent || loading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-[9px] py-2 text-[13px] font-medium transition-colors disabled:opacity-60 hover:opacity-90"
          style={isPro
            ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
            : isCurrent
            ? { background: 'var(--rp-surface-3)', color: 'var(--rp-text-faint)', cursor: 'not-allowed' }
            : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', border: isDark ? '2px solid #5f8fb5' : '2px solid #183153', color: isDark ? '#9db4c4' : '#183153' }}>
          {loading === planKey
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ArrowRight className="h-4 w-4" />}
          {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
        </button>
      )}
      {planKey !== 'FREE' && !isCurrent && bkashEnabled && (
        <button onClick={() => onBkash(planKey)} disabled={loading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-[9px] py-2 text-[13px] font-semibold transition-colors disabled:opacity-60 hover:opacity-90"
          style={{ background: '#e2136e', color: '#fff' }}>
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
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
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#183153' }} />
    </div>
  );

  const currentPlan = billing?.plan || 'FREE';

  return (
    <PageShell gap={8}>
      {/* Header */}
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your plan and payment details"
      />

      {/* Current plan card */}
      <div className="rounded-[14px] border bg-white p-6"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px]" style={{ background: 'var(--rp-teal-bg)' }}>
              <Building2 className="h-6 w-6" style={{ color: '#183153' }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[17px] font-semibold capitalize text-[#183153] dark:text-[#f8fafc]">
                  {currentPlan.toLowerCase()} Plan
                </h2>
                {billing && <StatusPill status={billing.planStatus} trialDaysLeft={billing.trialDaysLeft} />}
              </div>
              {billing?.currentPeriodEnd && billing.isActive && (
                <p className="text-[12.5px] mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">
                  Renews on {new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              {billing?.isTrialing && billing.trialEndsAt && (
                <p className="text-[12.5px] mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">
                  Trial ends {new Date(billing.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          {billing?.hasSubscription && (
            <button onClick={handlePortal} disabled={portalLoading}
              className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-60"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Manage Subscription
            </button>
          )}
        </div>

        {billing?.isTrialing && billing.trialDaysLeft <= 7 && (
          <div className="mt-5 flex items-start gap-3 rounded-[10px] border p-4"
            style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.25)' }}>
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#b89040' }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: '#8a6820' }}>
                Trial ends in {billing.trialDaysLeft} day{billing.trialDaysLeft !== 1 ? 's' : ''}
              </p>
              <p className="text-[12.5px] mt-0.5" style={{ color: '#a07830' }}>
                Upgrade now to keep access to all features after your trial.
              </p>
            </div>
          </div>
        )}

        {billing?.isPastDue && (
          <div className="mt-5 flex items-start gap-3 rounded-[10px] border p-4"
            style={{ background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.2)' }}>
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#c43c3c' }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: '#c43c3c' }}>Payment failed</p>
              <p className="text-[12.5px] mt-0.5" style={{ color: '#a84040' }}>
                Please update your payment method to avoid service interruption.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Test mode notice */}
      <div className="flex items-start gap-3 rounded-[10px] border p-4"
        style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)' }}>
        <CreditCard className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#183153' }} />
        <div>
          <p className="text-[13px] font-semibold" style={{ color: '#183153' }}>Test Mode Active</p>
          <p className="text-[12.5px] mt-0.5 text-[#475569] dark:text-[#9db4c4]">
            Use test card <strong>4242 4242 4242 4242</strong>, any future expiry, any 3-digit CVC. No real charges will be made.
          </p>
        </div>
      </div>

      {/* Plans */}
      <div>
        <h2 className="font-display text-[19px] font-semibold mb-1 text-[#183153] dark:text-[#f8fafc]">Choose Your Plan</h2>
        <p className="text-[13px] mb-6 text-[#64748b] dark:text-[#a9c1d0]">All plans include a 3-month free trial. Cancel anytime.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(billing?.planConfigs ?? [])
            .filter(p => p.key !== 'FREE')
            .map(plan => (
              <PlanCard key={plan.key} plan={plan}
                currentPlan={currentPlan} onSelect={handleUpgrade} onBkash={handleBkash} loading={loadingPlan}
                bkashEnabled={billing?.bkashEnabled} bkashPriceBdt={billing?.bkashPricesBdt?.[plan.key]} />
            ))}
        </div>
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
