'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Sparkles } from 'lucide-react';
import { PLAN_PRICING } from '@resort-pro/types';

const PLANS = [
  {
    id: 'STARTER' as const,
    eyebrow: 'First 100 resorts',
    name: PLAN_PRICING.STARTER.displayName,
    title: 'A confident start for one hands-on property.',
    price: PLAN_PRICING.STARTER.monthlyUsd,
    annualPrice: PLAN_PRICING.STARTER.annualUsd,
    capacity: `1 property · up to ${PLAN_PRICING.STARTER.roomLimit} rooms · ${PLAN_PRICING.STARTER.staffLimit} staff`,
    badge: 'Founding Resort',
    featured: true,
    cta: 'Claim founding access',
    features: [
      'Bookings, check-in and check-out',
      'Guest CRM, payments and invoices',
      'Restaurant and room-service workflow',
      'Direct booking website and widgets',
      'Full operational toolkit for 12 months',
      'Email support from a real team',
    ],
  },
  {
    id: 'PROFESSIONAL' as const,
    eyebrow: 'For growing teams',
    name: PLAN_PRICING.PROFESSIONAL.displayName,
    title: 'More rooms, more people and deeper oversight.',
    price: PLAN_PRICING.PROFESSIONAL.monthlyUsd,
    annualPrice: PLAN_PRICING.PROFESSIONAL.annualUsd,
    capacity: `1 property · up to ${PLAN_PRICING.PROFESSIONAL.roomLimit} rooms · ${PLAN_PRICING.PROFESSIONAL.staffLimit} staff`,
    badge: null,
    featured: false,
    cta: 'Start with Growing',
    features: [
      'Everything in Small Resort',
      'Advanced reports and rate plans',
      'Loyalty, inventory and maintenance',
      'Group bookings and housekeeping',
      'Custom domain for direct bookings',
      'Priority support',
    ],
  },
  {
    id: 'ENTERPRISE' as const,
    eyebrow: 'For resort groups',
    name: PLAN_PRICING.ENTERPRISE.displayName,
    title: 'One operating view across your portfolio.',
    price: PLAN_PRICING.ENTERPRISE.monthlyUsd,
    annualPrice: PLAN_PRICING.ENTERPRISE.annualUsd,
    capacity: `Up to ${PLAN_PRICING.ENTERPRISE.propertyLimit} properties · ${PLAN_PRICING.ENTERPRISE.roomLimit} rooms · ${PLAN_PRICING.ENTERPRISE.staffLimit} staff`,
    badge: null,
    featured: false,
    cta: 'Start with Resort Group',
    features: [
      'Everything in Growing Resort',
      'Multi-property reporting',
      'Revenue intelligence dashboard',
      'Advanced AI allowance',
      'Onboarding assistance',
      'Priority support',
    ],
  },
];

const COMPARE_ROWS = [
  {
    label: 'Properties',
    starter: '1',
    pro: '1',
    group: `Up to ${PLAN_PRICING.ENTERPRISE.propertyLimit}`,
  },
  {
    label: 'Rooms',
    starter: `Up to ${PLAN_PRICING.STARTER.roomLimit}`,
    pro: `Up to ${PLAN_PRICING.PROFESSIONAL.roomLimit}`,
    group: `Up to ${PLAN_PRICING.ENTERPRISE.roomLimit}`,
  },
  {
    label: 'Staff accounts',
    starter: `${PLAN_PRICING.STARTER.staffLimit}`,
    pro: `${PLAN_PRICING.PROFESSIONAL.staffLimit}`,
    group: `${PLAN_PRICING.ENTERPRISE.staffLimit}`,
  },
  { label: 'Booking, guests and payments', starter: true, pro: true, group: true },
  { label: 'Restaurant and room service', starter: true, pro: true, group: true },
  { label: 'Direct booking website', starter: true, pro: true, group: true },
  { label: 'SMS and WhatsApp notifications', starter: true, pro: true, group: true },
  { label: 'Advanced analytics and reports', starter: false, pro: true, group: true },
  { label: 'Custom domain and loyalty', starter: false, pro: true, group: true },
  { label: 'Multi-property reporting', starter: false, pro: false, group: true },
  { label: 'Revenue intelligence', starter: false, pro: false, group: true },
];

