'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { PLAN_PRICING } from '@resort-pro/types';
import { BrandLogo } from '@/components/brand/BrandLogo';

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Bookings & calendar',
    titleBn: 'Booking ও calendar',
    body: 'See every phone, walk-in and online booking in one calendar.',
    bodyBn: 'Phone, walk-in ও online booking—সব এক calendar-এ দেখুন।',
  },
  {
    icon: BedDouble,
    title: 'Rooms & housekeeping',
    titleBn: 'Room ও housekeeping',
    body: 'Know which rooms are free, occupied or waiting to be cleaned.',
    bodyBn: 'কোন room খালি, occupied বা cleaning বাকি—এক নজরে জানুন।',
  },
  {
    icon: CreditCard,
    title: 'Payments & invoices',
    titleBn: 'Payment ও invoice',
    body: 'Keep payments, balances and invoices connected to each stay.',
    bodyBn: 'প্রতিটি stay-এর payment, balance ও invoice একসঙ্গে রাখুন।',
  },
  {
    icon: Users,
    title: 'Guest records',
    titleBn: 'Guest record',
    body: 'Find guest details and stay history whenever your team needs them.',
    bodyBn: 'Team-এর দরকার হলে guest details ও stay history সহজে খুঁজে পান।',
  },
];

const FAQS = [
  {
    q: 'Is ResortPro suitable for a small resort?',
    qBn: 'ছোট resort-এর জন্য কি ResortPro উপযুক্ত?',
    a: `Yes. The Solo plan supports one property, up to ${PLAN_PRICING.FREE.roomLimit} rooms and ${PLAN_PRICING.FREE.staffLimit} staff accounts.`,
    aBn: `হ্যাঁ। Solo plan-এ ১টি property, সর্বোচ্চ ${PLAN_PRICING.FREE.roomLimit}টি room ও ${PLAN_PRICING.FREE.staffLimit}টি staff account ব্যবহার করা যায়।`,
  },
  {
    q: 'Can my team use it from a phone?',
    qBn: 'আমার team কি phone থেকে ব্যবহার করতে পারবে?',
    a: 'Yes. ResortPro works in a modern browser on computers, tablets and phones.',
    aBn: 'হ্যাঁ। ResortPro computer, tablet ও phone-এর modern browser-এ চলে।',
  },
  {
    q: 'Can I see the product before choosing a plan?',
    qBn: 'Plan নেওয়ার আগে product দেখা যাবে?',
    a: 'Yes. The live demo lets you explore the dashboard and everyday workflows first.',
    aBn: 'হ্যাঁ। Live demo-তে আগে dashboard ও দৈনন্দিন workflow ঘুরে দেখতে পারবেন।',
  },
];

