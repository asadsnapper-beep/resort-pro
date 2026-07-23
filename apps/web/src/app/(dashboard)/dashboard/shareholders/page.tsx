'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { shareholdersApi, staffApi } from '@/lib/api';
import { ModalShell } from '@/components/ui/modal-shell';
import { toast } from '@/hooks/use-toast';
import {
  PieChart, Plus, Loader2, Users, Pencil, Banknote, Clock, X, History,
} from 'lucide-react';

interface Shareholder {
  id: string;
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null };
  ownershipPercent: number;
  investedAmount: number | null;
  joinedAt: string;
  notes: string | null;
  lastPayout: { amount: number; paidAt: string; method: string } | null;
}

interface PendingInvite {
  id: string;
  email: string;
  ownershipPercent: number | null;
  createdAt: string;
  expiresAt: string;
}

const PAYOUT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
];

export default function ShareholdersPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState<Shareholder | null>(null);
  const [editTarget, setEditTarget] = useState<Shareholder | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Shareholder | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['shareholders'],
    queryFn: () => shareholdersApi.list().then((r) => r.data.data),
  });

  const shareholders: Shareholder[] = data?.shareholders ?? [];
  const pendingInvites: PendingInvite[] = data?.pendingInvites ?? [];
  const totalAllocated: number = data?.totalAllocated ?? 0;
  const remaining: number = data?.remaining ?? 100;

  const cancelInviteMutation = useMutation({
    mutationFn: (id: string) => staffApi.cancelInvite(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shareholders'] }); toast({ title: 'Invite cancelled' }); },
  });

  return (
    <div className="max-w-4xl space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
            <PieChart className="h-4 w-4" style={{ color: '#23766a' }} />
          </div>
          <div>
            <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f] dark:text-[#dfd9d0]">
              Shareholders
            </h1>
            <p className="text-[13px] text-[#7a9890] dark:text-[#94b8b0]">
              Ownership %, payout history — সব একসাথে
            </p>
          </div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
        >
          <Plus className="h-4 w-4" /> Add Shareholder
        </button>
      </div>

      {/* Allocation bar */}
      <div className="rounded-[14px] border bg-white p-5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
            Ownership Allocated: {totalAllocated.toFixed(1)}%
          </span>
          <span className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">{remaining.toFixed(1)}% remaining</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, totalAllocated)}%`, background: 'var(--rp-btn-accent)' }}
          />
        </div>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="rounded-[14px] border overflow-hidden" style={{ borderColor: 'rgba(184,144,64,0.2)' }}>
          <div className="px-5 py-3" style={{ background: 'var(--rp-amber-bg)' }}>
            <h2 className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: '#b89040' }}>
              <Clock className="h-3.5 w-3.5" /> Pending Invites ({pendingInvites.length})
            </h2>
          </div>
          <div className="bg-white">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate text-[#18231f] dark:text-[#dfd9d0]">{inv.email}</p>
                  <p className="text-[11.5px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">
                    {inv.ownershipPercent}% ownership · invited {new Date(inv.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })} · expires {new Date(inv.expiresAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </p>
                </div>
                <button
                  onClick={() => cancelInviteMutation.mutate(inv.id)}
                  disabled={cancelInviteMutation.isPending}
                  className="flex items-center gap-1 rounded-[7px] px-2.5 py-1.5 text-[11.5px] font-medium transition-colors hover:bg-[#fbeceb]"
                  style={{ color: '#c43c3c' }}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#9bbdb7' }} />
        </div>
      ) : shareholders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border bg-white py-14 text-center" style={{ borderColor: 'var(--rp-border)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
            <Users className="h-7 w-7 text-[#c5bdb4] dark:text-[#6e8580]" />
          </div>
          <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">এখনো কোনো shareholder যোগ করা হয়নি।</p>
        </div>
      ) : (
        <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          {shareholders.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#fafaf8] transition-colors" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: 'var(--rp-btn-accent)' }}>
                {s.user.firstName[0]}{s.user.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-medium truncate text-[#18231f] dark:text-[#dfd9d0]">{s.user.firstName} {s.user.lastName}</p>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: 'var(--rp-teal-bg)', color: '#23766a' }}>
                    {s.ownershipPercent}%
                  </span>
                </div>
                <p className="text-[12px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">
                  {s.user.email} · Joined {new Date(s.joinedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  {s.lastPayout && (
                    <span> · Last payout: ৳{s.lastPayout.amount.toLocaleString()} ({new Date(s.lastPayout.paidAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })})</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setHistoryTarget(s)}
                  className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#f4f1eb]"
                  style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}
                >
                  <History className="h-3.5 w-3.5" /> History
                </button>
                <button
                  onClick={() => setEditTarget(s)}
                  className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#f4f1eb]"
                  style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => setPayoutTarget(s)}
                  className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold hover:opacity-90"
                  style={{ background: 'var(--rp-amber-bg)', color: '#b89040' }}
                >
                  <Banknote className="h-3.5 w-3.5" /> Record Payout
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddShareholderModal
          remaining={remaining}
          onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); queryClient.invalidateQueries({ queryKey: ['shareholders'] }); }}
        />
      )}

      {editTarget && (
        <EditShareholderModal
          shareholder={editTarget}
          remaining={remaining + editTarget.ownershipPercent}
          onClose={() => setEditTarget(null)}
          onDone={() => { setEditTarget(null); queryClient.invalidateQueries({ queryKey: ['shareholders'] }); }}
        />
      )}

      {payoutTarget && (
        <RecordPayoutModal
          shareholder={payoutTarget}
          onClose={() => setPayoutTarget(null)}
          onDone={() => { setPayoutTarget(null); queryClient.invalidateQueries({ queryKey: ['shareholders'] }); }}
        />
      )}

      {historyTarget && (
        <PayoutHistoryModal
          shareholder={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}

function AddShareholderModal({ remaining, onClose, onDone }: { remaining: number; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [pct, setPct] = useState('');

  const mutation = useMutation({
    mutationFn: () => staffApi.invite({ email, role: 'SHAREHOLDER', ownershipPercent: Number(pct) }),
    onSuccess: () => { toast({ title: 'Invite sent!', description: `${email}-কে invite email পাঠানো হয়েছে।` }); onDone(); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error ?? 'Could not send invite', variant: 'destructive' }),
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Add Shareholder"
      description="Ownership % soho invite pathao — 7 din valid thakbe"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="rounded-[9px] border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!email || !pct || Number(pct) <= 0 || Number(pct) > remaining || mutation.isPending}
            className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send Invite
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="shareholder@email.com"
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none"
            style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Ownership %</label>
          <input
            type="number" min={0.01} max={remaining} step={0.01} value={pct} onChange={(e) => setPct(e.target.value)}
            placeholder="15"
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none"
            style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}
          />
          <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{remaining.toFixed(1)}% remaining — max allowed</p>
        </div>
      </div>
    </ModalShell>
  );
}

function EditShareholderModal({ shareholder, remaining, onClose, onDone }: { shareholder: Shareholder; remaining: number; onClose: () => void; onDone: () => void }) {
  const [pct, setPct] = useState(String(shareholder.ownershipPercent));
  const [notes, setNotes] = useState(shareholder.notes ?? '');

  const mutation = useMutation({
    mutationFn: () => shareholdersApi.update(shareholder.id, { ownershipPercent: Number(pct), notes }),
    onSuccess: () => { toast({ title: 'Updated' }); onDone(); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error ?? 'Could not update', variant: 'destructive' }),
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Edit — ${shareholder.user.firstName} ${shareholder.user.lastName}`}
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="rounded-[9px] border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!pct || Number(pct) <= 0 || Number(pct) > remaining || mutation.isPending}
            className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Ownership %</label>
          <input
            type="number" min={0.01} max={remaining} step={0.01} value={pct} onChange={(e) => setPct(e.target.value)}
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none"
            style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}
          />
          <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{remaining.toFixed(1)}% max (including current)</p>
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Notes (owner-only)</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none"
            style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}
          />
        </div>
      </div>
    </ModalShell>
  );
}

function RecordPayoutModal({ shareholder, onClose, onDone }: { shareholder: Shareholder; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => shareholdersApi.recordPayout(shareholder.id, { amount: Number(amount), method, paidAt, note: note || undefined }),
    onSuccess: () => { toast({ title: 'Payout recorded' }); onDone(); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error ?? 'Could not record payout', variant: 'destructive' }),
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Record Payout — ${shareholder.user.firstName} ${shareholder.user.lastName}`}
      description="ResortPro-r baire (bank/bKash/cash) e paoa taka log korar jonno — eta shudhu record, payment process kore na"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="rounded-[9px] border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!amount || Number(amount) <= 0 || !paidAt || mutation.isPending}
            className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Payout
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Amount (৳)</label>
          <input
            type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none"
            style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Date</label>
            <input
              type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none"
              style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Method</label>
            <select
              value={method} onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none"
              style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}
            >
              {PAYOUT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Note (optional)</label>
          <input
            type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Q1 distribution"
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none"
            style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}
          />
        </div>
      </div>
    </ModalShell>
  );
}

