'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft, Zap, Building2, Crown, Sparkles } from 'lucide-react';

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    icon: Zap,
    price: 49,
    currency: '$',
    period: 'per month',
    rooms: 'Up to 20 rooms',
    users: '3 staff accounts',
    trial: '14-day free trial',
    highlight: false,
    badge: null,
    cta: 'Start free trial',
    color: '#1a6b5e',
    features: [
      'Room & booking management',
      'Online check-in / check-out',
      'bKash & Stripe payments',
      'Guest CRM & history',
      'Restaurant & room service',
      'Public website (3 themes)',
      'Embed booking widgets',
      'SMS & WhatsApp notifications',
      'Basic analytics & reports',
      '24/7 email support',
    ],
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    icon: Crown,
    price: 99,
    currency: '$',
    period: 'per month',
    rooms: 'Up to 100 rooms',
    users: '10 staff accounts',
    trial: '14-day free trial',
    highlight: true,
    badge: 'Most Popular',
    cta: 'Start free trial',
    color: '#d4a853',
    features: [
      'Everything in Starter',
      'Advanced analytics & reports',
      'Rate plans & channel sync',
      'Loyalty program',
      'Custom domain (yourresort.com)',
      'Inventory management',
      'Maintenance tracking',
      'Group bookings',
      'Housekeeping module',
      'Priority support',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    icon: Building2,
    price: null,
    currency: '',
    period: 'custom pricing',
    rooms: 'Unlimited rooms',
    users: 'Unlimited users',
    trial: null,
    highlight: false,
    badge: null,
    cta: 'Contact sales',
    color: '#6366f1',
    features: [
      'Everything in Professional',
      'White-label branding',
      'SSO & SAML authentication',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom integrations',
      'On-premise deployment option',
      'Training & onboarding',
      'Quarterly business reviews',
      'Custom contract & billing',
    ],
  },
];

const COMPARE_ROWS = [
  { label: 'Rooms',                  starter: 'Up to 20',     pro: 'Up to 100',     ent: 'Unlimited'  },
  { label: 'Staff accounts',         starter: '3',            pro: '10',            ent: 'Unlimited'  },
  { label: 'Booking management',     starter: true,           pro: true,            ent: true         },
  { label: 'Online payments',        starter: true,           pro: true,            ent: true         },
  { label: 'Guest CRM',              starter: true,           pro: true,            ent: true         },
  { label: 'Restaurant module',      starter: true,           pro: true,            ent: true         },
  { label: 'SMS & WhatsApp',         starter: true,           pro: true,            ent: true         },
  { label: 'Public website',         starter: '3 themes',     pro: '3 themes',      ent: 'Custom'     },
  { label: 'Advanced analytics',     starter: false,          pro: true,            ent: true         },
  { label: 'Custom domain',          starter: false,          pro: true,            ent: true         },
  { label: 'Loyalty program',        starter: false,          pro: true,            ent: true         },
  { label: 'White-label branding',   starter: false,          pro: false,           ent: true         },
  { label: 'SSO / SAML',            starter: false,          pro: false,           ent: true         },
  { label: 'Dedicated support',      starter: false,          pro: false,           ent: true         },
];

