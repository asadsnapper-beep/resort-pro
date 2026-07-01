'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────
// Data — Bengali
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
    title: 'Room ও Booking Management',
    desc: 'Drag-and-drop Calendar, Walk-in, Online Booking এবং Group Booking — সব একটি সহজ Dashboard-এ।',
  },
  {
    color: 'bg-emerald-100 text-emerald-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
      </svg>
    ),
    title: 'Online Payment',
    desc: 'বিকাশ, SSL Commerce, Stripe এবং Manual Payment Built-in — কোনো Third-party Plugin দরকার নেই।',
  },
  {
    color: 'bg-blue-100 text-blue-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
    ),
    title: 'Analytics ও Reports',
    desc: 'Revenue Trend, Occupancy Rate, খরচের হিসাব এবং Profit Margin Report Real-time-এ।',
  },
  {
    color: 'bg-orange-100 text-orange-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M3 11l19-9-9 19-2-8-8-2z"/>
      </svg>
    ),
    title: 'Restaurant ও Room Service',
    desc: 'Menu Management, Table Order এবং Room Service Request — Live Kitchen Status সহ।',
  },
  {
    color: 'bg-purple-100 text-purple-700',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Guest CRM',
    desc: 'Guest Profile, Loyalty Points, Stay History এবং Communication Log — সব এক জায়গায়।',
  },
  {
    color: 'bg-gold-400/20 text-gold-600',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    title: 'যেকোনো Website-এ Embed',
    desc: 'Booking Form, Room Listing, Menu ও Calendar আপনার Website-এ এক লাইন Code-এই যোগ করুন।',
  },
];

const STEPS = [
  {
    num: '০১',
    title: 'Account তৈরি করুন',
    desc: 'Sign up করুন, Property-র তথ্য যোগ করুন, Room Upload করুন এবং Rate নির্ধারণ করুন। মাত্র ৫ মিনিট লাগবে।',
  },
  {
    num: '০২',
    title: 'Payment Setup করুন',
    desc: 'বিকাশ, Stripe বা SSL Commerce এক Click-এ Connect করুন। সঙ্গে সঙ্গে Online Booking নিতে শুরু করুন।',
  },
  {
    num: '০৩',
    title: 'Go Live করুন',
    desc: 'আপনার Booking Link Share করুন বা বিদ্যমান Website-এ Widget Embed করুন। Booking আসতে থাকবে।',
  },
];

const PLANS = [
  {
    name: 'STARTER',
    price: '৳৪,৯০০',
    rooms: 'সর্বোচ্চ ২০টি Room',
    staff: '৩ জন User',
    features: ['Room ও Booking Management', 'বিকাশ ও Stripe Payment', 'Guest CRM', 'Embed Widget', '২৪/৭ Email Support'],
    cta: 'Free Trial শুরু করুন',
    ctaHref: '/auth/register',
    highlight: false,
  },
  {
    name: 'PROFESSIONAL',
    price: '৳৯,৯০০',
    rooms: 'সর্বোচ্চ ১০০টি Room',
    staff: '১০ জন User',
    features: ['Starter-এর সব কিছু', 'Advanced Analytics ও Reports', 'Rate Plan ও Channel Sync', 'Restaurant ও Room Service', 'Priority Support'],
    cta: 'Free Trial শুরু করুন',
    ctaHref: '/auth/register',
    highlight: true,
  },
  {
    name: 'ENTERPRISE',
    price: '৳১৯,৯০০',
    rooms: 'সীমাহীন Room',
    staff: 'সীমাহীন User',
    features: ['Professional-এর সব কিছু', 'White-label Branding', 'SSO ও SAML', 'Dedicated Account Manager', 'SLA গ্যারান্টি'],
    cta: 'Sales Team-এর সাথে কথা বলুন',
    ctaHref: '/contact',
    highlight: false,
  },
];

const TESTIMONIALS = [
  {
    quote: 'ResortPro আমাদের ৪টি আলাদা Excel Sheet আর WhatsApp Booking Group সম্পূর্ণ বদলে দিয়েছে। এখন সব এক জায়গায়, মধ্যরাতেও Phone থেকে Status দেখতে পাই।',
    name: 'করিম হোসেন',
    role: 'Manager, Palm Paradise Resort',
    location: "কক্সবাজার",
  },
  {
    quote: 'বিকাশ Integration একাই আমাদের প্রতি সপ্তাহে অনেক ঘণ্টা বাঁচিয়ে দেয়। Guest Online-এ Payment করে, আমরা Dashboard-এ সঙ্গে সঙ্গে দেখতে পাই — WhatsApp-এ Payment-এর Screenshot তাড়া করার দিন শেষ।',
    name: 'সুমাইয়া ইসলাম',
    role: 'Owner, Sea View Boutique Hotel',
    location: 'সিলেট',
  },
  {
    quote: 'আমাদের WordPress Site-এ ৫ মিনিটে Booking Form বসিয়েছি। প্রথম মাসেই Online Booking দ্বিগুণ হয়ে গেছে। Embed SDK সত্যিই অসাধারণ।',
    name: 'রহিম চৌধুরী',
    role: 'CEO, Blue Lagoon Spa Resort',
    location: "কক্সবাজার",
  },
];

