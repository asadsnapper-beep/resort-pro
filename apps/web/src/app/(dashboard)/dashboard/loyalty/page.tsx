'use client';

import { createPortal } from 'react-dom';
import { ModalShell } from '@/components/ui/modal-shell';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loyaltyApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Star, Plus, Settings, Users, Trophy, TrendingUp,
  Search, X, Gift, ToggleLeft, ToggleRight,
  Crown, History, Check, Loader2,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

// ── Constants ─────────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  BRONZE:   { label: 'Bronze',   bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', icon: '🥉', bar: '#d4a853' },
  SILVER:   { label: 'Silver',   bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', icon: '🥈', bar: '#9bbdb7' },
  GOLD:     { label: 'Gold',     bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', icon: '🥇', bar: '#d4a853' },
  PLATINUM: { label: 'Platinum', bg: '#1b342f', border: 'rgba(27,52,47,0.5)',    text: '#dfd9d0', icon: '💎', bar: '#23766a' },
};

const TX_TYPE_CONFIG = {
  EARN:   { label: 'Earned',   color: '#23766a', sign: '+' },
  REDEEM: { label: 'Redeemed', color: '#b89040', sign: '−' },
  ADJUST: { label: 'Adjusted', color: '#b8724a', sign: '±' },
  EXPIRE: { label: 'Expired',  color: '#c43c3c', sign: '' },
};

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.BRONZE;
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

// ── Program Settings Modal ────────────────────────────────────────────────────
function ProgramSettingsModal({ prog, onClose }: { prog: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    programName:       prog?.programName       ?? 'Resort Rewards',
    isEnabled:         prog?.isEnabled         ?? false,
    pointsPerDollar:   String(prog?.pointsPerDollar   ?? 10),
    redemptionRate:    String(prog?.redemptionRate    ?? 100),
    bronzeThreshold:   String(prog?.bronzeThreshold   ?? 0),
    silverThreshold:   String(prog?.silverThreshold   ?? 500),
    goldThreshold:     String(prog?.goldThreshold     ?? 2000),
    platinumThreshold: String(prog?.platinumThreshold ?? 5000),
  });

  const mut = useMutation({
    mutationFn: () => loyaltyApi.updateProgram({
      ...form,
      pointsPerDollar:   parseFloat(form.pointsPerDollar),
      redemptionRate:    parseFloat(form.redemptionRate),
      bronzeThreshold:   parseInt(form.bronzeThreshold),
      silverThreshold:   parseInt(form.silverThreshold),
      goldThreshold:     parseInt(form.goldThreshold),
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
      <label className={labelCls}>{label}</label>
      <input type={type} value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={inputCls} />
      {hint && <p className="mt-1 text-[11px] text-[#8aa29a] dark:text-[#94b8b0]">{hint}</p>}
    </div>
  );

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Loyalty Program Settings"
      maxWidth="520px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            className="flex-1 rounded-[9px] border py-2.5 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-[9px] py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Settings
          </button>
        </div>
      }
    >
      <div className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-[10px] border px-4 py-3"
            style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
            <div>
              <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">Enable Loyalty Program</p>
              <p className="text-[11.5px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">Points auto-awarded on guest checkout</p>
            </div>
            <button onClick={() => setForm({ ...form, isEnabled: !form.isEnabled })}>
              {form.isEnabled
                ? <ToggleRight className="h-7 w-7" style={{ color: '#23766a' }} />
                : <ToggleLeft  className="h-7 w-7 text-[#c5bdb4] dark:text-[#6e8580]" />}
            </button>
          </div>

          {field('programName', 'Program Name')}

          <div className="grid grid-cols-2 gap-4">
            {field('pointsPerDollar', 'Points per $1 Spent', 'number', 'e.g. 10 = earn 10 pts per dollar')}
            {field('redemptionRate', 'Points per $1 Discount', 'number', 'e.g. 100 = 100 pts = $1 off')}
          </div>

          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-3">Tier Thresholds (lifetime points)</p>
            <div className="grid grid-cols-2 gap-4">
              {([
                ['bronzeThreshold',   '🥉 Bronze',   '0 (always)'],
                ['silverThreshold',   '🥈 Silver',   'e.g. 500 pts'],
                ['goldThreshold',     '🥇 Gold',     'e.g. 2,000 pts'],
                ['platinumThreshold', '💎 Platinum', 'e.g. 5,000 pts'],
              ] as const).map(([key, label, hint]) => field(key as keyof typeof form, label, 'number', hint))}
            </div>
          </div>

          {/* Example callout */}
          <div className="rounded-[12px] border px-4 py-3"
            style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
            <p className="text-[11.5px] font-semibold mb-1" style={{ color: '#1b342f' }}>💡 Example</p>
            <p className="text-[12px]" style={{ color: '#23766a' }}>
              A guest spending <strong>$500</strong> earns{' '}
              <strong>{Math.floor(500 * (parseFloat(form.pointsPerDollar) || 10))} pts</strong>.{' '}
              Redeeming <strong>{parseFloat(form.redemptionRate) || 100} pts</strong> gives a <strong>$1</strong> discount.
            </p>
          </div>
      </div>
    </ModalShell>
  );
}

// ── Sliders icon ──────────────────────────────────────────────────────────────
function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
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
    if (lt < prog.silverThreshold)   return { label: 'Silver',   needed: prog.silverThreshold - lt };
    if (lt < prog.goldThreshold)     return { label: 'Gold',     needed: prog.goldThreshold - lt };
    if (lt < prog.platinumThreshold) return { label: 'Platinum', needed: prog.platinumThreshold - lt };
    return null;
  })() : null;

  const ACTION_BUTTONS = [
    { key: 'award'  as const, label: 'Award',  Icon: Plus,         bg: 'var(--rp-teal-bg)', color: '#23766a' },
    { key: 'redeem' as const, label: 'Redeem', Icon: Gift,         bg: 'var(--rp-amber-bg)', color: '#b89040' },
    { key: 'adjust' as const, label: 'Adjust', Icon: SlidersIcon,  bg: 'var(--rp-coral-bg)', color: '#b8724a' },
  ];

  return createPortal((
    <>
      <div className="fixed inset-0 z-40"
        style={{ background: 'rgba(27,52,47,0.3)', backdropFilter: 'blur(3px)' }}
        onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white dark:bg-white/5 shadow-2xl"
        style={{ boxShadow: '-8px 0 40px rgba(27,52,47,0.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0"
          style={{ borderColor: 'var(--rp-border)' }}>
          <p className="font-display text-[16px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">Member Profile</p>
          <button onClick={onClose} className="rounded-[8px] p-1.5 transition-colors hover:bg-[#f4f1eb]">
            <X className="h-5 w-5 text-[#8aa29a] dark:text-[#94b8b0]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-[12px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
              ))}
            </div>
          ) : guest ? (
            <>
              {/* Guest header */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
                  style={{
                    background: tierCfg.bg,
                    color: tierCfg.text,
                    border: `2px solid ${tierCfg.border}`,
                  }}>
                  {guest.firstName?.[0]}{guest.lastName?.[0]}
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">{guest.firstName} {guest.lastName}</p>
                  <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">{guest.email}</p>
                  {account && <div className="mt-1.5"><TierBadge tier={account.tier} /></div>}
                </div>
              </div>

              {/* Not enrolled */}
              {!account ? (
                <div className="flex flex-col items-center rounded-[14px] border border-dashed p-6 text-center"
                  style={{ borderColor: 'rgba(35,118,106,0.3)', background: 'var(--rp-teal-soft)' }}>
                  <Star className="h-8 w-8 mb-2" style={{ color: '#23766a' }} />
                  <p className="text-[13px] font-medium mb-1 text-[#18231f] dark:text-[#dfd9d0]">Not enrolled yet</p>
                  <p className="text-[12px] mb-4 text-[#8aa29a] dark:text-[#94b8b0]">Enroll this guest to start tracking points</p>
                  <button onClick={() => enrollMut.mutate()} disabled={enrollMut.isPending}
                    className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                    {enrollMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Enroll in Loyalty Program
                  </button>
                </div>
              ) : (
                <>
                  {/* Points stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[12px] p-4 text-center"
                      style={{ background: 'var(--rp-teal-bg)' }}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4a6e66] dark:text-[#6d9990]">Balance</p>
                      <p className="text-[28px] font-black tracking-[-0.02em] mt-1" style={{ color: '#1b342f' }}>
                        {account.points.toLocaleString()}
                      </p>
                      <p className="text-[11px]" style={{ color: '#23766a' }}>points</p>
                      {prog && <p className="text-[11.5px] font-medium mt-1" style={{ color: '#23766a' }}>≈ {formatCurrency(account.points / prog.redemptionRate)}</p>}
                    </div>
                    <div className="rounded-[12px] p-4 text-center"
                      style={{ background: 'var(--rp-surface-2)' }}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8aa29a] dark:text-[#94b8b0]">Lifetime</p>
                      <p className="text-[28px] font-black tracking-[-0.02em] mt-1 text-[#18231f] dark:text-[#dfd9d0]">
                        {account.lifetimePoints.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-[#8aa29a] dark:text-[#94b8b0]">total pts</p>
                      <p className="text-[11.5px] mt-1 text-[#8aa29a] dark:text-[#94b8b0]">{account._count?.transactions ?? 0} transactions</p>
                    </div>
                  </div>

                  {/* Tier progress */}
                  {nextTierPts && prog ? (
                    <div className="rounded-[12px] border p-4" style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-medium text-[#18231f] dark:text-[#dfd9d0]">
                          Progress to {TIER_CONFIG[nextTierPts.label as keyof typeof TIER_CONFIG]?.icon} {nextTierPts.label}
                        </p>
                        <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{nextTierPts.needed.toLocaleString()} pts to go</p>
                      </div>
                      {(() => {
                        const map = { Silver: [prog.bronzeThreshold, prog.silverThreshold], Gold: [prog.silverThreshold, prog.goldThreshold], Platinum: [prog.goldThreshold, prog.platinumThreshold] };
                        const [from, to] = map[nextTierPts.label as keyof typeof map] ?? [0, 1];
                        const pct = Math.min(100, Math.round(((account.lifetimePoints - from) / (to - from)) * 100));
                        return (
                          <div className="h-[6px] w-full rounded-full" style={{ background: '#e8e5e0' }}>
                            <div className="h-[6px] rounded-full transition-all" style={{ background: '#23766a', width: `${pct}%` }} />
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-[12px] border px-4 py-3"
                      style={{ background: 'var(--rp-btn-accent)', borderColor: 'rgba(27,52,47,0.5)' }}>
                      <Crown className="h-4 w-4 shrink-0" style={{ color: '#d4a853' }} />
                      <p className="text-[13px] font-medium" style={{ color: 'var(--rp-btn-accent-text)' }}>Platinum member — highest tier!</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {ACTION_BUTTONS.map(({ key, label, Icon, bg, color }) => (
                      <button key={key} onClick={() => setMode(mode === key ? null : key)}
                        className="flex flex-col items-center gap-1.5 rounded-[10px] border py-3 text-[12px] font-semibold transition-all"
                        style={mode === key
                          ? { background: bg, borderColor: color, color }
                          : { background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-muted)' }}>
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Action form */}
                  {mode && (
                    <div className="rounded-[12px] border p-4 space-y-3"
                      style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                      <p className="text-[12px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                        {mode === 'award' ? '+ Award Points' : mode === 'redeem' ? '− Redeem Points' : '± Adjust Points'}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Points {mode === 'adjust' ? '(neg = deduct)' : ''}</label>
                          <input type="number" value={pts} onChange={(e) => setPts(e.target.value)}
                            placeholder={mode === 'adjust' ? '±500' : '100'} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Reason</label>
                          <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
                            placeholder="e.g. Birthday bonus" className={inputCls} />
                        </div>
                      </div>
                      {mode === 'redeem' && prog && pts && (
                        <p className="text-[12px] font-medium" style={{ color: '#b89040' }}>
                          ≈ {formatCurrency(parseInt(pts) / prog.redemptionRate)} discount value
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => actionMut.mutate()} disabled={actionMut.isPending || !pts || !desc}
                          className="flex-1 flex items-center justify-center gap-2 rounded-[9px] py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
                          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                          {actionMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Confirm
                        </button>
                        <button onClick={() => { setMode(null); setPts(''); setDesc(''); }}
                          className="rounded-[9px] border px-4 py-2 text-[13px] transition-colors hover:bg-[#f4f1eb]"
                          style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Transaction history */}
                  {account.transactions?.length > 0 && (
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-3 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" /> Transaction History
                      </p>
                      <div className="space-y-1.5">
                        {account.transactions.map((tx: any) => {
                          const cfg = TX_TYPE_CONFIG[tx.type as keyof typeof TX_TYPE_CONFIG];
                          return (
                            <div key={tx.id} className="flex items-center justify-between rounded-[10px] border px-3 py-2.5"
                              style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                              <div className="min-w-0">
                                <p className="text-[13px] truncate text-[#18231f] dark:text-[#dfd9d0]">{tx.description}</p>
                                <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                                  {new Date(tx.createdAt).toLocaleDateString()} · {cfg.label}
                                </p>
                              </div>
                              <span className="text-[13px] font-bold shrink-0 ml-2" style={{ color: cfg.color }}>
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
            <p className="text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Guest not found</p>
          )}
        </div>
      </div>
    </>
  ), document.body);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LoyaltyPage() {
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tierFilter, setTierFilter]       = useState('');
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
  const tierCounts = Object.fromEntries(stats.map((s: any) => [s.tier, s._count]));

  return (
    <PageShell gap={6}>
      {/* Header */}
      <PageHeader
        title={prog?.programName ?? 'Loyalty Program'}
        subtitle="Reward loyal guests with points, tier upgrades, and redeemable discounts"
        align="responsive"
        actions={
        <div className="flex items-center gap-2">
          {prog && (
            <span className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold"
              style={prog.isEnabled
                ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
                : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
              {prog.isEnabled ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {prog.isEnabled ? 'Active' : 'Inactive'}
            </span>
          )}
          <button onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            <Settings className="h-4 w-4" /> Settings
          </button>
        </div>
        }
      />

      {/* Disabled banner */}
      {prog && !prog.isEnabled && (
        <div className="flex items-center gap-3 rounded-[14px] border px-5 py-4"
          style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.25)' }}>
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: '#d4a853' }}>
            <Star className="h-[15px] w-[15px] text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold" style={{ color: '#7a5c2a' }}>Program is disabled</p>
            <p className="text-[12px] mt-0.5" style={{ color: '#b89040' }}>
              Enable the loyalty program in Settings to auto-award points on guest checkout.
            </p>
          </div>
          <button onClick={() => setSettingsOpen(true)}
            className="shrink-0 rounded-[9px] px-3 py-1.5 text-[12px] font-semibold transition-colors"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            Enable Now
          </button>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Members',         value: total,                                          icon: Users,  color: '#23766a', bg: 'var(--rp-teal-bg)' },
          { label: 'Bronze Members',  value: tierCounts['BRONZE'] ?? 0,                     icon: () => <span className="text-[18px]">🥉</span>, color: '#b89040', bg: 'var(--rp-amber-bg)' },
          { label: 'Gold + Platinum', value: (tierCounts['GOLD'] ?? 0) + (tierCounts['PLATINUM'] ?? 0), icon: Trophy, color: '#b89040', bg: 'var(--rp-amber-bg)' },
          { label: 'Platinum',        value: tierCounts['PLATINUM'] ?? 0,                   icon: Crown,  color: 'var(--rp-btn-accent-text)', bg: '#1b342f' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-4 rounded-[14px] border bg-white dark:bg-white/5 p-5"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: bg }}>
              <Icon className="h-[18px] w-[18px]" style={{ color }} />
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
              <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#18231f] dark:text-[#dfd9d0]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Members table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8aa29a] dark:text-[#94b8b0]" />
              <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] pl-9 pr-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30" />
            </div>
            <div className="flex gap-1.5">
              {['', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map((t) => (
                <button key={t || 'all'} onClick={() => setTierFilter(t)}
                  className="rounded-[8px] border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
                  style={tierFilter === t
                    ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                    : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
                  {t ? `${TIER_CONFIG[t as keyof typeof TIER_CONFIG]?.icon} ${t.charAt(0) + t.slice(1).toLowerCase()}` : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-[14px] border bg-white dark:bg-white/5 overflow-hidden"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-[10px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
                  <Star className="h-8 w-8" style={{ color: '#23766a' }} />
                </div>
                <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                  {search || tierFilter ? 'No matching members' : 'No members enrolled yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      {['Member', 'Tier', 'Balance', 'Lifetime', 'Txns'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i > 1 ? 'text-right' : 'text-left'}`}
                          style={{ color: 'var(--rp-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc: any) => (
                      <tr key={acc.id} className="border-b cursor-pointer transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                        style={{ borderColor: 'rgba(0,0,0,0.04)' }}
                        onClick={() => setSelectedGuest(acc.guest.id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                              style={{ background: 'var(--rp-teal-bg)', color: '#23766a' }}>
                              {acc.guest.firstName?.[0]}{acc.guest.lastName?.[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium truncate text-[#18231f] dark:text-[#dfd9d0]">
                                {acc.guest.firstName} {acc.guest.lastName}
                              </p>
                              <p className="text-[11.5px] truncate text-[#8aa29a] dark:text-[#94b8b0]">{acc.guest.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><TierBadge tier={acc.tier} /></td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold" style={{ color: '#23766a' }}>
                          {acc.points.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                          {acc.lifetimePoints.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                          {acc._count.transactions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Tier distribution */}
          <div className="rounded-[14px] border bg-white dark:bg-white/5 p-5"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4" style={{ color: '#23766a' }} />
              <p className="text-[13px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">Tier Distribution</p>
            </div>
            <div className="space-y-3">
              {(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'] as const).map((tier) => {
                const count = tierCounts[tier] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const cfg = TIER_CONFIG[tier];
                return (
                  <div key={tier}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{cfg.icon} {cfg.label}</span>
                      <span className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{count} ({pct}%)</span>
                    </div>
                    <div className="h-[5px] rounded-full" style={{ background: '#e8e5e0' }}>
                      <div className="h-[5px] rounded-full transition-all" style={{ background: cfg.bar, width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rounded-[14px] border bg-white dark:bg-white/5 p-5"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4" style={{ color: '#d4a853' }} />
              <p className="text-[13px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">Top Members</p>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-[12px] text-center py-4 text-[#8aa29a] dark:text-[#94b8b0]">No members yet</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((acc: any, i: number) => (
                  <div key={acc.id}
                    className="flex items-center gap-2.5 rounded-[9px] p-2 cursor-pointer transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                    onClick={() => setSelectedGuest(acc.guest.id)}>
                    <span className="text-[14px] w-5 text-center shrink-0">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">{i + 1}.</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate text-[#18231f] dark:text-[#dfd9d0]">
                        {acc.guest.firstName} {acc.guest.lastName}
                      </p>
                      <TierBadge tier={acc.tier} />
                    </div>
                    <span className="text-[13px] font-bold shrink-0" style={{ color: '#23766a' }}>
                      {acc.lifetimePoints.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Earn rate callout */}
          {prog?.isEnabled && (
            <div className="rounded-[14px] border px-5 py-4"
              style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
              <p className="text-[12px] font-semibold mb-1.5" style={{ color: '#1b342f' }}>💡 Earn Rate</p>
              <p className="text-[12.5px]" style={{ color: '#23766a' }}>
                <strong>{prog.pointsPerDollar} pts</strong> per $1 spent<br />
                <strong>{prog.redemptionRate} pts</strong> = $1 discount
              </p>
            </div>
          )}
        </div>
      </div>

      {settingsOpen && (
        <ProgramSettingsModal prog={prog} onClose={() => setSettingsOpen(false)} />
      )}

      {selectedGuest && (
        <MemberDrawer guestId={selectedGuest} prog={prog} onClose={() => setSelectedGuest(null)} />
      )}
    </PageShell>
  );
}
