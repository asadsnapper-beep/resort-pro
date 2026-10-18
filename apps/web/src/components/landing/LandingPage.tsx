'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';

// Palette from the approved Claude Design source
// (claude.ai/design/p/d56b55b0-882c-44d6-aecd-3667a5499d43 — "ResortPro Landing.dc.html").
// Keep these in sync with that file if it changes.
const NAVY = '#14314D';
const GOLD = '#CFA153';
const GOLD_HOVER = '#B98B3E';
const CREAM = '#F7F3EE';
const BORDER = '#EDE7DD';
const MUTED = '#5B6B79';
const MUTED_LIGHT = '#8B95A0';

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-lg"
      style={{ background: inverse ? '#fff' : NAVY }}
    >
      <Image
        src="/brand/resortpro-icon-mark.png"
        alt="ResortPro"
        fill
        sizes="36px"
        className={`scale-125 object-cover ${inverse ? '' : 'mix-blend-screen'}`}
      />
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-bitcount block text-[13px] font-medium uppercase tracking-[0.14em] sm:text-[15px]"
      style={{ color: GOLD }}
    >
      {children}
    </span>
  );
}

export function LandingPage({ isBn = false }: { isBn?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Server-controlled: reflects the real launch-offer window (see
  // plan/launch-pricing-and-trial-abuse-prevention.md §5). Never hardcode
  // "free trial" copy here — if the promotion isn't active, no offer badge
  // renders at all, so the CTA never claims something that isn't true.
  const [launchOfferActive, setLaunchOfferActive] = useState(false);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${API_URL}/api/auth/launch-promotion`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.data?.active) setLaunchOfferActive(true); })
      .catch(() => {});
  }, []);

  const navLinks = [
    { label: isBn ? 'ফিচার' : 'Features', href: '#features' },
    { label: isBn ? 'প্রাইসিং' : 'Pricing', href: '#pricing' },
  ];

  const tryLabel = isBn ? 'ResortPro ব্যবহার করে দেখুন' : 'Try ResortPro';

  // Nine, in a 3×3 grid. Four cards spread over a full-width band said less
  // than the product does; this is the same section carrying the real list.
  // Each icon is drawn here in the same plain stroke style rather than pulled
  // from an icon set, so the row reads as one hand.
  const icon = (paths: React.ReactNode) => (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">{paths}</svg>
  );

  const features = [
    {
      icon: icon(<>
        <rect x="4" y="10" width="32" height="24" rx="3" stroke={NAVY} strokeWidth="2" />
        <line x1="4" y1="18" x2="36" y2="18" stroke={NAVY} strokeWidth="2" />
        <line x1="12" y1="6" x2="12" y2="14" stroke={NAVY} strokeWidth="2" />
        <line x1="28" y1="6" x2="28" y2="14" stroke={NAVY} strokeWidth="2" />
      </>),
      title: isBn ? 'বুকিং এখন সহজ' : 'Bookings made simple',
      desc: isBn
        ? 'এক জায়গা থেকে প্রতিটা বুকিং তৈরি, ম্যানেজ আর ট্র্যাক করুন।'
        : 'Create, manage and track every booking from one clear place.',
    },
    {
      icon: icon(<>
        <path d="M8 34V6h16v28" stroke={NAVY} strokeWidth="2" strokeLinejoin="round" />
        <path d="M24 20h10m0 0-4-4m4 4-4 4" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>),
      title: isBn ? 'দ্রুত চেক-ইন ও চেক-আউট' : 'Faster check-in and check-out',
      desc: isBn
        ? 'অতিথিকে দ্রুত বরণ করুন, ওয়াক-ইন সামলান, আর নিশ্চিন্তে থাকা শেষ করুন।'
        : 'Welcome guests quickly, handle walk-ins, and close stays with confidence.',
    },
    {
      icon: icon(<>
        <rect x="5" y="16" width="12" height="18" rx="2" stroke={NAVY} strokeWidth="2" />
        <rect x="23" y="8" width="12" height="26" rx="2" stroke={NAVY} strokeWidth="2" />
      </>),
      title: isBn ? 'রুম ও হাউসকিপিং' : 'Room and housekeeping control',
      desc: isBn
        ? 'কোন রুম প্রস্তুত, দখলে, পরিষ্কার হচ্ছে বা নজর দরকার — সবসময় জানুন।'
        : 'Always know which rooms are ready, occupied, cleaning, or need attention.',
    },
    {
      icon: icon(<>
        <rect x="4" y="8" width="32" height="24" rx="3" stroke={NAVY} strokeWidth="2" />
        <line x1="4" y1="15" x2="36" y2="15" stroke={NAVY} strokeWidth="2" />
        <circle cx="9" cy="11.5" r="1.4" fill={NAVY} />
        <circle cx="14" cy="11.5" r="1.4" fill={NAVY} />
      </>),
      title: isBn ? 'নিজের বুকিং ওয়েবসাইট' : 'Your own booking website',
      desc: isBn
        ? 'অতিথিরা আপনার রিসোর্টের ওয়েবসাইট থেকেই খালি রুম দেখে সরাসরি বুক করতে পারবেন।'
        : 'Let guests check availability and book directly from your resort website.',
    },
    {
      icon: icon(<>
        <circle cx="20" cy="14" r="7" stroke={NAVY} strokeWidth="2" />
        <path d="M6 34c0-8 6-12 14-12s14 4 14 12" stroke={NAVY} strokeWidth="2" />
      </>),
      title: isBn ? 'গেস্ট হিস্ট্রি ও CRM' : 'Guest history and CRM',
      desc: isBn
        ? 'প্রতিটি অতিথি, তাঁদের থাকা, পছন্দ আর বুকিংয়ের ইতিহাস মনে রাখুন।'
        : 'Remember every guest, their stays, preferences, and booking history.',
    },
    {
      icon: icon(<>
        <rect x="4" y="9" width="32" height="22" rx="3" stroke={NAVY} strokeWidth="2" />
        <line x1="4" y1="16" x2="36" y2="16" stroke={NAVY} strokeWidth="2" />
      </>),
      title: isBn ? 'পেমেন্ট ও ইনভয়েস' : 'Payments and invoices',
      desc: isBn
        ? 'কাগজপত্রের পেছনে না ছুটে পেমেন্ট, বাকি আর ইনভয়েস ট্র্যাক করুন।'
        : 'Track payments, balances and invoices without chasing paperwork.',
    },
    {
      icon: icon(<>
        <path d="M12 6v12a4 4 0 0 0 8 0V6" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="18" x2="16" y2="34" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
        <path d="M28 6c-3 3-3 12 0 12v16" stroke={NAVY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>),
      title: isBn ? 'রেস্টুরেন্ট ও খাবারের অর্ডার' : 'Restaurant and food orders',
      desc: isBn
        ? 'প্রতিদিনের রিসোর্ট কাজের পাশাপাশি রেস্টুরেন্টের অর্ডারও সামলান।'
        : 'Manage restaurant orders alongside your daily resort operations.',
    },
    {
      icon: icon(<>
        <line x1="6" y1="34" x2="34" y2="34" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
        <rect x="9" y="20" width="6" height="12" rx="1.5" stroke={NAVY} strokeWidth="2" />
        <rect x="18" y="12" width="6" height="20" rx="1.5" stroke={NAVY} strokeWidth="2" />
        <rect x="27" y="24" width="6" height="8" rx="1.5" stroke={NAVY} strokeWidth="2" />
      </>),
      title: isBn ? 'প্রতিদিনের ব্যবসার রিপোর্ট' : 'Daily business reports',
      desc: isBn
        ? 'অকুপেন্সি, আগমন, প্রস্থান, পেমেন্ট আর পারফরম্যান্স এক নজরে দেখুন।'
        : 'See occupancy, arrivals, departures, payments and performance at a glance.',
    },
    {
      icon: icon(<>
        <rect x="5" y="5" width="13" height="13" rx="2" stroke={NAVY} strokeWidth="2" />
        <rect x="22" y="5" width="13" height="13" rx="2" stroke={NAVY} strokeWidth="2" />
        <rect x="5" y="22" width="13" height="13" rx="2" stroke={NAVY} strokeWidth="2" />
        <rect x="22" y="22" width="13" height="13" rx="2" stroke={NAVY} strokeWidth="2" />
      </>),
      title: isBn ? 'এক টিম, এক ড্যাশবোর্ড' : 'One team, one dashboard',
      desc: isBn
        ? 'ফ্রন্ট ডেস্ক, রুম, স্টাফ, মেইনটেন্যান্স আর অপারেশন — সব একসাথে যুক্ত রাখুন।'
        : 'Keep front desk, rooms, staff, maintenance and operations connected.',
    },
  ];

  const pricingTiers = [
    {
      name: isBn ? 'ইন্ডিপেন্ডেন্ট রিসোর্ট' : 'Independent Resort',
      subtext: isBn ? 'একটি রিসোর্টের জন্য' : 'For one resort',
    },
    {
      name: isBn ? 'রিসোর্ট গ্রুপ' : 'Resort Group',
      subtext: isBn ? 'বেড়ে ওঠা টিমের জন্য' : 'For growing teams',
    },
    {
      name: isBn ? 'এন্টারপ্রাইজ / কাস্টম' : 'Enterprise / Custom',
      subtext: isBn ? 'একাধিক প্রপার্টির জন্য' : 'For multiple properties',
    },
  ];

  return (
    <main id="top" className="min-w-0 overflow-x-hidden bg-white font-sans text-[#14314D]">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b bg-white" style={{ borderColor: BORDER }}>
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ResortPro home">
            <BrandMark />
            <span className="text-lg font-extrabold tracking-[-0.02px]">ResortPro</span>
          </Link>

          <div className="hidden items-center gap-9 lg:flex">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="text-[15px] font-semibold hover:opacity-70">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-6 lg:flex">
            {isBn ? (
              <Link
                href="/"
                onClick={() => { document.cookie = 'locale=en; path=/; max-age=31536000; SameSite=Lax'; }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-black/[.03]"
                style={{ borderColor: BORDER }}
                title="Switch to English"
              >
                <span className="text-sm">🇬🇧</span>
                <span>English</span>
              </Link>
            ) : (
              <Link
                href="/bn"
                onClick={() => { document.cookie = 'locale=bn; path=/; max-age=31536000; SameSite=Lax'; }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-black/[.03]"
                style={{ borderColor: BORDER }}
                title="Switch to বাংলা"
              >
                <span className="text-sm">🇧🇩</span>
                <span>বাংলা</span>
              </Link>
            )}
            <Link href="/auth/login" className="text-[15px] font-semibold">
              {isBn ? 'লগ ইন' : 'Sign in'}
            </Link>
            <Link href="/auth/register" className="text-[15px] font-semibold" style={{ color: NAVY }}>
              {isBn ? 'সাইন আপ' : 'Sign up'}
            </Link>
            <Link
              href="/try"
              className="rounded-lg px-6 py-3 text-[15px] font-bold text-white transition-colors"
              style={{ background: GOLD }}
              onMouseEnter={(e) => { e.currentTarget.style.background = GOLD_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = GOLD; }}
            >
              {tryLabel}
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg border p-2 lg:hidden"
            style={{ borderColor: BORDER }}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t bg-white px-5 py-5 lg:hidden" style={{ borderColor: BORDER }}>
            <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href} onClick={() => setMenuOpen(false)} className="font-bold">
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex items-center gap-3">
                {isBn ? (
                  <Link
                    href="/"
                    onClick={() => { document.cookie = 'locale=en; path=/; max-age=31536000; SameSite=Lax'; }}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"
                    style={{ borderColor: BORDER }}
                  >
                    <span>🇬🇧</span><span>English</span>
                  </Link>
                ) : (
                  <Link
                    href="/bn"
                    onClick={() => { document.cookie = 'locale=bn; path=/; max-age=31536000; SameSite=Lax'; }}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"
                    style={{ borderColor: BORDER }}
                  >
                    <span>🇧🇩</span><span>বাংলা</span>
                  </Link>
                )}
                <Link href="/auth/login" className="text-sm font-bold">{isBn ? 'লগ ইন' : 'Sign in'}</Link>
                <Link href="/auth/register" className="text-sm font-bold" style={{ color: NAVY }}>{isBn ? 'সাইন আপ' : 'Sign up'}</Link>
              </div>
              <Link
                href="/try"
                className="mt-2 rounded-lg px-6 py-3 text-center text-sm font-bold text-white"
                style={{ background: GOLD }}
              >
                {tryLabel}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO
          A dark band, centred, one button, and the dashboard shot starting
          inside it and running past its lower edge into the section below.
          The overlap is the whole idea: the page opens on the product rather
          than on a column of text beside it. */}
      <section className="relative" style={{ background: NAVY }}>
        <div className="mx-auto max-w-[820px] px-5 pt-20 text-center sm:px-8 sm:pt-28">
          <span className="font-bitcount text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: GOLD }}>
            {isBn ? 'বাংলাদেশ ও দক্ষিণ এশিয়ার রিসোর্ট মালিকদের জন্য' : 'For resort owners in Bangladesh & South Asia'}
          </span>
          <h1 className="mt-5 text-[clamp(2.3rem,5vw,3.3rem)] font-extrabold leading-[1.15] text-white">
            {isBn ? 'প্রতিদিনের ঝামেলা ছাড়াই আপনার রিসোর্ট চালান।' : 'Run your resort without the daily confusion.'}
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-lg leading-[1.6] text-white/70">
            {isBn
              ? 'রুম, বুকিং, গেস্ট আর পেমেন্ট — সবকিছু এক জায়গা থেকে সহজে ম্যানেজ করুন। কোনো খাতা না, এক্সেলের ঝামেলা না, কোনো বুকিং মিস না।'
              : 'Manage rooms, bookings, guests and payments in one simple place. No notebook, no Excel mess, no missed booking.'}
          </p>

          {/* One button. A second one of equal weight asks a visitor to choose
              before they know enough to choose; the quiet link below does not. */}
          <div className="mt-9 flex flex-col items-center gap-4">
            <Link
              href="/try"
              className="rounded-lg px-9 py-4 text-[17px] font-bold text-white transition-colors"
              style={{ background: GOLD }}
              onMouseEnter={(e) => { e.currentTarget.style.background = GOLD_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = GOLD; }}
            >
              {tryLabel}
            </Link>
            <a href="#features" className="text-sm font-bold text-white/70 underline-offset-4 hover:text-white hover:underline">
              {isBn ? 'কী কী আছে দেখুন' : 'See what it does'}
            </a>
            {launchOfferActive && (
              <span className="font-bitcount text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: GOLD }}>
                {isBn ? 'লঞ্চ অফার: ৩ মাস ফ্রি' : 'Launch offer: 3 months free'}
              </span>
            )}
          </div>
        </div>

        {/* The screenshot sits in the hero and hangs below it. The spacer under
            it is the part that hangs over, so the next section starts behind
            the image instead of after it. */}
        <div className="mx-auto mt-14 max-w-[1040px] px-5 sm:px-8">
          <div className="relative -mb-[22%] overflow-hidden rounded-2xl shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] sm:-mb-[16%]">
            <Image
              src="/brand/hero-dashboard-preview.png"
              alt={isBn ? 'ResortPro ড্যাশবোর্ড — আজকের বুকিং, রুম ও আয় এক নজরে' : "ResortPro dashboard — today's bookings, rooms, and revenue at a glance"}
              width={1200}
              height={720}
              priority
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* SOLUTION / FEATURES */}
      <section id="features" className="pb-20 pt-[26%] sm:pb-24 sm:pt-[20%]">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <h2 className="text-center text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold">
            {isBn ? 'আমাদের ফিচার' : 'Our features'}
          </h2>
          <p className="mt-4 text-center text-lg" style={{ color: MUTED }}>
            {isBn
              ? 'রিসোর্ট চালাতে যা যা লাগে — প্রতিদিনের ঝামেলা ছাড়াই।'
              : 'Everything you need to run your resort — without the daily chaos.'}
          </p>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl p-7" style={{ background: CREAM }}>
                {f.icon}
                <h3 className="mt-5 text-xl font-extrabold">{f.title}</h3>
                <p className="mt-2.5 text-[15px] leading-[1.6]" style={{ color: MUTED }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* The one thing here that is not a list of modules. It used to be a
              section of its own with its own heading, which gave a single
              feature the same weight as the whole product. */}
          <div className="mx-auto mt-14 grid max-w-[900px] gap-8 rounded-2xl p-8 lg:grid-cols-2 lg:items-center" style={{ background: CREAM }}>
            <div>
              <h3 className="text-xl font-extrabold leading-[1.4]">
                {isBn ? 'প্রশ্ন আছে? শুধু জিজ্ঞেস করুন।' : 'Have a question? Just ask.'}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.6]" style={{ color: MUTED }}>
                {isBn
                  ? 'বুকিং, রুম আর গেস্ট নিয়ে প্রশ্নের উত্তর সহজ ভাষায় — মেনুতে খোঁজাখুঁজি লাগে না।'
                  : 'Answers about your bookings, rooms and guests in plain language — no searching through menus.'}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="self-end max-w-[85%] rounded-xl px-4 py-3 text-[15px] text-white" style={{ background: NAVY }}>
                {isBn ? 'আজ রাতে কোন রুম খালি আছে?' : 'Which rooms are free tonight?'}
              </div>
              <div className="self-start max-w-[85%] rounded-xl border bg-white px-4 py-3 text-[15px]" style={{ borderColor: BORDER }}>
                {isBn ? 'আজ রাতে ৬টা রুম খালি — ৩টা ডাবল, ৩টা ফ্যামিলি।' : 'Six rooms free tonight — 3 doubles, 3 family.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-20 sm:py-24">
        {/* One resort owner saying one thing beats four bullets claiming it.
            "No technical experience needed", "your data stays private" and the
            other two were assertions about ourselves; this is not. */}
        <div className="mx-auto max-w-[1240px] px-5 text-center sm:px-8">
          <div className="mx-auto flex max-w-[640px] items-center gap-5 rounded-2xl p-8 text-left" style={{ background: CREAM }}>
            <span
              className="flex h-16 w-16 flex-none items-center justify-center rounded-full font-bitcount text-lg font-bold"
              style={{ background: GOLD, color: '#fff' }}
            >
              FA
            </span>
            <div>
              <p className="text-lg font-bold leading-[1.5]">
                {isBn
                  ? '“এখন সবাইকে ফোন না করেই আমি আমার বুকিং আর রুম দেখতে পারি।”'
                  : '“I can now see my bookings and rooms without calling everyone.”'}
              </p>
              <span className="mt-3 block text-sm font-bold" style={{ color: MUTED_LIGHT }}>
                {isBn ? 'ফারহানা আক্তার — সানরাইজ রিসোর্ট, কক্সবাজার' : "Farhana Akter — Sunrise Resort, Cox's Bazar"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section id="pricing" className="py-20 sm:py-24" style={{ background: CREAM }}>
        <div className="mx-auto max-w-[1240px] px-5 text-center sm:px-8">
          <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold">
            {isBn ? 'সহজভাবে শুরু করুন। প্রয়োজন হলে বাড়ান।' : 'Start simple. Grow when you need more.'}
          </h2>
          <p className="mt-4 text-lg" style={{ color: MUTED }}>
            {isBn
              ? 'যখন প্রস্তুত, তখন মার্কেটিং, লয়্যালটি ও আরও প্রপার্টি যোগ করুন।'
              : "Add marketing, loyalty and more properties whenever you're ready."}
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {pricingTiers.map((tier) => (
              <div key={tier.name} className="rounded-2xl border bg-white px-6 py-10" style={{ borderColor: BORDER }}>
                <p className="text-lg font-extrabold">{tier.name}</p>
                <p className="mt-1.5 text-sm font-semibold" style={{ color: MUTED }}>{tier.subtext}</p>
              </div>
            ))}
          </div>
          <Link
            href="/plans"
            className="mt-12 inline-block rounded-lg px-8 py-4 text-[17px] font-bold text-white transition-colors"
            style={{ background: NAVY }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0D2337'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = NAVY; }}
          >
            {isBn ? 'সহজ প্রাইসিং দেখুন' : 'See simple pricing'}
          </Link>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 text-center sm:py-24" style={{ background: NAVY }}>
        <div className="mx-auto max-w-[720px] px-5 sm:px-8">
          <h2 className="text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold leading-[1.3] text-white">
            {isBn
              ? 'ঝামেলা সামলাতে কম সময় দিন। গেস্টদের স্বাগত জানাতে বেশি সময় দিন।'
              : 'Spend less time managing confusion. Spend more time welcoming guests.'}
          </h2>
          <p className="mt-4 text-lg leading-[1.6] text-white/75">
            {isBn
              ? 'ResortPro ব্যবহার করে দেখুন, এক জায়গা থেকেই আপনার রিসোর্ট স্পষ্টভাবে দেখুন।'
              : 'Try ResortPro and see your resort clearly from one place.'}
          </p>
          <Link
            href="/try"
            className="mt-9 inline-flex items-center gap-2 rounded-lg px-9 py-4 text-[17px] font-bold text-white transition-colors"
            style={{ background: GOLD }}
            onMouseEnter={(e) => { e.currentTarget.style.background = GOLD_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = GOLD; }}
          >
            {tryLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-6 px-5 py-10 sm:flex-row sm:justify-between sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-base font-extrabold">ResortPro</span>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-semibold" style={{ color: MUTED }}>
            <Link href="/plans">{isBn ? 'প্রাইসিং' : 'Pricing'}</Link>
            <Link href="/privacy">{isBn ? 'গোপনীয়তা' : 'Privacy'}</Link>
            <Link href="/terms">{isBn ? 'শর্তাবলী' : 'Terms'}</Link>
            <Link href="/auth/login">{isBn ? 'লগ ইন' : 'Sign in'}</Link>
          </div>
        </div>
        <div className="border-t px-5 py-6 text-center text-xs sm:px-8" style={{ borderColor: BORDER, color: MUTED_LIGHT }}>
          © 2026 ResortPro.
        </div>
      </footer>
    </main>
  );
}