const FAQS = [
  {
    q: 'ResortPro ব্যবহার করতে কি Technical দক্ষতা লাগবে?',
    a: 'একদমই না। ResortPro Resort মালিক ও Manager-দের জন্য তৈরি, Developer-দের জন্য নয়। কোনো Coding ছাড়াই প্রায় ১০ মিনিটে Setup সম্পন্ন হয়। আমাদের Onboarding Wizard প্রতিটি ধাপে আপনাকে Guide করবে।',
  },
  {
    q: 'Guest-এর Payment-এর জন্য কি বিকাশ ব্যবহার করা যাবে?',
    a: 'হ্যাঁ। বিকাশ, SSL Commerce, Stripe এবং Manual Payment (নগদ/Bank Transfer) সবই ResortPro-তে সরাসরি Built-in। আপনি যেকোনো Combination-এ Payment Method চালু করতে পারবেন।',
  },
  {
    q: 'আমার বিদ্যমান Website-এ কি Booking Form বসানো যাবে?',
    a: 'অবশ্যই। আপনার Website-এ যেকোনো জায়গায় এক লাইন Code Paste করুন — WordPress, Wix, Squarespace বা যেকোনো Custom Site-এ। Booking Form, Room Listing, Calendar এবং Food Menu সবই Embed করা যাবে।',
  },
  {
    q: 'Free Trial শেষ হলে কী হবে?',
    a: 'আপনার Property-র জন্য উপযুক্ত একটি Plan বেছে নিন। আপনার সব Data সবসময় আপনার — ResortPro পছন্দ না হলে সব Export করে নিতে পারবেন। কোনো Lock-in নেই।',
  },
  {
    q: 'আমার Data কি নিরাপদ ও Backup থাকবে?',
    a: 'হ্যাঁ। সমস্ত Data Transit-এ ও Storage-এ Encrypted। প্রতিদিন Automatic Backup চলে। আমাদের Infrastructure AWS-এ Host করা, ৯৯.৯% Uptime SLA সহ।',
  },
  {
    q: 'যেকোনো সময় Cancel করা যাবে?',
    a: 'হ্যাঁ। কোনো Contract নেই, কোনো Cancellation Fee নেই। Dashboard থেকেই যেকোনো সময় Cancel করুন। Billing Period শেষ পর্যন্ত Subscription সক্রিয় থাকবে।',
  },
];