export default function PlansPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [showCompare, setShowCompare] = useState(false);

  const discount = billing === 'annual' ? 0.8 : 1;

  function handleSelect(plan: typeof PLANS[number]) {
    if (plan.id === 'ENTERPRISE') {
      router.push('/contact');
    } else {
      router.push(`/auth/register?plan=${plan.id}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-resort-700 flex items-center justify-center text-white font-bold text-sm">R</div>
            <span className="font-bold text-gray-900 text-lg">ResortPro</span>
          </Link>
          <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Already have an account? <span className="font-semibold text-resort-700">Sign in</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-16">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-resort-50 border border-resort-200 text-resort-700 text-sm font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            14-day free trial on all paid plans · No credit card required
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">Choose your plan</h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Start free, scale as you grow. Every plan includes full access during the trial.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'annual'
                  ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              Annual
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Save 20%</span>
            </button>
          </div>
        </div>

        {/* ── Plan Cards ──────────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const monthlyPrice = plan.price ? Math.round(plan.price * discount) : null;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl flex flex-col transition-all duration-200 ${
                  plan.highlight
                    ? 'bg-resort-900 text-white shadow-2xl scale-105 ring-2 ring-gold-400'
                    : 'bg-white text-gray-900 shadow-sm border border-gray-200 hover:shadow-md'
                }`}>

                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full text-xs font-bold bg-gold-500 text-resort-900 shadow-lg">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="p-8 flex flex-col flex-1">

                  {/* Plan name & icon */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      plan.highlight ? 'bg-white/10' : 'bg-gray-100'
                    }`}>
                      <Icon className="h-5 w-5" style={{ color: plan.highlight ? '#d4a853' : plan.color }} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                        {plan.name}
                      </h3>
                      <p className={`text-xs ${plan.highlight ? 'text-white/50' : 'text-gray-400'}`}>
                        {plan.rooms} · {plan.users}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {monthlyPrice ? (
                      <div className="flex items-end gap-1">
                        <span className={`text-4xl font-bold tracking-tight ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                          {plan.currency}{monthlyPrice}
                        </span>
                        <span className={`text-sm pb-1.5 ${plan.highlight ? 'text-white/60' : 'text-gray-400'}`}>
                          /mo{billing === 'annual' ? ' · billed annually' : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="text-3xl font-bold text-gray-900">Custom</div>
                    )}
                    {plan.trial && (
                      <p className={`text-xs mt-1.5 font-medium ${
                        plan.highlight ? 'text-gold-400' : 'text-resort-600'
                      }`}>
                        ✦ {plan.trial} — no credit card required
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          plan.highlight ? 'text-gold-400' : 'text-resort-600'
                        }`} />
                        <span className={`text-sm ${plan.highlight ? 'text-white/80' : 'text-gray-600'}`}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelect(plan)}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      plan.highlight
                        ? 'bg-gold-500 text-resort-900 hover:bg-gold-400 shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                        : plan.id === 'ENTERPRISE'
                          ? 'bg-gray-900 text-white hover:bg-gray-800'
                          : 'bg-resort-700 text-white hover:bg-resort-600'
                    }`}>
                    {plan.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Compare table toggle ─────────────────────────────────── */}
        <div className="text-center mb-6">
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="text-sm font-medium text-resort-700 hover:text-resort-900 underline underline-offset-4 transition-colors">
            {showCompare ? 'Hide' : 'Show'} full comparison table
          </button>
        </div>

        {showCompare && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-16">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left p-5 font-semibold text-gray-900 w-2/5">Features</th>
                  <th className="p-5 text-center font-semibold text-gray-700">Starter</th>
                  <th className="p-5 text-center font-semibold text-white bg-resort-800">Professional</th>
                  <th className="p-5 text-center font-semibold text-gray-700">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}>
                    <td className="p-4 pl-5 text-gray-700 font-medium">{row.label}</td>
                    {(['starter', 'pro', 'ent'] as const).map((col, ci) => {
                      const val = row[col];
                      return (
                        <td key={col} className={`p-4 text-center ${ci === 1 ? 'bg-resort-50' : ''}`}>
                          {val === true ? (
                            <Check className="h-4 w-4 text-resort-600 mx-auto" />
                          ) : val === false ? (
                            <span className="text-gray-300 text-lg">—</span>
                          ) : (
                            <span className="text-gray-700 text-xs font-medium">{val as string}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Trust badges ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-400 py-8 border-t border-gray-200">
          <span>✓ Cancel anytime</span>
          <span>✓ No setup fees</span>
          <span>✓ Data export included</span>
          <span>✓ GDPR compliant</span>
          <span>✓ 99.9% uptime SLA</span>
        </div>

        {/* ── Back link ─────────────────────────────────────────────── */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
