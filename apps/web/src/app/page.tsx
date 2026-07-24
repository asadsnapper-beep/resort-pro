'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Desktop App', href: '#desktop-app' },
  { label: 'FAQ', href: '#faq' },
];

const FEATURES = [
  {
    title: 'Bookings & Calendar',
    desc: 'Drag-and-drop calendar, walk-ins, online and group bookings in one view.',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23766a" strokeWidth={1.6} strokeLinecap="round">
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" />
      </svg>
    ),
  },
  {
    title: 'Payments Built In',
    desc: 'bKash, SSLCommerz, Stripe and cash — no plugins, no chasing screenshots.',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23766a" strokeWidth={1.6} strokeLinecap="round">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19M6 15h4" />
      </svg>
    ),
  },
  {
    title: 'Analytics & Reports',
    desc: 'Occupancy, revenue and profit, updated in real time.',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23766a" strokeWidth={1.6} strokeLinecap="round">
        <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3" />
      </svg>
    ),
  },
  {
    title: 'Restaurant & Room Service',
    desc: 'Menus, table orders and live kitchen status.',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23766a" strokeWidth={1.6} strokeLinecap="round">
        <path d="M7 2.5v8a2.5 2.5 0 0 1-5 0v-8M4.5 11v10.5M16 2.5c-1.7 0-2.5 2-2.5 5s.8 4 2.5 4 2.5-1 2.5-4-.8-5-2.5-5zM16 15.5v6" />
      </svg>
    ),
  },
  {
    title: 'Guest CRM & Loyalty',
    desc: 'Profiles, stay history and loyalty points in one place.',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23766a" strokeWidth={1.6} strokeLinecap="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  },
  {
    title: 'Embed Anywhere',
    desc: 'Add booking forms to your existing site with one line of code.',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23766a" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 8.5 5 12l3.5 3.5M15.5 8.5 19 12l-3.5 3.5M13 5l-2 14" />
      </svg>
    ),
  },
];

const STEPS = [
  { num: '01', title: 'Create your account', desc: 'Sign up free and add your rooms, rates and photos in minutes. No card needed.' },
  { num: '02', title: 'Connect payments', desc: 'Link bKash, SSLCommerz or Stripe in a few taps and start taking deposits.' },
  { num: '03', title: 'Go live', desc: "Share your booking link or embed it on your site. You're taking bookings tonight." },
];

const EMBED_WIDGETS = ['Booking form', 'Room list', 'Availability calendar', 'Restaurant menu'];

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 1500,
    annualMonthly: 1250,
    annualYearly: 15000,
    tagline: 'For small guesthouses getting online.',
    featuresPrefix: null as string | null,
    features: [
      'Up to <strong>10 rooms</strong> & 3 staff seats',
      'Core PMS — bookings, rooms, guests, housekeeping',
      'Booking site on a ResortPro subdomain',
      'bKash & cash · basic invoicing & reports',
      'Email support',
    ],
    ai: 'AI content generator · ~30 / mo',
    highlighted: false,
    badge: null as string | null,
  },
  {
    key: 'professional',
    name: 'Professional',
    monthly: 3900,
    annualMonthly: 3250,
    annualYearly: 39000,
    tagline: 'For growing resorts running every department.',
    featuresPrefix: 'Everything in Starter, plus',
    features: [
      'Up to <strong>40 rooms</strong> & 10 staff seats',
      'Custom domain — no ResortPro badge',
      'F&B + table ordering',
      'CRM, email/SMS marketing & loyalty',
      'OTA sync — Airbnb, Booking.com · advanced reports',
      'Priority email support',
    ],
    ai: 'AI content + chatbot · ~300 / mo',
    highlighted: true,
    badge: 'Most popular',
  },
  {
    key: 'premium',
    name: 'Premium',
    monthly: 7900,
    annualMonthly: 6583,
    annualYearly: 79000,
    tagline: 'For established & multi-property resorts.',
    featuresPrefix: 'Everything in Professional, plus',
    features: [
      '<strong>Unlimited</strong> rooms & staff seats',
      'Multi-property dashboard',
      'Revenue intelligence reports',
      'Priority support',
    ],
    ai: 'Full AI suite + insights · ~1,500 / mo',
    highlighted: false,
    badge: null,
  },
];

const STATS = [
  { stat: '10 min', label: 'to set up' },
  { stat: '14-day', label: 'free trial' },
  { stat: '24/7', label: 'access anywhere' },
];

