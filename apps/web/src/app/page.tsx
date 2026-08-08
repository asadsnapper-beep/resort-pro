'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Menu, X } from 'lucide-react';
import { PLAN_PRICING, PUBLIC_PLAN_ORDER } from '@resort-pro/types';

const navLinks = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Desktop app', href: '#desktop-app' },
];

const faqs = [
  [
    'Can I start without a card?',
    'Yes. Create your resort workspace, choose a plan, and explore the full operational toolkit before your first payment.',
  ],
  [
    'Does ResortPro work for restaurants too?',
    'Yes. Restaurant and room-service orders sit beside bookings and guest folios, so the day stays connected.',
  ],
  [
    'Can guests book directly from my own website?',
    'Yes. Publish a direct booking link or embed the live booking flow on your existing site.',
  ],
  [
    'What if I manage more than five properties?',
    'Talk to our team. We will create a group plan with the onboarding, limits, and support your operation needs.',
  ],
];

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`relative block h-7 w-7 overflow-hidden ${inverse ? 'bg-white' : 'bg-[#fff]'}`}
    >
      <Image
        src="/brand/resortpro-logo-concept-v2.png"
        alt="ResortPro"
        fill
        sizes="28px"
        className={`translate-y-[5px] scale-[1.8] object-cover ${inverse ? '' : 'mix-blend-multiply'}`}
      />
    </span>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`font-bitcount m-0 text-[11px] font-medium uppercase tracking-[0.18em] ${
        light ? 'text-[#f4c76b]' : 'text-[#b2402c]'
      }`}
    >
      {children}
    </p>
  );
}

