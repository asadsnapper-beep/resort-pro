'use client';

import { useEffect, useState } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  Gift, Loader2, Users, DollarSign, TrendingUp,
  ChevronDown, ChevronRight, Copy, CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReferralTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planStatus: string;
  isActive: boolean;
  createdAt: string;
  trialEndsAt?: string | null;
}

interface ReferrerStat {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planStatus: string;
  referralCode: string;
  totalReferrals: number;
  converted: number;
  conversionRate: number;
  attributedMrr: number;
  referrals: ReferralTenant[];
}

interface RecentReferral extends ReferralTenant {
  referrer: { id: string; name: string; slug: string; referralCode: string } | null;
}

interface ReferralData {
  summary: {
    totalReferred: number;
    totalConverted: number;
    conversionRate: number;
    totalAttributedMrr: number;
    activeReferrers: number;
  };
  referrers: ReferrerStat[];
  recentReferrals: RecentReferral[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  FREE: 'text-gray-400 bg-gray-700/50',
  STARTER: 'text-blue-400 bg-blue-500/15',
  PROFESSIONAL: 'text-indigo-400 bg-indigo-500/15',
  ENTERPRISE: 'text-purple-400 bg-purple-500/15',
};

const STATUS_COLORS: Record<string, string> = {
  trialing: 'text-amber-400 bg-amber-500/15',
  active: 'text-emerald-400 bg-emerald-500/15',
  past_due: 'text-red-400 bg-red-500/15',
  canceled: 'text-gray-400 bg-gray-700/50',
};

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// ── Referrer Row (expandable) ─────────────────────────────────────────────────

function ReferrerRow({ r }: { r: ReferrerStat }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(r.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <tr
        className="hover:bg-gray-800/40 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        {/* Expand icon + name */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            {open
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            }
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 uppercase shrink-0">
              {r.name[0]}
            </div>
            <div>
              <p className="text-white text-sm font-medium">{r.name}</p>
              <p className="text-gray-600 text-xs font-mono">{r.slug}</p>
            </div>
          </div>
        </td>

        {/* Referral code */}
        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 font-mono text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg hover:bg-cyan-500/20 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {r.referralCode}
          </button>
        </td>

        {/* Total referrals */}
        <td className="px-4 py-4 text-center">
          <span className="text-white font-semibold">{r.totalReferrals}</span>
        </td>

        {/* Converted */}
        <td className="px-4 py-4 text-center">
          <span className="text-emerald-400 font-semibold">{r.converted}</span>
          <span className="text-gray-600 text-xs ml-1">/ {r.totalReferrals}</span>
        </td>

        {/* Conversion rate */}
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${r.conversionRate}%` }}
              />
            </div>
            <span className="text-gray-400 text-xs w-8 text-right">{r.conversionRate}%</span>
          </div>
        </td>

        {/* MRR attributed */}
        <td className="px-4 py-4">
          <span className="text-emerald-400 font-semibold text-sm">
            {r.attributedMrr > 0 ? `$${r.attributedMrr}/mo` : '—'}
          </span>
        </td>

        {/* Plan badge */}
        <td className="px-4 py-4">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PLAN_COLORS[r.plan] ?? PLAN_COLORS.FREE)}>
            {r.plan}
          </span>
        </td>
      </tr>

      {/* Expanded — referrals list */}
      {open && (
        <tr>
          <td colSpan={7} className="px-5 pb-4 pt-0">
            <div className="ml-10 bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-700/50">
                <p className="text-gray-400 text-xs font-medium">Tenants referred by {r.name}</p>
              </div>
              <div className="divide-y divide-gray-700/30">
                {r.referrals.map(ref => (
                  <div key={ref.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-6 h-6 rounded-md bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 uppercase shrink-0">
                      {ref.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-sm font-medium truncate">{ref.name}</p>
                      <p className="text-gray-600 text-xs font-mono">{ref.slug}</p>
                    </div>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[ref.planStatus] ?? STATUS_COLORS.canceled)}>
                      {ref.planStatus}
                    </span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', PLAN_COLORS[ref.plan] ?? PLAN_COLORS.FREE)}>
                      {ref.plan}
                    </span>
                    <p className="text-gray-600 text-xs shrink-0">{timeAgo(ref.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminEndpoints.getReferrals()
      .then(r => setData(r.data.data))
      .catch(() => toast({ title: 'Failed to load referral data', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, referrers, recentReferrals } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Referral Tracking</h1>
        <p className="text-gray-500 text-sm mt-1">Who is referring new resorts to ResortPro</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Referred', value: summary.totalReferred, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/15' },
          { label: 'Converted', value: summary.totalConverted, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
          { label: 'Conversion Rate', value: `${summary.conversionRate}%`, icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
          { label: 'Attributed MRR', value: `$${summary.totalAttributedMrr}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/15' },
          { label: 'Active Referrers', value: summary.activeReferrers, icon: Gift, color: 'text-amber-400', bg: 'bg-amber-500/15' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* How referrals work info */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Gift className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-indigo-300 font-medium text-sm">How referrals work</p>
            <p className="text-indigo-400/70 text-xs mt-1 leading-relaxed">
              Every tenant gets a unique referral code (e.g. <span className="font-mono bg-indigo-900/50 px-1.5 py-0.5 rounded">SUNSET-A3K9</span>).
              Share as <span className="font-mono bg-indigo-900/50 px-1.5 py-0.5 rounded">resortpro.com/auth/register?ref=SUNSET-A3K9</span>.
              When someone signs up with that link, they're tracked as a referral.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Referrer leaderboard table */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">Referrers</h2>
            <span className="text-xs text-gray-500">{referrers.length} active referrers</span>
          </div>

          {referrers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Gift className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-gray-400 font-medium text-sm">No referrals yet</p>
              <p className="text-gray-600 text-xs mt-1">Referral codes are auto-generated on signup</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Referrer</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Code</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Total</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Paid</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Rate</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">MRR</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {referrers.map(r => <ReferrerRow key={r.id} r={r} />)}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent referral signups */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Recent Referral Signups</h2>
          </div>

          {recentReferrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <p className="text-gray-500 text-sm">No referred signups yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60 max-h-[500px] overflow-y-auto">
              {recentReferrals.map(r => (
                <div key={r.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 uppercase shrink-0 mt-0.5">
                      {r.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{r.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[r.planStatus] ?? STATUS_COLORS.canceled)}>
                          {r.planStatus}
                        </span>
                        <span className="text-gray-600 text-[10px]">{timeAgo(r.createdAt)}</span>
                      </div>
                      {r.referrer && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <ArrowRight className="w-3 h-3 text-gray-700 rotate-180 shrink-0" />
                          <p className="text-gray-600 text-[10px] truncate">
                            via <span className="text-gray-500">{r.referrer.name}</span>
                            <span className="font-mono text-gray-700 ml-1">({r.referrer.referralCode})</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', PLAN_COLORS[r.plan] ?? PLAN_COLORS.FREE)}>
                      {r.plan}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