interface PayoutEntry {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  note: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer', BKASH: 'bKash', CASH: 'Cash', OTHER: 'Other',
};

function PayoutHistoryModal({ shareholder, onClose }: { shareholder: Shareholder; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PayoutEntry[]>({
    queryKey: ['shareholder-payouts', shareholder.id],
    queryFn: () => shareholdersApi.payouts(shareholder.id).then((r) => r.data.data),
  });
  const payouts = data ?? [];
  const total = payouts.reduce((sum, p) => sum + p.amount, 0);

  const deleteMutation = useMutation({
    mutationFn: (payoutId: string) => shareholdersApi.deletePayout(shareholder.id, payoutId),
    onSuccess: () => {
      toast({ title: 'Payout deleted' });
      setConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['shareholder-payouts', shareholder.id] });
      queryClient.invalidateQueries({ queryKey: ['shareholders'] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error ?? 'Could not delete payout', variant: 'destructive' }),
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Payout History — ${shareholder.user.firstName} ${shareholder.user.lastName}`}
      description={`${shareholder.ownershipPercent}% ownership · ৳${total.toLocaleString()} paid total`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="rounded-[9px] border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Close</button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#9bbdb7' }} />
        </div>
      ) : payouts.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Ekhono kono payout record kora hoyni.</p>
      ) : (
        <div className="space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-[10px] border px-4 py-3" style={{ borderColor: 'var(--rp-border)' }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-amber-bg)' }}>
                <Banknote className="h-4 w-4" style={{ color: '#b89040' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">৳{p.amount.toLocaleString()}</p>
                <p className="text-[12px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">
                  {new Date(p.paidAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })} · {METHOD_LABEL[p.method] ?? p.method}
                  {p.note && <span> · {p.note}</span>}
                </p>
              </div>
              {confirmId === p.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11.5px] text-[#c43c3c]">Delete?</span>
                  <button
                    onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-[7px] px-2.5 py-1 text-[11.5px] font-semibold text-white"
                    style={{ background: '#c43c3c' }}
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium"
                    style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(p.id)}
                  className="shrink-0 rounded-[7px] px-2.5 py-1.5 text-[11.5px] font-medium transition-colors hover:bg-[#fbeceb]"
                  style={{ color: '#c43c3c' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
