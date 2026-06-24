'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { Loader2, Sparkles, ChevronRight, Languages } from 'lucide-react';

// ─── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  {
    role:        'OWNER',
    title:       'Resort Owner',
    titleBn:     'রিসোর্ট মালিক',
    emoji:       '👑',
    description: 'See everything — revenue, analytics, settings, all operations.',
    descBn:      'সব কিছু দেখতে পাবেন — revenue, analytics, settings, সব',
    border:      'border-resort-500',
    badge:       'Full Access',
    badgeColor:  'bg-emerald-900/60 text-emerald-300',
    features:    ['Dashboard & Analytics', 'All Bookings & Revenue', 'Staff & Settings', 'Billing & Plans', 'SMS Marketing'],
  },
  {
    role:        'MANAGER',
    title:       'General Manager',
    titleBn:     'জেনারেল ম্যানেজার',
    emoji:       '👔',
    description: 'Manage daily operations — bookings, guests, staff, housekeeping.',
    descBn:      'বুকিং, গেস্ট, স্টাফ, হাউসকিপিং ম্যানেজ করুন',
    border:      'border-blue-500',
    badge:       'Operations',
    badgeColor:  'bg-blue-900/60 text-blue-300',
    features:    ['Booking Management', 'Guest Profiles', 'Housekeeping', 'Support Tickets', 'Reports'],
  },
  {
    role:        'SHAREHOLDER',
    title:       'Shareholder',
    titleBn:     'শেয়ারহোল্ডার / বিনিয়োগকারী',
    emoji:       '📊',
    description: 'View analytics and revenue performance. Read-only financial overview.',
    descBn:      'Analytics এবং revenue দেখুন — শুধু পড়ার অ্যাক্সেস',
    border:      'border-amber-500',
    badge:       'Read-Only',
    badgeColor:  'bg-amber-900/60 text-amber-300',
    features:    ['Dashboard Stats', 'Revenue Analytics', 'Expense Overview', 'Monthly Reports'],
  },
  {
    role:        'RECEPTIONIST',
    title:       'Receptionist',
    titleBn:     'রিসেপশনিস্ট',
    emoji:       '🛎️',
    description: 'Handle check-ins, check-outs, new bookings and guest requests.',
    descBn:      'চেক-ইন, চেক-আউট এবং নতুন বুকিং handle করুন',
    border:      'border-purple-500',
    badge:       'Front Desk',
    badgeColor:  'bg-purple-900/60 text-purple-300',
    features:    ['Check-in / Check-out', 'Walk-in Bookings', 'Guest Requests', 'Room Status', 'Invoices'],
  },
  {
    role:        'MARKETER',
    title:       'Marketing Manager',
    titleBn:     'মার্কেটিং ম্যানেজার',
    emoji:       '📣',
    description: 'Manage website, CRM, email campaigns and SMS marketing.',
    descBn:      'ওয়েবসাইট, CRM, email ও SMS marketing ম্যানেজ করুন',
    border:      'border-pink-500',
    badge:       'Marketing',
    badgeColor:  'bg-pink-900/60 text-pink-300',
    features:    ['Website Management', 'CRM & Email', 'SMS Marketing', 'Guest Analytics', 'Campaigns'],
  },
  {
    role:        'DEVELOPER',
    title:       'Developer',
    titleBn:     'ডেভেলপার / IT স্টাফ',
    emoji:       '💻',
    description: 'Access embed widget settings, API keys and website integration.',
    descBn:      'Embed widget, API key এবং website integration দেখুন',
    border:      'border-slate-500',
    badge:       'Technical',
    badgeColor:  'bg-slate-700/60 text-slate-300',
    features:    ['Embed Widget SDK', 'Website Settings', 'API Configuration', 'Integration Docs'],
  },
  {
    role:        'STAFF',
    title:       'Housekeeping Staff',
    titleBn:     'হাউসকিপিং স্টাফ',
    emoji:       '🧹',
    description: 'View assigned cleaning tasks, update room status, log issues.',
    descBn:      'নিজের কাজের তালিকা দেখুন এবং রুম status update করুন',
    border:      'border-amber-500',
    badge:       'Staff View',
    badgeColor:  'bg-amber-900/60 text-amber-300',
    features:    ['Housekeeping Tasks', 'Room Status', 'Maintenance Logs', 'Food Orders'],
  },
  {
    role:        'CHEF',
    title:       'Chef',
    titleBn:     'শেফ',
    emoji:       '👨‍🍳',
    description: 'View incoming food orders and update order status in real-time.',
    descBn:      'F&B অর্ডার দেখুন এবং রান্নার status update করুন',
    border:      'border-red-500',
    badge:       'Kitchen View',
    badgeColor:  'bg-red-900/60 text-red-300',
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

  const switchLocale = useCallback(() => {
    const next = isBn ? 'en' : 'bn';
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  }, [isBn, router]);

  const handleRoleSelect = async (role: string) => {
    setLoading(role);
    clearAuth();

    try {
      const res = await api.post('/auth/demo-login', { role });
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

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#0d1f1c' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-500">
            <span className="font-bold text-resort-900 text-sm">R</span>
          </div>
          <span className="font-semibold text-white text-lg">ResortPro</span>
        </div>
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
          <h1 className="text-4xl font-bold text-white mb-3">
            {isBn ? 'কোন role-এ demo দেখতে চান?' : 'Which role would you like to explore?'}
          </h1>
          <p className="text-white/50 text-lg">
            {isBn ? 'আপনার role বেছে নিন এবং ResortPro explore করুন' : 'Choose your role to explore ResortPro from that perspective'}
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => handleRoleSelect(r.role)}
              disabled={loading !== null}
              style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
      className={`group relative text-left rounded-2xl border transition-all duration-200 p-6 ${r.border} hover:border-opacity-80 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed`}
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
                  <span className="text-4xl">{r.emoji}</span>
                  <div>
                    <p className="font-bold text-white text-lg leading-tight">{isBn ? r.titleBn : r.title}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${r.badgeColor}`}>
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
              <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-white/70 group-hover:text-white transition-colors">
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
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-white/30 text-sm mt-10">
          {isBn
            ? <>🔒 এটি একটি sandbox demo — কোনো real data বা account দরকার নেই।<br />Demo session ৯০ মিনিট পর শেষ হয়।</>
            : <>🔒 This is a sandboxed demo environment — no real data, no account needed.<br />Demo session expires after 90 minutes.</>
          }
        </p>
      </div>
    </div>
  );
}
