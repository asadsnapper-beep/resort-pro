'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Embed SDK', href: '#embed' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const FEATURES = [
  {
    color: 'bg-resort-100 text-resort-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
      </svg>
    ),
    title: 'Room & Booking Management',
    desc: 'Drag-and-drop calendar, walk-in, online booking, and group bookings all in one intuitive view.',
  },
  {
    color: 'bg-emerald-100 text-emerald-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
      </svg>
    ),
    title: 'Online Payments',
    desc: 'bKash, SSL Commerce, Stripe, and manual payments built in — no third-party plugins needed.',
  },
  {
    color: 'bg-blue-100 text-blue-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
    ),
    title: 'Analytics & Reports',
    desc: 'Revenue trends, occupancy rates, expense tracking, and profit margin reports in real time.',
  },
  {
    color: 'bg-orange-100 text-orange-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M3 11l19-9-9 19-2-8-8-2z"/>
      </svg>
    ),
    title: 'Restaurant & Room Service',
    desc: 'Menu management, table orders, and room-service requests with live kitchen status.',
  },
  {
    color: 'bg-purple-100 text-purple-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Guest CRM',
    desc: 'Guest profiles, loyalty points, stay history, and communication logs — all in one place.',
  },
  {
    color: 'bg-gold-400/20 text-gold-600',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    title: 'Embed on Any Website',
    desc: 'Drop booking forms, room listings, menus, and calendars on your site with one line of code.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Create your account',
    desc: 'Sign up, add your property details, upload your rooms and set your rates. Takes about 5 minutes.',
  },
  {
    num: '02',
    title: 'Set up payments',
    desc: 'Connect bKash, Stripe, or SSL Commerce with one click. Start accepting online bookings immediately.',
  },
  {
    num: '03',
    title: 'Go live',
    desc: 'Share your booking link or embed our widgets on your existing website. Watch bookings roll in.',
  },
];

const PLANS = [
  {
    name: 'STARTER',
    price: '$49',
    rooms: 'Up to 20 rooms',
    staff: '3 users',
    features: ['Room & booking management', 'bKash & Stripe payments', 'Guest CRM', 'Embed widgets', '24/7 email support'],
    cta: 'Start free trial',
    ctaHref: '/auth/register?plan=STARTER',
    highlight: false,
  },
  {
    name: 'PROFESSIONAL',
    price: '$99',
    rooms: 'Up to 100 rooms',
    staff: '10 users',
    features: ['Everything in Starter', 'Advanced analytics & reports', 'Rate plans & channel sync', 'Restaurant & room service', 'Priority support'],
    cta: 'Start free trial',
    ctaHref: '/auth/register?plan=PROFESSIONAL',
    highlight: true,
  },
  {
    name: 'ENTERPRISE',
    price: '$199',
    rooms: 'Unlimited rooms',
    staff: 'Unlimited users',
    features: ['Everything in Professional', 'White-label branding', 'SSO & SAML', 'Dedicated account manager', 'SLA guarantee'],
    cta: 'Contact sales',
    ctaHref: '/contact',
    highlight: false,
  },
];

const TESTIMONIALS = [
  {
    quote: 'ResortPro completely replaced our 4 different Excel sheets and WhatsApp booking group. Now everything is in one place and I can check the status from my phone at midnight.',
    name: 'Karim Hossain',
    role: 'Manager, Palm Paradise Resort',
    location: "Cox's Bazar",
  },
  {
    quote: 'The bKash integration alone saved us hours every week. Guests pay online, we see it instantly on the dashboard — no more chasing payment screenshots on WhatsApp.',
    name: 'Sumaiya Islam',
    role: 'Owner, Sea View Boutique Hotel',
    location: 'Sylhet',
  },
  {
    quote: 'We embedded the booking form on our WordPress site in 5 minutes. Online bookings doubled in the first month. The embed SDK is a game changer.',
    name: 'Rahim Chowdhury',
    role: 'CEO, Blue Lagoon Spa Resort',
    location: "Cox's Bazar",
  },
];

