'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Sparkles } from 'lucide-react';
import { PLAN_PRICING, PUBLIC_PLAN_ORDER } from '@resort-pro/types';

// Palette matches the landing page's design system
// (claude.ai/design/p/d56b55b0-882c-44d6-aecd-3667a5499d43 — "ResortPro Landing.dc.html").
// Keep these in sync with LandingPage.tsx if that source changes.
const NAVY = '#14314D';
const GOLD = '#CFA153';
const GOLD_HOVER = '#B98B3E';
const CREAM = '#F7F3EE';
const BORDER = '#EDE7DD';
const MUTED = '#5B6B79';
const MUTED_LIGHT = '#8B95A0';

const PLANS = [
  {
    id: 'FREE' as const,
    eyebrow: 'For small properties',
    name: PLAN_PRICING.FREE.displayName,
    title: 'Everything a smaller property needs, day one.',
    price: PLAN_PRICING.FREE.monthlyUsd,
    annualPrice: PLAN_PRICING.FREE.annualUsd,
    capacity: `1 property · up to ${PLAN_PRICING.FREE.roomLimit} rooms · ${PLAN_PRICING.FREE.staffLimit} staff`,
    badge: null,
    featured: false,
    cta: 'Start with Solo',
    features: [
      'Bookings, check-in and check-out',
      'Guest records, invoices and basic reports',
      'Direct booking website and widgets',
      'Full data export, always',
      'A clear upgrade path when you grow',
    ],
  },
  {
    id: 'PROFESSIONAL' as const,
    eyebrow: 'For resort groups',
    name: PLAN_PRICING.PROFESSIONAL.displayName,
    title: 'One operating view across every property you run.',
    price: PLAN_PRICING.PROFESSIONAL.monthlyUsd,
    annualPrice: PLAN_PRICING.PROFESSIONAL.annualUsd,
    capacity: `Up to ${PLAN_PRICING.PROFESSIONAL.propertyLimit} properties · ${PLAN_PRICING.PROFESSIONAL.roomLimit} rooms · ${PLAN_PRICING.PROFESSIONAL.staffLimit} staff`,
    badge: null,
    featured: false,
    cta: 'Start with Resort Group',
    features: [
      'Everything in Independent Resort',
      'Multi-property owner view',
      'OTA channel sync and corporate accounts',
      'Advanced reporting and AI chatbot',
      'Priority support',
    ],
  },
  {
    id: 'STARTER' as const,
    eyebrow: 'For independent resorts',
    name: PLAN_PRICING.STARTER.displayName,
    title: 'Everything you need to run one property, fully.',
    price: PLAN_PRICING.STARTER.monthlyUsd,
    annualPrice: PLAN_PRICING.STARTER.annualUsd,
    capacity: `1 property · up to ${PLAN_PRICING.STARTER.roomLimit} rooms · ${PLAN_PRICING.STARTER.staffLimit} staff`,
    badge: 'Most popular',
    featured: true,
    cta: 'Start with Independent',
    features: [
      'Everything in Solo',
      'Custom domain and online payments',
      'CRM, restaurant and housekeeping',
      'Inventory, maintenance and marketing',
      'Offers, loyalty, rates and group bookings',
      'AI content and PDF export',
    ],
  },
].sort((a, b) => PUBLIC_PLAN_ORDER.indexOf(a.id) - PUBLIC_PLAN_ORDER.indexOf(b.id));

const COMPARE_ROWS = [
  {
    label: 'Properties',
    starter: '1',
    pro: '1',
    group: `Up to ${PLAN_PRICING.PROFESSIONAL.propertyLimit}`,
  },
  {
    label: 'Rooms',
    starter: `Up to ${PLAN_PRICING.FREE.roomLimit}`,
    pro: `Up to ${PLAN_PRICING.STARTER.roomLimit}`,
    group: `Up to ${PLAN_PRICING.PROFESSIONAL.roomLimit}`,
  },
  {
    label: 'Staff accounts',
    starter: `${PLAN_PRICING.FREE.staffLimit}`,
    pro: `${PLAN_PRICING.STARTER.staffLimit}`,
    group: `${PLAN_PRICING.PROFESSIONAL.staffLimit}`,
  },
  { label: 'Booking, guests and payments', starter: true, pro: true, group: true },
  { label: 'Restaurant and room service', starter: false, pro: true, group: true },
  { label: 'Direct booking website', starter: true, pro: true, group: true },
  { label: 'Custom domain and loyalty', starter: false, pro: true, group: true },
  { label: 'Advanced analytics and reports', starter: false, pro: false, group: true },
  { label: 'Multi-property reporting', starter: false, pro: false, group: true },
];

