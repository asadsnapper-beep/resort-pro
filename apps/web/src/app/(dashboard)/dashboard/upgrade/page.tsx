'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { billingApi } from '@/lib/api';
import { PLAN_PRICING } from '@resort-pro/types';
import {
  CheckCircle2, Zap, Building2, ArrowRight,
  Loader2, Shield, Users, BarChart3, Headphones, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Prices/limits come from @resort-pro/types — see
// plan/launch-pricing-and-trial-abuse-prevention.md.
const PLANS = [
  {
    key: 'FREE',
    name: PLAN_PRICING.FREE.displayName,
    price: PLAN_PRICING.FREE.monthlyUsd,
    icon: Zap,
    color: 'from-slate-500 to-slate-700',
    borderColor: 'border-slate-400/30',
    bgColor: 'bg-slate-500/5',
    badgeColor: 'bg-slate-100 text-slate-700',
    features: [
      `Up to ${PLAN_PRICING.FREE.roomLimit} rooms`,
      'Bookings, guests and invoices',
      'Direct booking page',
      'Full data export',
    ],
  },
  {
    key: 'STARTER',
    name: PLAN_PRICING.STARTER.displayName,
    price: PLAN_PRICING.STARTER.monthlyUsd,
    icon: Zap,
    color: 'from-emerald-500 to-teal-600',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/5',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    features: [
      `Up to ${PLAN_PRICING.STARTER.roomLimit} rooms`,
      'Full booking management',
      'Guest CRM & profiles',
      'Website builder',
      'Email notifications',
      'Email support',
    ],
  },
  {
    key: 'PROFESSIONAL',
    name: PLAN_PRICING.PROFESSIONAL.displayName,
    price: PLAN_PRICING.PROFESSIONAL.monthlyUsd,
    icon: Building2,
    color: 'from-blue-500 to-indigo-600',
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/5',
    badgeColor: 'bg-blue-100 text-blue-700',
    popular: true,
    features: [
      `Up to ${PLAN_PRICING.PROFESSIONAL.roomLimit} rooms`,
      'Everything in Starter',
      'Staff invites & roles',
      'Advanced analytics',
      'Priority support',
      'Custom domain',
    ],
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const { tenant } = useAuthStore();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const trialEnded = tenant?.planStatus === 'trialing';
  const isCanceled = tenant?.planStatus === 'canceled';
  const isPastDue = tenant?.planStatus === 'past_due';
  const availablePlans = PLANS.filter((plan) => plan.key !== tenant?.plan);

  const handleChoosePlan = async (planKey: string) => {
    setLoadingPlan(planKey);
    try {
      const res = await billingApi.createCheckout(planKey);
      const { url } = res.data.data;
      window.location.href = url;
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to start checkout');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="mx-auto max-w-5xl px-6 py-16">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium mb-6 dark:bg-amber-900/20 dark:border-amber-700/30 dark:text-amber-400">
            <Star className="w-3.5 h-3.5 fill-current" />
            {trialEnded ? 'Your trial has ended' : isCanceled ? 'Subscription canceled' : 'Payment required'}
          </div>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {trialEnded
              ? 'Ready to keep growing?'
              : 'Reactivate your account'}
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            {trialEnded
              ? 'Your free trial has ended. Choose a plan to continue managing your resort and keep all your data.'
              : isPastDue
              ? 'Your payment failed. Update your billing to restore access.'
              : 'Choose a plan that fits your resort and get back to managing bookings.'}
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
          {[
            { icon: Shield, text: '30-day money-back' },
            { icon: Headphones, text: 'Cancel anytime' },
            { icon: Users, text: 'Built for resorts in Bangladesh' },
            { icon: BarChart3, text: 'All data preserved' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Icon className="w-4 h-4 text-emerald-500" />
              {text}
            </div>
          ))}
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {availablePlans.map((plan) => {
            const Icon = plan.icon;
            const isLoading = loadingPlan === plan.key;
            return (
              <div
                key={plan.key}
                className={cn(
                  'relative rounded-2xl border-2 p-6 flex flex-col transition-all',
                  plan.bgColor,
                  plan.borderColor,
                  plan.popular && 'ring-2 ring-blue-500/20 scale-[1.02]',
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-full shadow-sm">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br mb-4',
                    plan.color
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white">${plan.price}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">/month</span>
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleChoosePlan(plan.key)}
                  disabled={!!loadingPlan}
                  className={cn(
                    'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
                    loadingPlan && loadingPlan !== plan.key && 'opacity-50',
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Choose {plan.name}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ / Help */}
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Questions?{' '}
            <a href="mailto:support@resortpro.site" className="text-emerald-600 hover:underline font-medium">
              Contact our team
            </a>
            {' '}— we respond within 24 hours.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
            All plans include 30-day money-back guarantee. Cancel anytime with no questions asked.
          </p>
        </div>
      </div>
    </div>
  );
}
