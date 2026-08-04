'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api';
import {
  Gift, Link2, Copy, Check, Users, Clock, Award,
  Share2, MessageCircle, Mail, ExternalLink, Loader2, Sparkles, CreditCard,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
import { toast } from '@/hooks/use-toast';

interface ReferralEntry {
  id: string;
  status: 'PENDING' | 'REWARDED' | 'NO_REWARD';
  rewardType: string | null; rewardAmount: number | null;
  rewardPlan: string | null; rewardMonths: number | null;
  rewardNote: string | null; rewardedAt: string | null;
  createdAt: string;
  referred: { name: string; slug: string; plan: string; planStatus: string; createdAt: string };
}

interface ReferralData {
  referralCode: string | null; referralLink: string | null;
  accountCredit: number; freeUntil: string | null;
  stats: { total: number; rewarded: number; pending: number };
  referrals: ReferralEntry[];
}

function StatusPill({ status }: { status: ReferralEntry['status'] }) {
  if (status === 'REWARDED') return (
    <span className="inline-flex items-center gap-1 rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
      style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
      <Award className="h-3 w-3" /> Rewarded
    </span>
  );
  if (status === 'NO_REWARD') return (
    <span className="inline-flex items-center gap-1 rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
      style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
      No reward
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
      style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)', color: '#b89040' }}>
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

function rewardDescription(r: ReferralEntry) {
  if (!r.rewardType || r.rewardType === 'NONE') return '—';
  if (r.rewardType === 'CREDIT')    return `৳${r.rewardAmount?.toLocaleString()} account credit`;
  if (r.rewardType === 'FREE_PLAN') return `${r.rewardMonths} months ${r.rewardPlan} free`;
  return '—';
}

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
    const sub  = encodeURIComponent('ResortPro-তে যোগ দিন');
    const body = encodeURIComponent(
      `আমি ResortPro ব্যবহার করছি এবং আপনাকেও সুপারিশ করতে চাই। আমার referral link দিয়ে signup করলে আপনি বিশেষ সুবিধা পেতে পারেন:\n\n${link}`
    );
    window.open(`mailto:?subject=${sub}&body=${body}`);
  };

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#aac0d0' }} />
    </div>
  );

  return (
    <PageShell gap={6}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
          <Gift className="h-4 w-4" style={{ color: '#183153' }} />
        </div>
        <PageHeader
          title="Referral Program"
          subtitle="Share your link — যে resort signup করবে তার জন্য admin reward দেবে।"
          tightSubtitle
        />
      </div>

      {/* Reward banners */}
      {(d?.accountCredit ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-[12px] border px-5 py-4"
          style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)' }}>
          <CreditCard className="h-5 w-5 shrink-0" style={{ color: '#183153' }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#183153' }}>
              Account Credit: ৳{d!.accountCredit.toLocaleString()}
            </p>
            <p className="text-[12px] mt-0.5 text-[#475569] dark:text-[#9db4c4]">
              পরের invoice থেকে automatically deduct হবে।
            </p>
          </div>
        </div>
      )}

      {d?.freeUntil && new Date(d.freeUntil) > new Date() && (
        <div className="flex items-center gap-3 rounded-[12px] border px-5 py-4"
          style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)' }}>
          <Sparkles className="h-5 w-5 shrink-0" style={{ color: '#b89040' }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#7a5a1a' }}>
              Free Plan Active — until {new Date(d.freeUntil).toLocaleDateString('en-GB', { dateStyle: 'long' })}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: '#9a7830' }}>
              Referral reward হিসেবে আপনার plan free করা হয়েছে।
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Referrals', value: d?.stats.total ?? 0,   Icon: Users, bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text)', iconColor: 'var(--rp-text-muted)' },
          { label: 'Pending Reward',  value: d?.stats.pending ?? 0, Icon: Clock, bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', iconColor: '#b89040' },
          { label: 'Rewarded',        value: d?.stats.rewarded ?? 0,Icon: Award, bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153', iconColor: '#183153' },
        ].map(({ label, value, Icon, bg, border, text, iconColor }) => (
          <div key={label} className="rounded-[14px] border p-5 text-center"
            style={{ background: bg, borderColor: border }}>
            <div className="flex justify-center mb-3">
              <Icon className="h-5 w-5" style={{ color: iconColor }} />
            </div>
            <p className="text-[26px] font-bold" style={{ color: text }}>{value}</p>
            <p className="text-[12px] mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">{label}</p>
          </div>
        ))}
      </div>

      {/* Referral link card */}
      <div className="rounded-[14px] border bg-white p-6 space-y-4"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4" style={{ color: '#183153' }} />
          <h2 className="text-[14px] font-semibold text-[#183153] dark:text-[#f8fafc]">Your Referral Link</h2>
        </div>

        {link ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-[10px] border bg-[#f4f1eb] px-4 py-2.5"
                style={{ borderColor: 'var(--rp-border)' }}>
                <ExternalLink className="h-4 w-4 shrink-0 text-[#94a3b8] dark:text-[#7f99ab]" />
                <span className="truncate font-mono text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">{link}</span>
              </div>
              <button onClick={copyLink}
                className="flex shrink-0 items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-semibold hover:opacity-90"
                style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={shareWhatsApp}
                className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
                style={{ background: '#25d366', color: 'var(--rp-surface)' }}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
              <button onClick={shareEmail}
                className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
                style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                <Mail className="h-4 w-4" /> Email
              </button>
            </div>

            <p className="text-[12px] pt-1 text-[#64748b] dark:text-[#a9c1d0]">
              কেউ এই link দিয়ে signup করলে admin আপনাকে reward করবে — account credit অথবা plan upgrade।
            </p>
          </>
        ) : (
          <p className="text-[13px] text-[#94a3b8] dark:text-[#7f99ab]">
            Referral link generate হয়নি। Support-এ যোগাযোগ করুন।
          </p>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-[14px] border bg-white p-6"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <h2 className="flex items-center gap-2 text-[14px] font-semibold mb-4 text-[#183153] dark:text-[#f8fafc]">
          <Share2 className="h-4 w-4" style={{ color: '#183153' }} /> কীভাবে কাজ করে?
        </h2>
        <div className="space-y-3">
          {[
            'আপনার referral link copy করুন',
            'অন্য resort owner-দের সাথে share করুন — WhatsApp বা Email দিয়ে',
            'তারা আপনার link দিয়ে signup করলে আমরা automatically track করব',
            'Admin review করে আপনাকে reward দেবে — ৳ credit অথবা 2 months PROFESSIONAL free',
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 mt-0.5 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: 'var(--rp-teal-bg)', color: '#183153' }}>
                {i + 1}
              </span>
              <p className="text-[13px] text-[#475569] dark:text-[#9db4c4]">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral history */}
      <div className="rounded-[14px] border bg-white overflow-hidden"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div className="px-5 py-4" style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <h2 className="text-[13.5px] font-semibold text-[#183153] dark:text-[#f8fafc]">Referral History</h2>
        </div>
        {!d?.referrals.length ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
              <Users className="h-7 w-7 text-[#94a3b8] dark:text-[#7f99ab]" />
            </div>
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">এখনো কোনো referral নেই।</p>
            <p className="text-[12px] text-[#94a3b8] dark:text-[#7f99ab]">আপনার link share করুন।</p>
          </div>
        ) : (
          <div>
            {d.referrals.map(r => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#fafaf8] transition-colors"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-[9px] shrink-0"
                  style={{ background: 'var(--rp-teal-bg)' }}>
                  <Users className="h-4 w-4" style={{ color: '#183153' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium truncate text-[#183153] dark:text-[#f8fafc]">{r.referred.name}</p>
                  <p className="text-[12px] mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">
                    Signed up {new Date(r.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                    {r.rewardType && r.rewardType !== 'NONE' && (
                      <span className="ml-2" style={{ color: '#183153' }}>· Reward: {rewardDescription(r)}</span>
                    )}
                  </p>
                </div>
                <div className="shrink-0"><StatusPill status={r.status} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
