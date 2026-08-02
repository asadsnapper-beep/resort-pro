'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import {
  Loader2, Sparkles, ChevronRight, Languages, Crown, Briefcase,
  BarChart3, ConciergeBell, Megaphone, Code2, ChefHat, Mail,
} from 'lucide-react';

// Once a visitor gives their email, remember it on this browser so every
// role card is instantly explorable afterward — no re-asking per role.
const DEMO_EMAIL_KEY = 'rp_demo_email';

// ─── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  {
    role:        'OWNER',
    title:       'Resort Owner',
    titleBn:     'রিসোর্ট মালিক',
    icon:        Crown,
    description: 'See everything — revenue, analytics, settings, all operations.',
    descBn:      'সব কিছু দেখতে পাবেন — revenue, analytics, settings, সব',
    badge:       'Full Access',
    primary:     true,
    features:    ['Dashboard & Analytics', 'All Bookings & Revenue', 'Staff & Settings', 'Billing & Plans', 'SMS Marketing'],
  },
  {
    role:        'MANAGER',
    title:       'General Manager',
    titleBn:     'জেনারেল ম্যানেজার',
    icon:        Briefcase,
    description: 'Manage daily operations — bookings, guests, staff, housekeeping.',
    descBn:      'বুকিং, গেস্ট, স্টাফ, হাউসকিপিং ম্যানেজ করুন',
    badge:       'Operations',
    features:    ['Booking Management', 'Guest Profiles', 'Housekeeping', 'Support Tickets', 'Reports'],
  },
  {
    role:        'SHAREHOLDER',
    title:       'Shareholder',
    titleBn:     'শেয়ারহোল্ডার / বিনিয়োগকারী',
    icon:        BarChart3,
    description: 'View analytics and revenue performance. Read-only financial overview.',
    descBn:      'Analytics এবং revenue দেখুন — শুধু পড়ার অ্যাক্সেস',
    badge:       'Read-Only',
    features:    ['Dashboard Stats', 'Revenue Analytics', 'Expense Overview', 'Monthly Reports'],
  },
  {
    role:        'RECEPTIONIST',
    title:       'Receptionist',
    titleBn:     'রিসেপশনিস্ট',
    icon:        ConciergeBell,
    description: 'Handle check-ins, check-outs, new bookings and guest requests.',
    descBn:      'চেক-ইন, চেক-আউট এবং নতুন বুকিং handle করুন',
    badge:       'Front Desk',
    features:    ['Check-in / Check-out', 'Walk-in Bookings', 'Guest Requests', 'Room Status', 'Invoices'],
  },
  {
    role:        'MARKETER',
    title:       'Marketing Manager',
    titleBn:     'মার্কেটিং ম্যানেজার',
    icon:        Megaphone,
    description: 'Manage website, CRM, email campaigns and SMS marketing.',
    descBn:      'ওয়েবসাইট, CRM, email ও SMS marketing ম্যানেজ করুন',
    badge:       'Marketing',
    features:    ['Website Management', 'CRM & Email', 'SMS Marketing', 'Guest Analytics', 'Campaigns'],
  },
  {
    role:        'DEVELOPER',
    title:       'Developer',
    titleBn:     'ডেভেলপার / IT স্টাফ',
    icon:        Code2,
    description: 'Access embed widget settings, API keys and website integration.',
    descBn:      'Embed widget, API key এবং website integration দেখুন',
    badge:       'Technical',
    features:    ['Embed Widget SDK', 'Website Settings', 'API Configuration', 'Integration Docs'],
  },
  {
    role:        'STAFF',
    title:       'Housekeeping Staff',
    titleBn:     'হাউসকিপিং স্টাফ',
    icon:        Sparkles,
    description: 'View assigned cleaning tasks, update room status, log issues.',
    descBn:      'নিজের কাজের তালিকা দেখুন এবং রুম status update করুন',
    badge:       'Staff View',
    features:    ['Housekeeping Tasks', 'Room Status', 'Maintenance Logs', 'Food Orders'],
  },
  {
    role:        'CHEF',
    title:       'Chef',
    titleBn:     'শেফ',
    icon:        ChefHat,
    description: 'View incoming food orders and update order status in real-time.',
    descBn:      'F&B অর্ডার দেখুন এবং রান্নার status update করুন',
    badge:       'Kitchen View',
    features:    ['F&B Orders', 'Order Status Update', 'Live Order Queue'],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
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

  // One-time gate: a returning visitor who already gave their email on this
  // browser skips straight to the role picker, no re-prompt.
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

      setAuth(
        user,
        { ...tenant, isDemo: true },
        token,
        undefined,
      );

      router.replace('/dashboard');
    } catch (err: unknown) {
      setLoading(null);
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(`Demo login failed: ${msg ?? (isBn ? 'API server বন্ধ থাকতে পারে। আবার চেষ্টা করুন।' : 'API server may be down. Please try again.')}`);
    }
  };

  // Once the email is captured, role cards log straight in — no per-role
  // prompt. The overlay below blocks these clicks until email is given.
  const handleRoleSelect = (role: string) => {
    if (!capturedEmail) return;
    startDemo(role, capturedEmail);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(isBn ? 'সঠিক email address দিন' : 'Please enter a valid email address');
      return;
    }
    window.localStorage.setItem(DEMO_EMAIL_KEY, trimmed);
    setCapturedEmail(trimmed);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-resort-900 to-resort-700 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
        <a href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-500 font-display">
            <span className="font-bold text-resort-900 text-sm">R</span>
          </div>
          <span className="font-display font-semibold text-white text-lg">ResortPro</span>
        </a>
        <div className="flex items-center gap-3">
          <button
            onClick={switchLocale}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <Languages className="h-4 w-4" />
            <span>{isBn ? 'English' : 'বাংলা'}</span>
          </button>
          <a href="/" className="text-sm text-white/50 hover:text-white transition-colors">
            {isBn ? '← হোমে ফিরুন' : '← Back to Home'}
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-14">

        {/* Headline */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-gold-500/15 border border-gold-500/30 px-4 py-1.5 text-gold-400 text-sm font-medium mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            {isBn ? 'ইন্টারেক্টিভ ডেমো — সাইনআপ লাগবে না' : 'Interactive Demo — No sign-up required'}
          </div>
          <h1 className="font-display text-4xl font-bold text-white mb-3">
            {isBn ? 'কোন role-এ demo দেখতে চান?' : 'Which role would you like to explore?'}
          </h1>
          <p className="text-white/50 text-lg">
            {isBn ? 'আপনার role বেছে নিন এবং ResortPro explore করুন' : 'Choose your role to explore ResortPro from that perspective'}
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
            <button
              key={r.role}
              onClick={() => handleRoleSelect(r.role)}
              disabled={loading !== null}
              className={`group relative text-left rounded-2xl border transition-all duration-200 p-6 bg-white/[0.04] hover:bg-white/[0.06] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed ${
                r.primary
                  ? 'border-gold-500/50 shadow-[0_0_0_1px_rgba(212,168,83,0.15),0_12px_32px_-8px_rgba(212,168,83,0.25)] hover:border-gold-500/80'
                  : 'border-white/10 hover:border-gold-500/30 hover:shadow-xl'
              }`}
            >
              {/* Loading overlay */}
              {loading === r.role && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isBn ? 'লগইন হচ্ছে...' : 'Logging in...'}
                  </div>
                </div>
              )}

              {/* Top row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${r.primary ? 'bg-gold-500/15' : 'bg-white/[0.06]'}`}>
                    <Icon className={`h-5 w-5 ${r.primary ? 'text-gold-400' : 'text-white/70'}`} />
                  </span>
                  <div>
                    <p className="font-display font-bold text-white text-lg leading-tight">{isBn ? r.titleBn : r.title}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${r.primary ? 'bg-gold-500/15 text-gold-400' : 'bg-white/[0.08] text-white/60'}`}>
                  {r.badge}
                </span>
              </div>

              {/* Description */}
              <p className="text-white/60 text-sm mb-5">{isBn ? r.descBn : r.description}</p>

              {/* Feature list */}
              <ul className="space-y-1.5">
                {r.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/30 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA arrow */}
              <div className={`mt-5 flex items-center gap-1 text-sm font-semibold transition-colors ${r.primary ? 'text-gold-400 group-hover:text-gold-300' : 'text-white/70 group-hover:text-white'}`}>
                {loading === r.role ? (
                  <span>{isBn ? 'লগইন হচ্ছে...' : 'Setting up your demo...'}</span>
                ) : (
                  <>
                    <span>{isBn ? `${r.titleBn} হিসেবে দেখুন` : `Explore as ${r.title}`}</span>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </div>
            </button>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-white/30 text-sm mt-10">
          {isBn
            ? <>🔒 এটি একটি sandbox demo — কোনো real data বা account দরকার নেই।<br />Demo session ৯০ মিনিট পর শেষ হয়।</>
            : <>🔒 This is a sandboxed demo environment — no real data, no account needed.<br />Demo session expires after 90 minutes.</>
          }
        </p>
      </div>

      {checkedStorage && !capturedEmail && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-resort-900 p-6 shadow-2xl">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/15">
              <Mail className="h-5 w-5 text-gold-400" />
            </div>

            <h2 className="font-display text-xl font-bold text-white mb-2">
              {isBn ? 'Demo দেখতে email দিন' : 'Enter your email to explore the demo'}
            </h2>
            <p className="text-white/50 text-sm mb-5">
              {isBn
                ? 'একবার email দিলেই হবে — এরপর যেকোনো role-এ demo দেখতে পারবেন, আবার চাইবে না। স্প্যাম নেই।'
                : "Just once — after this you can explore any role's demo freely, no re-asking. No spam."}
            </p>

            <form onSubmit={handleEmailSubmit}>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-gold-500/50"
              />
              {emailError && <p className="mt-2 text-xs text-red-400">{emailError}</p>}

              <button
                type="submit"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-3 text-sm font-semibold text-resort-900 transition-all hover:bg-gold-400"
              >
                {isBn ? 'Demo দেখুন' : 'Continue to demo'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