function AvailabilityBoard() {
  const rooms = [
    ['Garden 01', 'navy', 'navy', 'open', 'coral', 'coral', 'open'],
    ['Garden 02', 'open', 'gold', 'gold', 'navy', 'navy', 'navy'],
    ['Ocean 04', 'navy', 'navy', 'navy', 'open', 'coral', 'coral'],
    ['Ocean 05', 'open', 'open', 'navy', 'navy', 'open', 'gold'],
    ['Suite 01', 'coral', 'coral', 'coral', 'navy', 'navy', 'open'],
  ];
  const cellTone: Record<string, string> = {
    navy: 'bg-[#183153]',
    coral: 'bg-[#ef725c]',
    gold: 'bg-[#f4c76b]',
    open: 'bg-[#e5f0f7]',
  };

  return (
    <div className="min-w-0 border-2 border-[#183153] bg-white">
      <div className="flex items-center justify-between border-b-2 border-[#183153] px-4 py-4 sm:px-5">
        <div>
          <p className="m-0 text-sm font-extrabold text-[#183153]">Palm House</p>
          <p className="mt-1 text-xs text-[#64748b]">Thursday, 14 August</p>
        </div>
        <span className="font-bitcount bg-[#ef725c] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white">
          Friday arrivals
        </span>
      </div>
      <div className="overflow-x-auto px-3 py-5 sm:px-5">
        <div className="min-w-[500px]">
          <div className="grid grid-cols-[90px_repeat(6,minmax(44px,1fr))] gap-1.5 text-[10px] text-[#64748b]">
            <span />
            {['14', '15', '16', '17', '18', '19'].map((day) => (
              <span key={day} className="text-center">
                {day}
              </span>
            ))}
            {rooms.map(([room, ...days]) => (
              <div key={room} className="contents">
                <span className="flex items-center font-bold uppercase tracking-[0.04em] text-[#475569]">
                  {room}
                </span>
                {days.map((day, index) => (
                  <span key={`${room}-${index}`} className={`h-6 ${cellTone[day]}`} />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b]">
            {[
              ['Staying', 'bg-[#183153]'],
              ['Arriving', 'bg-[#ef725c]'],
              ['Held', 'bg-[#f4c76b]'],
              ['Open', 'bg-[#e5f0f7]'],
            ].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5">
                <i className={`block h-2.5 w-2.5 ${color}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 border-t-2 border-[#183153]">
        {[
          ['87%', 'Rooms filled', 'text-[#183153]'],
          ['৳13.5k', 'Taken today', 'text-[#183153]'],
          ['14', 'Arrivals', 'text-[#ef725c]'],
        ].map(([value, label, tone], index) => (
          <div
            key={label}
            className={`p-4 sm:p-5 ${index < 2 ? 'border-r-2 border-[#183153]' : ''}`}
          >
            <p className={`font-bitcount m-0 text-2xl ${tone}`}>{value}</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t-2 border-[#183153] bg-[#fff1ea] px-4 py-3 text-xs text-[#64748b] sm:px-5">
        <span className="mr-2 inline-block h-2.5 w-2.5 bg-[#ef725c] align-middle" />
        <strong className="text-[#183153]">Booking received ৳13,500</strong> · just now
      </div>
    </div>
  );
}

function FeatureCard({
  number,
  title,
  children,
  tone,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  tone?: 'peach' | 'blue';
}) {
  return (
    <article
      className={`border-b-2 border-r-2 border-[#183153] p-6 sm:p-8 ${tone === 'peach' ? 'bg-[#fff1ea]' : tone === 'blue' ? 'bg-[#e5f0f7]' : 'bg-white'}`}
    >
      <p className="font-bitcount m-0 text-xs text-[#b2402c]">{number}</p>
      <h3 className="mt-7 text-xl font-extrabold tracking-[-0.03em] text-[#183153]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#64748b]">{children}</p>
    </article>
  );
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const planCards = [
    {
      key: 'FREE' as const,
      label: 'Solo',
      title: 'Everything a small property needs, day one.',
      description: 'Bookings, calendar, front desk, guest history, invoices, and a direct booking page.',
      features: [
        '1 property · 5 rooms · 2 staff',
        'Bookings, guests & invoices',
        'Full data export, always',
      ],
    },
    {
      key: 'STARTER' as const,
      label: 'Independent Resort',
      title: 'Everything you need to run one property, fully.',
      description: 'Your own domain, CRM, restaurant, and every operational module.',
      features: [
        '1 property · 20 rooms · 20 staff',
        'Custom domain & online payments',
        'CRM, restaurant, housekeeping & more',
      ],
      featured: true,
    },
    {
      key: 'PROFESSIONAL' as const,
      label: 'Resort Group',
      title: 'One view across every property you run.',
      description: 'For owners managing more than one property.',
      features: [
        'Up to 5 properties · 200 rooms',
        'Multi-property owner view',
        'Priority onboarding & support',
      ],
    },
  ].sort((a, b) => PUBLIC_PLAN_ORDER.indexOf(a.key) - PUBLIC_PLAN_ORDER.indexOf(b.key));

  return (
    <main id="top" className="min-h-screen overflow-x-hidden bg-white font-sans text-[#183153]">
      <header className="border-b-2 border-[#183153] bg-white">
        <nav className="mx-auto flex min-h-[74px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ResortPro home">
            <BrandMark />
            <span className="text-lg font-extrabold tracking-[-0.04em]">ResortPro</span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-semibold hover:text-[#ef725c]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-6 lg:flex">
            <Link
              href="/bn"
              onClick={() => {
                document.cookie = 'locale=bn; path=/; max-age=31536000; SameSite=Lax';
              }}
              className="flex items-center gap-1.5 rounded-lg border border-[#183153]/20 px-3 py-1.5 text-xs font-bold text-[#183153] transition-all hover:bg-[#183153]/5"
              title="Switch to বাংলা"
            >
              <span className="text-sm">🇧🇩</span>
              <span>বাংলা</span>
            </Link>
            <Link href="/auth/login" className="text-sm font-bold">
              Log in
            </Link>
            <Link
              href="/plans"
              className="bg-[#183153] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#ef725c]"
            >
              See plans
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="border-2 border-[#183153] p-2 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t-2 border-[#183153] bg-white px-5 py-5 lg:hidden">
            <div className="mx-auto flex max-w-[1240px] flex-col gap-4 sm:px-3">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="font-bold"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex items-center gap-3">
                <Link
                  href="/bn"
                  onClick={() => {
                    document.cookie = 'locale=bn; path=/; max-age=31536000; SameSite=Lax';
                  }}
                  className="flex items-center gap-1.5 border-2 border-[#183153] px-3 py-2 text-xs font-bold"
                >
                  <span>🇧🇩</span>
                  <span>বাংলা</span>
                </Link>
                <Link
                  href="/auth/login"
                  className="border-2 border-[#183153] px-4 py-2.5 text-sm font-bold"
                >
                  Log in
                </Link>
                <Link
                  href="/plans"
                  className="bg-[#183153] px-4 py-2.5 text-sm font-bold text-white"
                >
                  See plans
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="mx-auto grid min-w-0 max-w-[1240px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-20 lg:py-20">
        <div className="min-w-0">
          <Eyebrow>Built for modern resort teams</Eyebrow>
          <h1 className="mt-8 max-w-[620px] text-[clamp(3.5rem,6.5vw,6.7rem)] font-extrabold leading-[.94] tracking-[-0.07em] text-[#183153]">
            Let your resort feel effortless.
          </h1>
          <p className="mt-8 max-w-[540px] text-[17px] leading-8 text-[#64748b] sm:text-[19px]">
            One beautifully simple place for every arrival, payment, room, and guest
            relationship—built around how your team actually works.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 bg-[#183153] px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-[#ef725c]"
            >
              Build your workspace <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/try"
              className="inline-flex items-center gap-2 border-2 border-[#183153] px-6 py-4 text-sm font-bold transition-colors hover:bg-[#fff1ea]"
            >
              Explore the live demo <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[12px] font-semibold text-[#64748b]">
          {['bKash & cards built in', 'Cancel anytime', 'Setup in an afternoon'].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <i className="h-2 w-2 bg-[#ef725c]" /> {item}
              </span>
            ))}
          </div>
        </div>
        <AvailabilityBoard />
      </section>

      <section className="border-y-2 border-[#183153] bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-5 py-7 sm:px-8">
          <p className="max-w-[390px] text-sm leading-6 text-[#64748b]">
            For the owners who want a front desk that feels personal, not paperwork.
          </p>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-extrabold uppercase tracking-[0.04em] text-[#183153] sm:gap-x-10">
            <span>bKash</span>
            <span>SSLCommerz</span>
            <span>Stripe</span>
            <span>Bank transfer</span>
          </div>
        </div>
      </section>

      <section
        id="product"
        className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-20 lg:py-32"
      >
        <div>
          <Eyebrow>One live picture of the day</Eyebrow>
          <h2 className="mt-7 max-w-[470px] text-[clamp(2.9rem,4.5vw,5rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
            Every guest moment, held together.
          </h2>
          <p className="mt-7 max-w-[430px] text-[17px] leading-8 text-[#64748b]">
            ResortPro is not another dashboard to babysit. It gives the people at your desk,
            restaurant, and back office the same live picture.
          </p>
        </div>
        <div className="grid border-l-2 border-t-2 border-[#183153] sm:grid-cols-2">
          <FeatureCard number="01" title="The morning view">
            Arrivals, departures, and the rooms that need attention—before the first guest reaches
            the desk.
          </FeatureCard>
          <FeatureCard number="02" title="The payment moment" tone="peach">
            Deposits, balances, and invoices stay tied to the booking instead of disappearing into
            chat screenshots.
          </FeatureCard>
          <FeatureCard number="03" title="The guest relationship" tone="blue">
            A complete stay history makes every return guest feel remembered, not searched for.
          </FeatureCard>
          <FeatureCard number="04" title="The room turnover">
            Housekeeping sees exactly what changed, what is ready, and what needs a closer look.
          </FeatureCard>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#183153] text-white">
        <div className="mx-auto grid max-w-[1240px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 lg:py-32">
          <div>
            <Eyebrow light>From first click to first booking</Eyebrow>
            <h2 className="mt-8 max-w-[440px] text-[clamp(3rem,5vw,5.4rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
              Go live without changing who you are.
            </h2>
          </div>
          <div className="border-t border-white/40">
            {[
              [
                '01',
                'Make it yours',
                'Add your rooms, rates, team, and the details guests actually care about.',
              ],
              [
                '02',
                'Open the direct door',
                'Publish your booking link or place it inside your own website in minutes.',
              ],
              [
                '03',
                'Run the day together',
                'Every booking, payment, order, and room status stays live for the people who need it.',
              ],
            ].map(([number, title, copy]) => (
              <div
                key={number}
                className="grid gap-3 border-b border-white/40 py-7 sm:grid-cols-[70px_1fr_.9fr] sm:gap-5"
              >
                <span className="font-bitcount text-xl text-[#ef725c]">{number}</span>
                <h3 className="text-xl font-extrabold tracking-[-0.03em]">{title}</h3>
                <p className="text-sm leading-6 text-white/70">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-32">
        <div className="border-2 border-[#183153] bg-white">
          <div className="border-b-2 border-[#183153] p-6 sm:p-8">
            <p className="text-xl font-extrabold tracking-[-0.04em]">Book a stay at Palm House</p>
            <p className="mt-2 text-sm text-[#64748b]">Cox&apos;s Bazar · 14–17 August</p>
          </div>
          <div className="grid grid-cols-2 border-b-2 border-[#183153]">
            <div className="border-r-2 border-[#183153] p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                Garden room
              </p>
              <p className="font-bitcount mt-8 text-2xl">৳7,500</p>
            </div>
            <div className="bg-[#fff1ea] p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                Ocean suite
              </p>
              <p className="font-bitcount mt-8 text-2xl">৳12,000</p>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <button
              type="button"
              className="w-full bg-[#ef725c] px-5 py-4 text-left text-sm font-bold text-white transition-colors hover:bg-[#b2402c]"
            >
              Choose your room
            </button>
          </div>
        </div>
        <div>
          <Eyebrow>Your direct booking deserves better</Eyebrow>
          <h2 className="mt-7 max-w-[540px] text-[clamp(2.8rem,4.5vw,4.9rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
            Your best guest experience starts before check-in.
          </h2>
          <p className="mt-7 max-w-[490px] text-[17px] leading-8 text-[#64748b]">
            Turn your rooms, availability, and offers into a booking experience that looks
            unmistakably like your resort—not a third-party marketplace.
          </p>
          <Link
            href="/try"
            className="mt-8 inline-flex items-center gap-2 border-b-2 border-[#183153] pb-1 text-sm font-extrabold hover:border-[#ef725c] hover:text-[#ef725c]"
          >
            See the guest journey <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section id="pricing" className="border-y-2 border-[#183153] bg-[#fff1ea]">
        <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <Eyebrow>Simple enough to choose in a minute</Eyebrow>
              <h2 className="mt-7 max-w-[600px] text-[clamp(2.9rem,4.8vw,5.1rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
                Start with real value, then grow on your terms.
              </h2>
            </div>
            <div className="inline-flex w-fit border-2 border-[#183153] bg-white p-1">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={`px-4 py-2.5 text-sm font-bold ${annual ? 'text-[#183153]' : 'bg-[#183153] text-white'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={`px-4 py-2.5 text-sm font-bold ${annual ? 'bg-[#183153] text-white' : 'text-[#183153]'}`}
              >
                Yearly <span className="text-[#ef725c]">· 2 months free</span>
              </button>
            </div>
          </div>

          <div className="mt-12 grid border-l-2 border-t-2 border-[#183153] lg:grid-cols-3">
            {planCards.map((plan) => {
              const pricing = PLAN_PRICING[plan.key];
              const price = annual ? pricing.annualUsd : pricing.monthlyUsd;
              return (
                <article
                  key={plan.key}
                  className={`relative flex min-h-[470px] flex-col border-b-2 border-r-2 border-[#183153] p-7 sm:p-8 ${plan.featured ? 'bg-[#183153] text-white' : 'bg-white'}`}
                >
                  <p
                    className={`m-0 text-[11px] font-bold uppercase tracking-[0.12em] ${plan.featured ? 'text-[#f4c76b]' : 'text-[#64748b]'}`}
                  >
                    {plan.label}
                  </p>
                  <div className="mt-7 flex items-end gap-2">
                    <span
                      className={`font-bitcount text-5xl ${plan.featured ? 'text-white' : 'text-[#183153]'}`}
                    >
                      ${price}
                    </span>
                    <span
                      className={`mb-1 text-sm font-semibold ${plan.featured ? 'text-white/70' : 'text-[#64748b]'}`}
                    >
                      {annual ? '/ year' : '/ month'}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold tracking-[-0.03em]">{plan.title}</h3>
                  <p
                    className={`mt-3 text-sm leading-6 ${plan.featured ? 'text-white/75' : 'text-[#64748b]'}`}
                  >
                    {plan.description}
                  </p>
                  <ul
                    className={`mt-8 grid gap-3 border-t pt-6 text-sm font-semibold ${plan.featured ? 'border-white/35 text-white' : 'border-[#183153]/25 text-[#183153]'}`}
                  >
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <Check
                          className={`mt-0.5 h-4 w-4 flex-none ${plan.featured ? 'text-[#f4c76b]' : 'text-[#ef725c]'}`}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/auth/register?plan=${plan.key}`}
                    className={`mt-auto px-5 py-4 text-center text-sm font-bold transition-colors ${plan.featured ? 'bg-[#ef725c] text-white hover:bg-[#f4c76b] hover:text-[#183153]' : 'border-2 border-[#183153] hover:bg-[#183153] hover:text-white'}`}
                  >
                    Choose {pricing.displayName}
                  </Link>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-sm font-semibold text-[#64748b]">
            Need white-label, SSO, or more than five properties?{' '}
            <Link
              href="/contact"
              className="text-[#183153] underline decoration-[#ef725c] decoration-2 underline-offset-4"
            >
              Talk to our team.
            </Link>
          </p>
        </div>
      </section>

      <section className="bg-[#fff1ea]">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:gap-20 lg:py-28">
          <blockquote>
            <p className="max-w-[500px] text-[clamp(1.8rem,3vw,3rem)] font-extrabold leading-[1.15] tracking-[-0.04em]">
              “We stopped keeping the day in a notebook. The desk, the kitchen, and I are finally
              looking at the same page.”
            </p>
            <footer className="mt-7 text-sm font-bold text-[#64748b]">
              Rezaul Karim — owner, Palm House, Cox&apos;s Bazar
            </footer>
          </blockquote>
          <div className="grid grid-cols-2 border-l-2 border-t-2 border-[#183153] bg-white">
            {[
              ['3 min', 'Average check-in'],
              ['41%', 'More direct bookings'],
              ['0', 'Spreadsheets kept'],
              ['14 mo', 'Running on ResortPro'],
            ].map(([stat, label], index) => (
              <div key={label} className="border-b-2 border-r-2 border-[#183153] p-6 sm:p-7">
                <p className={`font-bitcount text-3xl ${index === 1 ? 'text-[#ef725c]' : ''}`}>
                  {stat}
                </p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="desktop-app"
        className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-32"
      >
        <div>
          <Eyebrow>For the people at the desk</Eyebrow>
          <h2 className="mt-7 max-w-[550px] text-[clamp(2.8rem,4.5vw,4.9rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
            A desktop app that keeps working when the day gets busy.
          </h2>
          <p className="mt-7 max-w-[530px] text-[17px] leading-8 text-[#64748b]">
            Keep essential operations close at hand, sync offline work, and connect attendance
            hardware without leaving ResortPro.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://github.com/asadsnapper-beep/resort-pro/releases/download/desktop-v0.1.0/ResortPro.Setup.0.1.0.exe"
              className="bg-[#183153] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#ef725c]"
            >
              Download for Windows
            </a>
            <a
              href="https://github.com/asadsnapper-beep/resort-pro/releases/download/desktop-v0.1.0/ResortPro-0.1.0-arm64.dmg"
              className="border-2 border-[#183153] px-5 py-3 text-sm font-bold hover:bg-[#fff1ea]"
            >
              Download for Mac
            </a>
          </div>
        </div>
        <div className="border-2 border-[#183153] bg-[#183153] text-white">
          <div className="flex items-center justify-between border-b border-white/30 px-5 py-4 text-xs font-bold uppercase tracking-[0.08em] text-white/75">
            <span>ResortPro Desktop</span>
            <span className="text-[#f4c76b]">● Online</span>
          </div>
          <div className="p-7 sm:p-10">
            <p className="max-w-[340px] text-[clamp(2rem,3vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.04em]">
              14 arrivals before noon.
            </p>
          </div>
          {[
            ['Check-in queue', '14'],
            ['Rooms to turn over', '6'],
            ['Unpaid balances', '2'],
          ].map(([label, number], index) => (
            <div
              key={label}
              className="flex items-center justify-between border-t border-white/30 px-7 py-4 text-sm font-bold sm:px-10"
            >
              <span>{label}</span>
              <span className={`font-bitcount text-xl ${index === 0 ? 'text-[#ef725c]' : ''}`}>
                {number}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t-2 border-[#183153]">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-20 lg:py-32">
          <div>
            <Eyebrow>Good to know</Eyebrow>
            <h2 className="mt-7 text-[clamp(2.8rem,4.5vw,4.8rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
              A few honest answers.
            </h2>
            <p className="mt-6 max-w-[360px] text-[17px] leading-8 text-[#64748b]">
              If you need help setting up, our team can guide you in Bangla or English.
            </p>
          </div>
          <div className="border-t-2 border-[#183153]">
            {faqs.map(([question, answer], index) => (
              <div key={question} className="border-b-2 border-[#183153]">
                <button
                  type="button"
                  onClick={() => setOpenFaq((open) => (open === index ? -1 : index))}
                  className={`flex w-full items-center justify-between gap-4 px-0 py-6 text-left transition-colors ${openFaq === index ? 'bg-[#fff1ea] pl-5 pr-5' : ''}`}
                >
                  <span className="text-lg font-extrabold tracking-[-0.02em]">{question}</span>
                  <ChevronDown
                    className={`h-5 w-5 flex-none transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === index && (
                  <p className="max-w-[650px] px-5 pb-6 text-[15px] leading-7 text-[#64748b]">
                    {answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y-2 border-[#183153] bg-[#ef725c] text-white">
        <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
          <h2 className="max-w-[850px] text-[clamp(3rem,6vw,6.8rem)] font-extrabold leading-[.94] tracking-[-0.07em]">
            Make the stay memorable. Make the work lighter.
          </h2>
          <p className="mt-7 max-w-[560px] text-lg leading-8 text-white/90">
            Your resort already has a point of view. Its operating system should too.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/plans"
              className="bg-[#183153] px-6 py-4 text-sm font-bold text-white hover:bg-white hover:text-[#183153]"
            >
              See plans
            </Link>
            <Link
              href="/contact"
              className="border-2 border-white px-6 py-4 text-sm font-bold hover:bg-white/15"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#183153] text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-8 px-5 py-12 sm:flex-row sm:items-end sm:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark inverse />
              <span className="text-lg font-extrabold tracking-[-0.04em]">ResortPro</span>
            </div>
            <p className="mt-4 max-w-[330px] text-sm leading-6 text-white/70">
              The operating system for resorts that want every stay to feel personal.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-bold text-white/85">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="#top">Back to top</a>
          </div>
        </div>
        <div className="mx-auto max-w-[1240px] border-t border-white/25 px-5 py-6 text-xs text-white/55 sm:px-8">
          © 2026 ResortPro.
        </div>
      </footer>
    </main>
  );
}
