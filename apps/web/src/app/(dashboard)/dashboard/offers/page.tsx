'use client';

import { useState } from 'react';
import { ModalShell } from '@/components/ui/modal-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isPast, isFuture } from 'date-fns';
import {
  Plus, Pencil, Trash2, BarChart2, Tag, Percent, Banknote,
  MoonStar, CalendarDays, Users, CheckCircle2, XCircle, Clock,
  AlertTriangle, Loader2,
} from 'lucide-react';
import { offersApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

type OfferType = 'PERCENTAGE' | 'FIXED' | 'FREE_NIGHT';

interface Offer {
  id: string; title: string; description?: string;
  type: OfferType; value: number; promoCode?: string | null;
  minStay: number; validFrom: string; validTo: string;
  maxUses?: number | null; usedCount: number; roomIds: string[];
  showOnBar: boolean; showSection: boolean; showOnCards: boolean;
  priority: number; isActive: boolean; isCurrentlyActive?: boolean;
  bookingsUsed?: number;
}

function offerStatus(o: Offer): 'active' | 'scheduled' | 'expired' | 'paused' {
  if (isFuture(new Date(o.validFrom))) return 'scheduled';
  if (isPast(new Date(o.validTo))) return 'expired';
  if (!o.isCurrentlyActive) return 'paused';
  return 'active';
}

const STATUS_META = {
  active:    { label: 'Active',    Icon: CheckCircle2,   bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  scheduled: { label: 'Scheduled', Icon: Clock,          bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  expired:   { label: 'Expired',   Icon: XCircle,        bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
  paused:    { label: 'Paused',    Icon: AlertTriangle,  bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
};

const TYPE_META: Record<OfferType, { label: string; Icon: React.ElementType; bg: string; border: string; text: string }> = {
  PERCENTAGE: { label: '% Off',      Icon: Percent,    bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  FIXED:      { label: 'Fixed Amt',  Icon: Banknote, bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  FREE_NIGHT: { label: 'Free Night', Icon: MoonStar,   bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.15)', text: '#b8724a' },
};

function formatValue(o: Offer) {
  if (o.type === 'PERCENTAGE') return `${o.value}% off`;
  if (o.type === 'FIXED')      return `$${o.value} off`;
  if (o.type === 'FREE_NIGHT') return `${o.value} free night${o.value > 1 ? 's' : ''}`;
  return String(o.value);
}

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

const EMPTY_FORM = {
  title: '', description: '', type: 'PERCENTAGE' as OfferType,
  value: 10, promoCode: '', minStay: 1,
  validFrom: format(new Date(), 'yyyy-MM-dd'),
  validTo:   format(new Date(Date.now() + 30 * 86_400_000), 'yyyy-MM-dd'),
  maxUses: '' as number | '',
  showOnBar: true, showSection: true, showOnCards: true, priority: 0, isActive: true,
};

function OfferModal({ initial, onClose, onSave }: {
  initial?: Partial<typeof EMPTY_FORM> & { id?: string };
  onClose: () => void;
  onSave: (data: typeof EMPTY_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM, ...initial });
  const set = (k: keyof typeof EMPTY_FORM, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={initial?.id ? 'Edit Offer' : 'New Offer'}
      maxWidth="680px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" form="offer-form"
            className="rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {initial?.id ? 'Save Changes' : 'Create Offer'}
          </button>
        </div>
      }
    >
      <form id="offer-form" onSubmit={e => { e.preventDefault(); onSave({ ...form, id: initial?.id }); }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Title *</label>
              <input required value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Summer Sale — 20% Off" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Description</label>
              <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Short description shown on website…"
                className={inputCls + ' resize-none'} />
            </div>
            <div>
              <label className={labelCls}>Discount Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value as OfferType)} className={inputCls + ' cursor-pointer'}>
                <option value="PERCENTAGE">Percentage (% off)</option>
                <option value="FIXED">Fixed Amount ($ off)</option>
                <option value="FREE_NIGHT">Free Night(s)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{form.type === 'PERCENTAGE' ? 'Discount %' : form.type === 'FIXED' ? 'Amount ($)' : 'Free Nights'} *</label>
              <input required type="number" min={0.01} step={0.01} value={form.value}
                onChange={e => set('value', parseFloat(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Promo Code <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
              <input value={form.promoCode ?? ''} onChange={e => set('promoCode', e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER20" className={inputCls + ' uppercase font-mono'} />
            </div>
            <div>
              <label className={labelCls}>Minimum Nights</label>
              <input type="number" min={1} step={1} value={form.minStay}
                onChange={e => set('minStay', parseInt(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valid From *</label>
              <input required type="date" value={form.validFrom}
                onChange={e => set('validFrom', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valid Until *</label>
              <input required type="date" value={form.validTo}
                onChange={e => set('validTo', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Max Uses <span style={{ color: 'var(--rp-text-faint)' }}>(blank = unlimited)</span></label>
              <input type="number" min={1} step={1}
                value={form.maxUses === '' ? '' : form.maxUses}
                onChange={e => set('maxUses', e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder="Unlimited" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Priority <span style={{ color: 'var(--rp-text-faint)' }}>(higher = shown first)</span></label>
              <input type="number" min={0} step={1} value={form.priority}
                onChange={e => set('priority', parseInt(e.target.value))} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Show on Website</label>
              <div className="flex flex-wrap gap-4 mt-1">
                {[
                  { key: 'showOnBar',   label: 'Announcement bar' },
                  { key: 'showSection', label: 'Offers section' },
                  { key: 'showOnCards', label: 'Room cards' },
                  { key: 'isActive',    label: 'Active' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-[13px] text-[#18231f] dark:text-[#dfd9d0]">
                    <input type="checkbox"
                      checked={!!form[key as keyof typeof EMPTY_FORM]}
                      onChange={e => set(key as keyof typeof EMPTY_FORM, e.target.checked)}
                      className="h-4 w-4 rounded" style={{ accentColor: '#23766a' }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
        </div>
      </form>
    </ModalShell>
  );
}

function StatsModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['offer-stats', offer.id], queryFn: () => offersApi.stats(offer.id) });
  const stats = data?.data?.data;

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={`Stats — ${offer.title}`}
      maxWidth="520px"
    >
      <div className="space-y-4">
          {!stats ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#8aa29a] dark:text-[#94b8b0]" /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Uses',   value: stats.totalUses ?? 0,                             bg: 'var(--rp-teal-bg)', text: '#23766a' },
                  { label: 'Total Saved',  value: `$${(stats.totalSaved ?? 0).toFixed(2)}`,         bg: 'var(--rp-amber-bg)', text: '#b89040' },
                  { label: 'Revenue',      value: `$${(stats.totalRevenue ?? 0).toFixed(2)}`,       bg: 'var(--rp-surface-2)', text: 'var(--rp-text)' },
                ].map(s => (
                  <div key={s.label} className="rounded-[12px] border p-4 text-center"
                    style={{ background: s.bg, borderColor: 'var(--rp-border)' }}>
                    <p className="text-[20px] font-bold" style={{ color: s.text }}>{s.value}</p>
                    <p className="text-[11.5px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">{s.label}</p>
                  </div>
                ))}
              </div>
              {stats.recentUsages?.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-2 text-[#8aa29a] dark:text-[#94b8b0]">Recent Bookings</p>
                  <div className="space-y-0 max-h-48 overflow-y-auto rounded-[10px] border" style={{ borderColor: 'var(--rp-border)' }}>
                    {stats.recentUsages.map((u: { discount: number; booking: { createdAt: string; totalAmount: string } }, i: number) => (
                      <div key={i} className="flex justify-between px-4 py-2.5 text-[13px] transition-colors hover:bg-[#fafaf8]"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <span style={{ color: 'var(--rp-text-subtle)' }}>{format(new Date(u.booking.createdAt), 'MMM d, yyyy')}</span>
                        <span className="font-medium" style={{ color: '#23766a' }}>−${u.discount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </ModalShell>
  );
}

const FILTERS = ['all', 'active', 'scheduled', 'expired'] as const;
type Filter = typeof FILTERS[number];

export default function OffersPage() {
  const qc = useQueryClient();
  const [filter, setFilter]           = useState<Filter>('all');
  const [editing, setEditing]         = useState<Offer | null | 'new'>(null);
  const [statsFor, setStatsFor]       = useState<Offer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Offer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['offers', filter],
    queryFn: () => offersApi.list(filter === 'all' ? undefined : filter),
  });
  const offers: Offer[] = data?.data?.data ?? [];

  const { data: allData } = useQuery({
    queryKey: ['offers', 'all'],
    queryFn: () => offersApi.list(undefined),
  });
  const allOffers: Offer[] = allData?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: unknown) => offersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); setEditing(null); toast({ title: 'Offer created' }); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to create offer', variant: 'destructive' }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, unknown>) => offersApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); setEditing(null); toast({ title: 'Offer updated' }); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to update offer', variant: 'destructive' }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => offersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); setConfirmDelete(null); toast({ title: 'Offer deleted' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to delete offer', variant: 'destructive' }),
  });

  const handleSave = (form: typeof EMPTY_FORM & { id?: string }) => {
    const payload = { ...form, maxUses: form.maxUses === '' ? null : Number(form.maxUses), promoCode: form.promoCode || null };
    if (form.id) updateMutation.mutate({ id: form.id, ...payload });
    else createMutation.mutate(payload);
  };

  const counts = allOffers.reduce<Record<string, number>>(
    (acc, o) => { const s = offerStatus(o); acc[s] = (acc[s] ?? 0) + 1; return acc; }, {}
  );

  return (
    <div className="flex flex-col gap-6 max-w-5xl animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Offers & Promotions</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Create discounts and promo codes for your guests</p>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> New Offer
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active',    key: 'active',    bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
          { label: 'Scheduled', key: 'scheduled', bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
          { label: 'Expired',   key: 'expired',   bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
          { label: 'Total',     key: 'total',     bg: '#1b342f', border: 'rgba(27,52,47,0.4)',    text: '#dfd9d0' },
        ].map(({ label, key, bg, border, text }) => (
          <div key={key} className="rounded-[14px] border p-4"
            style={{ background: bg, borderColor: border }}>
            <p className="text-[26px] font-bold" style={{ color: text }}>
              {key === 'total' ? allOffers.length : (counts[key] ?? 0)}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: key === 'total' ? 'rgba(223,217,208,0.7)' : 'var(--rp-text-muted)' }}>{label} offers</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="rounded-[8px] border px-4 py-1.5 text-[12.5px] font-medium capitalize transition-colors"
            style={filter === f
              ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
              : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Offers grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 rounded-[14px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[14px] border-2 border-dashed py-16 text-center"
          style={{ borderColor: 'rgba(35,118,106,0.2)', background: 'var(--rp-surface-2)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
            <Tag className="h-7 w-7" style={{ color: '#23766a' }} />
          </div>
          <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">No offers yet</p>
          <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">Click "New Offer" to create your first promotion</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {offers.map(offer => {
            const status = offerStatus(offer);
            const sm = STATUS_META[status];
            const tm = TYPE_META[offer.type];
            const StatusIcon = sm.Icon;
            const TypeIcon   = tm.Icon;

            return (
              <div key={offer.id}
                className="group relative rounded-[14px] border bg-white p-5 transition-all hover:shadow-md"
                style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
                      style={{ background: tm.bg, borderColor: tm.border, color: tm.text }}>
                      <TypeIcon className="h-3 w-3" /> {formatValue(offer)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
                      style={{ background: sm.bg, borderColor: sm.border, color: sm.text }}>
                      <StatusIcon className="h-3 w-3" /> {sm.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setStatsFor(offer)}
                      className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#f4f1eb] text-[#8aa29a] dark:text-[#94b8b0]">
                      <BarChart2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(offer)}
                      className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#f4f1eb] text-[#8aa29a] dark:text-[#94b8b0]">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmDelete(offer)}
                      className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#fef2f2] text-[#c5bdb4] dark:text-[#6e8580]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">{offer.title}</h3>
                {offer.description && (
                  <p className="text-[12.5px] mt-0.5 line-clamp-2 text-[#8aa29a] dark:text-[#94b8b0]">{offer.description}</p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {format(new Date(offer.validFrom), 'MMM d')}–{format(new Date(offer.validTo), 'MMM d, yyyy')}
                  </span>
                  {offer.minStay > 1 && (
                    <span className="flex items-center gap-1"><MoonStar className="h-3 w-3" /> {offer.minStay}+ nights</span>
                  )}
                  {offer.maxUses && (
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {offer.usedCount}/{offer.maxUses} used</span>
                  )}
                </div>

                {offer.promoCode && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] border border-dashed px-3 py-1 text-[12px] font-mono font-semibold"
                    style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.3)', color: '#23766a' }}>
                    <Tag className="h-3 w-3" /> {offer.promoCode}
                  </div>
                )}

                <div className="flex gap-1.5 mt-3">
                  {[
                    { key: 'showOnBar',   label: 'Bar' },
                    { key: 'showSection', label: 'Section' },
                    { key: 'showOnCards', label: 'Cards' },
                  ].map(({ key, label }) => (
                    <span key={key}
                      className="rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-medium"
                      style={offer[key as keyof Offer]
                        ? { background: 'var(--rp-teal-bg)', color: '#23766a' }
                        : { background: 'var(--rp-surface-3)', color: 'var(--rp-text-faint)', textDecoration: 'line-through' }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <OfferModal
          initial={editing === 'new' ? undefined : {
            ...editing,
            validFrom: format(new Date(editing.validFrom), 'yyyy-MM-dd'),
            validTo:   format(new Date(editing.validTo), 'yyyy-MM-dd'),
            maxUses:   editing.maxUses ?? '',
            promoCode: editing.promoCode ?? '',
          }}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {statsFor && <StatsModal offer={statsFor} onClose={() => setStatsFor(null)} />}

      {confirmDelete && (
        <ModalShell
          open={true}
          onClose={() => setConfirmDelete(null)}
          title="Confirm Delete"
          description="This action cannot be undone"
          maxWidth="400px"
          footer={
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]"
                style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium disabled:opacity-50"
                style={{ background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.2)', color: '#c43c3c' }}>
                {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          }
        >
          <p className="text-[13.5px] text-[#4a6e66] dark:text-[#6d9990]">
            "{confirmDelete.title}" will be permanently removed.
          </p>
        </ModalShell>
      )}
    </div>
  );
}