const FAQS = [
  {
    q: 'Do I need technical skills to use ResortPro?',
    a: 'Not at all. ResortPro is designed for resort owners and managers, not developers. Setup takes about 10 minutes with no coding required. Our onboarding wizard walks you through each step.',
  },
  {
    q: 'Can I use bKash for guest payments?',
    a: 'Yes. bKash, SSL Commerce, Stripe, and manual payment (cash/bank transfer) are all built directly into ResortPro. You can enable any combination of payment methods for your property.',
  },
  {
    q: 'Can I embed the booking form on my existing website?',
    a: 'Absolutely. Drop one line of code anywhere on your website — WordPress, Wix, Squarespace, or any custom site. The booking form, room listing, calendar, and food menu are all embeddable.',
  },
  {
    q: 'What happens after my free trial ends?',
    a: "You choose a plan that fits your property. Your data is always yours — if you decide ResortPro isn't for you, you can export everything. No lock-in.",
  },
  {
    q: 'Is my data safe and backed up?',
    a: 'Yes. All data is encrypted in transit and at rest. Automated backups run daily. Our infrastructure is hosted on AWS with 99.9% uptime SLA.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no cancellation fees. Cancel anytime directly from your dashboard. Your subscription stays active until the end of the billing period.',
  },
];

const TRUST_BRANDS = [
  'Palm Paradise Resort',
  'Sea View Boutique',
  'The Green Valley Inn',
  'Coral Bay Hotels',
  'Monsoon Retreat',
  'Blue Lagoon Spa',
];

const EMBED_WIDGETS = [
  { icon: '📅', label: 'Booking Form' },
  { icon: '🛏️', label: 'Room Listing' },
  { icon: '📆', label: 'Calendar' },
  { icon: '🍽️', label: 'Food Menu' },
  { icon: '📞', label: 'Floating CTA' },
];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500 font-display text-lg font-bold text-resort-900">
        R
      </div>
      <span className="font-display text-xl font-semibold tracking-tight text-resort-900">
        ResortPro
      </span>
    </div>
  );
}