export function LandingPage({ isBn = false }: { isBn?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [launchOfferActive, setLaunchOfferActive] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${API_URL}/api/auth/launch-promotion`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (payload?.data?.active) setLaunchOfferActive(true); })
      .catch(() => {});
  }, []);

  const navLinks = [
    { label: isBn ? 'কী পাবেন' : 'Features', href: '#features' },
    { label: isBn ? 'কীভাবে শুরু করবেন' : 'How it works', href: '#how' },
    { label: isBn ? 'দাম' : 'Pricing', href: '#pricing' },
  ];

  return (
    <main className="min-w-0 overflow-x-hidden bg-[#f8f6f1] font-sans text-resort-900 selection:bg-lime-300/40">
      <header className={`fixed inset-x-0 top-0 z-50 transition-all ${scrolled ? 'border-b border-resort-900/10 bg-[#f8f6f1]/95 shadow-sm backdrop-blur-xl' : 'bg-[#f8f6f1]'}`}>
        <nav className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href={isBn ? '/bn' : '/'} className="flex items-center" aria-label="ResortPro home">
            <BrandLogo />
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-bold text-slate-600 transition-colors hover:text-resort-600">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-5 lg:flex">
            <Link
              href={isBn ? '/' : '/bn'}
              onClick={() => { document.cookie = `locale=${isBn ? 'en' : 'bn'}; path=/; max-age=31536000; SameSite=Lax`; }}
              className="text-xs font-extrabold text-slate-500 hover:text-resort-900"
            >
              {isBn ? 'EN' : 'বাংলা'}
            </Link>
            <Link href="/auth/login" className="text-sm font-bold hover:text-resort-600">{isBn ? 'লগ ইন' : 'Log in'}</Link>
            <Link href="/auth/register" className="text-sm font-bold hover:text-resort-600">{isBn ? 'সাইন আপ' : 'Sign up'}</Link>
            <Link href="/try" className="rounded-full bg-resort-600 px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-resort-700">
              {isBn ? 'Demo দেখুন' : 'View demo'}
            </Link>
          </div>

          <button type="button" aria-label={isBn ? 'Menu খুলুন' : 'Open menu'} onClick={() => setMenuOpen(true)} className="rounded-full border border-resort-900/15 p-2.5 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </nav>
      </header>

      <div className={`fixed inset-0 z-[60] lg:hidden ${menuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!menuOpen}>
        <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className={`absolute inset-0 bg-resort-900/25 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute right-0 top-0 flex h-full w-[min(86vw,360px)] flex-col bg-[#f8f6f1] p-6 shadow-2xl transition-transform duration-300 ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between">
            <BrandLogo />
            <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="rounded-full border border-resort-900/15 p-2"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-12 flex flex-col border-t border-resort-900/10">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="border-b border-resort-900/10 py-5 text-lg font-bold">{link.label}</a>
            ))}
          </div>
          <Link href="/try" onClick={() => setMenuOpen(false)} className="mt-auto rounded-full bg-resort-600 px-5 py-3.5 text-center text-sm font-extrabold text-white">{isBn ? 'Demo দেখুন' : 'View demo'}</Link>
          <Link href="/auth/register" onClick={() => setMenuOpen(false)} className="mt-3 rounded-full bg-lime-300 px-5 py-3.5 text-center text-sm font-extrabold text-resort-900">{isBn ? 'অ্যাকাউন্ট খুলুন' : 'Sign up'}</Link>
        </div>
      </div>

      <section className="px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:pb-28">
        <div className="mx-auto max-w-6xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-resort-900/10 bg-white px-4 py-2 text-xs font-extrabold text-resort-600 shadow-sm">
            <Check className="h-3.5 w-3.5" />
            {isBn ? 'ছোট ও মাঝারি resort-এর জন্য' : 'Built for independent resorts'}
          </span>
          <h1 className="font-editorial mx-auto mt-7 max-w-4xl text-[clamp(3rem,7vw,6.2rem)] font-medium leading-[0.98] tracking-[-0.04em]">
            {isBn ? 'একটি সহজ dashboard থেকে পুরো resort চালান।' : 'Run your whole resort from one simple dashboard.'}
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            {isBn
              ? 'Room, booking, guest ও payment—সব এক জায়গায়। খাতা, Excel আর WhatsApp message মিলিয়ে দেখার ঝামেলা কমান।'
              : 'Manage rooms, bookings, guests and payments in one place. Spend less time matching notebooks, spreadsheets and WhatsApp messages.'}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/try" className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-resort-600 px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-resort-900/10 transition-all hover:-translate-y-0.5 hover:bg-resort-700 sm:w-auto">
              {isBn ? 'Live demo দেখুন' : 'Explore the live demo'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/auth/register" className="text-sm font-extrabold text-resort-700 underline decoration-lime-400 decoration-2 underline-offset-4">
              {isBn ? 'অ্যাকাউন্ট খুলুন' : 'Create your account'}
            </Link>
            <Link href="/plans" className="text-sm font-extrabold text-resort-700 underline decoration-lime-400 decoration-2 underline-offset-4">
              {isBn ? 'দাম দেখুন' : 'See pricing'}
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
            <span>{isBn ? 'Credit card লাগে না' : 'No credit card required'}</span>
            <span>·</span>
            <span>{isBn ? 'Phone ও computer-এ চলে' : 'Works on phone & computer'}</span>
            {launchOfferActive && <><span>·</span><span className="text-resort-600">{isBn ? 'Launch offer চালু আছে' : 'Launch offer available'}</span></>}
          </div>

          <div className="mx-auto mt-14 max-w-5xl border-t-2 border-lime-400 bg-white p-2 shadow-[0_28px_75px_-35px_rgba(24,49,83,0.45)] sm:mt-20 sm:p-3">
            <div className="flex h-8 items-center gap-1.5 border-b border-slate-100 px-3">
              <span className="h-2 w-2 rounded-full bg-slate-200" />
              <span className="h-2 w-2 rounded-full bg-slate-200" />
              <span className="h-2 w-2 rounded-full bg-slate-200" />
              <span className="mx-auto -translate-x-5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">ResortPro dashboard</span>
            </div>
            <Image src="/landing-next/hero-dashboard-resortpro.png" alt={isBn ? 'ResortPro dashboard-এ room, booking, check-in ও revenue' : 'ResortPro dashboard showing rooms, bookings, check-ins and revenue'} width={1024} height={531} priority className="h-auto w-full" />
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-resort-900/10 bg-white px-5 py-20 sm:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-resort-600">{isBn ? 'যা প্রতিদিন দরকার' : 'What you need every day'}</span>
            <h2 className="font-editorial mt-4 text-[clamp(2.4rem,5vw,4rem)] font-medium leading-tight">
              {isBn ? 'কাজগুলো সহজ করুন।' : 'Keep the daily work simple.'}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">{isBn ? 'জটিল software নয়। Resort team-এর দরকারি কাজগুলোর একটি পরিষ্কার view।' : 'Not another complicated system. Just a clear view of the work your resort team already does.'}</p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-2xl border border-resort-900/10 bg-[#f8f6f1] p-7 sm:p-8">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-resort-600 shadow-sm"><Icon className="h-5 w-5" /></span>
                  <h3 className="font-editorial mt-6 text-2xl font-medium">{isBn ? feature.titleBn : feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{isBn ? feature.bodyBn : feature.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how" className="px-5 py-20 sm:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-resort-600">{isBn ? 'শুরু করা সহজ' : 'Easy to start'}</span>
            <h2 className="font-editorial mt-4 text-[clamp(2.4rem,5vw,4rem)] font-medium leading-tight">{isBn ? 'তিনটি সহজ ধাপ।' : 'Three simple steps.'}</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { title: isBn ? 'Account তৈরি করুন' : 'Create your account', body: isBn ? 'Resort ও room-এর basic তথ্য যোগ করুন।' : 'Add the basics about your resort and rooms.' },
              { title: isBn ? 'Team যোগ করুন' : 'Add your team', body: isBn ? 'প্রত্যেক staff-কে দরকারি access দিন।' : 'Give each staff member the access they need.' },
              { title: isBn ? 'Booking শুরু করুন' : 'Start taking bookings', body: isBn ? 'Dashboard থেকে booking ও daily কাজ চালান।' : 'Run bookings and daily work from the dashboard.' },
            ].map((step, index) => (
              <article key={step.title} className="border-t border-resort-900/15 pt-6">
                <span className="font-editorial text-4xl text-lime-700">0{index + 1}</span>
                <h3 className="mt-5 text-lg font-extrabold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-resort-900 px-5 py-20 text-white sm:px-8 md:py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 text-center lg:flex-row lg:text-left">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-lime-300">{isBn ? 'পরিষ্কার pricing' : 'Simple pricing'}</span>
            <h2 className="font-editorial mt-4 text-[clamp(2.5rem,5vw,4.2rem)] font-medium leading-tight">{isBn ? <>শুরু করুন মাসে <span className="text-lime-300">${PLAN_PRICING.FREE.monthlyUsd}</span> থেকে।</> : <>Start from <span className="text-lime-300">${PLAN_PRICING.FREE.monthlyUsd}</span> a month.</>}</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/65">{isBn ? `Solo plan-এ ১টি property, ${PLAN_PRICING.FREE.roomLimit}টি room ও ${PLAN_PRICING.FREE.staffLimit}টি staff account পাবেন। Resort বড় হলে plan বদলাতে পারবেন।` : `Solo includes one property, ${PLAN_PRICING.FREE.roomLimit} rooms and ${PLAN_PRICING.FREE.staffLimit} staff accounts. Move up when your resort grows.`}</p>
          </div>
          <Link href="/plans" className="inline-flex w-full flex-none items-center justify-center gap-2 rounded-full bg-lime-300 px-7 py-3.5 text-sm font-extrabold text-resort-900 transition-colors hover:bg-lime-200 sm:w-auto">
            {isBn ? 'সব plan দেখুন' : 'See all plans'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-resort-600">FAQ</span>
            <h2 className="font-editorial mt-4 text-[clamp(2.4rem,5vw,4rem)] font-medium leading-tight">{isBn ? 'সাধারণ প্রশ্ন।' : 'Common questions.'}</h2>
          </div>
          <div className="border-t border-resort-900/15">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group border-b border-resort-900/15">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left text-base font-extrabold marker:hidden">
                  {isBn ? faq.qBn : faq.q}
                  <ChevronDown className="h-4 w-4 flex-none transition-transform group-open:rotate-180" />
                </summary>
                <p className="max-w-2xl pb-6 text-sm leading-7 text-slate-600">{isBn ? faq.aBn : faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-resort-900/10 bg-[#f8f6f1] px-5 py-20 text-center sm:px-8 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-editorial text-[clamp(2.6rem,6vw,5rem)] font-medium leading-tight">{isBn ? 'নিজে দেখে সিদ্ধান্ত নিন।' : 'See it before you decide.'}</h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600">{isBn ? 'Live demo খুলে room, booking, guest ও payment workflow ঘুরে দেখুন।' : 'Open the live demo and explore rooms, bookings, guests and payment workflows.'}</p>
          <Link href="/try" className="group mt-8 inline-flex items-center gap-2 rounded-full bg-resort-600 px-7 py-3.5 text-sm font-extrabold text-white hover:bg-resort-700">
            {isBn ? 'Live demo খুলুন' : 'Open the live demo'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="mt-6 text-sm font-bold text-slate-600">
            {isBn ? 'অথবা ' : 'Or '}
            <Link href="/auth/register" className="font-extrabold text-resort-700 underline decoration-lime-400 decoration-2 underline-offset-4">{isBn ? 'অ্যাকাউন্ট খুলুন' : 'Create your account'}</Link>
          </p>
        </div>
      </section>

      <footer className="bg-[#0e223c] px-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 border-b border-white/10 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href={isBn ? '/bn' : '/'} className="flex items-center"><BrandLogo inverse /></Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/55">{isBn ? 'Independent resort-এর দৈনন্দিন কাজের জন্য একটি সহজ platform।' : 'A simple operating platform for independent resorts.'}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-white/60">
            <Link href="/plans" className="hover:text-white">{isBn ? 'দাম' : 'Pricing'}</Link>
            <Link href="/docs" className="hover:text-white">{isBn ? 'সাহায্য' : 'Help'}</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/auth/login" className="hover:text-white">{isBn ? 'লগ ইন' : 'Log in'}</Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between py-6 text-xs text-white/40">
          <span>© 2026 ResortPro.</span>
          <Link href={isBn ? '/' : '/bn'} className="font-bold text-white/65 hover:text-white">{isBn ? 'English' : 'বাংলা'}</Link>
        </div>
      </footer>
    </main>
  );
}
