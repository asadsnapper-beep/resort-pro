'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { billingApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Shield,
  Building2,
  ExternalLink,
  Receipt,
  Loader2,
  Star,
  ArrowRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type PlanKey = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

type PlanDef = {
  name: string;
  price: number;
  currency: string;
  features: string[];
  roomLimit: number;
};

type BillingStatus = {
  plan: string;
  planStatus: string;
  trialDaysLeft: number;
  isTrialing: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  availablePlans: Record<PlanKey, PlanDef>;
};

type Invoice = {
  id: string;
  number: string | null;
  amount: string;
  currency: string;
  status: string;
  date: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
};

// ── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status, trialDaysLeft }: { status: string; trialDaysLeft: number }) {
  if (status === 'trialing') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-200">
        <Clock className="w-3.5 h-3.5" />
        Trial — {trialDaysLeft} days left
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium border border-green-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Active
      </span>
    );
  }
  if (status === 'past_due') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-medium border border-red-200">
        <AlertTriangle className="w-3.5 h-3.5" />
        Past Due
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-medium border border-gray-200">
      {status}
    </span>
  );
}

// ── Plan Card ──────────────────────────────────────────────────────────────────
function PlanCard({
  planKey,
  plan,
  currentPlan,
  onSelect,
  loading,
}: {
  planKey: PlanKey;
  plan: PlanDef;
  currentPlan: string;
  onSelect: (key: PlanKey) => void;
  loading: string | null;
}) {
  const isCurrent = currentPlan.toUpperCase() === planKey;
  const isPro = planKey === 'PROFESSIONAL';
  const icons: Record<PlanKey, React.ReactNode> = {
    STARTER: <Zap className="w-5 h-5" />,
    PROFESSIONAL: <Star className="w-5 h-5" />,
    ENTERPRISE: <Shield className="w-5 h-5" />,
  };

  return (
    <div
      className={`relative rounded-2xl border-2 p-6 flex flex-col gap-4 transition-all ${
        isPro
          ? 'border-[#1a6b5e] shadow-lg shadow-[#1a6b5e]/10'
          : isCurrent
          ? 'border-[#d4a853] bg-amber-50/30'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#1a6b5e] text-white text-xs font-bold px-3 py-1 rounded-full">
            MOST POPULAR
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4">
          <span className="bg-[#d4a853] text-white text-xs font-bold px-3 py-1 rounded-full">
            CURRENT PLAN
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isPro ? 'bg-[#1a6b5e] text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {icons[planKey]}
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{plan.name}</h3>
          <p className="text-sm text-gray-500">
            {plan.roomLimit === -1 ? 'Unlimited rooms' : `Up to ${plan.roomLimit} rooms`}
          </p>
        </div>
      </div>

      <div>
        <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
        <span className="text-gray-500">/month</span>
      </div>

      <ul className="flex flex-col gap-2 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-[#1a6b5e] flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        onClick={() => onSelect(planKey)}
        disabled={isCurrent || loading !== null}
        className={`w-full ${
          isPro
            ? 'bg-[#1a6b5e] hover:bg-[#145a4f] text-white'
            : isCurrent
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white border-2 border-[#1a6b5e] text-[#1a6b5e] hover:bg-[#f0faf8]'
        }`}
      >
        {loading === planKey ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <ArrowRight className="w-4 h-4 mr-2" />
        )}
        {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
      </Button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    // Handle return from Stripe
    if (searchParams.get('success') === '1') {
      toast({ title: '🎉 Subscription activated!', description: 'Your plan has been upgraded successfully.' });
    }
    if (searchParams.get('canceled') === '1') {
      toast({ title: 'Checkout cancelled', description: 'No changes were made.', variant: 'destructive' });
    }
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
      const { url } = res.data.data;
      window.location.href = url;
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to start checkout';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await billingApi.createPortal();
      window.location.href = res.data.data.url;
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to open billing portal';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setPortalLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a6b5e]" />
      </div>
    );
  }

  const currentPlan = billing?.plan || 'FREE';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-500 mt-1">Manage your plan and payment details</p>
      </div>

      {/* Current Plan Status */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#f0faf8] flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#1a6b5e]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-900 capitalize">
                  {currentPlan.toLowerCase()} Plan
                </h2>
                {billing && (
                  <StatusBadge status={billing.planStatus} trialDaysLeft={billing.trialDaysLeft} />
                )}
              </div>
              {billing?.currentPeriodEnd && billing.isActive && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Renews on {new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              {billing?.isTrialing && billing.trialEndsAt && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Trial ends {new Date(billing.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {billing?.hasSubscription && (
            <Button
              onClick={handlePortal}
              disabled={portalLoading}
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          )}
        </div>

        {/* Trial warning */}
        {billing?.isTrialing && billing.trialDaysLeft <= 7 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Your trial ends in {billing.trialDaysLeft} day{billing.trialDaysLeft !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Upgrade now to keep access to all features after your trial.
              </p>
            </div>
          </div>
        )}

        {/* Past due warning */}
        {billing?.isPastDue && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Payment failed</p>
              <p className="text-sm text-red-700 mt-0.5">
                Please update your payment method to avoid service interruption.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Test Mode Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Test Mode Active</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Use test card <strong>4242 4242 4242 4242</strong>, any future expiry date, any 3-digit CVC.
            No real charges will be made.
          </p>
        </div>
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Your Plan</h2>
        <p className="text-gray-500 mb-6">All plans include a 3-month free trial. Cancel anytime.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {billing?.availablePlans &&
            (Object.entries(billing.availablePlans) as [PlanKey, PlanDef][]).map(([key, plan]) => (
              <PlanCard
                key={key}
                planKey={key}
                plan={plan}
                currentPlan={currentPlan}
                onSelect={handleUpgrade}
                loading={loadingPlan}
              />
            ))}
        </div>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Invoice History</h2>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Invoice</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-gray-700">{inv.number || inv.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {inv.currency} {inv.amount}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === 'paid'
                            ? 'bg-green-50 text-green-700'
                            : inv.status === 'open'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-[#1a6b5e] hover:underline"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          PDF
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

      {/* No invoices yet */}
      {invoices.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No invoices yet. They will appear here after your first payment.</p>
        </div>
      )}
    </div>
  );
}
