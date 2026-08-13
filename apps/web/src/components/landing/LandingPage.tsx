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
    { label: isBn ? 'কীভাবে কাজ করে' : 'How it works', href: '#how' },
    { label: isBn ? 'ফিচার' : 'Features', href: '#features' },
    { label: isBn ? 'প্রাইসিং' : 'Pricing', href: '#pricing' },
  ];

  const tryLabel = isBn ? 'ResortPro ব্যবহার করে দেখুন' : 'Try ResortPro';

  const problems = [
    {
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="12" y="4" width="16" height="32" rx="3" stroke={NAVY} strokeWidth="2" />
          <circle cx="20" cy="30" r="1.5" fill={NAVY} />
        </svg>
      ),
      text: isBn ? 'কল আর মেসেজে বুকিং ডিটেইলস হারিয়ে যায়' : 'Booking details are lost in calls and messages',
    },
    {
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="6" y="6" width="28" height="28" rx="3" stroke={NAVY} strokeWidth="2" />
          <line x1="6" y1="14" x2="34" y2="14" stroke={NAVY} strokeWidth="2" />
        </svg>
      ),
      text: isBn ? 'কোন রুম খালি আছে সবসময় জানা থাকে না' : 'You do not always know which room is available',
    },
    {
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="7" y="10" width="26" height="22" rx="2" stroke={NAVY} strokeWidth="2" />
          <line x1="7" y1="17" x2="33" y2="17" stroke={NAVY} strokeWidth="2" />
        </svg>
      ),
      text: isBn ? 'গেস্ট পেমেন্ট আর হিসাব গুলিয়ে যায়' : 'Guest payments and records become confusing',
    },
  ];

  const features = [
    {
      icon: (
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
          <rect x="5" y="16" width="12" height="18" rx="2" stroke={NAVY} strokeWidth="2" />
          <rect x="23" y="8" width="12" height="26" rx="2" stroke={NAVY} strokeWidth="2" />
        </svg>
      ),
      title: isBn ? 'রুম ও হাউসকিপিং' : 'Rooms & housekeeping',
      desc: isBn
        ? 'খালি, দখলকৃত ও পরিষ্কারের রুম দেখুন, এক ট্যাপে চেক-ইন/চেক-আউট করুন।'
        : 'See available, occupied and cleaning rooms, and check guests in or out in one tap.',
    },
    {
      icon: (
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="10" width="32" height="24" rx="3" stroke={NAVY} strokeWidth="2" />
          <line x1="4" y1="18" x2="36" y2="18" stroke={NAVY} strokeWidth="2" />
          <line x1="12" y1="6" x2="12" y2="14" stroke={NAVY} strokeWidth="2" />
          <line x1="28" y1="6" x2="28" y2="14" stroke={NAVY} strokeWidth="2" />
        </svg>
      ),
      title: isBn ? 'বুকিং' : 'Bookings',
      desc: isBn
        ? 'কল, ওয়াক-ইন বা নিজের ওয়েবসাইট থেকে মিনিটে বুকিং তৈরি ও ম্যানেজ করুন।'
        : 'Create and manage bookings in minutes — from calls, walk-ins or your own website.',
    },
    {
      icon: (
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="14" r="7" stroke={NAVY} strokeWidth="2" />
          <path d="M6 34c0-8 6-12 14-12s14 4 14 12" stroke={NAVY} strokeWidth="2" />
        </svg>
      ),
      title: isBn ? 'গেস্ট' : 'Guests',
      desc: isBn
        ? 'গেস্টের তথ্য, ডকুমেন্ট ও থাকার ইতিহাস এক জায়গায় রাখুন।'
        : 'Keep guest details, documents and stay history together.',
    },
    {
      icon: (
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="9" width="32" height="22" rx="3" stroke={NAVY} strokeWidth="2" />
          <line x1="4" y1="16" x2="36" y2="16" stroke={NAVY} strokeWidth="2" />
        </svg>
      ),
      title: isBn ? 'পেমেন্ট' : 'Payments',
      desc: isBn
        ? 'ইনভয়েস, পেমেন্ট ও আয় স্বয়ংক্রিয়ভাবে ট্র্যাক করুন।'
        : 'Track invoices, payments and revenue automatically.',
    },
  ];

  const steps = [
    isBn ? 'আপনার রুম যোগ করুন' : 'Add your rooms',
    isBn ? 'বুকিং নেওয়া শুরু করুন' : 'Start taking bookings',
    isBn ? 'স্বচ্ছতার সাথে রিসোর্ট চালান' : 'Run your resort with clarity',
  ];

  const trustBullets = [
    isBn ? 'কোনো টেকনিক্যাল অভিজ্ঞতা লাগবে না' : 'No technical experience needed',
    isBn ? 'কম্পিউটার বা ফোন যেকোনো জায়গা থেকে ব্যবহার করুন' : 'Use it from your computer or phone',
    isBn ? 'আপনার রিসোর্টের তথ্য থাকে সম্পূর্ণ গোপন' : 'Your resort data stays private',
    isBn ? 'প্রয়োজনে বন্ধুত্বপূর্ণ সাপোর্ট পাবেন' : 'Friendly support when you need help',
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

      {/* HERO */}
      <section className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
        <div className="min-w-0">
          <Eyebrow>{isBn ? 'বাংলাদেশ ও দক্ষিণ এশিয়ার রিসোর্ট মালিকদের জন্য' : 'For resort owners in Bangladesh & South Asia'}</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.6rem,5.5vw,3.5rem)] font-extrabold leading-[1.12]">
            {isBn ? 'প্রতিদিনের ঝামেলা ছাড়াই আপনার রিসোর্ট চালান।' : 'Run your resort without the daily confusion.'}
          </h1>
          <p className="mt-5 max-w-[520px] text-lg leading-[1.6]" style={{ color: MUTED }}>
            {isBn
              ? 'রুম, বুকিং, গেস্ট আর পেমেন্ট — সবকিছু এক জায়গা থেকে সহজে ম্যানেজ করুন। কোনো খাতা না, এক্সেলের ঝামেলা না, কোনো বুকিং মিস না।'
              : 'Manage rooms, bookings, guests and payments in one simple place. No notebook, no Excel mess, no missed booking.'}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/try"
              className="rounded-lg px-8 py-4 text-[17px] font-bold text-white transition-colors"
              style={{ background: GOLD }}
              onMouseEnter={(e) => { e.currentTarget.style.background = GOLD_HOVER; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = GOLD; }}
            >
              {tryLabel}
            </Link>
            <a
              href="#how"
              className="rounded-lg border-2 px-8 py-4 text-[17px] font-bold transition-colors hover:bg-black/[.03]"
              style={{ borderColor: NAVY }}
            >
              {isBn ? 'কীভাবে কাজ করে দেখুন' : 'See how it works'}
            </a>
            {launchOfferActive && (
              <span className="font-bitcount text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: GOLD }}>
                · {isBn ? 'লঞ্চ অফার: ৩ মাস ফ্রি' : 'Launch offer: 3 months free'}
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-2xl shadow-[0_24px_60px_-20px_rgba(20,49,77,0.3)]">
            <Image
              src="/brand/hero-dashboard-preview.png"
              alt={isBn ? 'ResortPro ড্যাশবোর্ড — আজকের বুকিং, রুম ও আয় এক নজরে' : "ResortPro dashboard — today's bookings, rooms, and revenue at a glance"}
              width={1200}
              height={720}
              priority
              className="h-auto w-full object-cover"
            />
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x overflow-hidden rounded-xl border text-center" style={{ borderColor: BORDER }}>
            {[
              isBn ? 'আজকের বুকিং' : "Today's bookings",
              isBn ? 'খালি রুম' : 'Available rooms',
              isBn ? 'আজকের আয়' : 'Revenue today',
            ].map((label) => (
              <span key={label} className="px-2 py-3 text-[11px] font-bold uppercase tracking-[0.06em] sm:text-xs" style={{ borderColor: BORDER }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-20 sm:py-24" style={{ background: CREAM }}>
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <h2 className="mx-auto max-w-[700px] text-center text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-[1.3]">
            {isBn
              ? 'রিসোর্ট চালানো এমনিতেই কঠিন। এটা ম্যানেজ করা কঠিন হওয়া উচিত না।'
              : 'Running a resort is already hard. Managing it should not be.'}
          </h2>
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {problems.map((p) => (
              <div key={p.text} className="rounded-2xl border bg-white p-8" style={{ borderColor: BORDER }}>
                {p.icon}
                <p className="mt-5 text-lg font-bold leading-[1.5]">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION / FEATURES */}
      <section id="features" className="py-20 sm:py-24">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <h2 className="text-center text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold">
            {isBn ? 'আপনার প্রতিদিনের রিসোর্ট কাজের জন্য এক জায়গা।' : 'One place for your daily resort work.'}
          </h2>
          <p className="mt-4 text-center text-lg" style={{ color: MUTED }}>
            {isBn ? 'ফ্রন্ট ডেস্কের যা যা লাগে, ঠিক ততটুকুই — বাড়তি কিছু না।' : "Everything a front desk needs — nothing you don't."}
          </p>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl p-7" style={{ background: CREAM }}>
                {f.icon}
                <h3 className="mt-5 text-xl font-extrabold">{f.title}</h3>
                <p className="mt-2.5 text-[15px] leading-[1.6]" style={{ color: MUTED }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 sm:py-24" style={{ background: CREAM }}>
        <div className="mx-auto max-w-[900px] px-5 text-center sm:px-8">
          <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold">
            {isBn ? 'প্রথম দিন থেকেই সহজ।' : 'Simple from day one.'}
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step}>
                <div className="font-bitcount text-4xl font-normal" style={{ color: GOLD }}>{index + 1}</div>
                <p className="mt-3 text-lg font-bold">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHAT HELPER */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-[900px] gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-[1.3]">
              {isBn ? 'প্রশ্ন আছে? শুধু জিজ্ঞেস করুন।' : 'Have a question? Just ask.'}
            </h2>
            <p className="mt-5 text-lg leading-[1.6]" style={{ color: MUTED }}>
              {isBn
                ? 'ResortPro-এর ভেতরেই একটা সহজ চ্যাট হেল্পার আছে যা আপনার বুকিং, রুম আর গেস্ট নিয়ে প্রশ্নের সহজ ভাষায় উত্তর দেয় — কোনো ম্যানুয়াল পড়া বা মেনুতে খোঁজাখুঁজি লাগে না।'
                : 'A simple chat helper inside ResortPro answers questions about your bookings, rooms and guests in plain language — no manuals, no searching through menus.'}
            </p>
          </div>
          <div className="flex flex-col gap-3.5 rounded-2xl p-7" style={{ background: CREAM }}>
            <div className="self-end max-w-[85%] rounded-xl px-4.5 py-3.5 text-[15px] text-white" style={{ background: NAVY }}>
              {isBn ? 'আজ রাতে কোন রুম খালি আছে?' : 'Which rooms are free tonight?'}
            </div>
            <div className="self-start max-w-[85%] rounded-xl border bg-white px-4.5 py-3.5 text-[15px]" style={{ borderColor: BORDER }}>
              {isBn ? 'আজ রাতে আপনার ৬টা রুম খালি আছে — ৩টা ডাবল আর ৩টা ফ্যামিলি রুম।' : 'You have 6 rooms free tonight — 3 doubles and 3 family rooms.'}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST + TESTIMONIAL */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-[1240px] px-5 text-center sm:px-8">
          <h2 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold">
            {isBn ? 'প্রকৃত রিসোর্ট মালিকদের জন্য তৈরি।' : 'Built for real resort owners.'}
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {trustBullets.map((b) => (
              <div key={b} className="flex flex-col items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: NAVY }} />
                <p className="text-[15px] font-bold leading-[1.4]">{b}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-14 flex max-w-[640px] items-center gap-5 rounded-2xl p-8 text-left" style={{ background: CREAM }}>
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
              ? 'যখন প্রস্তুত, তখন মার্কেটিং, লয়্যালটি ও মাল্টি-প্রপার্টি টুলস যোগ করুন।'
              : "Add marketing, loyalty and multi-property tools whenever you're ready."}
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
