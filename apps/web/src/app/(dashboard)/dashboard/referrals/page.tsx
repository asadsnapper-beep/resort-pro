'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api';
import {
  Gift, Link2, Copy, Check, Users, Clock, Award,
  Share2, MessageCircle, Mail, ExternalLink, Loader2,
  ChevronRight, Sparkles, CreditCard,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface ReferralEntry {
  id: string;
  status: 'PENDING' | 'REWARDED' | 'NO_REWARD';
  rewardType: string | null;
  rewardAmount: number | null;
  rewardPlan: string | null;
  rewardMonths: number | null;
  rewardNote: string | null;
  rewardedAt: string | null;
  createdAt: string;
  referred: {
    name: string;
    slug: string;
    plan: string;
    planStatus: string;
    createdAt: string;
  };
}

interface ReferralData {
  referralCode: string | null;
  referralLink: string | null;
  accountCredit: number;
  freeUntil: string | null;
  stats: { total: number; rewarded: number; pending: number };
  referrals: ReferralEntry[];
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function statusBadge(status: ReferralEntry['status']) {
  if (status === 'REWARDED')   return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Rewarded</span>;
  if (status === 'NO_REWARD')  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-500 border border-gray-700">No reward</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>;
}

function rewardDescription(r: ReferralEntry) {
  if (!r.rewardType || r.rewardType === 'NONE') return '—';
  if (r.rewardType === 'CREDIT') return `৳${r.rewardAmount?.toLocaleString()} account credit`;
  if (r.rewardType === 'FREE_PLAN') return `${r.rewardMonths} months ${r.rewardPlan} free`;
  return '—';
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);

  const { data: d, isLoading } = useQuery<ReferralData>({
    queryKey: ['tenant-referrals'],
    queryFn:  () => tenantApi.getReferrals().then(r => r.data.data),
  });
  const link = d?.referralLink ?? '';

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copied!' });
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `আমি ResortPro ব্যবহার করছি — resort management-এর জন্য দারুণ একটা platform! এখানে signup করুন: ${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const shareEmail = () => {
    const sub = encodeURIComponent('ResortPro-তে যোগ দিন');
    const body = encodeURIComponent(`আমি ResortPro ব্যবহার করছি এবং আপনাকেও সুপারিশ করতে চাই। আমার referral link দিয়ে signup করলে আপনি বিশেষ সুবিধা পেতে পারেন:\n\n${link}`);
    window.open(`mailto:?subject=${sub}&body=${body}`);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-resort-500" />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Gift className="h-6 w-6 text-resort-600" /> Referral Program
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Share your link — যে resort signup করবে তার জন্য admin reward দেবে।
        </p>
      </div>

      {/* Account credit / free plan banner */}
      {(d?.accountCredit ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl px-5 py-4">
          <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <div>
            <p className="font-semibold text-green-700 dark:text-green-300">
              Account Credit: ৳{d!.accountCredit.toLocaleString()}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
              পরের invoice থেকে automatically deduct হবে।
            </p>
          </div>
        </div>
      )}
      {d?.freeUntil && new Date(d.freeUntil) > new Date() && (
        <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl px-5 py-4">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div>
            <p className="font-semibold text-indigo-700 dark:text-indigo-300">
              Free Plan Active — until {new Date(d.freeUntil).toLocaleDateString('en-GB', { dateStyle: 'long' })}
            </p>
            <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-0.5">
              Referral reward হিসেবে আপনার plan free করা হয়েছে।
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Referrals', value: d?.stats.total ?? 0, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Pending Reward', value: d?.stats.pending ?? 0, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
          { label: 'Rewarded',       value: d?.stats.rewarded ?? 0, icon: Award, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 text-center">
            <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${bg} mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Referral Link */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="h-4 w-4 text-resort-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Your Referral Link</h2>
        </div>

        {link ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 overflow-hidden">
                <ExternalLink className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-mono">{link}</span>
              </div>
              <button onClick={copyLink}
                className="flex items-center gap-2 px-4 py-2.5 bg-resort-600 hover:bg-resort-700 text-white text-sm font-semibold rounded-xl transition-colors shrink-0">
                {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}
              </button>
            </div>

            {/* Share buttons */}
            <div className="flex gap-2 pt-1">
              <button onClick={shareWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
              <button onClick={shareEmail}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors border border-gray-200 dark:border-gray-700">
                <Mail className="h-4 w-4" /> Email
              </button>
            </div>

            <p className="text-xs text-gray-500 pt-1">
              কেউ এই link দিয়ে signup করলে admin আপনাকে reward করবে — account credit অথবা plan upgrade।
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">Referral link generate হয়নি। Support-এ যোগাযোগ করুন।</p>
        )}
      </div>

      {/* How it works */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Share2 className="h-4 w-4 text-resort-600" /> কীভাবে কাজ করে?
        </h2>
        <div className="space-y-3">
          {[
            { step: '1', text: 'আপনার referral link copy করুন' },
            { step: '2', text: 'অন্য resort owner-দের সাথে share করুন — WhatsApp বা Email দিয়ে' },
            { step: '3', text: 'তারা আপনার link দিয়ে signup করলে আমরা automatically track করব' },
            { step: '4', text: 'Admin review করে আপনাকে reward দেবে — ৳ credit অথবা 2 months PROFESSIONAL free' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-resort-100 dark:bg-resort-500/20 text-resort-700 dark:text-resort-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral history */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Referral History</h2>
        </div>

        {!d?.referrals.length ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">এখনো কোনো referral নেই।</p>
            <p className="text-xs text-gray-400 mt-1">আপনার link share করুন।</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {d.referrals.map(r => (
              <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                <div className="h-9 w-9 rounded-xl bg-resort-100 dark:bg-resort-500/20 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-resort-600 dark:text-resort-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{r.referred.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Signed up {new Date(r.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                    {r.rewardType && r.rewardType !== 'NONE' && (
                      <span className="ml-2 text-green-600 dark:text-green-400">
                        · Reward: {rewardDescription(r)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="shrink-0">{statusBadge(r.status)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