function BrandMark() {
  return (
    <span className="relative block h-7 w-7 overflow-hidden bg-white">
      <Image
        src="/brand/resortpro-logo-concept-v2.png"
        alt="ResortPro"
        fill
        sizes="28px"
        className="translate-y-[5px] scale-[1.8] object-cover mix-blend-multiply"
      />
    </span>
  );
}

function Price({ plan, billing }: { plan: (typeof PLANS)[number]; billing: 'monthly' | 'annual' }) {
  const price = billing === 'annual' ? plan.annualPrice : plan.price;

  return (
    <div className="flex items-end gap-2">
      <span className="font-display text-5xl font-semibold tracking-[-0.06em] text-[#183153]">
        ${price}
      </span>
      <span className="mb-1.5 text-sm font-bold text-[#64748b]">
        {billing === 'annual' ? '/ year' : '/ month'}
      </span>
    </div>
  );
}

export default function PlansPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [showCompare, setShowCompare] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#183153]">
      <header className="border-b-2 border-[#183153] bg-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ResortPro home">
            <BrandMark />
            <span className="font-display text-xl font-semibold tracking-[-0.045em]">
              ResortPro
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm font-bold">
            <Link
              href="/auth/login"
              className="hidden text-[#475569] transition-colors hover:text-[#ef725c] sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/try"
              className="border-2 border-[#183153] bg-[#183153] px-4 py-2 text-white transition-colors hover:border-[#ef725c] hover:bg-[#ef725c]"
            >
              Try the demo
            </Link>
          </div>
        </div>
      </header>

      <section className="relative border-b-2 border-[#183153] bg-[#fff1ea]">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(#183153_1px,transparent_1px),linear-gradient(90deg,#183153_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_330px] lg:items-end lg:py-20">
          <div>
            <p className="font-bitcount mb-5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#b2402c]">
              Simple prices. Serious operations.
            </p>
            <h1 className="font-display max-w-3xl text-5xl font-semibold leading-[0.94] tracking-[-0.065em] text-[#183153] sm:text-6xl lg:text-7xl">
              Pick the plan that matches your next season.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#475569]">
              One workspace for bookings, guests, staff and direct revenue. Start small without
              buying a smaller version of your business.
            </p>
          </div>
          <aside className="border-2 border-[#183153] bg-white p-5 shadow-[8px_8px_0_#183153]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#ef725c] text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bitcount text-[10px] font-medium uppercase tracking-[0.14em] text-[#b2402c]">
                  Founding offer
                </p>
                <p className="mt-1 text-sm font-extrabold leading-5 text-[#183153]">
                  First 100 verified resorts get 3 months free.
                </p>
              </div>
            </div>
            <p className="mt-4 border-t border-[#d9e4ea] pt-4 text-xs leading-5 text-[#64748b]">
              Your $20 starting price and full operational toolkit are protected for your first 12
              months.
            </p>
          </aside>
        </div>
      </section>

      <section className="border-b-2 border-[#183153] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-bold text-[#475569]">
            No setup fee. No credit card to start. Cancel whenever your season changes.
          </p>
          <div className="flex w-fit border-2 border-[#183153] bg-white p-1 text-sm font-extrabold">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`px-4 py-2 transition-colors ${billing === 'monthly' ? 'bg-[#183153] text-white' : 'text-[#64748b] hover:text-[#183153]'}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              className={`px-4 py-2 transition-colors ${billing === 'annual' ? 'bg-[#183153] text-white' : 'text-[#64748b] hover:text-[#183153]'}`}
            >
              Annual <span className="ml-1 text-[#ef725c]">2 months free</span>
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid border-l-2 border-t-2 border-[#183153] lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex min-w-0 flex-col border-b-2 border-r-2 border-[#183153] p-6 sm:p-8 ${plan.featured ? 'bg-[#e5f0f7]' : plan.id === 'ENTERPRISE' ? 'bg-[#fff1ea]' : 'bg-white'}`}
            >
              {plan.badge && (
                <span className="font-bitcount absolute right-0 top-0 bg-[#ef725c] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.13em] text-white">
                  {plan.badge}
                </span>
              )}
              <p className="font-bitcount text-[10px] font-medium uppercase tracking-[0.15em] text-[#b2402c]">
                {plan.eyebrow}
              </p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.055em] text-[#183153]">
                {plan.name}
              </h2>
              <p className="mt-3 min-h-12 text-sm leading-6 text-[#475569]">{plan.title}</p>
              <div className="mt-7 border-y-2 border-[#183153] py-5">
                <Price plan={plan} billing={billing} />
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#64748b]">
                {plan.capacity}
              </p>
              <ul className="mt-7 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm leading-5 text-[#475569]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ef725c]" strokeWidth={3} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => router.push(`/auth/register?plan=${plan.id}`)}
                className={`mt-8 flex w-full items-center justify-center gap-2 border-2 border-[#183153] px-4 py-3.5 text-sm font-extrabold transition-colors ${plan.featured ? 'bg-[#183153] text-white hover:border-[#ef725c] hover:bg-[#ef725c]' : 'bg-white text-[#183153] hover:bg-[#183153] hover:text-white'}`}
              >
                {plan.cta}
                <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-sm leading-6 text-[#64748b]">
          Have more than {PLAN_PRICING.ENTERPRISE.propertyLimit} properties, need SSO, or want
          white-label support?{' '}
          <Link
            href="/contact"
            className="font-extrabold text-[#b2402c] underline decoration-2 underline-offset-4"
          >
            Talk to us
          </Link>
          .
        </p>
      </section>

      <section className="border-y-2 border-[#183153] bg-[#183153] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="font-bitcount text-[10px] font-medium uppercase tracking-[0.16em] text-[#f4c76b]">
              Built for the day-to-day
            </p>
            <h2 className="font-display mt-3 text-4xl font-semibold leading-none tracking-[-0.055em]">
              Your booking desk, front office and restaurant finally agree.
            </h2>
          </div>
          <div className="grid grid-cols-2 border-l border-white/25 sm:grid-cols-4">
            {[
              ['3 months', 'free for founding resorts'],
              ['1 place', 'for every guest detail'],
              ['0%', 'setup fee'],
              ['24/7', 'your operations stay visible'],
            ].map(([number, label]) => (
              <div
                key={number}
                className="border-b border-r border-t border-white/25 px-4 py-5 sm:border-t-0"
              >
                <p className="font-display text-3xl font-semibold tracking-[-0.05em] text-[#f4c76b]">
                  {number}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <button
          type="button"
          onClick={() => setShowCompare((value) => !value)}
          className="flex w-full items-center justify-between border-2 border-[#183153] bg-white px-5 py-5 text-left transition-colors hover:bg-[#e5f0f7]"
        >
          <span>
            <span className="font-bitcount block text-[10px] font-medium uppercase tracking-[0.15em] text-[#b2402c]">
              No hidden tiers
            </span>
            <span className="font-display mt-1 block text-2xl font-semibold tracking-[-0.045em]">
              Compare every plan in detail
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${showCompare ? 'rotate-180' : ''}`}
          />
        </button>
        {showCompare && (
          <div className="overflow-x-auto border-b-2 border-l-2 border-r-2 border-[#183153]">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-[#e5f0f7]">
                <tr>
                  <th className="font-bitcount border-r border-[#183153] px-5 py-4 text-[10px] font-medium uppercase tracking-[0.13em]">
                    Included
                  </th>
                  <th className="border-r border-[#183153] px-5 py-4 font-bold">Small Resort</th>
                  <th className="border-r border-[#183153] px-5 py-4 font-bold">Growing Resort</th>
                  <th className="px-5 py-4 font-bold">Resort Group</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-[#183153]">
                    <td className="border-r border-[#183153] px-5 py-4 font-bold text-[#475569]">
                      {row.label}
                    </td>
                    {(['starter', 'pro', 'group'] as const).map((tier) => (
                      <td
                        key={tier}
                        className="border-r border-[#183153] px-5 py-4 last:border-r-0"
                      >
                        {row[tier] === true ? (
                          <Check className="h-4 w-4 text-[#ef725c]" strokeWidth={3} />
                        ) : row[tier] === false ? (
                          <span className="text-[#94a3b8]">—</span>
                        ) : (
                          <span className="text-[#475569]">{row[tier]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="border-t-2 border-[#183153] bg-[#fff1ea]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#183153] hover:text-[#ef725c]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <p className="text-xs text-[#64748b]">
            Questions before you choose?{' '}
            <Link href="/try" className="font-bold text-[#b2402c] underline underline-offset-4">
              Explore a live role demo
            </Link>
            .
          </p>
        </div>
      </footer>
    </main>
  );
}
