'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isPast, isFuture } from 'date-fns';
import {
  Plus, Pencil, Trash2, BarChart2, Tag, Percent, DollarSign,
  MoonStar, CalendarDays, Users, CheckCircle2, XCircle, Clock,
  AlertTriangle, X,
} from 'lucide-react';
import { offersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
type OfferType = 'PERCENTAGE' | 'FIXED' | 'FREE_NIGHT';

interface Offer {
  id: string;
  title: string;
  description?: string;
  type: OfferType;
  value: number;
  promoCode?: string | null;
  minStay: number;
  validFrom: string;
  validTo: string;
  maxUses?: number | null;
  usedCount: number;
  roomIds: string[];
  showOnBar: boolean;
  showSection: boolean;
  showOnCards: boolean;
  priority: number;
  isActive: boolean;
  isCurrentlyActive?: boolean;
  bookingsUsed?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function offerStatus(o: Offer): 'active' | 'scheduled' | 'expired' | 'paused' {
  if (isFuture(new Date(o.validFrom))) return 'scheduled';
  if (isPast(new Date(o.validTo))) return 'expired';
  // isCurrentlyActive = false means isActive toggled off OR maxUses exhausted
  if (!o.isCurrentlyActive) return 'paused';
  return 'active';
}

const STATUS_CONFIG = {
  active:    { label: 'Active',    icon: CheckCircle2, cls: 'bg-green-50 text-green-700 ring-green-200' },
  scheduled: { label: 'Scheduled', icon: Clock,        cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  expired:   { label: 'Expired',   icon: XCircle,      cls: 'bg-gray-50 text-gray-500 ring-gray-200' },
  paused:    { label: 'Paused',    icon: AlertTriangle, cls: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
};

const TYPE_CONFIG: Record<OfferType, { label: string; icon: React.ElementType; color: string }> = {
  PERCENTAGE: { label: '% Off',       icon: Percent,   color: 'text-resort-700 bg-resort-50' },
  FIXED:      { label: 'Fixed Amt',   icon: DollarSign, color: 'text-gold-700 bg-gold-50' },
  FREE_NIGHT: { label: 'Free Night',  icon: MoonStar,   color: 'text-purple-700 bg-purple-50' },
};

function formatValue(o: Offer) {
  if (o.type === 'PERCENTAGE') return `${o.value}% off`;
  if (o.type === 'FIXED')      return `$${o.value} off`;
  if (o.type === 'FREE_NIGHT') return `${o.value} free night${o.value > 1 ? 's' : ''}`;
  return String(o.value);
}

// ── Offer Form Modal ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', description: '', type: 'PERCENTAGE' as OfferType,
  value: 10, promoCode: '', minStay: 1,
  validFrom: format(new Date(), 'yyyy-MM-dd'),
  validTo: format(new Date(Date.now() + 30 * 86_400_000), 'yyyy-MM-dd'),
  maxUses: '' as number | '',
  showOnBar: true, showSection: true, showOnCards: true,
  priority: 0, isActive: true,
};

function OfferModal({
  initial, onClose, onSave,
}: {
  initial?: Partial<typeof EMPTY_FORM> & { id?: string };
  onClose: () => void;
  onSave: (data: typeof EMPTY_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM, ...initial });
  const set = (k: keyof typeof EMPTY_FORM, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, id: initial?.id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {initial?.id ? 'Edit Offer' : 'New Offer'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[80vh]">
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input required value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Summer Sale — 20% Off"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Short description shown on website..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none" />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value as OfferType)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                <option value="PERCENTAGE">Percentage (% off)</option>
                <option value="FIXED">Fixed Amount ($ off)</option>
                <option value="FREE_NIGHT">Free Night(s)</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {form.type === 'PERCENTAGE' ? 'Discount %' : form.type === 'FIXED' ? 'Amount ($)' : 'Free Nights'} *
              </label>
              <input required type="number" min={0.01} step={0.01} value={form.value}
                onChange={e => set('value', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {/* Promo code */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Promo Code (optional)</label>
              <input value={form.promoCode ?? ''} onChange={e => set('promoCode', e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER20"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {/* Min stay */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minimum Nights</label>
              <input type="number" min={1} step={1} value={form.minStay}
                onChange={e => set('minStay', parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {/* Valid From */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid From *</label>
              <input required type="date" value={form.validFrom}
                onChange={e => set('validFrom', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {/* Valid To */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until *</label>
              <input required type="date" value={form.validTo}
                onChange={e => set('validTo', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {/* Max uses */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Uses (blank = unlimited)</label>
              <input type="number" min={1} step={1}
                value={form.maxUses === '' ? '' : form.maxUses}
                onChange={e => set('maxUses', e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority (higher = shown first)</label>
              <input type="number" min={0} step={1} value={form.priority}
                onChange={e => set('priority', parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {/* Display options */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-2">Show on Website</label>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'showOnBar',    label: 'Announcement bar' },
                  { key: 'showSection',  label: 'Offers section' },
                  { key: 'showOnCards',  label: 'Room cards' },
                  { key: 'isActive',     label: 'Active' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox"
                      checked={!!form[key as keyof typeof EMPTY_FORM]}
                      onChange={e => set(key as keyof typeof EMPTY_FORM, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-resort-600" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/50">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit"
              className="rounded-lg bg-resort-700 px-4 py-2 text-sm font-medium text-white hover:bg-resort-800 transition-colors">
              {initial?.id ? 'Save Changes' : 'Create Offer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Stats Modal ───────────────────────────────────────────────────────────────
function StatsModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['offer-stats', offer.id],
    queryFn: () => offersApi.stats(offer.id),
  });
  const stats = data?.data?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Offer Stats — {offer.title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {!stats ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Uses', value: stats.totalUses ?? 0 },
                  { label: 'Total Saved', value: `$${(stats.totalSaved ?? 0).toFixed(2)}` },
                  { label: 'Revenue', value: `$${(stats.totalRevenue ?? 0).toFixed(2)}` },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-resort-50 p-4 text-center">
                    <p className="text-xl font-bold text-resort-700">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {stats.recentUsages?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Bookings</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {stats.recentUsages.map((u: { discount: number; booking: { createdAt: string; totalAmount: string } }, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-gray-600">{format(new Date(u.booking.createdAt), 'MMM d, yyyy')}</span>
                        <span className="text-green-600 font-medium">−${u.discount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
const FILTERS = ['all', 'active', 'scheduled', 'expired'] as const;
type Filter = typeof FILTERS[number];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OffersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Offer | null | 'new'>(null);
  const [statsFor, setStatsFor] = useState<Offer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Offer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['offers', filter],
    queryFn: () => offersApi.list(filter === 'all' ? undefined : filter),
  });
  const offers: Offer[] = data?.data?.data ?? [];

  // Always fetch ALL offers for summary counts — independent of the current tab filter
  const { data: allData } = useQuery({
    queryKey: ['offers', 'all'],
    queryFn: () => offersApi.list(undefined),
  });
  const allOffers: Offer[] = allData?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: unknown) => offersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      setEditing(null);
      toast({ title: 'Offer created' });
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to create offer', variant: 'destructive' }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string } & Record<string, unknown>) => offersApi.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      setEditing(null);
      toast({ title: 'Offer updated' });
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to update offer', variant: 'destructive' }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => offersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      setConfirmDelete(null);
      toast({ title: 'Offer deleted' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete offer', variant: 'destructive' }),
  });

  const handleSave = (form: typeof EMPTY_FORM & { id?: string }) => {
    const payload = {
      ...form,
      maxUses: form.maxUses === '' ? null : Number(form.maxUses),
      promoCode: form.promoCode || null,
    };
    if (form.id) {
      updateMutation.mutate({ id: form.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Summary counts — always from allOffers (not filtered), so tabs don't break them
  const counts = allOffers.reduce<Record<string, number>>(
    (acc, o) => { const s = offerStatus(o); acc[s] = (acc[s] ?? 0) + 1; return acc; }, {}
  );

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Offers & Promotions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create discounts and promo codes for your guests</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 rounded-xl bg-resort-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-resort-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Offer
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active',    key: 'active',    color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Scheduled', key: 'scheduled', color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Expired',   key: 'expired',   color: 'text-gray-500',  bg: 'bg-gray-50' },
          { label: 'Total',     key: 'total',     color: 'text-resort-700', bg: 'bg-resort-50' },
        ].map(({ label, key, color, bg }) => (
          <div key={key} className={cn('rounded-xl p-4', bg)}>
            <p className={cn('text-2xl font-bold', color)}>
              {key === 'total' ? allOffers.length : (counts[key] ?? 0)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{label} offers</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit dark:bg-gray-800">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              filter === f
                ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Offers list */}
      {isLoading ? (
        <div className="flex justify-center py-20 text-gray-400 text-sm">Loading offers…</div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
          <Tag className="h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No offers yet</p>
          <p className="text-xs text-gray-400">Click "New Offer" to create your first promotion</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {offers.map(offer => {
            const status = offerStatus(offer);
            const sc = STATUS_CONFIG[status];
            const tc = TYPE_CONFIG[offer.type];
            const StatusIcon = sc.icon;
            const TypeIcon = tc.icon;

            return (
              <div key={offer.id}
                className="group relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow dark:border-gray-800 dark:bg-gray-900">

                {/* Type badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tc.color)}>
                      <TypeIcon className="h-3 w-3" />
                      {formatValue(offer)}
                    </span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', sc.cls)}>
                      <StatusIcon className="h-3 w-3" />
                      {sc.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setStatsFor(offer)} title="Stats"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
                      <BarChart2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(offer)} title="Edit"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setConfirmDelete(offer)} title="Delete"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Title & description */}
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{offer.title}</h3>
                {offer.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{offer.description}</p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {format(new Date(offer.validFrom), 'MMM d')}–{format(new Date(offer.validTo), 'MMM d, yyyy')}
                  </span>
                  {offer.minStay > 1 && (
                    <span className="flex items-center gap-1">
                      <MoonStar className="h-3 w-3" />
                      {offer.minStay}+ nights
                    </span>
                  )}
                  {offer.maxUses && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {offer.usedCount}/{offer.maxUses} used
                    </span>
                  )}
                </div>

                {/* Promo code chip */}
                {offer.promoCode && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-resort-300 bg-resort-50 px-3 py-1 text-xs font-mono font-semibold text-resort-700 dark:border-resort-700 dark:bg-resort-900/20">
                    <Tag className="h-3 w-3" />
                    {offer.promoCode}
                  </div>
                )}

                {/* Display flags */}
                <div className="flex gap-2 mt-3">
                  {[
                    { key: 'showOnBar',   label: 'Bar' },
                    { key: 'showSection', label: 'Section' },
                    { key: 'showOnCards', label: 'Cards' },
                  ].map(({ key, label }) => (
                    <span key={key}
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                        offer[key as keyof Offer]
                          ? 'bg-green-50 text-green-600'
                          : 'bg-gray-50 text-gray-400 line-through',
                      )}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {editing && (
        <OfferModal
          initial={editing === 'new' ? undefined : {
            ...editing,
            validFrom: format(new Date(editing.validFrom), 'yyyy-MM-dd'),
            validTo:   format(new Date(editing.validTo),   'yyyy-MM-dd'),
            maxUses:   editing.maxUses ?? '',
            promoCode: editing.promoCode ?? '',
          }}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {/* Stats modal */}
      {statsFor && <StatsModal offer={statsFor} onClose={() => setStatsFor(null)} />}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete Offer?</h3>
            <p className="mt-1 text-sm text-gray-500">
              "{confirmDelete.title}" will be permanently removed.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
