'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  ChefHat,
  Code2,
  ConciergeBell,
  Crown,
  Languages,
  Loader2,
  Mail,
  Megaphone,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

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

const DEMO_EMAIL_KEY = 'rp_demo_email';

const ROLES = [
  {
    role: 'OWNER',
    title: 'Resort Owner',
    titleBn: 'রিসোর্ট মালিক',
    icon: Crown,
    description: 'See everything — revenue, analytics, settings, all operations.',
    descBn: 'সব কিছু দেখতে পাবেন — revenue, analytics, settings, সব',
    badge: 'Full Access',
    primary: true,
    features: [
      'Dashboard & Analytics',
      'All Bookings & Revenue',
      'Staff & Settings',
      'Billing & Plans',
      'SMS Marketing',
    ],
  },
  {
    role: 'MANAGER',
    title: 'General Manager',
    titleBn: 'জেনারেল ম্যানেজার',
    icon: Briefcase,
    description: 'Manage daily operations — bookings, guests, staff and housekeeping.',
    descBn: 'বুকিং, গেস্ট, স্টাফ, হাউসকিপিং ম্যানেজ করুন',
    badge: 'Operations',
    features: [
      'Booking Management',
      'Guest Profiles',
      'Housekeeping',
      'Support Tickets',
      'Reports',
    ],
  },
  {
    role: 'SHAREHOLDER',
    title: 'Shareholder',
    titleBn: 'শেয়ারহোল্ডার / বিনিয়োগকারী',
    icon: BarChart3,
    description: 'View analytics and revenue performance through a read-only financial view.',
    descBn: 'Analytics এবং revenue দেখুন — শুধু পড়ার অ্যাক্সেস',
    badge: 'Read-only',
    features: ['Dashboard Stats', 'Revenue Analytics', 'Expense Overview', 'Monthly Reports'],
  },
  {
    role: 'RECEPTIONIST',
    title: 'Receptionist',
    titleBn: 'রিসেপশনিস্ট',
    icon: ConciergeBell,
    description: 'Handle check-ins, check-outs, bookings and guest requests at the desk.',
    descBn: 'চেক-ইন, চেক-আউট এবং নতুন বুকিং handle করুন',
    badge: 'Front desk',
    features: [
      'Check-in / Check-out',
      'Walk-in Bookings',
      'Guest Requests',
      'Room Status',
      'Invoices',
    ],
  },
  {
    role: 'MARKETER',
    title: 'Marketing Manager',
    titleBn: 'মার্কেটিং ম্যানেজার',
    icon: Megaphone,
    description: 'Manage website, CRM, email campaigns and SMS marketing.',
    descBn: 'ওয়েবসাইট, CRM, email ও SMS marketing ম্যানেজ করুন',
    badge: 'Marketing',
    features: [
      'Website Management',
      'CRM & Email',
      'SMS Marketing',
      'Guest Analytics',
      'Campaigns',
    ],
  },
  {
    role: 'DEVELOPER',
    title: 'Developer',
    titleBn: 'ডেভেলপার / IT স্টাফ',
    icon: Code2,
    description: 'Access embed settings, API keys and website integration tools.',
    descBn: 'Embed widget, API key এবং website integration দেখুন',
    badge: 'Technical',
    features: ['Embed Widget SDK', 'Website Settings', 'API Configuration', 'Integration Docs'],
  },
  {
    role: 'STAFF',
    title: 'Housekeeping Staff',
    titleBn: 'হাউসকিপিং স্টাফ',
    icon: Sparkles,
    description: 'View assigned cleaning tasks, update room status and log issues.',
    descBn: 'নিজের কাজের তালিকা দেখুন এবং রুম status update করুন',
    badge: 'Staff view',
    features: ['Housekeeping Tasks', 'Room Status', 'Maintenance Logs', 'Food Orders'],
  },
  {
    role: 'CHEF',
    title: 'Chef',
    titleBn: 'শেফ',
    icon: ChefHat,
    description: 'View incoming food orders and update every order in real time.',
    descBn: 'F&B অর্ডার দেখুন এবং রান্নার status update করুন',
    badge: 'Kitchen view',
    features: ['F&B Orders', 'Order Status Update', 'Live Order Queue'],
  },
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

export default function DemoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const isBn = locale === 'bn';
  const { setAuth, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [capturedEmail, setCapturedEmail] = useState<string | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    // A demo-access email link carries ?email=... so opening it in a
    // different browser/app (Gmail's in-app viewer, a phone vs. the
    // desktop browser the visitor originally used) still skips the gate —
    // localStorage alone doesn't survive across browser contexts.
    const fromLink = searchParams.get('email');
    if (fromLink && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromLink)) {
      window.localStorage.setItem(DEMO_EMAIL_KEY, fromLink);
      setCapturedEmail(fromLink);
      setCheckedStorage(true);
      return;
    }
    const stored = window.localStorage.getItem(DEMO_EMAIL_KEY);
    if (stored) setCapturedEmail(stored);
    setCheckedStorage(true);
  }, [searchParams]);

  const switchLocale = useCallback(() => {
    const next = isBn ? 'en' : 'bn';
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  }, [isBn, router]);

  const startDemo = async (role: string, emailValue: string) => {
    setLoading(role);
    clearAuth();

    try {
      const res = await api.post('/auth/demo-login', { role, email: emailValue });
      const { token, user, tenant } = res.data.data;
      setAuth(user, { ...tenant, isDemo: true }, token, undefined);
      router.replace('/dashboard');
    } catch (err: unknown) {
      setLoading(null);
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(
        `Demo login failed: ${msg ?? (isBn ? 'API server বন্ধ থাকতে পারে। আবার চেষ্টা করুন।' : 'API server may be down. Please try again.')}`,
      );
    }
  };

  const handleRoleSelect = (role: string) => {
    if (capturedEmail) startDemo(role, capturedEmail);
  };

  const handleEmailSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(isBn ? 'সঠিক email address দিন' : 'Please enter a valid email address');
      return;
    }
    window.localStorage.setItem(DEMO_EMAIL_KEY, trimmed);
    setCapturedEmail(trimmed);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-white font-sans" style={{ color: NAVY }}>
      <header className="border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ResortPro home">
            <BrandMark />
            <span className="text-lg font-extrabold tracking-[-0.02px]">ResortPro</span>
          </Link>
          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              type="button"
              onClick={switchLocale}
              className="flex items-center gap-1.5 px-2 py-2 transition-colors hover:opacity-70 sm:px-3"
              style={{ color: MUTED }}
            >
              <Languages className="h-4 w-4" />
              <span>{isBn ? 'English' : 'বাংলা'}</span>
            </button>
            <Link
              href="/"
              className="hidden items-center gap-1.5 px-2 py-2 transition-colors hover:opacity-70 sm:flex"
              style={{ color: MUTED }}
            >
              <ArrowLeft className="h-4 w-4" />
              {isBn ? 'হোমে ফিরুন' : 'Back home'}
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b" style={{ background: CREAM, borderColor: BORDER }}>
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_300px] lg:items-end lg:py-20">
          <div>
            <span
              className="font-bitcount block text-[13px] font-medium uppercase tracking-[0.14em]"
              style={{ color: GOLD }}
            >
              {isBn ? 'ইন্টারঅ্যাক্টিভ প্রোডাক্ট ট্যুর' : 'Interactive product tour'}
            </span>
            <h1 className="mt-4 max-w-3xl text-[clamp(2.4rem,5vw,3.2rem)] font-extrabold leading-[1.15]">
              {isBn
                ? 'আপনার কাজের জায়গা থেকে ResortPro দেখুন।'
                : 'See ResortPro from the desk where work actually happens.'}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: MUTED }}>
              {isBn
                ? 'একটি role বেছে নিন। dashboard, booking, guest এবং daily operations কীভাবে একসাথে কাজ করে তা দেখুন।'
                : 'Choose a role, then step into a live workspace for bookings, guests and the daily operational work around them.'}
            </p>
          </div>
          <aside className="rounded-2xl p-6 text-white" style={{ background: NAVY }}>
            <span
              className="font-bitcount block text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: GOLD }}
            >
              {isBn ? 'একটি প্রকৃত ওয়ার্কস্পেস' : 'A real workspace'}
            </span>
            <p className="mt-3 text-2xl font-extrabold leading-none">
              {isBn ? 'কোনো স্লাইডশো নয়।' : 'Not a slideshow.'}
            </p>
            <p className="mt-4 text-sm leading-6 text-white/65">
              {isBn
                ? 'কোনো card দেখানোর জন্য নয়—প্রতিটি role-এর নিজের কাজের জায়গা আছে।'
                : 'Every role enters a real, role-specific workspace — not a sales deck.'}
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div
          className="mb-10 flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-end sm:justify-between"
          style={{ borderColor: BORDER }}
        >
          <div>
            <span
              className="font-bitcount block text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: GOLD }}
            >
              {isBn ? 'আপনার ভিউ বেছে নিন' : 'Choose your view'}
            </span>
            <h2 className="mt-2 text-3xl font-extrabold">
              {isBn ? 'কোন role-এ explore করতে চান?' : 'Which role do you want to explore?'}
            </h2>
          </div>
          <p className="text-sm" style={{ color: MUTED }}>
            {isBn ? 'শুরু করতে ১ মিনিটেরও কম লাগবে।' : 'It takes less than a minute to get oriented.'}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.role}
                type="button"
                onClick={() => handleRoleSelect(role.role)}
                disabled={loading !== null}
                className="group relative flex min-h-[300px] flex-col rounded-2xl border p-6 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={
                  role.primary
                    ? { background: NAVY, borderColor: NAVY, color: '#fff' }
                    : { background: CREAM, borderColor: BORDER }
                }
                onMouseEnter={(e) => {
                  if (!role.primary) e.currentTarget.style.borderColor = GOLD;
                }}
                onMouseLeave={(e) => {
                  if (!role.primary) e.currentTarget.style.borderColor = BORDER;
                }}
              >
                {loading === role.role && (
                  <span
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl text-sm font-extrabold text-white"
                    style={{ background: `${NAVY}e6` }}
                  >
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isBn ? 'লগইন হচ্ছে...' : 'Opening demo...'}
                  </span>
                )}
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={role.primary ? { background: 'rgba(255,255,255,0.12)', color: GOLD } : { background: '#fff', color: GOLD }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="mt-6 flex items-start justify-between gap-3">
                  <h3 className="text-xl font-extrabold leading-none">
                    {isBn ? role.titleBn : role.title}
                  </h3>
                  <span
                    className="font-bitcount shrink-0 text-[9px] uppercase tracking-[0.1em]"
                    style={{ color: role.primary ? GOLD : GOLD }}
                  >
                    {role.badge}
                  </span>
                </div>
                <p
                  className="mt-4 text-sm leading-6"
                  style={{ color: role.primary ? 'rgba(255,255,255,0.7)' : MUTED }}
                >
                  {isBn ? role.descBn : role.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1.5">
                  {role.features.slice(0, 3).map((feature) => (
                    <span
                      key={feature}
                      className="text-[11px]"
                      style={{ color: role.primary ? 'rgba(255,255,255,0.55)' : MUTED_LIGHT }}
                    >
                      • {feature}
                    </span>
                  ))}
                </div>
                <span
                  className="mt-auto flex items-center gap-2 pt-5 text-sm font-extrabold"
                  style={{ color: role.primary ? GOLD : NAVY }}
                >
                  {isBn ? 'এই role-এ দেখুন' : 'Explore this role'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-10 text-center text-xs leading-6" style={{ color: MUTED }}>
          {isBn ? (
            <>
              এটি একটি sandbox demo — কোনো real data বা account দরকার নেই।
              <br />
              Demo session ৯০ মিনিট পর শেষ হয়।
            </>
          ) : (
            <>
              This is a sandbox demo — no real data and no account needed.
              <br />
              Your demo session expires after 90 minutes.
            </>
          )}
        </p>
      </section>

      <footer style={{ background: NAVY }} className="text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-white/65">
            {isBn
              ? 'একটি ডাইরেক্ট বুকিং সিস্টেম কীভাবে আপনার নিজের ফ্রন্ট অফিসের মতো অনুভব হতে পারে দেখুন।'
              : 'See how a direct booking system can feel like your own front office.'}
          </p>
          <Link href="/plans" className="font-extrabold underline decoration-2 underline-offset-4" style={{ color: GOLD }}>
            {isBn ? 'সহজ প্রাইসিং দেখুন' : 'View simple pricing'}
          </Link>
        </div>
      </footer>

      {checkedStorage &&
        !capturedEmail &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: GOLD }}>
                <Mail className="h-5 w-5" />
              </span>
              <span
                className="font-bitcount mt-6 block text-[11px] font-medium uppercase tracking-[0.14em]"
                style={{ color: GOLD }}
              >
                {isBn ? 'একটি ছোট তথ্য' : 'One quick detail'}
              </span>
              <h2 className="mt-2 text-3xl font-extrabold leading-none" style={{ color: NAVY }}>
                {isBn ? 'Demo দেখতে email দিন' : 'Enter your email, then explore freely.'}
              </h2>
              <p className="mt-4 text-sm leading-6" style={{ color: MUTED }}>
                {isBn
                  ? 'একবার email দিলেই হবে। এরপর যেকোনো role-এর demo দেখতে পারবেন—আবার চাইবে না। স্প্যাম নেই।'
                  : 'We ask once, then every role is yours to explore on this browser. No spam.'}
              </p>
              <form onSubmit={handleEmailSubmit} className="mt-6">
                <label htmlFor="demo-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="demo-email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError(null);
                  }}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#94a3b8]"
                  style={{ borderColor: BORDER, color: NAVY }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = GOLD; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                />
                {emailError && (
                  <p className="mt-2 text-xs font-bold" style={{ color: '#b2402c' }}>{emailError}</p>
                )}
                <button
                  type="submit"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-sm font-extrabold text-white transition-colors"
                  style={{ background: GOLD }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = GOLD_HOVER; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = GOLD; }}
                >
                  {isBn ? 'Demo দেখুন' : 'Continue to demo'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </main>
  );
}
