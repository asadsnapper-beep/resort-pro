'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Menu, X } from 'lucide-react';
import { PLAN_PRICING, PUBLIC_PLAN_ORDER } from '@resort-pro/types';

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

function AvailabilityBoard({ isBn = false }: { isBn?: boolean }) {
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
          <p className="m-0 text-sm font-extrabold text-[#183153]">
            {isBn ? 'পাম হাউস' : 'Palm House'}
          </p>
          <p className="mt-1 text-xs text-[#64748b]">
            {isBn ? 'বৃহস্পতিবার, ১৪ আগস্ট' : 'Thursday, 14 August'}
          </p>
        </div>
        <span className="font-bitcount bg-[#ef725c] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white">
          {isBn ? 'শুক্রবার আগমন' : 'Friday arrivals'}
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
              [isBn ? 'অবস্থানরত' : 'Staying', 'bg-[#183153]'],
              [isBn ? 'আজকের আগমন' : 'Arriving', 'bg-[#ef725c]'],
              [isBn ? 'হোল্ডকৃত' : 'Held', 'bg-[#f4c76b]'],
              [isBn ? 'ফ্রি' : 'Open', 'bg-[#e5f0f7]'],
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
          ['87%', isBn ? 'রুম বুকড' : 'Rooms filled', 'text-[#183153]'],
          [isBn ? '৳১৩.৫k' : '৳13.5k', isBn ? 'আজকের মোট' : 'Taken today', 'text-[#183153]'],
          ['14', isBn ? 'আজকের আগমন' : 'Arrivals', 'text-[#ef725c]'],
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
        <strong className="text-[#183153]">
          {isBn ? 'নতুন বুকিং পাওয়া গেছে ৳১৩,৫০০' : 'Booking received ৳13,500'}
        </strong>{' '}
        · {isBn ? 'এখনই' : 'just now'}
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

export function LandingPage({ isBn = false }: { isBn?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const navLinks = [
    { label: isBn ? 'ফিচার' : 'Product', href: '#product' },
    { label: isBn ? 'কীভাবে কাজ করে' : 'How it works', href: '#how-it-works' },
    { label: isBn ? 'প্রাইসিং' : 'Pricing', href: '#pricing' },
    { label: isBn ? 'ডেস্কটপ অ্যাপ' : 'Desktop app', href: '#desktop-app' },
  ];

  const faqs = [
    [
      isBn ? 'কার্ড ছাড়াই কি ট্রায়াল শুরু করা যাবে?' : 'Can I start without a card?',
      isBn
        ? 'হ্যাঁ। কোনো ক্রেডিট কার্ড ছাড়াই ফ্রেশ ড্যাশবোর্ড তৈরি করে প্রথম পেমেন্টের আগেই সব ফিচার ব্যবহার করে দেখুন।'
        : 'Yes. Create your resort workspace, choose a plan, and explore the full operational toolkit before your first payment.',
    ],
    [
      isBn ? 'ResortPro কি রেস্তোরাঁ ও কিচেনেও কাজ করবে?' : 'Does ResortPro work for restaurants too?',
      isBn
        ? 'হ্যাঁ। রেস্তোরাঁ ও রুম-সার্ভিসের অর্ডারগুলো রুম ফোলিও ও বুকিংয়ের সাথে স্বয়ংক্রিয়ভাবে যুক্ত থাকে।'
        : 'Yes. Restaurant and room-service orders sit beside bookings and guest folios, so the day stays connected.',
    ],
    [
      isBn ? 'অতিথিরা কি সরাসরি আমার ওয়েবসাইট থেকে বুক করতে পারবে?' : 'Can guests book directly from my own website?',
      isBn
        ? 'হ্যাঁ। কাস্টম ডাইরেক্ট লিংক শেয়ার করতে পারেন অথবা আপনার বিদ্যমান সাইটে ৫ মিনিটে বুকিং ফর্ম বসিয়ে নিন।'
        : 'Yes. Publish a direct booking link or embed the live booking flow on your existing site.',
    ],
    [
      isBn ? 'আমাদের ৫টির বেশি প্রপার্টি থাকলে কীভাবে হ্যান্ডেল করব?' : 'What if I manage more than five properties?',
      isBn
        ? 'আমাদের এন্টারপ্রাইজ টিমের সাথে যোগাযোগ করুন। আমরা আপনার টিমের প্রয়োজন অনুযায়ী কাস্টম গ্রুপ প্ল্যান তৈরি করে দেব।'
        : 'Talk to our team. We will create a group plan with the onboarding, limits, and support your operation needs.',
    ],
  ];

  const planCards = [
    {
      key: 'FREE' as const,
      label: 'Solo',
      title: isBn
        ? 'ছোট প্রপার্টির জন্য প্রথম দিন থেকেই পারফেক্ট।'
        : 'Everything a small property needs, day one.',
      description: isBn
        ? 'বুকিং, ক্যালেন্ডার, ফ্রন্ট ডেস্কে গেস্ট হিস্ট্রি, ইনভয়েস ও ফ্রি ডাইরেক্ট পেজ।'
        : 'Bookings, calendar, front desk, guest history, invoices, and a direct booking page.',
      features: [
        isBn ? '১টি প্রপার্টি · ৫টি রুম · ২ জন স্টাফ' : '1 property · 5 rooms · 2 staff',
        isBn ? 'বুকিং, গেস্ট ও ইনভয়েস ম্যানেজমেন্ট' : 'Bookings, guests & invoices',
        isBn ? 'আনলিমিটেড ডাটা এক্সপোর্ট' : 'Full data export, always',
      ],
    },
    {
      key: 'STARTER' as const,
      label: isBn ? 'ইন্ডিপেন্ডেন্ট রিসোর্ট' : 'Independent Resort',
      title: isBn
        ? 'একটি প্রপার্টি ফুল স্কেলে চালানোর সব কিছু।'
        : 'Everything you need to run one property, fully.',
      description: isBn
        ? 'কাস্টম ডোমেইন, সিআরএম, রেস্তোরাঁ ও অল-ইন-ওয়ান অপারেশনাল মডিউল।'
        : 'Your own domain, CRM, restaurant, and every operational module.',
      features: [
        isBn ? '১টি প্রপার্টি · ২০টি রুম · ২০ জন স্টাফ' : '1 property · 20 rooms · 20 staff',
        isBn ? 'কাস্টম ডোমেইন ও অনলাইন পেমেন্ট' : 'Custom domain & online payments',
        isBn ? 'সিআরএম, রেস্তোরাঁ ও হাউসকিপিং মডিউল' : 'CRM, restaurant, housekeeping & more',
      ],
      featured: true,
    },
    {
      key: 'PROFESSIONAL' as const,
      label: isBn ? 'রিসোর্ট গ্রুপ' : 'Resort Group',
      title: isBn
        ? 'আপনার সব প্রপার্টির এক জায়গায় রিয়েল-টাইম তথ্য।'
        : 'One view across every property you run.',
      description: isBn
        ? 'একাধিক রিসোর্ট ও প্রপার্টি পরিচালনাকারী মালিকদের জন্য।'
        : 'For owners managing more than one property.',
      features: [
        isBn ? '৫টি প্রপার্টি পর্যন্ত · ২০০টি রুম' : 'Up to 5 properties · 200 rooms',
        isBn ? 'মাল্টি-প্রপার্টি ওনার ভিউ' : 'Multi-property owner view',
        isBn ? 'প্রাইওরিটি অনবোর্ডিং ও সাপোর্ট' : 'Priority onboarding & support',
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
            {isBn ? (
              <Link
                href="/"
                onClick={() => {
                  document.cookie = 'locale=en; path=/; max-age=31536000; SameSite=Lax';
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#183153]/20 px-3 py-1.5 text-xs font-bold text-[#183153] transition-all hover:bg-[#183153]/5"
                title="Switch to English"
              >
                <span className="text-sm">🇬🇧</span>
                <span>English</span>
              </Link>
            ) : (
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
            )}
            <Link href="/auth/login" className="text-sm font-bold">
              {isBn ? 'লগ ইন' : 'Log in'}
            </Link>
            <Link
              href="/plans"
              className="bg-[#183153] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#ef725c]"
            >
              {isBn ? 'প্ল্যান দেখুন' : 'See plans'}
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
                {isBn ? (
                  <Link
                    href="/"
                    onClick={() => {
                      document.cookie = 'locale=en; path=/; max-age=31536000; SameSite=Lax';
                    }}
                    className="flex items-center gap-1.5 border-2 border-[#183153] px-3 py-2 text-xs font-bold"
                  >
                    <span>🇬🇧</span>
                    <span>English</span>
                  </Link>
                ) : (
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
                )}
                <Link
                  href="/auth/login"
                  className="border-2 border-[#183153] px-4 py-2.5 text-sm font-bold"
                >
                  {isBn ? 'লগ ইন' : 'Log in'}
                </Link>
                <Link
                  href="/plans"
                  className="bg-[#183153] px-4 py-2.5 text-sm font-bold text-white"
                >
                  {isBn ? 'প্ল্যান দেখুন' : 'See plans'}
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="mx-auto grid min-w-0 max-w-[1240px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-20 lg:py-20">
        <div className="min-w-0">
          <Eyebrow>{isBn ? 'মডার্ন রিসোর্ট টিমের জন্য তৈরি' : 'Built for modern resort teams'}</Eyebrow>
          <h1 className="mt-8 max-w-[620px] text-[clamp(3.2rem,6vw,6.5rem)] font-extrabold leading-[.94] tracking-[-0.07em] text-[#183153]">
            {isBn ? 'আপনার রিসোর্ট পরিচালনা হোক সহজ ও সাশ্রয়ী।' : 'Let your resort feel effortless.'}
          </h1>
          <p className="mt-8 max-w-[540px] text-[17px] leading-8 text-[#64748b] sm:text-[19px]">
            {isBn
              ? 'বুকিং, পেমেন্ট, রুম এবং গেস্ট হিস্ট্রি — সব কিছু আপনার টিমের সুবিধার্থে একটি সুন্দর প্ল্যাটফর্মে।'
              : 'One beautifully simple place for every arrival, payment, room, and guest relationship—built around how your team actually works.'}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 bg-[#183153] px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-[#ef725c]"
            >
              {isBn ? 'ওয়ার্কস্পেস তৈরি করুন' : 'Build your workspace'} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/try"
              className="inline-flex items-center gap-2 border-2 border-[#183153] px-6 py-4 text-sm font-bold transition-colors hover:bg-[#fff1ea]"
            >
              {isBn ? 'লাইভ ডেমো দেখুন' : 'Explore the live demo'} <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[12px] font-semibold text-[#64748b]">
            {[
              isBn ? 'বিকাশ ও কার্ড পেমেন্ট বিল্ট-ইন' : 'bKash & cards built in',
              isBn ? 'যেকোনো সময় বাতিলযোগ্য' : 'Cancel anytime',
              isBn ? 'মাত্র কয়েক মিনিটে সেটআপ' : 'Setup in an afternoon',
            ].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <i className="h-2 w-2 bg-[#ef725c]" /> {item}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-w-0 border-2 border-[#183153] bg-white p-2 shadow-[8px_8px_0_#183153] sm:p-3">
          <Image
            src="/brand/hero-dashboard-preview.png"
            alt="ResortPro Dashboard Preview"
            width={1200}
            height={675}
            priority
            className="h-auto w-full border border-[#183153]/20 object-cover"
          />
        </div>
      </section>

      <section className="border-y-2 border-[#183153] bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-5 py-7 sm:px-8">
          <p className="max-w-[390px] text-sm leading-6 text-[#64748b]">
            {isBn
              ? 'যেসব রিসোর্ট মালিক কাগজের হিসাবের বদলে আধুনিক ফ্রন্ট ডেস্ক চান, তাদের জন্য।'
              : 'For the owners who want a front desk that feels personal, not paperwork.'}
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
          <Eyebrow>{isBn ? 'পুরো দিনের একটি রিয়েল-টাইম ছবি' : 'One live picture of the day'}</Eyebrow>
          <h2 className="mt-7 max-w-[470px] text-[clamp(2.9rem,4.5vw,5rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
            {isBn ? 'গেস্টের প্রতিটি মুহূর্ত, একই সূত্রে গাঁথা।' : 'Every guest moment, held together.'}
          </h2>
          <p className="mt-7 max-w-[430px] text-[17px] leading-8 text-[#64748b]">
            {isBn
              ? 'ResortPro কোনো জটিল ড্যাশবোর্ড নয়। এটি আপনার ডেস্ক, রেস্তোরাঁ ও টিমের জন্য একটি পরিষ্কার রিয়েল-টাইম চিত্র প্রকাশ করে।'
              : 'ResortPro is not another dashboard to babysit. It gives the people at your desk, restaurant, and back office the same live picture.'}
          </p>
        </div>
        <div className="grid border-l-2 border-t-2 border-[#183153] sm:grid-cols-2">
          <FeatureCard number="01" title={isBn ? 'সকালের প্রথম আপডেট' : 'The morning view'}>
            {isBn
              ? 'অতিথি আসার আগেই চেক-ইন, চেক-আউট ও প্রস্তুতি তালিকা হাতে পাওয়ার সুবিধা।'
              : 'Arrivals, departures, and the rooms that need attention—before the first guest reaches the desk.'}
          </FeatureCard>
          <FeatureCard number="02" title={isBn ? 'সহজ পেমেন্ট ব্যবস্থা' : 'The payment moment'} tone="peach">
            {isBn
              ? 'এডভান্স পেমেন্ট, বাকি হিসাব ও ইনভয়েস সরাসরি বুকিংয়ের সাথে সংযুক্ত।'
              : 'Deposits, balances, and invoices stay tied to the booking instead of disappearing into chat screenshots.'}
          </FeatureCard>
          <FeatureCard number="03" title={isBn ? 'গেস্টদের সাথে আন্তরিক সম্পর্ক' : 'The guest relationship'} tone="blue">
            {isBn
              ? 'রিটার্নিং গেস্টদের পছন্দ ও পুরো হিস্ট্রি সামনে ভেসে উঠে।'
              : 'A complete stay history makes every return guest feel remembered, not searched for.'}
          </FeatureCard>
          <FeatureCard number="04" title={isBn ? 'রুম প্রস্তুতি ও হাউসকিপিং' : 'The room turnover'}>
            {isBn
              ? 'হাউসকিপিং টিম সরাসরি দেখে কোন রুম রেডি আর কোনটা প্রস্তুত হচ্ছে।'
              : 'Housekeeping sees exactly what changed, what is ready, and what needs a closer look.'}
          </FeatureCard>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#183153] text-white">
        <div className="mx-auto grid max-w-[1240px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 lg:py-32">
          <div>
            <Eyebrow light>{isBn ? 'প্রথম ক্লিক থেকে প্রথম বুকিং' : 'From first click to first booking'}</Eyebrow>
            <h2 className="mt-8 max-w-[440px] text-[clamp(3rem,5vw,5.4rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
              {isBn ? 'নিজের সুবিধামতো সহজেই লাইভ হয়ে যান' : 'Go live without changing who you are.'}
            </h2>
          </div>
          <div className="border-t border-white/40">
            {[
              [
                '01',
                isBn ? 'নিজের মতো সাজান' : 'Make it yours',
                isBn ? 'আপনার রুম, রেট, সার্ভিস ও টিম যুক্ত করুন।' : 'Add your rooms, rates, team, and the details guests actually care about.',
              ],
              [
                '02',
                isBn ? 'ডাইরেক্ট বুকিং উইজেট চালু করুন' : 'Open the direct door',
                isBn ? 'সরাসরি ওয়েবসাইট বা সোশ্যাল মিডিয়ায় কাস্টম বুকিং লিংক শেয়ার করুন।' : 'Publish your booking link or place it inside your own website in minutes.',
              ],
              [
                '03',
                isBn ? 'টিমকে সাথে নিয়ে চালান' : 'Run the day together',
                isBn ? 'রিয়েল-টাইমে প্রতিটি পেমেন্ট ও অর্ডারের আপডেট পান।' : 'Every booking, payment, order, and room status stays live for the people who need it.',
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
            <p className="text-xl font-extrabold tracking-[-0.04em]">
              {isBn ? 'Palm House-এ রুম বুক করুন' : 'Book a stay at Palm House'}
            </p>
            <p className="mt-2 text-sm text-[#64748b]">
              {isBn ? 'কক্সবাজার · ১৪–১৭ আগস্ট' : 'Cox\'s Bazar · 14–17 August'}
            </p>
          </div>
          <div className="grid grid-cols-2 border-b-2 border-[#183153]">
            <div className="border-r-2 border-[#183153] p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                {isBn ? 'গার্ডেন রুম' : 'Garden room'}
              </p>
              <p className="font-bitcount mt-8 text-2xl">৳7,500</p>
            </div>
            <div className="bg-[#fff1ea] p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                {isBn ? 'ওশান সুইট' : 'Ocean suite'}
              </p>
              <p className="font-bitcount mt-8 text-2xl">৳12,000</p>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <button
              type="button"
              className="w-full bg-[#ef725c] px-5 py-4 text-left text-sm font-bold text-white transition-colors hover:bg-[#b2402c]"
            >
              {isBn ? 'আপনার পছন্দের রুমটি বেছে নিন' : 'Choose your room'}
            </button>
          </div>
        </div>
        <div>
          <Eyebrow>{isBn ? 'ডাইরেক্ট বুকিং হোক চমৎকার' : 'Your direct booking deserves better'}</Eyebrow>
          <h2 className="mt-7 max-w-[540px] text-[clamp(2.8rem,4.5vw,4.9rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
            {isBn
              ? 'চেক-ইনের আগেই শুরু হোক সেরা গেস্ট অভিজ্ঞতা।'
              : 'Your best guest experience starts before check-in.'}
          </h2>
          <p className="mt-7 max-w-[490px] text-[17px] leading-8 text-[#64748b]">
            {isBn
              ? 'আপনার রুমের সুবিধা ও অফারগুলোকে এমন একটি ডিজিটাল অভিজ্ঞতায় রূপান্তর করুন যা সরাসরি আপনার ব্র্যান্ডের কথা বলে।'
              : 'Turn your rooms, availability, and offers into a booking experience that looks unmistakably like your resort—not a third-party marketplace.'}
          </p>
          <Link
            href="/try"
            className="mt-8 inline-flex items-center gap-2 border-b-2 border-[#183153] pb-1 text-sm font-extrabold hover:border-[#ef725c] hover:text-[#ef725c]"
          >
            {isBn ? 'গেস্টদের বুকিং ফ্লো দেখুন' : 'See the guest journey'} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section id="pricing" className="border-y-2 border-[#183153] bg-[#fff1ea]">
        <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <Eyebrow>{isBn ? 'এক মিনিটেই সিদ্ধান্ত নিন' : 'Simple enough to choose in a minute'}</Eyebrow>
              <h2 className="mt-7 max-w-[600px] text-[clamp(2.9rem,4.8vw,5.1rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
                {isBn
                  ? 'প্রয়োজন অনুযায়ী আপনার সার্ভিস বেছে নিন।'
                  : 'Start with real value, then grow on your terms.'}
              </h2>
            </div>
            <div className="inline-flex w-fit border-2 border-[#183153] bg-white p-1">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={`px-4 py-2.5 text-sm font-bold ${annual ? 'text-[#183153]' : 'bg-[#183153] text-white'}`}
              >
                {isBn ? 'মাসিক' : 'Monthly'}
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={`px-4 py-2.5 text-sm font-bold ${annual ? 'bg-[#183153] text-white' : 'text-[#183153]'}`}
              >
                {isBn ? 'বার্ষিক' : 'Yearly'}{' '}
                <span className="text-[#ef725c]">
                  {isBn ? '· ২ মাস সম্পূর্ণ ফ্রি' : '· 2 months free'}
                </span>
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
                      {annual ? (isBn ? '/ বছর' : '/ year') : (isBn ? '/ মাস' : '/ month')}
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
                    {isBn ? `${pricing.displayName} প্ল্যান বেছে নিন` : `Choose ${pricing.displayName}`}
                  </Link>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-sm font-semibold text-[#64748b]">
            {isBn
              ? 'হোয়াইট-লেবেল, SSO বা একাধিক প্রপার্টির জন্য কাস্টম প্ল্যান প্রয়োজন? '
              : 'Need white-label, SSO, or more than five properties? '}
            <Link
              href="/contact"
              className="text-[#183153] underline decoration-[#ef725c] decoration-2 underline-offset-4"
            >
              {isBn ? 'আমাদের টিমের সাথে কথা বলুন।' : 'Talk to our team.'}
            </Link>
          </p>
        </div>
      </section>

      <section className="bg-[#fff1ea]">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:gap-20 lg:py-28">
          <blockquote>
            <p className="max-w-[500px] text-[clamp(1.8rem,3vw,3rem)] font-extrabold leading-[1.15] tracking-[-0.04em]">
              {isBn
                ? '“আমরা খাতায় হিসাব রাখা বন্ধ করে দিয়েছি। ডেস্কে, কিচেনে ও ম্যানেজমেন্টের সবাই এখন একই ড্যাশবোর্ড দেখছি।”'
                : '“We stopped keeping the day in a notebook. The desk, the kitchen, and I are finally looking at the same page.”'}
            </p>
            <footer className="mt-7 text-sm font-bold text-[#64748b]">
              {isBn
                ? 'রেজাউল করিম — ওনার, পাম হাউস, কক্সবাজার'
                : 'Rezaul Karim — owner, Palm House, Cox\'s Bazar'}
            </footer>
          </blockquote>
          <div className="grid grid-cols-2 border-l-2 border-t-2 border-[#183153] bg-white">
            {[
              [isBn ? '৩ মিনিট' : '3 min', isBn ? 'গড় চেক-ইন সময়' : 'Average check-in'],
              [isBn ? '৪১%' : '41%', isBn ? 'বেশি ডাইরেক্ট বুকিং' : 'More direct bookings'],
              [isBn ? '০টি' : '0', isBn ? 'কাগজের খাতায় এন্ট্রি' : 'Spreadsheets kept'],
              [isBn ? '১৪ মাস' : '14 mo', isBn ? 'ResortPro ব্যবহার করছেন' : 'Running on ResortPro'],
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
          <Eyebrow>{isBn ? 'ডেস্কে থাকা টিমের জন্য' : 'For the people at the desk'}</Eyebrow>
          <h2 className="mt-7 max-w-[550px] text-[clamp(2.8rem,4.5vw,4.9rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
            {isBn
              ? 'কাজের ব্যস্ততম মুহূর্তেও অফলাইনে সচল ডেস্কটপ অ্যাপ।'
              : 'A desktop app that keeps working when the day gets busy.'}
          </h2>
          <p className="mt-7 max-w-[530px] text-[17px] leading-8 text-[#64748b]">
            {isBn
              ? 'ইন্টারনেট চলে গেলেও নিরবচ্ছিন্ন ফ্রন্ট ডেস্ক অপারেশন বজায় রাখুন।'
              : 'Keep essential operations close at hand, sync offline work, and connect attendance hardware without leaving ResortPro.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://github.com/asadsnapper-beep/resort-pro/releases/download/desktop-v0.1.0/ResortPro.Setup.0.1.0.exe"
              className="bg-[#183153] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#ef725c]"
            >
              {isBn ? 'Windows-এর জন্য ডাউনলোড' : 'Download for Windows'}
            </a>
            <a
              href="https://github.com/asadsnapper-beep/resort-pro/releases/download/desktop-v0.1.0/ResortPro-0.1.0-arm64.dmg"
              className="border-2 border-[#183153] px-5 py-3 text-sm font-bold hover:bg-[#fff1ea]"
            >
              {isBn ? 'Mac-এর জন্য ডাউনলোড' : 'Download for Mac'}
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
              {isBn ? 'দুপুরের আগে ১৪টি চেক-ইন।' : '14 arrivals before noon.'}
            </p>
          </div>
          {[
            [isBn ? 'চেক-ইন কিউ' : 'Check-in queue', '14'],
            [isBn ? 'রুম প্রস্তুত করতে হবে' : 'Rooms to turn over', '6'],
            [isBn ? 'বাকি হিসাব' : 'Unpaid balances', '2'],
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
            <Eyebrow>{isBn ? 'জরুরি কিছু প্রশ্ন ও উত্তর' : 'Good to know'}</Eyebrow>
            <h2 className="mt-7 text-[clamp(2.8rem,4.5vw,4.8rem)] font-extrabold leading-[.98] tracking-[-0.06em]">
              {isBn ? 'সচরাচর জিজ্ঞাসিত প্রশ্নাবলী।' : 'A few honest answers.'}
            </h2>
            <p className="mt-6 max-w-[360px] text-[17px] leading-8 text-[#64748b]">
              {isBn
                ? 'আপনাকে সেটআপে সাহায্য করতে আমাদের টিম বাংলা ও ইংরেজি উভয় ভাষায় পাশে থাকবে।'
                : 'If you need help setting up, our team can guide you in Bangla or English.'}
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
            {isBn
              ? 'প্রতিটি গেস্টের অভিজ্ঞতা হোক চমৎকার। কাজের চাপ হোক হালকা।'
              : 'Make the stay memorable. Make the work lighter.'}
          </h2>
          <p className="mt-7 max-w-[560px] text-lg leading-8 text-white/90">
            {isBn
              ? 'আপনার রিসোর্টের আলাদা একটি পরিচয় আছে। এর অপারেটিং সিস্টেমেরও সেটা থাকা উচিত।'
              : 'Your resort already has a point of view. Its operating system should too.'}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/plans"
              className="bg-[#183153] px-6 py-4 text-sm font-bold text-white hover:bg-white hover:text-[#183153]"
            >
              {isBn ? 'প্ল্যান দেখুন' : 'See plans'}
            </Link>
            <Link
              href="/contact"
              className="border-2 border-white px-6 py-4 text-sm font-bold hover:bg-white/15"
            >
              {isBn ? 'ডেমো বুক করুন' : 'Book a demo'}
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
              {isBn
                ? 'যেসব রিসোর্ট প্রতিটি গেস্টের অভিজ্ঞতা স্পেশাল করতে চায়, তাদের নিজস্ব অপারেটিং সিস্টেম।'
                : 'The operating system for resorts that want every stay to feel personal.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-bold text-white/85">
            <Link href="/privacy">{isBn ? 'গোপনীয়তা' : 'Privacy'}</Link>
            <Link href="/terms">{isBn ? 'শর্তাবলী' : 'Terms'}</Link>
            <a href="#top">{isBn ? 'উপরে যান' : 'Back to top'}</a>
          </div>
        </div>
        <div className="mx-auto max-w-[1240px] border-t border-white/25 px-5 py-6 text-xs text-white/55 sm:px-8">
          © 2026 ResortPro.
        </div>
      </footer>
    </main>
  );
}
