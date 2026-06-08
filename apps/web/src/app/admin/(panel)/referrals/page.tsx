'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  Gift, Loader2, Users, Clock, Award, Check,
  ChevronDown, ChevronUp, CreditCard, Sparkles, X,
  Plus, Copy, Link2, Search, RefreshCw,
} from 'lucide-react';

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
  rewardedBy: string | null;
  createdAt: string;
  referrer: { id: string; name: string; slug: string; referralCode: string | null; plan: string };
  referred: { id: string; name: string; slug: string; plan: string; planStatus: string; createdAt: string };
}

interface ReferralData {
  summary: { total: number; pending: number; rewarded: number };
  referrals: ReferralEntry[];
}

/* ── Types: Tenant list ────────────────────────────────────────────────────── */
interface TenantItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  referralCode: string | null;
  referralLink: string | null;
}

/* ── Create Custom Link Modal ───────────────────────────────────────────────── */
function CreateLinkModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TenantItem | null>(null);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ referralCode: string; referralLink: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery<TenantItem[]>({
    queryKey: ['referral-tenants-list'],
    queryFn: () => adminEndpoints.getReferralTenantsList().then(r => r.data.data),
  });

  const tenants = tenantsData ?? [];
  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const createMut = useMutation({
    mutationFn: () => adminEndpoints.createCustomLink({
      tenantId: selected!.id,
      ...(code.trim() && { code: code.trim() }),
    }).then(r => r.data.data),
    onSuccess: (data: { referralCode: string; referralLink: string }) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ['referral-tenants-list'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Failed to create link';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const copyLink = () => {
    if (!result?.referralLink) return;
    navigator.clipboard.writeText(result.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copied!' });
  };

  const handleSelectTenant = (t: TenantItem) => {
    setSelected(t);
    setCode(t.referralCode ?? '');
    setResult(null);
    setSearch('');
  };

  const autoCode = (slug: string) =>
    slug.toUpperCase().replace(/-/g, '').slice(0, 8);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <h2 className="font-bold text-white flex items-center gap-2">
                <Link2 className="h-4 w-4 text-indigo-400" /> Custom Referral Link
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                যেকোনো resort-এর জন্য custom referral code set করুন।
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Step 1: Select tenant */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                1. Resort select করুন
              </label>

              {selected ? (
                <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                    {selected.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{selected.name}</p>
                    <p className="text-xs text-gray-500">{selected.slug} · {selected.plan}</p>
                  </div>
                  <button onClick={() => { setSelected(null); setCode(''); setResult(null); }}
                    className="text-gray-500 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Resort name বা slug লিখুন…"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  {search && (
                    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      {tenantsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                        </div>
                      ) : filtered.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">কোনো resort পাওয়া যায়নি।</p>
                      ) : filtered.slice(0, 8).map(t => (
                        <button key={t.id} onClick={() => handleSelectTenant(t)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-left">
                          <div className="h-7 w-7 rounded-lg bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-bold shrink-0">
                            {t.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{t.name}</p>
                            <p className="text-xs text-gray-500">{t.slug}</p>
                          </div>
                          {t.referralCode && (
                            <span className="text-xs font-mono text-indigo-400 shrink-0">{t.referralCode}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Custom code */}
            {selected && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  2. Referral code (optional — ফাঁকা রাখলে auto-generate হবে)
                </label>
                <div className="flex gap-2">
                  <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    placeholder={autoCode(selected.slug)}
                    maxLength={20}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase" />
                  <button onClick={() => setCode(autoCode(selected.slug))}
                    title="Auto-generate"
                    className="px-3 py-2.5 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1.5">
                  Preview: <span className="text-indigo-400 font-mono">
                    {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/auth/register?ref={code || autoCode(selected.slug)}
                  </span>
                </p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/25 p-4 space-y-3">
                <p className="text-sm font-semibold text-green-400 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Custom link set!
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-green-300 bg-green-500/10 rounded-lg px-3 py-2 font-mono truncate">
                    {result.referralLink}
                  </code>
                  <button onClick={copyLink}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-green-600">Code: <span className="font-mono">{result.referralCode}</span></p>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-800">
            {!result ? (
              <button
                onClick={() => createMut.mutate()}
                disabled={!selected || createMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                {createMut.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  : <><Link2 className="h-4 w-4" /> Create Link</>}
              </button>
            ) : (
              <button onClick={() => { setSelected(null); setCode(''); setResult(null); }}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl transition-colors">
                আরেকটি বানাও
              </button>
            )}
            <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-xl transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Reward Modal ───────────────────────────────────────────────────────────── */
function RewardModal({ referral, onClose, onSave, saving }: {
  referral: ReferralEntry;
  onClose: () => void;
  onSave: (data: { type: 'CREDIT' | 'FREE_PLAN' | 'NONE'; amount?: number; plan?: string; months?: number; note?: string }) => void;
  saving: boolean;
}) {
  const [type, setType] = useState<'CREDIT' | 'FREE_PLAN' | 'NONE'>('FREE_PLAN');
  const [amount, setAmount] = useState(5000);
  const [plan, setPlan] = useState('PROFESSIONAL');
  const [months, setMonths] = useState(2);
  const [note, setNote] = useState('');

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <h2 className="font-bold text-white">Apply Reward</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Referrer: <span className="text-indigo-400">{referral.referrer.name}</span>
                {' '} → <span className="text-gray-400">{referral.referred.name}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Reward type */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-3">Reward Type</label>
              <div className="space-y-2">
                {[
                  { id: 'FREE_PLAN' as const, label: 'Free Plan Upgrade', icon: Sparkles, desc: 'Give N months of a plan for free' },
                  { id: 'CREDIT' as const,    label: 'Account Credit',    icon: CreditCard, desc: 'Add ৳ credit to their balance' },
                  { id: 'NONE' as const,      label: 'No Reward',         icon: X, desc: 'Mark as reviewed, no reward' },
                ].map(opt => (
                  <button key={opt.id} type="button" onClick={() => setType(opt.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      type === opt.id
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-white'
                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                    }`}>
                    <opt.icon className="h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                    {type === opt.id && <Check className="h-4 w-4 ml-auto text-indigo-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Free plan options */}
            {type === 'FREE_PLAN' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Plan</label>
                  <select value={plan} onChange={e => setPlan(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="STARTER">STARTER</option>
                    <option value="PROFESSIONAL">PROFESSIONAL</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Months</label>
                  <input type="number" min={1} max={24} value={months}
                    onChange={e => setMonths(parseInt(e.target.value) || 1)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="col-span-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 text-xs text-indigo-300">
                  {referral.referrer.name} পাবে: <strong>{months} months {plan} plan free</strong>
                </div>
              </div>
            )}

            {/* Credit options */}
            {type === 'CREDIT' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Credit Amount (৳)</label>
                <input type="number" min={100} step={500} value={amount}
                  onChange={e => setAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <div className="mt-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs text-green-300">
                  {referral.referrer.name} পাবে: <strong>৳{amount.toLocaleString()} account credit</strong>
                </div>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder="e.g. Great referral — active paying user"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-800">
            <button
              onClick={() => onSave({ type, amount: type === 'CREDIT' ? amount : undefined, plan: type === 'FREE_PLAN' ? plan : undefined, months: type === 'FREE_PLAN' ? months : undefined, note: note || undefined })}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Applying…</> : <><Check className="h-4 w-4" /> Apply Reward</>}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Referral Row ───────────────────────────────────────────────────────────── */
function ReferralRow({ r, onReward }: { r: ReferralEntry; onReward: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const statusBadge = () => {
    if (r.status === 'REWARDED')   return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1"><Award className="h-3 w-3" /> Rewarded</span>;
    if (r.status === 'NO_REWARD')  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-500 border border-gray-700">No reward</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>;
  };

  const rewardDesc = () => {
    if (!r.rewardType || r.rewardType === 'NONE') return null;
    if (r.rewardType === 'CREDIT') return `৳${r.rewardAmount?.toLocaleString()} credit`;
    if (r.rewardType === 'FREE_PLAN') return `${r.rewardMonths}mo ${r.rewardPlan} free`;
    return null;
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      r.status === 'PENDING' ? 'border-amber-500/20 bg-amber-500/5' : 'border-gray-800 bg-gray-900'
    }`}>
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        {/* Referrer → Referred */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{r.referrer.name}</span>
            <span className="text-gray-600 text-xs">referred</span>
            <span className="text-sm font-semibold text-indigo-400">{r.referred.name}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
            {rewardDesc() && <span className="text-xs text-green-400">· {rewardDesc()}</span>}
          </div>
        </div>

        {/* Status + reward button */}
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge()}
          {r.status === 'PENDING' && (
            <button onClick={e => { e.stopPropagation(); onReward(); }}
              className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium">
              Reward
            </button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-800 bg-gray-950/50 px-4 py-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-500 mb-1">Referrer</p>
            <p className="text-white font-medium">{r.referrer.name}</p>
            <p className="text-gray-500">Code: <code className="text-indigo-400">{r.referrer.referralCode}</code></p>
            <p className="text-gray-500">Plan: {r.referrer.plan}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">New Signup</p>
            <p className="text-white font-medium">{r.referred.name}</p>
            <p className="text-gray-500">Plan: {r.referred.plan} ({r.referred.planStatus})</p>
            <p className="text-gray-500">Joined: {new Date(r.referred.createdAt).toLocaleDateString()}</p>
          </div>
          {r.status === 'REWARDED' && (
            <div className="col-span-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
              <p className="text-green-400 font-medium">Reward: {rewardDesc()}</p>
              {r.rewardNote && <p className="text-green-600 mt-0.5">Note: {r.rewardNote}</p>}
              <p className="text-green-700 mt-0.5">By {r.rewardedBy} on {new Date(r.rewardedAt!).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Campaign Link Types ────────────────────────────────────────────────────── */
interface CampaignLinkItem {
  id: string;
  code: string;
  label: string;
  createdBy: string;
  isActive: boolean;
  signups: number;
  link: string;
  createdAt: string;
}

/* ── Campaign Links Section ─────────────────────────────────────────────────── */
function CampaignLinksSection() {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState('');
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery<CampaignLinkItem[]>({
    queryKey: ['campaign-links'],
    queryFn: () => adminEndpoints.getCampaignLinks().then(r => r.data.data),
  });

  const { data: signupData } = useQuery<{ link: CampaignLinkItem; tenants: { id: string; name: string; slug: string; plan: string; planStatus: string; createdAt: string }[] }>({
    queryKey: ['campaign-link-signups', expandedId],
    queryFn: () => adminEndpoints.getCampaignLinkSignups(expandedId!).then(r => r.data.data),
    enabled: !!expandedId,
  });

  const createMut = useMutation({
    mutationFn: () => adminEndpoints.createCampaignLink({
      label: newLabel.trim(),
      ...(newCode.trim() && { code: newCode.trim() }),
    }).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-links'] });
      setNewLabel(''); setNewCode(''); setCreating(false);
      toast({ title: 'Campaign link created!' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err?.response?.data?.error || 'Failed', variant: 'destructive' }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminEndpoints.updateCampaignLink(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-links'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminEndpoints.deleteCampaignLink(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-links'] });
      toast({ title: 'Deleted' });
    },
  });

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!' });
  };

  const autoCode = (label: string) =>
    label.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

  return (
    <div className="space-y-4">

      {/* Create new */}
      {creating ? (
        <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">New Campaign Link</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">Marketer name / label</label>
              <input value={newLabel}
                onChange={e => { setNewLabel(e.target.value); if (!newCode) setNewCode(autoCode(e.target.value)); }}
                placeholder="Rakib - BD Sales"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Code (auto)</label>
              <input value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder={autoCode(newLabel) || 'RAKIB2024'}
                maxLength={20}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={() => createMut.mutate()}
                disabled={!newLabel.trim() || createMut.isPending}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create
              </button>
              <button onClick={() => setCreating(false)}
                className="px-3 py-2.5 text-gray-500 hover:text-white border border-gray-700 rounded-xl transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-700 rounded-2xl text-sm text-gray-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors">
          <Plus className="h-4 w-4" /> New Campaign Link
        </button>
      )}

      {/* Links list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-600" /></div>
      ) : links.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-2xl">
          <Link2 className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">কোনো campaign link নেই।</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(l => (
            <div key={l.id} className={`border rounded-2xl overflow-hidden transition-colors ${l.isActive ? 'border-gray-800 bg-gray-900' : 'border-gray-800/50 bg-gray-900/50 opacity-60'}`}>
              {/* Row */}
              <div className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white text-sm">{l.label}</p>
                    <code className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">{l.code}</code>
                    {!l.isActive && <span className="text-xs text-gray-500">(inactive)</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{l.link}</p>
                </div>

                {/* Signup count */}
                <div className="text-center shrink-0">
                  <p className="text-2xl font-bold text-white">{l.signups}</p>
                  <p className="text-xs text-gray-500">signups</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => copyLink(l.link)} title="Copy link"
                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} title="View signups"
                    className={`p-2 rounded-lg transition-colors ${expandedId === l.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedId === l.id ? 'rotate-180' : ''}`} />
                  </button>
                  <button onClick={() => toggleMut.mutate({ id: l.id, isActive: !l.isActive })} title={l.isActive ? 'Deactivate' : 'Activate'}
                    className="p-2 text-gray-500 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (confirm(`Delete "${l.label}"?`)) deleteMut.mutate(l.id); }}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded signups */}
              {expandedId === l.id && (
                <div className="border-t border-gray-800 bg-gray-950/50 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Signups via {l.code}</p>
                  {!signupData ? (
                    <div className="flex items-center gap-2 py-3 text-gray-600 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
                  ) : signupData.tenants.length === 0 ? (
                    <p className="text-xs text-gray-600 py-2">এখনো কোনো signup নেই।</p>
                  ) : (
                    <div className="space-y-2">
                      {signupData.tenants.map(t => (
                        <div key={t.id} className="flex items-center gap-3 text-sm">
                          <div className="h-7 w-7 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">{t.name[0]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{t.name}</p>
                            <p className="text-xs text-gray-500">{t.slug}</p>
                          </div>
                          <span className="text-xs text-gray-500 shrink-0">{new Date(t.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium shrink-0">{t.plan}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function AdminReferralsPage() {
  const qc = useQueryClient();
  const [mainTab, setMainTab] = useState<'referrals' | 'marketing'>('referrals');
  const [rewardTarget, setRewardTarget] = useState<ReferralEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'rewarded'>('all');
  const [showCreateLink, setShowCreateLink] = useState(false);

  const { data, isLoading } = useQuery<ReferralData>({
    queryKey: ['admin-referrals'],
    queryFn:  () => adminEndpoints.getReferrals().then(r => r.data.data),
  });

  const rewardMut = useMutation({
    mutationFn: (payload: Parameters<typeof adminEndpoints.rewardReferral>[1] & { id: string }) => {
      const { id, ...rest } = payload;
      return adminEndpoints.rewardReferral(id, rest);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-referrals'] });
      setRewardTarget(null);
      toast({ title: '✓ Reward applied' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to apply reward', variant: 'destructive' }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  const d = data;
  const all = d?.referrals ?? [];
  const filtered = all.filter(r => {
    if (filter === 'pending')  return r.status === 'PENDING';
    if (filter === 'rewarded') return r.status === 'REWARDED';
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Gift className="h-6 w-6 text-indigo-400" /> Referrals & Marketing
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Owner referrals track করো এবং marketing team-এর attribution দেখো।
          </p>
        </div>
        {mainTab === 'referrals' && (
          <button onClick={() => setShowCreateLink(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shrink-0">
            <Plus className="h-4 w-4" /> Custom Link
          </button>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {([
          { id: 'referrals' as const, label: 'Owner Referrals', icon: Gift },
          { id: 'marketing' as const, label: 'Marketing Links',  icon: Link2 },
        ]).map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              mainTab === t.id ? 'text-indigo-400 border-indigo-500' : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Owner Referrals Tab ─────────────────────────────────────── */}
      {mainTab === 'referrals' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total',   value: d?.summary.total ?? 0,   icon: Users,  color: 'text-blue-400',  bg: 'bg-blue-500/10' },
              { label: 'Pending', value: d?.summary.pending ?? 0,  icon: Clock,  color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Rewarded',value: d?.summary.rewarded ?? 0, icon: Award,  color: 'text-green-400', bg: 'bg-green-500/10' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
                <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${bg} mb-3`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 border-b border-gray-800">
            {([
              { id: 'all' as const,     label: 'All',      count: all.length },
              { id: 'pending' as const, label: 'Pending',  count: d?.summary.pending ?? 0 },
              { id: 'rewarded' as const,label: 'Rewarded', count: d?.summary.rewarded ?? 0 },
            ]).map(t => (
              <button key={t.id} onClick={() => setFilter(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  filter === t.id ? 'text-indigo-400 border-indigo-500' : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}>
                {t.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-800 text-gray-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Referral list */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl">
              <Gift className="h-10 w-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No referrals yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => (
                <ReferralRow key={r.id} r={r} onReward={() => setRewardTarget(r)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Marketing Links Tab ─────────────────────────────────────── */}
      {mainTab === 'marketing' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 px-4 py-3 text-sm text-indigo-300">
            Marketing team-এর জন্য unique link তৈরি করুন। যে link দিয়ে কেউ signup করবে তা automatically সেই marketer-এর count-এ যোগ হবে।
          </div>
          <CampaignLinksSection />
        </div>
      )}

      {/* Reward modal */}
      {rewardTarget && (
        <RewardModal
          referral={rewardTarget}
          onClose={() => setRewardTarget(null)}
          onSave={data => rewardMut.mutate({ id: rewardTarget.id, ...data })}
          saving={rewardMut.isPending}
        />
      )}

      {/* Custom link modal */}
      {showCreateLink && <CreateLinkModal onClose={() => setShowCreateLink(false)} />}
    </div>
  );
}