const BENEFITS = [
  {
    title: 'Close the spreadsheets',
    text: 'Three booking sheets become one live calendar. Double-bookings stop, and your reception team finally breathes during peak season.',
  },
  {
    title: 'Get paid before arrival',
    text: 'bKash, SSLCommerz and Stripe in one place. No more chasing payment screenshots on WhatsApp — guests pay the deposit before they even arrive.',
  },
  {
    title: 'Run it from your phone',
    text: 'Occupancy and revenue update live across every property, so you can drop rates on a slow weekend before it costs you.',
  },
];

const FAQS = [
  { q: 'Do I need technical skills to set this up?', a: 'No. Most owners are live within an afternoon — add your rooms and rates, connect a payment method, and share your link. If you get stuck, our team helps you onboard in Bangla or English.' },
  { q: 'Which payment methods are supported?', a: 'bKash, SSLCommerz, Stripe and plain cash, all in one place. Guests can pay a deposit or the full amount online, and every transaction is reconciled automatically.' },
  { q: 'Can I use ResortPro with my existing website?', a: 'Yes. Drop a single line of code onto WordPress, Wix, Squarespace or any site and a live booking form, room list, calendar or menu appears instantly.' },
  { q: 'What happens after the 14-day free trial?', a: 'Nothing breaks. You pick a plan when you are ready — no card is required to start, and you can change or cancel your plan at any time.' },
  { q: 'Can I manage more than one property?', a: 'Absolutely. The Premium plan gives you a single dashboard across all your properties, with separate calendars, staff and reporting for each — and Enterprise adds white-label and custom limits for larger chains.' },
  { q: 'Is my data safe?', a: 'Your data is encrypted in transit and at rest, backed up daily, and never sold. You can export everything at any time.' },
];

const TRUST_BRANDS = [
  { text: 'bKash', cls: 'font-display text-[19px] font-semibold' },
  { text: 'SSLCommerz', cls: 'text-[18px] font-semibold tracking-[0.04em]' },
  { text: 'Stripe', cls: 'font-display text-[19px] font-semibold' },
  { text: 'Bank Transfer', cls: 'text-[17px] font-semibold tracking-[0.04em]' },
];

const EMBED_CODE = `<script src="https://cdn.resortpro.site/embed.js"
        data-property="bay-breeze"
        data-widget="booking"></script>`;

const DESKTOP_RELEASE_BASE = 'https://github.com/asadsnapper-beep/resort-pro/releases/download/desktop-v0.1.0';

const DOWNLOADS = [
  {
    os: 'Windows',
    note: 'Windows 10/11 · v0.1.0 · 78 MB',
    url: `${DESKTOP_RELEASE_BASE}/ResortPro.Setup.0.1.0.exe`,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#23766a" strokeWidth={1.6}>
        <rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
      </svg>
    ),
  },
  {
    os: 'Mac',
    note: 'Apple Silicon · v0.1.0 · 94 MB',
    url: `${DESKTOP_RELEASE_BASE}/ResortPro-0.1.0-arm64.dmg`,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#23766a" strokeWidth={1.6}>
        <rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
];

