'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    <span className="relative block h-7 w-7 overflow-hidden bg-white">
      <Image
        src="/brand/resortpro-logo-concept-v2.png"
        alt="ResortPro"
        fill
        sizes="28px"
        className="translate-y-[5px] scale-[1.8] object-cover mix-blend-multiply"
      />
    </span>
  );
}

export default function DemoPage() {
  const router = useRouter();
  const locale = useLocale();
  const isBn = locale === 'bn';
  const { setAuth, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [capturedEmail, setCapturedEmail] = useState<string | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(DEMO_EMAIL_KEY);
    if (stored) setCapturedEmail(stored);
    setCheckedStorage(true);
  }, []);

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
    <main className="min-h-screen overflow-hidden bg-white text-[#183153]">
      <header className="border-b-2 border-[#183153] bg-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ResortPro home">
            <BrandMark />
            <span className="font-display text-xl font-semibold tracking-[-0.045em]">
              ResortPro
            </span>
          </Link>
          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              type="button"
              onClick={switchLocale}
              className="flex items-center gap-1.5 px-2 py-2 text-[#475569] transition-colors hover:text-[#ef725c] sm:px-3"
            >
              <Languages className="h-4 w-4" />
              <span>{isBn ? 'English' : 'বাংলা'}</span>
            </button>
            <Link
              href="/"
              className="hidden items-center gap-1.5 px-2 py-2 text-[#475569] transition-colors hover:text-[#ef725c] sm:flex"
            >
              <ArrowLeft className="h-4 w-4" />
              {isBn ? 'হোমে ফিরুন' : 'Back home'}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative border-b-2 border-[#183153] bg-[#fff1ea]">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(#183153_1px,transparent_1px),linear-gradient(90deg,#183153_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_300px] lg:items-end lg:py-20">
          <div>
            <p className="font-bitcount text-[11px] font-medium uppercase tracking-[0.18em] text-[#b2402c]">
              Interactive product tour
            </p>
            <h1 className="font-display mt-4 max-w-3xl text-5xl font-semibold leading-[0.94] tracking-[-0.065em] text-[#183153] sm:text-6xl">
              {isBn
                ? 'আপনার কাজের জায়গা থেকে ResortPro দেখুন।'
                : 'See ResortPro from the desk where work actually happens.'}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#475569]">
              {isBn
                ? 'একটি role বেছে নিন। dashboard, booking, guest এবং daily operations কীভাবে একসাথে কাজ করে তা দেখুন।'
                : 'Choose a role, then step into a live workspace for bookings, guests and the daily operational work around them.'}
            </p>
          </div>
          <aside className="border-2 border-[#183153] bg-[#183153] p-5 text-white shadow-[8px_8px_0_#ef725c]">
            <p className="font-bitcount text-[10px] font-medium uppercase tracking-[0.14em] text-[#f4c76b]">
              A real workspace
            </p>
            <p className="font-display mt-3 text-2xl font-semibold leading-none tracking-[-0.04em]">
              Not a slideshow.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/65">
              {isBn
                ? 'কোনো card দেখানোর জন্য নয়—প্রতিটি role-এর নিজের কাজের জায়গা আছে।'
                : 'Every role enters a real, role-specific workspace — not a sales deck.'}
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-8 flex flex-col gap-3 border-b-2 border-[#183153] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-bitcount text-[10px] font-medium uppercase tracking-[0.16em] text-[#b2402c]">
              Choose your view
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-0.05em]">
              {isBn ? 'কোন role-এ explore করতে চান?' : 'Which role do you want to explore?'}
            </h2>
          </div>
          <p className="text-sm text-[#64748b]">
            {isBn
              ? 'শুরু করতে ১ মিনিটেরও কম লাগবে।'
              : 'It takes less than a minute to get oriented.'}
          </p>
        </div>

        <div className="grid border-l-2 border-t-2 border-[#183153] sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role, index) => {
            const Icon = role.icon;
            const mutedBackground =
              index % 3 === 1 ? 'bg-[#e5f0f7]' : index % 3 === 2 ? 'bg-[#fff1ea]' : 'bg-white';
            return (
              <button
                key={role.role}
                type="button"
                onClick={() => handleRoleSelect(role.role)}
                disabled={loading !== null}
                className={`group relative min-h-[304px] border-b-2 border-r-2 border-[#183153] p-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${role.primary ? 'bg-[#183153] text-white hover:bg-[#ef725c]' : `${mutedBackground} hover:bg-[#f4c76b]`}`}
              >
                {loading === role.role && (
                  <span className="absolute inset-0 z-10 flex items-center justify-center bg-[#183153]/90 text-sm font-extrabold text-white">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isBn ? 'লগইন হচ্ছে...' : 'Opening demo...'}
                  </span>
                )}
                <span
                  className={`flex h-10 w-10 items-center justify-center border-2 ${role.primary ? 'border-[#f4c76b] text-[#f4c76b]' : 'border-[#183153] text-[#ef725c]'}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="mt-6 flex items-start justify-between gap-3">
                  <h3 className="font-display text-2xl font-semibold leading-none tracking-[-0.045em]">
                    {isBn ? role.titleBn : role.title}
                  </h3>
                  <span
                    className={`font-bitcount shrink-0 text-[9px] uppercase tracking-[0.1em] ${role.primary ? 'text-[#f4c76b]' : 'text-[#b2402c]'}`}
                  >
                    {role.badge}
                  </span>
                </div>
                <p
                  className={`mt-4 text-sm leading-6 ${role.primary ? 'text-white/70' : 'text-[#475569]'}`}
                >
                  {isBn ? role.descBn : role.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1.5">
                  {role.features.slice(0, 3).map((feature) => (
                    <span
                      key={feature}
                      className={`text-[11px] ${role.primary ? 'text-white/55' : 'text-[#64748b]'}`}
                    >
                      • {feature}
                    </span>
                  ))}
                </div>
                <span
                  className={`absolute bottom-5 left-5 flex items-center gap-2 text-sm font-extrabold ${role.primary ? 'text-[#f4c76b]' : 'text-[#183153]'}`}
                >
                  {isBn ? 'এই role-এ দেখুন' : 'Explore this role'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-8 text-center text-xs leading-6 text-[#64748b]">
          {isBn ? (
            <>
              এটি একটি sandbox demo — কোনো real data বা account দরকার নেই।
              <br />
              Demo session ৯০ মিনিট পর শেষ হয়।
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

      <footer className="border-t-2 border-[#183153] bg-[#183153] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-white/65">
            See how a direct booking system can feel like your own front office.
          </p>
          <Link
            href="/plans"
            className="font-extrabold text-[#f4c76b] underline decoration-2 underline-offset-4"
          >
            View simple pricing
          </Link>
        </div>
      </footer>

      {checkedStorage &&
        !capturedEmail &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#183153]/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md border-2 border-[#183153] bg-white p-6 shadow-[10px_10px_0_#ef725c] sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center bg-[#ef725c] text-white">
                <Mail className="h-5 w-5" />
              </span>
              <p className="font-bitcount mt-6 text-[10px] font-medium uppercase tracking-[0.16em] text-[#b2402c]">
                One quick detail
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold leading-none tracking-[-0.05em] text-[#183153]">
                {isBn ? 'Demo দেখতে email দিন' : 'Enter your email, then explore freely.'}
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#64748b]">
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
                  className="w-full border-2 border-[#183153] bg-white px-4 py-3 text-sm text-[#183153] outline-none placeholder:text-[#94a3b8] focus:border-[#ef725c]"
                />
                {emailError && (
                  <p className="mt-2 text-xs font-bold text-[#b2402c]">{emailError}</p>
                )}
                <button
                  type="submit"
                  className="mt-4 flex w-full items-center justify-center gap-2 border-2 border-[#183153] bg-[#183153] px-4 py-3.5 text-sm font-extrabold text-white transition-colors hover:border-[#ef725c] hover:bg-[#ef725c]"
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
