'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loyaltyApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Star, Plus, Minus, Settings, Users, Trophy, TrendingUp,
  Search, X, ChevronUp, ChevronDown, Gift, Zap, ToggleLeft, ToggleRight,
  Crown, Medal, Award, History, Check,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  BRONZE:   { label: 'Bronze',   color: 'text-amber-700',   bg: 'bg-amber-100 dark:bg-amber-900/30',   icon: '🥉', ring: 'ring-amber-400' },
  SILVER:   { label: 'Silver',   color: 'text-gray-500',    bg: 'bg-gray-100 dark:bg-gray-800',        icon: '🥈', ring: 'ring-gray-400' },
  GOLD:     { label: 'Gold',     color: 'text-yellow-600',  bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: '🥇', ring: 'ring-yellow-400' },
  PLATINUM: { label: 'Platinum', color: 'text-purple-600',  bg: 'bg-purple-100 dark:bg-purple-900/30', icon: '💎', ring: 'ring-purple-400' },
};

const TX_TYPE_CONFIG = {
  EARN:    { label: 'Earned',   color: 'text-emerald-600', sign: '+' },
  REDEEM:  { label: 'Redeemed', color: 'text-blue-600',    sign: '' },
  ADJUST:  { label: 'Adjusted', color: 'text-orange-500',  sign: '' },
  EXPIRE:  { label: 'Expired',  color: 'text-red-500',     sign: '' },
};

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.BRONZE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Program Settings Modal ────────────────────────────────────────────────────
function ProgramSettingsModal({ prog, onClose }: { prog: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    programName: prog?.programName ?? 'Resort Rewards',
    isEnabled: prog?.isEnabled ?? false,
    pointsPerDollar: String(prog?.pointsPerDollar ?? 10),
    redemptionRate: String(prog?.redemptionRate ?? 100),
    bronzeThreshold: String(prog?.bronzeThreshold ?? 0),
    silverThreshold: String(prog?.silverThreshold ?? 500),
    goldThreshold: String(prog?.goldThreshold ?? 2000),
    platinumThreshold: String(prog?.platinumThreshold ?? 5000),
  });

  const mut = useMutation({
    mutationFn: () => loyaltyApi.updateProgram({
      ...form,
      pointsPerDollar: parseFloat(form.pointsPerDollar),
      redemptionRate: parseFloat(form.redemptionRate),
      bronzeThreshold: parseInt(form.bronzeThreshold),
      silverThreshold: parseInt(form.silverThreshold),
      goldThreshold: parseInt(form.goldThreshold),
      platinumThreshold: parseInt(form.platinumThreshold),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-program'] });
      toast({ title: 'Program settings saved' });
      onClose();
    },
    onError: () => toast({ title: 'Failed to save settings', variant: 'destructive' }),
  });

  const field = (key: keyof typeof form, label: string, type = 'text', hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-resort-700 to-resort-600 rounded-t-2xl">
          <div className="flex items-center gap-2 text-white">
            <Settings className="h-5 w-5" />
            <h2 className="text-base font-semibold">Loyalty Program Settings</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Enable Loyalty Program</p>
              <p className="text-xs text-gray-400 mt-0.5">Points auto-awarded on guest checkout</p>
            </div>
            <button
              onClick={() => setForm({ ...form, isEnabled: !form.isEnabled })}
              className={form.isEnabled ? 'text-resort-600' : 'text-gray-400'}
            >
              {form.isEnabled ? <ToggleRight className="h-8 w-8" /> : <ToggleLeft className="h-8 w-8" />}
            </button>
          </div>

          {field('programName', 'Program Name')}

          <div className="grid grid-cols-2 gap-4">
            {field('pointsPerDollar', 'Points per $1 Spent', 'number', 'e.g. 10 = earn 10 pts per dollar')}
            {field('redemptionRate', 'Points per $1 Discount', 'number', 'e.g. 100 = 100 pts = $1 off')}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tier Thresholds (lifetime points)</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['bronzeThreshold', '🥉 Bronze', '0 (always)'],
                ['silverThreshold', '🥈 Silver', 'e.g. 500 pts'],
                ['goldThreshold', '🥇 Gold', 'e.g. 2,000 pts'],
                ['platinumThreshold', '💎 Platinum', 'e.g. 5,000 pts'],
              ].map(([key, label, hint]) =>
                field(key as keyof typeof form, label, 'number', hint)
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-resort-200 dark:border-resort-800 bg-resort-50 dark:bg-resort-900/10 p-4">
            <p className="text-xs font-semibold text-resort-700 dark:text-resort-300 mb-2">💡 Example</p>
            <p className="text-xs text-resort-600 dark:text-resort-400">
              A guest spending <strong>$500</strong> earns{' '}
              <strong>{Math.floor(500 * (parseFloat(form.pointsPerDollar) || 10))} pts</strong>.{' '}
              Redeeming <strong>{parseFloat(form.redemptionRate) || 100} pts</strong> gives a{' '}
              <strong>$1</strong> discount.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-lg bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors disabled:opacity-50">
            {mut.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member Detail Drawer ──────────────────────────────────────────────────────
function MemberDrawer({ guestId, prog, onClose }: { guestId: string; prog: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'award' | 'redeem' | 'adjust' | null>(null);
  const [pts, setPts] = useState('');
  const [desc, setDesc] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['loyalty-account', guestId],
    queryFn: () => loyaltyApi.getAccount(guestId),
  });

  const data = res?.data?.data;
  const account = data?.account;
  const guest = data?.guest ?? account?.guest;

  const enrollMut = useMutation({
    mutationFn: () => loyaltyApi.enroll(guestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-account', guestId] });
      qc.invalidateQueries({ queryKey: ['loyalty-accounts'] });
      toast({ title: 'Guest enrolled in loyalty program' });
    },
  });

  const actionMut = useMutation({
    mutationFn: () => {
      const p = parseInt(pts);
      if (mode === 'award') return loyaltyApi.award(guestId, { points: p, description: desc });
      if (mode === 'redeem') return loyaltyApi.redeem(guestId, { points: p, description: desc });
      return loyaltyApi.adjust(guestId, { points: p, description: desc });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-account', guestId] });
      qc.invalidateQueries({ queryKey: ['loyalty-accounts'] });
      toast({ title: 'Points updated successfully' });
      setMode(null); setPts(''); setDesc('');
    },
    onError: (e: any) => toast({ title: e?.response?.data?.error ?? 'Failed', variant: 'destructive' }),
  });

  const tierCfg = TIER_CONFIG[(account?.tier as keyof typeof TIER_CONFIG) ?? 'BRONZE'];
  const nextTierPts = account && prog ? (() => {
    const lt = account.lifetimePoints;
    if (lt < prog.silverThreshold) return { label: 'Silver', needed: prog.silverThreshold - lt };
    if (lt < prog.goldThreshold) return { label: 'Gold', needed: prog.goldThreshold - lt };
    if (lt < prog.platinumThreshold) return { label: 'Platinum', needed: prog.platinumThreshold - lt };
    return null;
  })() : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <p className="font-bold text-gray-900 dark:text-white">Member Profile</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
          ) : guest ? (
            <>
              {/* Guest header */}
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold ring-2 ${account ? tierCfg.ring : 'ring-gray-200'} bg-resort-100 dark:bg-resort-900/30 text-resort-700 dark:text-resort-300`}>
                  {guest.firstName?.[0]}{guest.lastName?.[0]}
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{guest.firstName} {guest.lastName}</p>
                  <p className="text-sm text-gray-400">{guest.email}</p>
                  {account && <div className="mt-1"><TierBadge tier={account.tier} /></div>}
                </div>
              </div>

              {/* Not enrolled */}
              {!account ? (
                <div className="rounded-xl border-2 border-dashed border-resort-200 dark:border-resort-800 p-6 text-center">
                  <Star className="h-8 w-8 text-resort-400 mx-auto mb-2" />
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Not enrolled yet</p>
                  <p className="text-xs text-gray-400 mb-4">Enroll this guest to start tracking points</p>
                  <button onClick={() => enrollMut.mutate()} disabled={enrollMut.isPending}
                    className="px-4 py-2 rounded-lg bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors disabled:opacity-50">
                    {enrollMut.isPending ? 'Enrolling…' : 'Enroll in Loyalty Program'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Points stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-resort-50 dark:bg-resort-900/10 p-4 text-center">
                      <p className="text-xs text-resort-500 dark:text-resort-400 font-medium">Current Balance</p>
                      <p className="text-3xl font-black text-resort-700 dark:text-resort-300 mt-1">{account.points.toLocaleString()}</p>
                      <p className="text-xs text-resort-400">points</p>
                      {prog && <p className="text-xs text-resort-600 dark:text-resort-400 mt-1">≈ {formatCurrency(account.points / prog.redemptionRate)}</p>}
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                      <p className="text-xs text-gray-400 font-medium">Lifetime Earned</p>
                      <p className="text-3xl font-black text-gray-700 dark:text-gray-200 mt-1">{account.lifetimePoints.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">total pts</p>
                      <p className="text-xs text-gray-400 mt-1">{account._count?.transactions ?? 0} transactions</p>
                    </div>
                  </div>

                  {/* Tier progress */}
                  {nextTierPts && prog && (
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          Progress to {TIER_CONFIG[nextTierPts.label as keyof typeof TIER_CONFIG]?.icon} {nextTierPts.label}
                        </p>
                        <p className="text-xs text-gray-400">{nextTierPts.needed.toLocaleString()} pts to go</p>
                      </div>
                      {(() => {
                        const thresholds = { Silver: [prog.bronzeThreshold, prog.silverThreshold], Gold: [prog.silverThreshold, prog.goldThreshold], Platinum: [prog.goldThreshold, prog.platinumThreshold] };
                        const [from, to] = thresholds[nextTierPts.label as keyof typeof thresholds] ?? [0, 1];
                        const pct = Math.min(100, Math.round(((account.lifetimePoints - from) / (to - from)) * 100));
                        return (
                          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                            <div className="h-2 rounded-full bg-resort-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {!nextTierPts && (
                    <div className="rounded-xl bg-purple-50 dark:bg-purple-900/10 p-3 flex items-center gap-2">
                      <Crown className="h-5 w-5 text-purple-600 shrink-0" />
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Platinum member — highest tier!</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'award' as const, label: 'Award', icon: Plus, color: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200' },
                      { key: 'redeem' as const, label: 'Redeem', icon: Gift, color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200' },
                      { key: 'adjust' as const, label: 'Adjust', icon: SlidersIcon, color: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-200' },
                    ].map(({ key, label, icon: Icon, color }) => (
                      <button key={key} onClick={() => setMode(mode === key ? null : key)}
                        className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition-colors ${color} ${mode === key ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Action form */}
                  {mode && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                      <p className="text-sm font-semibold capitalize text-gray-700 dark:text-gray-300">
                        {mode === 'award' ? '+ Award Points' : mode === 'redeem' ? '− Redeem Points' : '± Adjust Points'}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Points {mode === 'adjust' ? '(negative to deduct)' : ''}
                          </label>
                          <input type="number" value={pts} onChange={(e) => setPts(e.target.value)}
                            placeholder={mode === 'adjust' ? '±500' : '100'}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Reason</label>
                          <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
                            placeholder="e.g. Birthday bonus"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                        </div>
                      </div>
                      {mode === 'redeem' && prog && pts && (
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          ≈ {formatCurrency(parseInt(pts) / prog.redemptionRate)} discount value
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => actionMut.mutate()} disabled={actionMut.isPending || !pts || !desc}
                          className="flex-1 py-2 rounded-lg bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors disabled:opacity-50">
                          {actionMut.isPending ? 'Saving…' : 'Confirm'}
                        </button>
                        <button onClick={() => { setMode(null); setPts(''); setDesc(''); }}
                          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Transaction history */}
                  {account.transactions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" /> Transaction History
                      </p>
                      <div className="space-y-2">
                        {account.transactions.map((tx: any) => {
                          const cfg = TX_TYPE_CONFIG[tx.type as keyof typeof TX_TYPE_CONFIG];
                          return (
                            <div key={tx.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{tx.description}</p>
                                <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString()} · {cfg.label}</p>
                              </div>
                              <span className={`text-sm font-bold shrink-0 ml-2 ${cfg.color}`}>
                                {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground">Guest not found</p>
          )}
        </div>
      </div>
    </>
  );
}

// Mini icon component
function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LoyaltyPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 350);
  };

  const { data: progRes } = useQuery({
    queryKey: ['loyalty-program'],
    queryFn: () => loyaltyApi.getProgram(),
  });

  const { data: accountsRes, isLoading } = useQuery({
    queryKey: ['loyalty-accounts', debouncedSearch, tierFilter],
    queryFn: () => loyaltyApi.getAccounts({ search: debouncedSearch || undefined, tier: tierFilter || undefined }),
  });

  const { data: leaderRes } = useQuery({
    queryKey: ['loyalty-leaderboard'],
    queryFn: () => loyaltyApi.leaderboard(),
  });

  const prog = progRes?.data?.data;
  const { accounts = [], total = 0, stats = [] } = accountsRes?.data?.data ?? {};
  const leaderboard: any[] = leaderRes?.data?.data ?? [];

  // Tier distribution from stats (counts all members, not just current page)
  const tierCounts = Object.fromEntries(stats.map((s: any) => [s.tier, s._count]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Star className="h-6 w-6 text-resort-600" />
            {prog?.programName ?? 'Loyalty Program'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reward loyal guests with points, tier upgrades, and redeemable discounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {prog && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${prog.isEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
              {prog.isEnabled ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {prog.isEnabled ? 'Active' : 'Inactive'}
            </div>
          )}
          <button onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Program not enabled banner */}
      {prog && !prog.isEnabled && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-5 py-4 flex items-center gap-3">
          <Star className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">Program is disabled</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Enable the loyalty program in Settings to auto-award points on guest checkout.
            </p>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="ml-auto shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors">
            Enable Now
          </button>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl p-3 bg-resort-600"><Users className="h-5 w-5 text-white" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Members</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl p-3 bg-amber-500"><Medal className="h-5 w-5 text-white" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Bronze Members</p>
              <p className="text-2xl font-bold">{tierCounts['BRONZE'] ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl p-3 bg-yellow-500"><Trophy className="h-5 w-5 text-white" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gold + Platinum</p>
              <p className="text-2xl font-bold">{(tierCounts['GOLD'] ?? 0) + (tierCounts['PLATINUM'] ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl p-3 bg-purple-500"><Crown className="h-5 w-5 text-white" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Platinum Members</p>
              <p className="text-2xl font-bold">{tierCounts['PLATINUM'] ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Members table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-resort-500" />
            </div>
            <div className="flex gap-1.5">
              {['', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map((t) => (
                <button key={t || 'all'} onClick={() => setTierFilter(t)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    tierFilter === t ? 'bg-resort-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {t ? TIER_CONFIG[t as keyof typeof TIER_CONFIG]?.icon + ' ' + t.charAt(0) + t.slice(1).toLowerCase() : 'All'}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
                </div>
              ) : accounts.length === 0 ? (
                <div className="py-16 text-center">
                  <Star className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {search || tierFilter ? 'No matching members' : 'No members enrolled yet'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                        <th className="px-4 py-3 font-medium">Member</th>
                        <th className="px-4 py-3 font-medium">Tier</th>
                        <th className="px-4 py-3 font-medium text-right">Balance</th>
                        <th className="px-4 py-3 font-medium text-right">Lifetime</th>
                        <th className="px-4 py-3 font-medium text-right">Txns</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                      {accounts.map((acc: any) => (
                        <tr key={acc.id}
                          className="hover:bg-resort-50 dark:hover:bg-resort-900/10 cursor-pointer transition-colors"
                          onClick={() => setSelectedGuest(acc.guest.id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-resort-100 dark:bg-resort-900/30 flex items-center justify-center text-xs font-bold text-resort-700 dark:text-resort-300 shrink-0">
                                {acc.guest.firstName?.[0]}{acc.guest.lastName?.[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{acc.guest.firstName} {acc.guest.lastName}</p>
                                <p className="text-xs text-gray-400 truncate">{acc.guest.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><TierBadge tier={acc.tier} /></td>
                          <td className="px-4 py-3 text-right font-semibold text-resort-600">{acc.points.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{acc.lifetimePoints.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{acc._count.transactions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Leaderboard + Tier breakdown */}
        <div className="space-y-4">
          {/* Tier breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-resort-600" />
                Tier Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'] as const).map((tier) => {
                const count = tierCounts[tier] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const cfg = TIER_CONFIG[tier];
                return (
                  <div key={tier}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{cfg.icon} {cfg.label}</span>
                      <span className="text-xs text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-1.5 rounded-full bg-resort-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Top Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-4">No members yet</p>
              ) : (
                <div className="space-y-2.5">
                  {leaderboard.slice(0, 5).map((acc: any, i: number) => (
                    <div key={acc.id}
                      className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                      onClick={() => setSelectedGuest(acc.guest.id)}>
                      <span className={`text-sm font-black w-5 text-center ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {acc.guest.firstName} {acc.guest.lastName}
                        </p>
                        <TierBadge tier={acc.tier} />
                      </div>
                      <span className="text-sm font-bold text-resort-600 shrink-0">{acc.lifetimePoints.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Points value callout */}
          {prog && prog.isEnabled && (
            <Card className="border-resort-200 dark:border-resort-800 bg-resort-50 dark:bg-resort-900/10">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-resort-700 dark:text-resort-300 mb-2">💡 Earn Rate</p>
                <p className="text-xs text-resort-600 dark:text-resort-400">
                  <strong>{prog.pointsPerDollar} pts</strong> per $1 spent<br />
                  <strong>{prog.redemptionRate} pts</strong> = $1 discount
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <ProgramSettingsModal prog={prog} onClose={() => setSettingsOpen(false)} />
      )}

      {/* Member detail drawer */}
      {selectedGuest && (
        <MemberDrawer
          guestId={selectedGuest}
          prog={prog}
          onClose={() => setSelectedGuest(null)}
        />
      )}
    </div>
  );
}