function LogoLight() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500 font-display text-lg font-bold text-resort-900">
        R
      </div>
      <span className="font-display text-xl font-semibold tracking-tight text-white">
        ResortPro
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-resort-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function CheckIconGold() {
  return (
    <svg className="h-4 w-4 shrink-0 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// Fake dashboard mockup — pure HTML/CSS/Tailwind
function DashboardMockup() {
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 bg-resort-800 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
        <span className="h-3 w-3 rounded-full bg-green-400/80" />
        <div className="ml-3 flex-1 rounded-md bg-resort-700 px-3 py-1 text-xs text-resort-400">
          app.resortpro.io/dashboard
        </div>
      </div>
      {/* App body */}
      <div className="flex bg-gray-50" style={{ minHeight: 320 }}>
        {/* Sidebar */}
        <div className="flex w-48 flex-col gap-2 bg-resort-800 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gold-500" />
            <div className="h-3 w-20 rounded bg-resort-600" />
          </div>
          {[70, 55, 80, 60, 45, 65].map((w, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${i === 0 ? 'bg-resort-600' : ''}`}>
              <div className="h-3 w-3 rounded bg-resort-500" />
              <div className={`h-2 rounded bg-resort-600`} style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        {/* Main content */}
        <div className="flex-1 p-5">
          {/* Stats row */}
          <div className="mb-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Occupancy', val: '87%', color: 'bg-resort-100 text-resort-700' },
              { label: 'Revenue', val: '৳ 84k', color: 'bg-gold-400/20 text-gold-600' },
              { label: 'Check-ins', val: '12', color: 'bg-blue-50 text-blue-600' },
              { label: 'Pending', val: '4', color: 'bg-orange-50 text-orange-600' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                <p className="text-[10px] font-medium text-gray-400">{s.label}</p>
                <p className={`mt-1 text-sm font-bold ${s.color.split(' ')[1]}`}>{s.val}</p>
                <div className={`mt-1 h-1 w-full rounded ${s.color.split(' ')[0]}`} />
              </div>
            ))}
          </div>
          {/* Fake chart */}
          <div className="mb-4 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-2.5 w-24 rounded bg-gray-200" />
              <div className="h-2 w-16 rounded bg-gray-100" />
            </div>
            <div className="flex items-end gap-1.5 pt-2" style={{ height: 50 }}>
              {[35, 55, 42, 70, 60, 80, 65, 90, 75, 85, 70, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i === 11 ? '#23766a' : '#e0f0ee',
                  }}
                />
              ))}
            </div>
          </div>
          {/* Bookings table */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="border-b border-gray-100 px-3 py-2">
              <div className="h-2.5 w-28 rounded bg-gray-200" />
            </div>
            {[
              { status: 'bg-green-400', w1: 80, w2: 40 },
              { status: 'bg-blue-400', w1: 65, w2: 55 },
              { status: 'bg-gold-400', w1: 72, w2: 35 },
              { status: 'bg-green-400', w1: 58, w2: 48 },
              { status: 'bg-orange-400', w1: 75, w2: 30 },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-gray-50 px-3 py-2 last:border-0">
                <div className={`h-2 w-2 rounded-full ${row.status}`} />
                <div className="h-2 rounded bg-gray-200" style={{ width: `${row.w1}%` }} />
                <div className="h-2 rounded bg-gray-100" style={{ width: `${row.w2}%`, minWidth: 32 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="scroll-smooth antialiased">

      {/* ── NAVBAR ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 shadow-sm backdrop-blur-md border-b border-gray-100'
            : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {scrolled ? <Logo /> : <LogoLight />}

          {/* Desktop nav */}
          <div className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  scrolled
                    ? 'text-gray-600 hover:text-resort-700'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {/* Language switcher */}
            <Link
              href="/bn"
              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                scrolled
                  ? 'border-gray-200 text-gray-500 hover:text-resort-700 hover:border-resort-300'
                  : 'border-white/20 text-white/60 hover:text-white hover:border-white/40'
              }`}
            >
              বাংলা
            </Link>
            <Link
              href="/auth/login"
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-gray-600 hover:text-resort-700' : 'text-white/80 hover:text-white'
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/plans"
              className="rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-resort-900 transition-all hover:bg-gold-400 shadow-sm"
            >
              Start free trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="flex flex-col gap-1.5 p-2 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-6 transition-all duration-300 ${scrolled ? 'bg-resort-900' : 'bg-white'} ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-6 transition-all duration-300 ${scrolled ? 'bg-resort-900' : 'bg-white'} ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-6 transition-all duration-300 ${scrolled ? 'bg-resort-900' : 'bg-white'} ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
            <div className="flex flex-col gap-4">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="text-sm font-medium text-gray-700 hover:text-resort-700"
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-3 border-t border-gray-100 pt-4">
                <Link href="/auth/login" className="text-center text-sm font-medium text-gray-700">Sign in</Link>
                <Link href="/plans" className="rounded-lg bg-gold-500 py-2.5 text-center text-sm font-semibold text-resort-900">
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section
        id="hero"
        className="relative overflow-hidden bg-resort-900 pt-28 pb-20"
        style={{
          backgroundImage:
            'linear-gradient(135deg, #19403b 0%, #1e5048 50%, #23766a 100%)',
        }}
      >
        {/* Dot grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
            <span className="text-gold-400">✦</span>
            Trusted by 200+ resorts across Asia
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold leading-[1.15] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            The all-in-one platform built for{' '}
            <span className="text-gold-400">resorts &amp; boutique hotels</span>
          </h1>

          {/* Sub */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
            Bookings, payments, staff, restaurant, analytics — one beautiful dashboard.
            Stop juggling spreadsheets and WhatsApp groups.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/plans"
              className="w-full rounded-xl bg-gold-500 px-8 py-4 text-base font-semibold text-resort-900 shadow-lg shadow-gold-500/25 transition-all hover:bg-gold-400 hover:shadow-gold-400/30 sm:w-auto"
            >
              Start free trial →
            </Link>
            <a
              href="/try"
              className="w-full rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:w-auto"
            >
              Watch demo →
            </a>
          </div>

          {/* Trust pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-sm text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> 14-day free trial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> Setup in 10 minutes
            </span>
          </div>

          {/* Dashboard mockup */}
          <div className="relative mt-16">
            {/* Glow */}
            <div className="pointer-events-none absolute -inset-x-10 top-10 h-60 rounded-full bg-resort-600/20 blur-3xl" />
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── LOGOS BAR ── */}
      <section className="bg-white py-10">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="mb-8 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Trusted by resorts using
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {TRUST_BRANDS.map((brand) => (
              <span
                key={brand}
                className="text-sm font-semibold uppercase tracking-widest text-gray-300"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ROW ── */}
      <section className="border-b border-gray-100 bg-white py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { num: '200+', label: 'Resorts onboarded' },
              { num: '50,000+', label: 'Bookings managed' },
              { num: '৳ 12 Cr+', label: 'Revenue processed' },
              { num: '4.9 ★', label: 'Customer rating' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-3xl font-bold text-resort-700 md:text-4xl">{s.num}</p>
                <p className="mt-1 text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-resort-600">
              Platform
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything your resort needs, in one place
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Stop paying for 6 different tools. ResortPro brings everything under one roof.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-gray-100 bg-gray-50 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-resort-200 hover:bg-white hover:shadow-lg hover:shadow-resort-100/50"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.color}`}>
                  {f.svg}
                </div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="bg-resort-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-resort-600">
              Getting started
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              Up and running in 10 minutes
            </h2>
          </div>

          <div className="relative mt-16">
            {/* Connector line */}
            <div className="absolute left-0 right-0 top-10 hidden h-0.5 bg-resort-200 md:block mx-[calc(16.66%+1.5rem)]" />

            <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.num} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-resort-700 shadow-lg shadow-resort-700/30 ring-4 ring-resort-50">
                    <span className="font-display text-xl font-bold text-white">{step.num}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── EMBED SDK ── */}
      <section id="embed" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-20">
            {/* Left text */}
            <div className="flex-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-resort-600">
                Embed SDK
              </p>
              <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                Your website.{' '}
                <span className="text-resort-700">Your bookings.</span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-gray-500">
                Already have a website? Keep it. Just drop one line of code to embed ResortPro's
                booking engine, room listings, food menu, or live availability calendar. Works
                with WordPress, Wix, Squarespace, or any custom site.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  'No developer required — copy & paste one snippet',
                  'Fully branded to match your existing site',
                  'Real-time sync with your ResortPro dashboard',
                ].map((point) => (
                  <div key={point} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm text-gray-600">{point}</span>
                  </div>
                ))}
              </div>
              {/* Widget badges */}
              <div className="mt-8 flex flex-wrap gap-2">
                {EMBED_WIDGETS.map((w) => (
                  <span
                    key={w.label}
                    className="flex items-center gap-1.5 rounded-full border border-resort-200 bg-resort-50 px-3 py-1.5 text-xs font-medium text-resort-700"
                  >
                    {w.icon} {w.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: code snippet */}
            <div className="flex-1 w-full">
              <div className="overflow-hidden rounded-2xl bg-gray-900 shadow-2xl ring-1 ring-white/10">
                {/* Editor chrome */}
                <div className="flex items-center gap-1.5 border-b border-gray-700 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-red-400/80" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <span className="h-3 w-3 rounded-full bg-green-400/80" />
                  <span className="ml-3 text-xs text-gray-500">booking-widget.html</span>
                </div>
                <div className="p-6 font-mono text-sm leading-relaxed">
                  <p className="text-gray-500">{'<!-- Your existing website HTML -->'}</p>
                  <p className="mt-3 text-gray-400">{'<div'}</p>
                  <p className="ml-4 text-blue-400">{'  data-resortpro="booking"'}</p>
                  <p className="ml-4 text-green-400">{'  data-slug="your-resort"'}</p>
                  <p className="ml-4 text-purple-400">{'  data-theme="light"'}</p>
                  <p className="text-gray-400">{'></div>'}</p>
                  <p className="mt-4 text-gray-400">{'<script'}</p>
                  <p className="ml-4 text-yellow-300">{'  src="https://cdn.resortpro.io/embed.js"'}</p>
                  <p className="text-gray-400">{'></script>'}</p>
                  <p className="mt-4 text-gray-600">{'// That\'s it. Booking form is live.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-resort-600">
              Pricing
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Start free. Upgrade when you're ready.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-8 ${
                  plan.highlight
                    ? 'bg-resort-800 text-white shadow-2xl shadow-resort-900/40 ring-2 ring-gold-400'
                    : 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-gold-500 px-4 py-1 text-xs font-bold text-resort-900">
                      Most Popular
                    </span>
                  </div>
                )}
                <p className={`text-xs font-bold uppercase tracking-widest ${plan.highlight ? 'text-gold-400' : 'text-resort-600'}`}>
                  {plan.name}
                </p>
                <div className="mt-3 flex items-end gap-1">
                  <span className={`font-display text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </span>
                  <span className={`mb-1 text-sm ${plan.highlight ? 'text-white/60' : 'text-gray-400'}`}>/month</span>
                </div>
                <p className={`mt-1 text-sm ${plan.highlight ? 'text-white/70' : 'text-gray-500'}`}>
                  {plan.rooms} · {plan.staff}
                </p>

                <ul className="mt-7 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      {plan.highlight ? <CheckIconGold /> : <CheckIcon />}
                      <span className={`text-sm ${plan.highlight ? 'text-white/80' : 'text-gray-600'}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  <Link
                    href={plan.ctaHref}
                    className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                      plan.highlight
                        ? 'bg-gold-500 text-resort-900 hover:bg-gold-400'
                        : 'border border-resort-200 bg-resort-50 text-resort-700 hover:bg-resort-100'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-gray-400">
            All plans include: 14-day free trial &bull; bKash &amp; Stripe payments &bull; Embed
            widgets &bull; 24/7 email support
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="bg-resort-900 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-gold-400 sm:text-4xl">
              What resort owners are saying
            </h2>
            <p className="mt-4 text-white/60">
              Real feedback from property managers across Asia.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="flex flex-col rounded-2xl bg-white/10 p-7 ring-1 ring-white/10 backdrop-blur-sm"
              >
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-gold-400">★</span>
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-white/80">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-resort-700 text-sm font-bold text-gold-400">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-white/50">{t.role}</p>
                    <p className="text-xs text-white/40">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-white py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-resort-600">
              FAQ
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50 transition-all"
                >
                  <button
                    className="flex w-full items-center justify-between px-6 py-5 text-left"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                  >
                    <span className="pr-4 text-sm font-semibold text-gray-900">{faq.q}</span>
                    <span
                      className={`shrink-0 text-resort-600 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 px-6 pb-5 pt-4">
                      <p className="text-sm leading-relaxed text-gray-500">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="py-28 text-center"
        style={{
          backgroundImage: 'linear-gradient(135deg, #1e5048 0%, #19403b 100%)',
        }}
      >
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80">
            <span className="text-gold-400">✦</span>
            Join 200+ resorts already using ResortPro
          </div>
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Ready to transform how you run your resort?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/60">
            No contracts. No setup fees. Start free and upgrade only when you need to.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/plans"
              className="w-full rounded-xl bg-gold-500 px-8 py-4 text-base font-semibold text-resort-900 shadow-lg shadow-gold-500/25 transition-all hover:bg-gold-400 sm:w-auto"
            >
              Start free trial — it's free for 14 days
            </Link>
            <Link
              href="/contact"
              className="w-full rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:w-auto"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-resort-900">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
            {/* Brand col */}
            <div className="col-span-2 md:col-span-1">
              <LogoLight />
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                Built for the hospitality industry. The all-in-one resort management platform.
              </p>
              {/* Social icons */}
              <div className="mt-6 flex gap-4">
                {[
                  {
                    label: 'Twitter/X',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    ),
                  },
                  {
                    label: 'LinkedIn',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    ),
                  },
                  {
                    label: 'Facebook',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    ),
                  },
                ].map((s) => (
                  <a
                    key={s.label}
                    href="#"
                    aria-label={s.label}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {[
              {
                title: 'Product',
                links: ['Features', 'Pricing', 'Embed SDK', 'WordPress Plugin'],
              },
              {
                title: 'Company',
                links: ['About', 'Blog', 'Contact'],
              },
              {
                title: 'Legal',
                links: ['Privacy Policy', 'Terms of Service', 'GDPR'],
              },
              {
                title: 'Support',
                links: ['Documentation', 'Help Center', 'Status'],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
                  {col.title}
                </p>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-white/60 transition-colors hover:text-white"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
            <p className="text-sm text-white/40">
              &copy; {new Date().getFullYear()} ResortPro. Built for the hospitality industry.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-white/40 border border-white/30 rounded px-2 py-1 text-white/60">
                🌐 English
              </span>
              <Link href="/bn" className="text-xs text-white/40 hover:text-white/70 transition-colors border border-white/20 rounded px-2 py-1">
                🇧🇩 বাংলা
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