const TRUST_BRANDS = [
  'পাম প্যারাডাইস রিসোর্ট',
  'সি ভিউ বুটিক',
  'গ্রিন ভ্যালি ইন',
  'কোরাল বে হোটেলস',
  'মনসুন রিট্রিট',
  'ব্লু লেগুন স্পা',
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

function DashboardMockup() {
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 bg-resort-800 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
        <span className="h-3 w-3 rounded-full bg-green-400/80" />
        <div className="ml-3 flex-1 rounded-md bg-resort-700 px-3 py-1 text-xs text-resort-400">
          app.resortpro.site/dashboard
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
              <div className="h-2 rounded bg-resort-600" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        {/* Main content */}
        <div className="flex-1 p-5">
          <div className="mb-4 grid grid-cols-4 gap-3">
            {[
              { label: 'Occupancy', val: '৮৭%', color: 'bg-resort-100 text-resort-700' },
              { label: 'Revenue', val: '৳ ৮৪ক', color: 'bg-gold-400/20 text-gold-600' },
              { label: 'Check-ins', val: '১২', color: 'bg-blue-50 text-blue-600' },
              { label: 'Pending', val: '৪', color: 'bg-orange-50 text-orange-600' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                <p className="text-[10px] font-medium text-gray-400">{s.label}</p>
                <p className={`mt-1 text-sm font-bold ${s.color.split(' ')[1]}`}>{s.val}</p>
                <div className={`mt-1 h-1 w-full rounded ${s.color.split(' ')[0]}`} />
              </div>
            ))}
          </div>
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
// Main Page — Bengali
// ─────────────────────────────────────────────

export default function BanglaHomePage() {
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
              href="/"
              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                scrolled
                  ? 'border-gray-200 text-gray-500 hover:text-resort-700 hover:border-resort-300'
                  : 'border-white/20 text-white/60 hover:text-white hover:border-white/40'
              }`}
            >
              EN
            </Link>
            <Link
              href="/auth/login"
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-gray-600 hover:text-resort-700' : 'text-white/80 hover:text-white'
              }`}
            >
              লগ ইন
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-resort-900 transition-all hover:bg-gold-400 shadow-sm"
            >
              ফ্রি ট্রায়াল শুরু করুন
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="flex flex-col gap-1.5 p-2 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="মেনু টগল"
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
                <Link href="/" className="text-center text-xs font-medium text-gray-500 border border-gray-200 rounded-lg py-1.5">
                  English version
                </Link>
                <Link href="/auth/login" className="text-center text-sm font-medium text-gray-700">লগ ইন</Link>
                <Link href="/auth/register" className="rounded-lg bg-gold-500 py-2.5 text-center text-sm font-semibold text-resort-900">
                  ফ্রি ট্রায়াল শুরু করুন
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
          backgroundImage: 'linear-gradient(135deg, #19403b 0%, #1e5048 50%, #23766a 100%)',
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
            এশিয়ার ২০০+ রিসোর্ট আমাদের বিশ্বাস করে
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold leading-[1.2] tracking-tight text-white sm:text-5xl md:text-6xl">
            রিসোর্ট ও বুটিক হোটেলের জন্য{' '}
            <span className="text-gold-400">সর্বাত্মক ম্যানেজমেন্ট প্ল্যাটফর্ম</span>
          </h1>

          {/* Sub */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
            বুকিং, পেমেন্ট, স্টাফ, রেস্তোরাঁ, অ্যানালিটিক্স — একটি সুন্দর ড্যাশবোর্ডে।
            Excel শিট আর WhatsApp গ্রুপের ঝামেলা বন্ধ করুন।
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/register"
              className="w-full rounded-xl bg-gold-500 px-8 py-4 text-base font-semibold text-resort-900 shadow-lg shadow-gold-500/25 transition-all hover:bg-gold-400 hover:shadow-gold-400/30 sm:w-auto"
            >
              ফ্রি ট্রায়াল শুরু করুন →
            </Link>
            <a
              href="#how-it-works"
              className="w-full rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:w-auto"
            >
              ডেমো দেখুন
            </a>
          </div>

          {/* Trust pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-sm text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> ১৪ দিনের ফ্রি ট্রায়াল
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> ক্রেডিট কার্ড লাগবে না
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> ১০ মিনিটে সেটআপ
            </span>
          </div>

          {/* Dashboard mockup */}
          <div className="relative mt-16">
            <div className="pointer-events-none absolute -inset-x-10 top-10 h-60 rounded-full bg-resort-600/20 blur-3xl" />
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── LOGOS BAR ── */}
      <section className="bg-white py-10">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="mb-8 text-xs font-semibold uppercase tracking-widest text-gray-400">
            যেসব রিসোর্ট আমাদের ব্যবহার করছে
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
              { num: '২০০+', label: 'রিসোর্ট অনবোর্ড' },
              { num: '৫০,০০০+', label: 'বুকিং সম্পন্ন' },
              { num: '৳ ১২ কোটি+', label: 'পেমেন্ট প্রসেস' },
              { num: '৪.৯ ★', label: 'গ্রাহক রেটিং' },
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
              প্ল্যাটফর্ম
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              আপনার রিসোর্টের সব প্রয়োজন, এক জায়গায়
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              ৬টি আলাদা টুলের জন্য আলাদা টাকা দেওয়া বন্ধ করুন। ResortPro সব একই ছাদের নিচে এনেছে।
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
              শুরু করার উপায়
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              ১০ মিনিটেই চালু হয়ে যান
            </h2>
          </div>

          <div className="relative mt-16">
            <div className="absolute left-0 right-0 top-10 hidden h-0.5 bg-resort-200 md:block mx-[calc(16.66%+1.5rem)]" />
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
              {STEPS.map((step) => (
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
            <div className="flex-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-resort-600">
                Embed SDK
              </p>
              <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                আপনার Website।{' '}
                <span className="text-resort-700">আপনার Booking।</span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-gray-500">
                ইতিমধ্যে একটি Website আছে? সেটি রাখুন। শুধু এক লাইন Code Paste করে ResortPro-র
                Booking Engine, Room Listing, Food Menu বা Live Availability Calendar বসিয়ে নিন।
                WordPress, Wix, Squarespace বা যেকোনো Custom Site-এ কাজ করে।
              </p>
              <div className="mt-6 space-y-3">
                {[
                  'Developer লাগবে না — শুধু একটি Snippet Copy-Paste',
                  'আপনার Site-এর Brand-এর সাথে পুরোপুরি মিলে যায়',
                  'ResortPro Dashboard-এর সাথে Real-time Sync',
                ].map((point) => (
                  <div key={point} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-sm text-gray-600">{point}</span>
                  </div>
                ))}
              </div>
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

            {/* Code snippet */}
            <div className="flex-1 w-full">
              <div className="overflow-hidden rounded-2xl bg-gray-900 shadow-2xl ring-1 ring-white/10">
                <div className="flex items-center gap-1.5 border-b border-gray-700 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-red-400/80" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <span className="h-3 w-3 rounded-full bg-green-400/80" />
                  <span className="ml-3 text-xs text-gray-500">booking-widget.html</span>
                </div>
                <div className="p-6 font-mono text-sm leading-relaxed">
                  <p className="text-gray-500">{'<!-- আপনার ওয়েবসাইটের HTML -->'}</p>
                  <p className="mt-3 text-gray-400">{'<div'}</p>
                  <p className="ml-4 text-blue-400">{'  data-resortpro="booking"'}</p>
                  <p className="ml-4 text-green-400">{'  data-slug="your-resort"'}</p>
                  <p className="ml-4 text-purple-400">{'  data-theme="light"'}</p>
                  <p className="text-gray-400">{'></div>'}</p>
                  <p className="mt-4 text-gray-400">{'<script'}</p>
                  <p className="ml-4 text-yellow-300">{'  src="https://cdn.resortpro.site/embed.js"'}</p>
                  <p className="text-gray-400">{'></script>'}</p>
                  <p className="mt-4 text-gray-600">{'// ব্যস। বুকিং ফর্ম চালু।'}</p>
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
              মূল্য পরিকল্পনা
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              সহজ ও স্বচ্ছ মূল্য
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              ফ্রিতে শুরু করুন। প্রস্তুত হলে আপগ্রেড করুন।
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
                      সবচেয়ে জনপ্রিয়
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
                  <span className={`mb-1 text-sm ${plan.highlight ? 'text-white/60' : 'text-gray-400'}`}>/মাস</span>
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
            সব Plan-এ আছে: ১৪ দিনের Free Trial &bull; বিকাশ ও Stripe Payment &bull; Embed Widget &bull; ২৪/৭ Email Support
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="bg-resort-900 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-gold-400 sm:text-4xl">
              রিসোর্ট মালিকরা কী বলছেন
            </h2>
            <p className="mt-4 text-white/60">
              এশিয়ার প্রপার্টি ম্যানেজারদের বাস্তব অভিজ্ঞতা।
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
              প্রশ্নোত্তর
            </p>
            <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
              সাধারণ জিজ্ঞাসা
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
            ইতিমধ্যে ২০০+ রিসোর্ট ResortPro ব্যবহার করছে
          </div>
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            আপনার রিসোর্ট পরিচালনা বদলে দিতে প্রস্তুত?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/60">
            কোনো চুক্তি নেই। সেটআপ ফি নেই। ফ্রিতে শুরু করুন, প্রয়োজন হলে আপগ্রেড করুন।
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/register"
              className="w-full rounded-xl bg-gold-500 px-8 py-4 text-base font-semibold text-resort-900 shadow-lg shadow-gold-500/25 transition-all hover:bg-gold-400 sm:w-auto"
            >
              ফ্রি ট্রায়াল শুরু করুন — ১৪ দিন বিনামূল্যে
            </Link>
            <Link
              href="/contact"
              className="w-full rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:w-auto"
            >
              আমাদের সাথে কথা বলুন
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
                হসপিটালিটি ইন্ডাস্ট্রির জন্য তৈরি। রিসোর্ট ম্যানেজমেন্টের সর্বাত্মক প্ল্যাটফর্ম।
              </p>
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
                links: ['আমাদের সম্পর্কে', 'Blog', 'যোগাযোগ'],
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
                      <a href="#" className="text-sm text-white/60 transition-colors hover:text-white">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
            <p className="text-sm text-white/40">
              &copy; {new Date().getFullYear()} ResortPro. সর্বস্বত্ব সংরক্ষিত।
            </p>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xs text-white/40 hover:text-white/70 transition-colors border border-white/20 rounded px-2 py-1">
                🌐 English
              </Link>
              <span className="text-xs text-white/40 border border-white/30 rounded px-2 py-1 text-white/60">
                🇧🇩 বাংলা
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