function BrandMark() {
  return (
    <span
      className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-lg"
      style={{ background: NAVY }}
    >
      <Image
        src="/brand/resortpro-icon-mark.png"
        alt="ResortPro"
        fill
        sizes="36px"
        className="scale-125 object-cover mix-blend-screen"
      />
    </span>
  );
}

function Price({ plan, billing }: { plan: (typeof PLANS)[number]; billing: 'monthly' | 'annual' }) {
  const price = billing === 'annual' ? plan.annualPrice : plan.price;

  return (
    <div className="flex items-end gap-2">
      <span className="font-bitcount text-5xl font-normal" style={{ color: NAVY }}>
        ${price}
      </span>
      <span className="mb-1.5 text-sm font-bold" style={{ color: MUTED }}>
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
    <main className="min-h-screen overflow-hidden bg-white font-sans" style={{ color: NAVY }}>
      <header className="border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ResortPro home">
            <BrandMark />
            <span className="text-lg font-extrabold">ResortPro</span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-bold">
            <Link
              href="/auth/login"
              className="hidden transition-colors hover:opacity-70 sm:block"
              style={{ color: MUTED }}
            >
              Sign in
            </Link>
            <Link
              href="/try"
              className="rounded-lg px-5 py-2.5 text-white transition-colors"
              style={{ background: GOLD }}
              onMouseEnter={(e) => { e.currentTarget.style.background = GOLD_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = GOLD; }}
            >
              Try the demo
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b" style={{ background: CREAM, borderColor: BORDER }}>
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_330px] lg:items-end lg:py-20">
          <div>
            <span
              className="font-bitcount mb-5 block text-[13px] font-medium uppercase tracking-[0.14em]"
              style={{ color: GOLD }}
            >
              Simple prices. Serious operations.
            </span>
            <h1 className="max-w-3xl text-[clamp(2.6rem,5.5vw,4rem)] font-extrabold leading-[1.1]">
              Pick the plan that matches your next season.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: MUTED }}>
              One workspace for bookings, guests, staff and direct revenue. Start small without
              buying a smaller version of your business.
            </p>
          </div>
          <aside className="rounded-2xl bg-white p-6">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ background: GOLD }}
              >
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <span
                  className="font-bitcount block text-[11px] font-medium uppercase tracking-[0.12em]"
                  style={{ color: GOLD }}
                >
                  Fair, predictable pricing
                </span>
                <p className="mt-1 text-sm font-extrabold leading-5">
                  Choose the capacity and tools that match your operation today.
                </p>
              </div>
            </div>
            <p className="mt-4 border-t pt-4 text-xs leading-5" style={{ borderColor: BORDER, color: MUTED }}>
              Your selected price is protected for your first 12 months.
            </p>
          </aside>
        </div>
      </section>

      <section className="border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-bold" style={{ color: MUTED }}>
            No setup fee. Cancel whenever your season changes. Your data stays yours.
          </p>
          <div className="flex w-fit rounded-lg border p-1 text-sm font-extrabold" style={{ borderColor: BORDER }}>
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className="rounded-md px-4 py-2 transition-colors"
              style={billing === 'monthly' ? { background: NAVY, color: '#fff' } : { color: MUTED }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              className="rounded-md px-4 py-2 transition-colors"
              style={billing === 'annual' ? { background: NAVY, color: '#fff' } : { color: MUTED }}
            >
              Annual <span className="ml-1" style={{ color: billing === 'annual' ? GOLD : GOLD }}>2 months free</span>
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className="relative flex min-w-0 flex-col rounded-2xl border p-6 sm:p-8"
              style={
                plan.featured
                  ? { background: NAVY, borderColor: NAVY, color: '#fff' }
                  : { background: plan.id === 'PROFESSIONAL' ? CREAM : '#fff', borderColor: BORDER }
              }
            >
              {plan.badge && (
                <span
                  className="font-bitcount absolute right-6 top-6 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white"
                  style={{ background: GOLD }}
                >
                  {plan.badge}
                </span>
              )}
              <span
                className="font-bitcount text-[11px] font-medium uppercase tracking-[0.12em]"
                style={{ color: GOLD }}
              >
                {plan.eyebrow}
              </span>
              <h2 className="mt-3 text-3xl font-extrabold">{plan.name}</h2>
              <p className="mt-3 min-h-12 text-sm leading-6" style={{ color: plan.featured ? 'rgba(255,255,255,0.75)' : MUTED }}>
                {plan.title}
              </p>
              <div className="mt-7 border-y py-5" style={{ borderColor: plan.featured ? 'rgba(255,255,255,0.2)' : BORDER }}>
                {plan.featured ? (
                  <div className="flex items-end gap-2">
                    <span className="font-bitcount text-5xl font-normal text-white">
                      ${billing === 'annual' ? plan.annualPrice : plan.price}
                    </span>
                    <span className="mb-1.5 text-sm font-bold text-white/70">
                      {billing === 'annual' ? '/ year' : '/ month'}
                    </span>
                  </div>
                ) : (
                  <Price plan={plan} billing={billing} />
                )}
              </div>
              <p
                className="mt-4 text-xs font-bold uppercase tracking-[0.06em]"
                style={{ color: plan.featured ? 'rgba(255,255,255,0.6)' : MUTED_LIGHT }}
              >
                {plan.capacity}
              </p>
              <ul className="mt-7 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex gap-2.5 text-sm leading-5"
                    style={{ color: plan.featured ? 'rgba(255,255,255,0.85)' : MUTED }}
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} style={{ color: GOLD }} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => router.push(`/auth/register?plan=${plan.id}`)}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-sm font-extrabold transition-colors"
                style={plan.featured ? { background: GOLD, color: '#fff' } : { border: `1px solid ${BORDER}`, color: NAVY }}
                onMouseEnter={(e) => {
                  if (plan.featured) e.currentTarget.style.background = GOLD_HOVER;
                  else e.currentTarget.style.borderColor = GOLD;
                }}
                onMouseLeave={(e) => {
                  if (plan.featured) e.currentTarget.style.background = GOLD;
                  else e.currentTarget.style.borderColor = BORDER;
                }}
              >
                {plan.cta}
                <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-sm leading-6" style={{ color: MUTED }}>
          Have more than {PLAN_PRICING.PROFESSIONAL.propertyLimit} properties, need SSO, or want
          white-label support?{' '}
          <Link href="/contact" className="font-extrabold underline decoration-2 underline-offset-4" style={{ color: GOLD }}>
            Talk to us
          </Link>
          .
        </p>
      </section>

      <section className="text-white" style={{ background: NAVY }}>
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <span className="font-bitcount block text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: GOLD }}>
              Built for the day-to-day
            </span>
            <h2 className="mt-3 text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-[1.2]">
              Your booking desk, front office and restaurant finally agree.
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              ['$10', 'a month to start with Solo'],
              ['1 place', 'for every guest detail'],
              ['0%', 'setup fee'],
              ['24/7', 'your operations stay visible'],
            ].map(([number, label]) => (
              <div key={number} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p className="font-bitcount text-3xl font-normal" style={{ color: GOLD }}>{number}</p>
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
          className="flex w-full items-center justify-between rounded-2xl border bg-white px-6 py-6 text-left transition-colors"
          style={{ borderColor: BORDER }}
        >
          <span>
            <span className="font-bitcount block text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: GOLD }}>
              No hidden tiers
            </span>
            <span className="mt-1 block text-2xl font-extrabold">Compare every plan in detail</span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${showCompare ? 'rotate-180' : ''}`} />
        </button>
        {showCompare && (
          <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: BORDER }}>
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead style={{ background: CREAM }}>
                <tr>
                  <th className="font-bitcount px-5 py-4 text-[10px] font-medium uppercase tracking-[0.1em]">Included</th>
                  <th className="px-5 py-4 font-bold">Solo</th>
                  <th className="px-5 py-4 font-bold">Independent Resort</th>
                  <th className="px-5 py-4 font-bold">Resort Group</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} className="border-t" style={{ borderColor: BORDER }}>
                    <td className="px-5 py-4 font-bold" style={{ color: MUTED }}>{row.label}</td>
                    {(['starter', 'pro', 'group'] as const).map((tier) => (
                      <td key={tier} className="px-5 py-4">
                        {row[tier] === true ? (
                          <Check className="h-4 w-4" strokeWidth={3} style={{ color: GOLD }} />
                        ) : row[tier] === false ? (
                          <span style={{ color: MUTED_LIGHT }}>—</span>
                        ) : (
                          <span style={{ color: MUTED }}>{row[tier]}</span>
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

      <footer className="border-t" style={{ background: CREAM, borderColor: BORDER }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold transition-colors hover:opacity-70">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <p className="text-xs" style={{ color: MUTED }}>
            Questions before you choose?{' '}
            <Link href="/try" className="font-bold underline underline-offset-4" style={{ color: GOLD }}>
              Explore a live role demo
            </Link>
            .
          </p>
        </div>
      </footer>
    </main>
  );
}