const taka = (n: number) => '৳' + n.toLocaleString('en-IN');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already in view on mount (e.g. above-the-fold hero) → reveal next frame
    // so the fade still plays but we never wait on the IntersectionObserver.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(26px)',
        transition: `opacity .9s cubic-bezier(.2,.7,.2,1) ${delay}ms, transform .9s cubic-bezier(.2,.7,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ label, centered = false, dark = false }: { label: string; centered?: boolean; dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-[11px] ${centered ? 'justify-center' : ''}`}>
      <span className="h-px w-[26px] bg-gold-500" />
      <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${dark ? 'text-[#e8c682]' : 'text-resort-600'}`}>
        {label}
      </span>
      {centered && <span className="h-px w-[26px] bg-gold-500" />}
    </div>
  );
}

function GoldCheck() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LogoMark({ size = 30, dotBg = '#19403b' }: { size?: number; dotBg?: string }) {
  return (
    <span
      className="flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: dotBg }}
    >
      <span className="rounded-full border-[1.5px] border-gold-500" style={{ width: size * 0.37, height: size * 0.37 }} />
    </span>
  );
}

// ─────────────────────────────────────────────
// Dashboard mockup (cream — matches prototype)
// ─────────────────────────────────────────────

function DashboardMockup() {
  const navItems = ['Dashboard', 'Bookings', 'Calendar', 'Restaurant', 'Payments', 'Guests'];
  const calRows: { label: string; bars: { span: number; color: string }[] }[] = [
    { label: 'Deluxe', bars: [{ span: 1, color: '#e7eeec' }, { span: 2, color: '#23766a' }, { span: 1, color: '#e7eeec' }, { span: 2, color: '#d4a853' }, { span: 1, color: '#e7eeec' }] },
    { label: 'Suite', bars: [{ span: 3, color: '#23766a' }, { span: 1, color: '#e7eeec' }, { span: 2, color: '#23766a' }, { span: 1, color: '#e7eeec' }] },
    { label: 'Villa', bars: [{ span: 1, color: '#e7eeec' }, { span: 1, color: '#e7eeec' }, { span: 3, color: '#19403b' }, { span: 2, color: '#e7eeec' }] },
    { label: 'Cabana', bars: [{ span: 2, color: '#d4a853' }, { span: 1, color: '#e7eeec' }, { span: 2, color: '#23766a' }, { span: 2, color: '#e7eeec' }] },
  ];

  return (
    <div
      className="overflow-hidden rounded-[6px] border-t-[3px] border-gold-500 bg-white text-left"
      style={{ boxShadow: '0 40px 90px -30px rgba(25,64,59,.32), 0 8px 24px rgba(25,64,59,.08)' }}
    >
      {/* Browser bar */}
      <div className="flex items-center gap-2 border-b border-[rgba(25,64,59,0.07)] px-[18px] py-[14px]">
        <span className="h-[11px] w-[11px] rounded-full bg-[#e8ddd0]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#e8ddd0]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#e8ddd0]" />
        <span className="ml-[14px] text-xs text-[#9aa19d]">app.resortpro.site / dashboard</span>
      </div>

      <div className="flex min-h-[420px]">
        {/* Sidebar */}
        <div className="hidden w-[200px] flex-none flex-col gap-1.5 bg-resort-900 p-[22px_16px] sm:flex" style={{ padding: '22px 16px' }}>
          <div className="mb-[18px] flex items-center gap-[9px] px-1.5">
            <LogoMark size={22} dotBg="#23766a" />
            <span className="font-display text-[15px] font-semibold text-[#f2efe9]">ResortPro</span>
          </div>
          {navItems.map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
              style={i === 0 ? { background: 'rgba(212,168,83,.16)' } : undefined}
            >
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: i === 0 ? '#d4a853' : 'rgba(255,255,255,.3)' }} />
              <span className={`text-[13px] ${i === 0 ? 'font-medium text-white' : 'text-[#b9c6c2]'}`}>{item}</span>
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 bg-[#faf9f6] p-[26px_28px]" style={{ padding: '26px 28px' }}>
          <div className="mb-[22px] flex items-center justify-between">
            <div>
              <div className="font-display text-xl font-semibold text-resort-900">Good morning 👋</div>
              <div className="mt-0.5 text-[12.5px] text-[#8a918d]">Saturday, 20 June · 24 rooms</div>
            </div>
            <span className="rounded-full bg-resort-600 px-[15px] py-2 text-xs font-semibold text-white">+ New booking</span>
          </div>

          {/* Stat cards */}
          <div className="mb-[22px] grid grid-cols-3 gap-3.5">
            {[
              { label: 'OCCUPANCY', val: '87%', note: '▲ 6% this week', noteColor: '#23766a' },
              { label: "TODAY'S REVENUE", val: '৳3.2L', note: '▲ 12% vs avg', noteColor: '#23766a' },
              { label: 'ARRIVALS', val: '14', note: '3 checked in', noteColor: '#8a918d' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[rgba(25,64,59,0.07)] bg-white p-4">
                <div className="text-[11.5px] tracking-[0.04em] text-[#8a918d]">{s.label}</div>
                <div className="mt-[5px] font-display text-[27px] font-semibold text-resort-900">{s.val}</div>
                <div className="mt-0.5 text-[11.5px]" style={{ color: s.noteColor }}>{s.note}</div>
              </div>
            ))}
          </div>

          {/* Calendar */}
          <div className="rounded-xl border border-[rgba(25,64,59,0.07)] bg-white p-[18px]">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-[13.5px] font-semibold text-resort-900">Booking calendar</span>
              <span className="text-xs text-[#8a918d]">June 18 – 24</span>
            </div>
            <div className="flex flex-col gap-[9px]">
              {calRows.map((row) => (
                <div key={row.label} className="grid items-center gap-1.5" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
                  <span className="text-[11px] text-[#8a918d]">{row.label}</span>
                  {row.bars.map((b, i) => (
                    <span key={i} className="h-[18px] rounded-[5px]" style={{ background: b.color, gridColumn: `span ${b.span}` }} />
                  ))}
                </div>
              ))}
            </div>
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
  const [navSolid, setNavSolid] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onScroll = () => setNavSolid((window.scrollY || 0) > 28);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const copyCode = () => {
    try { navigator.clipboard?.writeText(EMBED_CODE); } catch { /* noop */ }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#faf8f4] font-sans text-resort-900 antialiased scroll-smooth">

      {/* ── NAV ── */}
      <header
        className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
        style={{
          background: navSolid ? 'rgba(250,248,244,0.82)' : 'rgba(250,248,244,0)',
          backdropFilter: navSolid ? 'saturate(180%) blur(14px)' : 'none',
          WebkitBackdropFilter: navSolid ? 'saturate(180%) blur(14px)' : 'none',
          borderBottom: `1px solid ${navSolid ? 'rgba(25,64,59,0.1)' : 'rgba(25,64,59,0)'}`,
        }}
      >
        <nav className="mx-auto flex h-[74px] max-w-[1180px] items-center justify-between px-7">
          <a href="#top" className="flex items-center gap-[11px]">
            <LogoMark />
            <span className="font-display text-[21px] font-semibold tracking-tight">ResortPro</span>
          </a>

          {/* Desktop links */}
          <div className="hidden items-center gap-[34px] md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-[14.5px] font-medium text-[#3f4a47] transition-colors hover:text-resort-600">
                {l.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-[18px] md:flex">
            <Link href="/auth/login" className="text-[14.5px] font-medium text-resort-900 transition-colors hover:text-resort-600">
              Log in
            </Link>
            <Link
              href="/plans"
              className="rounded-full border-[1.5px] border-gold-500 px-[19px] py-[9px] text-sm font-semibold text-resort-600 transition-all hover:-translate-y-px hover:bg-gold-500 hover:text-resort-900"
            >
              Start free trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="flex flex-col gap-1.5 p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            <span className={`block h-0.5 w-6 bg-resort-900 transition-all duration-300 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-6 bg-resort-900 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-6 bg-resort-900 transition-all duration-300 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-[rgba(25,64,59,0.1)] bg-[#faf8f4] px-7 py-5 md:hidden">
            <div className="flex flex-col gap-4">
              {NAV_LINKS.map((l) => (
                <a key={l.label} href={l.href} className="text-[15px] font-medium text-resort-900" onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-3 border-t border-[rgba(25,64,59,0.1)] pt-4">
                <Link href="/auth/login" className="text-center text-sm font-medium text-resort-900">Log in</Link>
                <Link href="/plans" className="rounded-full bg-resort-600 py-3 text-center text-sm font-semibold text-white">
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section id="top" className="px-7 pb-[90px] pt-[150px] text-center">
        <div className="mx-auto max-w-[840px]">
          <Reveal className="inline-block"><Eyebrow label="Hotel & resort management, reimagined" centered /></Reveal>

          <Reveal delay={80}>
            <h1 className="mt-[26px] font-display text-[clamp(2.6rem,6.2vw,5rem)] font-medium leading-[1.04] tracking-[-0.02em] text-resort-900">
              The <em className="not-italic text-resort-600 italic">calm</em> way to<br className="hidden sm:block" /> run a busy resort.
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-7 max-w-[620px] text-[clamp(1.05rem,1.5vw,1.28rem)] leading-[1.6] text-[#5b6360]">
              Bookings, payments, restaurant, and guests — one elegant system that replaces your spreadsheets,
              WhatsApp groups, and payment screenshots. Built for the way resorts in Bangladesh actually work.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/plans"
                className="rounded-full bg-resort-600 px-[30px] py-[15px] text-[15.5px] font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{ boxShadow: '0 10px 30px rgba(35,118,106,.25)' }}
              >
                Start your free trial
              </Link>
              <a
                href="/try"
                className="inline-flex items-center gap-[7px] rounded-full border-[1.5px] border-resort-600/35 px-[26px] py-3.5 text-[15.5px] font-semibold text-[#1f5950] transition-all hover:-translate-y-px hover:border-resort-600 hover:bg-resort-600/[0.06]"
              >
                Explore the live demo <span className="text-[13px]">↗</span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={280}>
            <a href="#how" className="mt-[18px] inline-block border-b-[1.5px] border-transparent pb-0.5 text-sm font-medium text-[#8a918d] transition-all hover:border-[#1f5950] hover:text-[#1f5950]">
              or see how it works →
            </a>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-[22px] text-[13.5px] text-[#8a918d]">
              No credit card required · Set up in 10 minutes · bKash & Stripe built in
            </p>
          </Reveal>
        </div>

        <Reveal delay={400} className="mx-auto mt-[72px] max-w-[1040px]">
          <DashboardMockup />
        </Reveal>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="px-7 py-2">
        <div className="mx-auto max-w-[1040px] border-y border-[rgba(25,64,59,0.1)] py-[30px]">
          <p className="mb-[22px] text-center text-[13px] tracking-[0.04em] text-[#8a918d]">
            Payments built in — bKash, cards, and bank transfer, secured end-to-end
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-[clamp(28px,5vw,64px)] gap-y-5 opacity-50">
            {TRUST_BRANDS.map((b) => (
              <span key={b.text} className={`text-resort-900 ${b.cls}`}>{b.text}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="px-7 py-[120px]">
        <div className="mx-auto max-w-[1180px]">
          <Reveal className="max-w-[720px]">
            <Eyebrow label="Everything in one place" />
            <h2 className="my-[18px] font-display text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.1] tracking-[-0.02em] text-resort-900">
              Run every part of your property from a single screen.
            </h2>
            <p className="text-[1.15rem] leading-[1.6] text-[#5b6360]">
              From the first enquiry to checkout and the final invoice — ResortPro handles the whole guest journey.
            </p>
          </Reveal>

          <div className="mt-[54px] grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <div className="group h-full rounded-[18px] border border-[rgba(25,64,59,0.09)] bg-white p-[30px] transition-all duration-300 hover:-translate-y-1.5 hover:border-resort-600/30 hover:shadow-[0_22px_44px_-22px_rgba(25,64,59,0.28)]">
                  <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f1ef]">{f.svg}</span>
                  <h3 className="mb-[9px] font-display text-[21px] font-semibold text-resort-900">{f.title}</h3>
                  <p className="text-[15px] leading-[1.62] text-[#5b6360]">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="px-7 pb-[120px] pt-10">
        <div className="mx-auto max-w-[1180px]">
          <Reveal className="max-w-[720px]">
            <Eyebrow label="Live in three steps" />
            <h2 className="mt-[18px] font-display text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.1] tracking-[-0.02em] text-resort-900">
              From sign-up to your first online booking — today.
            </h2>
          </Reveal>

          <div className="mt-[58px] grid grid-cols-1 gap-7 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.num} delay={i * 80}>
                <div className="md:pr-[18px]">
                  <div className="font-display text-[62px] font-medium leading-none text-resort-600">{s.num}</div>
                  <div className="my-[18px] h-px w-10" style={{ background: 'repeating-linear-gradient(90deg,#d4a853 0 8px,transparent 8px 14px)' }} />
                  <h3 className="mb-[9px] font-display text-[22px] font-semibold text-resort-900">{s.title}</h3>
                  <p className="text-[15px] leading-[1.62] text-[#5b6360]">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── EMBED ── */}
      <section className="px-7 pb-[120px]">
        <Reveal className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <Eyebrow label="Works with your website" />
            <h2 className="my-[18px] font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-medium leading-[1.12] tracking-[-0.02em] text-resort-900">
              Keep your website. Add the booking power.
            </h2>
            <p className="mb-[26px] text-[1.1rem] leading-[1.62] text-[#5b6360]">
              One snippet drops a live booking form, room list, calendar or menu onto WordPress, Wix, Squarespace — any site.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {EMBED_WIDGETS.map((w) => (
                <span key={w} className="rounded-full border border-[rgba(25,64,59,0.12)] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1f5950]">
                  {w}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-resort-900 p-6" style={{ boxShadow: '0 30px 70px -30px rgba(25,64,59,.5)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-[7px]">
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.18]" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.18]" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.18]" />
              </div>
              <button
                onClick={copyCode}
                className="rounded-[7px] border border-gold-500/35 bg-gold-500/[0.16] px-[13px] py-1.5 text-[12.5px] font-semibold text-[#e8c682] transition-all hover:bg-gold-500/[0.28]"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[13.5px] leading-[1.7] text-[#cfe0db]">{EMBED_CODE}</pre>
          </div>
        </Reveal>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="border-y border-[rgba(25,64,59,0.08)] bg-white px-7 py-[110px]">
        <div className="mx-auto max-w-[1180px]">
          <Reveal className="mx-auto max-w-[640px] text-center">
            <Eyebrow label="Simple, honest pricing" centered />
            <h2 className="mb-3.5 mt-[18px] font-display text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.1] tracking-[-0.02em] text-resort-900">
              Pick a plan. Change it anytime.
            </h2>
            <p className="text-[1.12rem] leading-[1.6] text-[#5b6360]">
              AI in every plan, a 14-day free trial, and bKash built in. No setup fees, no contracts.
            </p>
          </Reveal>

          {/* Billing toggle */}
          <div className="my-[34px] mb-[50px] flex items-center justify-center gap-3.5">
            <span className="text-[14.5px] font-medium" style={{ color: annual ? '#8a918d' : '#19403b' }}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              aria-label="Toggle annual billing"
              className="flex h-7 w-[52px] items-center rounded-full p-[3px] transition-colors duration-200"
              style={{ background: annual ? '#23766a' : '#d8d2c6', justifyContent: annual ? 'flex-end' : 'flex-start' }}
            >
              <span className="block h-[22px] w-[22px] rounded-full bg-white" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </button>
            <span className="text-[14.5px] font-medium" style={{ color: annual ? '#19403b' : '#8a918d' }}>Annual</span>
            <span className="rounded-full bg-[#f3e6c9] px-[11px] py-[5px] text-xs font-semibold text-[#9c7b2e]">2 months free</span>
          </div>

          {/* Plan cards */}
          <div className="mx-auto grid max-w-[1080px] grid-cols-1 items-stretch gap-6 md:grid-cols-3">
            {PLANS.map((plan) => {
              const hl = plan.highlighted;
              const price = taka(annual ? plan.annualMonthly : plan.monthly);
              const note = annual ? `billed ${taka(plan.annualYearly)} / yr` : 'per month, billed monthly';
              return (
                <Reveal key={plan.key} className="h-full">
                  <div
                    className={`relative flex h-full flex-col rounded-[20px] ${
                      hl ? 'border-[1.5px] border-gold-500 bg-resort-900 md:-translate-y-2.5' : 'border border-[rgba(25,64,59,0.1)] bg-[#faf8f4]'
                    }`}
                    style={{ padding: hl ? '38px 30px' : '34px 30px', boxShadow: hl ? '0 30px 70px -30px rgba(25,64,59,.55)' : undefined }}
                  >
                    {plan.badge && (
                      <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold-500 px-4 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-resort-900">
                        {plan.badge}
                      </span>
                    )}
                    <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${hl ? 'text-[#e8c682]' : 'text-resort-600'}`}>{plan.name}</div>
                    <div className="mb-1 mt-3.5 flex items-baseline gap-1.5">
                      <span className={`font-display text-[46px] font-semibold ${hl ? 'text-white' : 'text-resort-900'}`}>{price}</span>
                      <span className={`text-sm ${hl ? 'text-[#a9bcb6]' : 'text-[#8a918d]'}`}>/mo</span>
                    </div>
                    <div className={`min-h-[18px] text-[13px] ${hl ? 'text-[#a9bcb6]' : 'text-[#8a918d]'}`}>{note}</div>
                    <p className={`mt-3 text-sm leading-[1.55] ${hl ? 'text-[#cdd9d5]' : 'text-[#5b6360]'}`}>{plan.tagline}</p>

                    <div className="my-[22px] h-px" style={{ background: hl ? 'rgba(255,255,255,.14)' : 'rgba(25,64,59,.1)' }} />

                    {plan.featuresPrefix && (
                      <div className={`mb-3.5 text-[12.5px] font-semibold tracking-[0.02em] ${hl ? 'text-[#9fb4ae]' : 'text-[#8a918d]'}`}>
                        {plan.featuresPrefix}
                      </div>
                    )}

                    <div className="flex flex-1 flex-col gap-[13px]">
                      {plan.features.map((feat) => (
                        <div key={feat} className="flex items-start gap-[11px]">
                          <GoldCheck />
                          <span className={`text-[14.5px] ${hl ? 'text-[#eef3f1]' : 'text-[#3f4a47]'}`} dangerouslySetInnerHTML={{ __html: feat }} />
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-5 flex items-center gap-[9px] rounded-[10px] px-[13px] py-[11px]"
                      style={{ background: hl ? 'rgba(212,168,83,.16)' : 'rgba(212,168,83,.14)' }}
                    >
                      <span className="text-sm leading-none" style={{ color: hl ? '#e8c682' : '#b88a2e' }}>✦</span>
                      <span className="text-[13px] font-medium" style={{ color: hl ? '#e8c682' : '#9c7b2e' }}>{plan.ai}</span>
                    </div>

                    <Link
                      href="/plans"
                      className={`mt-[18px] rounded-full py-3.5 text-center text-[15px] font-semibold transition-all ${
                        hl
                          ? 'bg-gold-500 font-bold text-resort-900 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(212,168,83,0.35)]'
                          : 'border-[1.5px] border-resort-600 text-resort-600 hover:bg-resort-600 hover:text-white'
                      }`}
                    >
                      Start free trial
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Enterprise strip */}
          <Reveal className="mx-auto mt-6 flex max-w-[1080px] flex-wrap items-center justify-between gap-[18px] rounded-[18px] border border-[rgba(25,64,59,0.1)] bg-[#faf8f4] px-[34px] py-[26px]">
            <div className="flex flex-wrap items-center gap-[18px]">
              <div className="font-display text-[21px] font-semibold text-resort-900">Enterprise</div>
              <div className="max-w-[560px] text-[14.5px] leading-[1.5] text-[#5b6360]">
                For hotel groups &amp; chains — white-label, custom AI caps, dedicated infrastructure and negotiated pricing.
              </div>
            </div>
            <Link
              href="/contact"
              className="whitespace-nowrap rounded-full bg-resort-900 px-[26px] py-3 text-[14.5px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-resort-600"
            >
              Contact sales
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── DESKTOP APP ── */}
      <section id="desktop-app" className="border-b border-[rgba(25,64,59,0.08)] bg-[#faf8f4] px-7 py-[110px]">
        <div className="mx-auto max-w-[1180px]">
          <Reveal className="mx-auto max-w-[640px] text-center">
            <Eyebrow label="For your front desk" centered />
            <h2 className="mb-3.5 mt-[18px] font-display text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.1] tracking-[-0.02em] text-resort-900">
              A desktop app for the front desk.
            </h2>
            <p className="text-[1.12rem] leading-[1.6] text-[#5b6360]">
              Runs alongside your browser, syncs offline bookings automatically, and connects a fingerprint
              attendance device — no extra tab, no lost connection at checkout.
            </p>
          </Reveal>

          <div className="mx-auto mt-[54px] grid max-w-[820px] grid-cols-1 gap-6 sm:grid-cols-2">
            {DOWNLOADS.map((d, i) => (
              <Reveal key={d.os} delay={i * 80}>
                <div className="flex h-full flex-col items-center rounded-[20px] border border-[rgba(25,64,59,0.1)] bg-white p-9 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(35,118,106,0.09)]">
                    {d.icon}
                  </span>
                  <div className="mt-5 font-display text-[19px] font-semibold text-resort-900">{d.os}</div>
                  <div className="mt-1.5 text-[13.5px] text-[#8a918d]">{d.note}</div>
                  <a
                    href={d.url}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-resort-900 px-7 py-3 text-[14.5px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-resort-600"
                  >
                    Download for {d.os}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="bg-resort-900 px-7 py-[110px]">
        <div className="mx-auto max-w-[1180px]">
          <Reveal className="mx-auto max-w-[680px] text-center">
            <Eyebrow label="Built for how resorts work" centered dark />
            <h2 className="mt-[18px] font-display text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.1] tracking-[-0.02em] text-white">
              Why teams switch to ResortPro — and stay.
            </h2>
          </Reveal>

          {/* Stat band */}
          <Reveal className="my-[54px] mb-[60px] flex flex-wrap items-center justify-center gap-x-[clamp(28px,6vw,80px)] gap-y-8">
            {STATS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-x-[clamp(28px,6vw,80px)]">
                {i > 0 && <span className="hidden h-12 w-px bg-white/[0.14] sm:block" />}
                <div className="text-center">
                  <div className="font-display text-[clamp(2.4rem,4vw,3.2rem)] font-semibold leading-none text-gold-500">{s.stat}</div>
                  <div className="mt-2 text-[13.5px] tracking-[0.02em] text-[#a9bcb6]">{s.label}</div>
                </div>
              </div>
            ))}
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 80}>
                <div className="h-full rounded-[18px] border border-white/10 bg-white/[0.04] p-8">
                  <div className="text-[15px] font-semibold text-gold-500">{b.title}</div>
                  <p className="mt-3 text-[16px] leading-[1.65] text-[#eef3f1]">{b.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="px-7 py-[110px]">
        <div className="mx-auto max-w-[760px]">
          <Reveal className="text-center">
            <Eyebrow label="Good to know" centered />
            <h2 className="mt-[18px] font-display text-[clamp(2rem,4vw,3.1rem)] font-medium leading-[1.1] tracking-[-0.02em] text-resort-900">
              Questions, answered.
            </h2>
          </Reveal>

          <div className="mt-[46px] border-t border-[rgba(25,64,59,0.12)]">
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div key={i} className="border-b border-[rgba(25,64,59,0.12)]">
                  <button
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    className="flex w-full items-center justify-between gap-5 px-1 py-6 text-left"
                  >
                    <span className="text-[17.5px] font-semibold text-resort-900">{faq.q}</span>
                    <span
                      className="flex-none text-2xl font-light leading-none text-resort-600 transition-transform duration-300"
                      style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
                    >
                      +
                    </span>
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-[400ms] ease-out"
                    style={{ maxHeight: open ? 240 : 0, opacity: open ? 1 : 0 }}
                  >
                    <p className="m-0 max-w-[640px] px-1 pb-6 text-[15.5px] leading-[1.65] text-[#5b6360]">{faq.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-resort-900 px-7 py-[100px] text-center">
        <Reveal className="mx-auto max-w-[720px]">
          <h2 className="mb-[18px] font-display text-[clamp(2.2rem,4.6vw,3.6rem)] font-medium leading-[1.08] tracking-[-0.02em] text-white">
            Your front desk, finally at peace.
          </h2>
          <p className="mb-[34px] text-[1.15rem] leading-[1.6] text-[#cdd9d5]">
            Start free today. Be taking online bookings by tonight.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/plans"
              className="rounded-full bg-gold-500 px-8 py-[15px] text-[15.5px] font-bold text-resort-900 transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(212,168,83,0.35)]"
            >
              Start free trial
            </Link>
            <Link
              href="/contact"
              className="rounded-full border-[1.5px] border-white/30 px-[30px] py-3.5 text-[15.5px] font-semibold text-[#eef3f1] transition-all hover:border-white hover:bg-white/[0.06]"
            >
              Book a demo
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#142f2b] px-7 pb-10 pt-16">
        <div className="mx-auto max-w-[1180px]">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 min-w-[220px] sm:col-span-3 lg:col-span-1">
              <a href="#top" className="mb-4 flex items-center gap-[11px]">
                <LogoMark size={28} dotBg="#23766a" />
                <span className="font-display text-[19px] font-semibold text-[#f2efe9]">ResortPro</span>
              </a>
              <p className="max-w-[260px] text-sm leading-[1.6] text-[#90a39e]">
                The calm operating system for resorts in Bangladesh and beyond.
              </p>
            </div>

            {[
              { title: 'Product', links: [['Features', '#features'], ['Pricing', '#pricing'], ['Embed SDK', '#'], ['Changelog', '#']] },
              { title: 'Company', links: [['About', '#'], ['Careers', '#'], ['Blog', '#']] },
              { title: 'Resources', links: [['Docs', '#'], ['Help center', '#faq'], ['Status', '#']] },
              { title: 'Legal', links: [['Privacy', '/privacy'], ['Terms', '/terms'], ['Refund', '/refund']] },
            ].map((col) => (
              <div key={col.title}>
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#7f938e]">{col.title}</div>
                <div className="flex flex-col gap-[11px]">
                  {col.links.map(([label, href]) => (
                    <a key={label} href={href} className="text-sm text-[#c2d0cb] transition-colors hover:text-white">{label}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="my-6 mt-11 h-px bg-white/10" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-[13px] text-[#7f938e]">© 2026 ResortPro. Made in Bangladesh.</span>
            <div className="flex items-center gap-[22px]">
              <span className="text-[13px] text-[#90a39e]">English (BD)</span>
              <div className="flex gap-3.5">
                {['Twitter', 'LinkedIn', 'Facebook'].map((s) => (
                  <a key={s} href="#" className="text-[13px] text-[#90a39e] transition-colors hover:text-white">{s}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
