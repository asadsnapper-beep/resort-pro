'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ratePlansApi, roomsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Plus, Tags, Pencil, Trash2, ToggleLeft, ToggleRight,
  CalendarDays, BedDouble, Star, Loader2, Info,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
import { useToast } from '@/hooks/use-toast';
import { ModalShell } from '@/components/ui/modal-shell';

// ── Types ─────────────────────────────────────────────────────────────────────
type RatePlanType = 'STANDARD' | 'SEASONAL' | 'WEEKEND' | 'PROMO' | 'EARLY_BIRD' | 'LAST_MINUTE';

interface RatePlan {
  id: string;
  name: string;
  type: RatePlanType;
  price: number;
  roomId: string | null;
  room?: { id: string; name: string; number: string } | null;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: number[];
  minNights: number;
  isActive: boolean;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_META: Record<RatePlanType, { label: string; bg: string; border: string; text: string; description: string }> = {
  STANDARD:    { label: 'Standard',    bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', description: 'Default year-round rate' },
  SEASONAL:    { label: 'Seasonal',    bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', description: 'Specific date range pricing' },
  WEEKEND:     { label: 'Weekend',     bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', description: 'Friday–Sunday rates' },
  PROMO:       { label: 'Promo',       bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)',  text: '#c43c3c', description: 'Highest priority — overrides all' },
  EARLY_BIRD:  { label: 'Early Bird',  bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)', text: '#b8724a', description: 'Book early discount' },
  LAST_MINUTE: { label: 'Last Minute', bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.15)',text: 'var(--rp-text-accent)', description: 'Fill rooms last-minute' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PRIORITY_ORDER: RatePlanType[] = ['PROMO', 'SEASONAL', 'WEEKEND', 'EARLY_BIRD', 'LAST_MINUTE', 'STANDARD'];

const inputCls = 'w-full rounded-[8px] border border-black/5 dark:border-white/10 bg-[#f4f1eb] dark:bg-white/10 px-3 py-[9px] text-[13px] text-[#18231f] dark:text-[#dfd9d0] placeholder:text-[#b5afa7] dark:placeholder:text-[#6e8580] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a] mb-1.5';

// ── Plan Modal ────────────────────────────────────────────────────────────────
interface PlanFormData {
  name: string; type: RatePlanType; price: string; roomId: string;
  startDate: string; endDate: string; daysOfWeek: number[]; minNights: string; isActive: boolean;
}

function PlanModal({ plan, rooms, onClose }: {
  plan?: RatePlan;
  rooms: { id: string; name: string; number: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!plan;

  const [form, setForm] = useState<PlanFormData>({
    name: plan?.name ?? '',
    type: plan?.type ?? 'STANDARD',
    price: plan ? String(plan.price) : '',
    roomId: plan?.roomId ?? '',
    startDate: plan?.startDate ? plan.startDate.slice(0, 10) : '',
    endDate: plan?.endDate ? plan.endDate.slice(0, 10) : '',
    daysOfWeek: plan?.daysOfWeek ?? [],
    minNights: plan ? String(plan.minNights) : '1',
    isActive: plan?.isActive ?? true,
  });

  const set = (k: keyof PlanFormData, v: unknown) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'type' && v === 'WEEKEND' && next.daysOfWeek.length === 0) next.daysOfWeek = [0, 5, 6];
      return next;
    });
  };
  const toggleDay = (d: number) => setForm(f => ({
    ...f,
    daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d],
  }));

  const [formError, setFormError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (form.startDate && form.endDate && form.endDate < form.startDate) throw new Error('End date must be after start date');
      const payload = {
        name: form.name, type: form.type, price: parseFloat(form.price),
        roomId: form.roomId || null,
        startDate: form.startDate || null, endDate: form.endDate || null,
        daysOfWeek: form.daysOfWeek, minNights: parseInt(form.minNights) || 1, isActive: form.isActive,
      };
      return isEdit ? ratePlansApi.update(plan!.id, payload) : ratePlansApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-plans'] });
      toast({ title: isEdit ? 'Rate plan updated' : 'Rate plan created' });
      onClose();
    },
    onError: (e: Error) => {
      if (e.message.includes('End date')) setFormError(e.message);
      else toast({ title: 'Save failed', variant: 'destructive' });
    },
  });

  const showDateRange = ['SEASONAL', 'PROMO', 'EARLY_BIRD', 'LAST_MINUTE'].includes(form.type);
  const showDaysOfWeek = form.type === 'WEEKEND';
  const meta = TYPE_META[form.type];

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={isEdit ? 'Edit Rate Plan' : 'New Rate Plan'}
      description={isEdit ? `Editing ${plan?.name}` : 'Create a new pricing rule for your rooms'}
      maxWidth="520px"
      footer={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} disabled={isPending}
            className="flex-1 rounded-[9px] border py-2.5 text-[13px] transition-colors hover:bg-[#f4f1eb] dark:hover:bg-white/5 disabled:opacity-50"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button disabled={!form.name || !form.price || isPending}
            onClick={() => { setFormError(''); mutate(); }}
            className="flex-1 flex items-center justify-center gap-2 rounded-[9px] py-2.5 text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Type selector */}
          <div>
            <label className={labelCls}>Rate Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as RatePlanType[]).map(t => {
                const m = TYPE_META[t];
                const active = form.type === t;
                return (
                  <button key={t} type="button" onClick={() => set('type', t)}
                    className="rounded-[8px] border-2 px-3 py-2 text-[12px] font-semibold transition-all text-left"
                    style={{
                      borderColor: active ? m.text : 'var(--rp-border)',
                      background: active ? m.bg : 'var(--rp-surface-2)',
                      color: active ? m.text : 'var(--rp-text-muted)',
                    }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
              <Info className="h-3 w-3" />{meta.description}
            </p>
          </div>

          {/* Name */}
          <div>
            <label className={labelCls}>Plan Name</label>
            <input className={inputCls}
              placeholder={`e.g. ${form.type === 'SEASONAL' ? 'Peak Season 2025' : form.type === 'PROMO' ? 'Summer Sale 30% Off' : 'Standard Rate'}`}
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          {/* Price + Room */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Price / Night</label>
              <input type="number" min="0" step="0.01" className={inputCls}
                placeholder="0.00" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Room (optional)</label>
              <select className={inputCls} value={form.roomId} onChange={e => set('roomId', e.target.value)}>
                <option value="">All Rooms</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (#{r.number})</option>)}
              </select>
            </div>
          </div>

          {/* Min nights */}
          <div>
            <label className={labelCls}>Minimum Nights</label>
            <input type="number" min="1" className={inputCls}
              value={form.minNights} onChange={e => set('minNights', e.target.value)} />
          </div>

          {/* Date range */}
          {showDateRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start Date</label>
                <input type="date" className={inputCls} value={form.startDate}
                  onChange={e => { setFormError(''); set('startDate', e.target.value); }} />
              </div>
              <div>
                <label className={labelCls}>End Date</label>
                <input type="date" className={inputCls} value={form.endDate}
                  onChange={e => { setFormError(''); set('endDate', e.target.value); }} />
              </div>
            </div>
          )}

          {/* Days of week */}
          {showDaysOfWeek && (
            <div>
              <label className={labelCls}>Applies on Days</label>
              <div className="flex gap-1.5">
                {DAYS.map((day, i) => {
                  const active = form.daysOfWeek.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      className="flex-1 rounded-[7px] py-1.5 text-[12px] font-semibold transition-all"
                      style={active
                        ? { background: '#23766a', color: 'var(--rp-btn-accent-text)' }
                        : { background: 'var(--rp-surface-3)', color: 'var(--rp-text-muted)' }}>
                      {day.slice(0, 1)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                {form.daysOfWeek.length === 0
                  ? "No days selected — rate won't apply"
                  : DAYS.filter((_, i) => form.daysOfWeek.includes(i)).join(', ')}
              </p>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-[10px] border px-4 py-3"
            style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
            <div>
              <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">Active</p>
              <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">Inactive plans won't affect pricing</p>
            </div>
            <button type="button" onClick={() => set('isActive', !form.isActive)}>
              {form.isActive
                ? <ToggleRight className="h-7 w-7" style={{ color: '#23766a' }} />
                : <ToggleLeft className="h-7 w-7 text-[#c5bdb4] dark:text-[#6e8580]" />}
            </button>
          </div>

          {formError && (
            <p className="flex items-center gap-1 rounded-[8px] border px-3 py-2 text-[12px]"
              style={{ background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }}>
              ⚠ {formError}
            </p>
          )}
        </div>
    </ModalShell>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RatePlansPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState<RatePlan | undefined>();

  const { data: plansRes, isLoading } = useQuery({
    queryKey: ['rate-plans'],
    queryFn: () => ratePlansApi.list(),
    select: r => r.data.data as RatePlan[],
  });

  const { data: roomsRes } = useQuery({
    queryKey: ['rooms-simple'],
    queryFn: () => roomsApi.list(),
    select: r => (r.data.data?.rooms ?? r.data.data ?? []) as { id: string; name: string; number: string }[],
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: (p: RatePlan) => ratePlansApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-plans'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const { mutate: deletePlan } = useMutation({
    mutationFn: (id: string) => ratePlansApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rate-plans'] }); toast({ title: 'Rate plan deleted' }); },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const plans = plansRes ?? [];
  const rooms = roomsRes ?? [];
  const activePlans = plans.filter(p => p.isActive);
  const byType = PRIORITY_ORDER.map(t => ({ type: t, count: plans.filter(p => p.type === t).length })).filter(x => x.count > 0);

  const openCreate = () => { setEditPlan(undefined); setShowModal(true); };
  const openEdit = (p: RatePlan) => { setEditPlan(p); setShowModal(true); };

  return (
    <PageShell gap={6}>
      {/* Header */}
      <PageHeader
        title="Rate Plans"
        subtitle="Dynamic pricing by season, day-of-week, or promotion"
        align="start"
        actions={
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            <Plus className="h-4 w-4" /> New Rate Plan
          </button>
        }
      />

      {/* Priority legend */}
      <div className="rounded-[14px] border bg-white dark:bg-white/5 p-4"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mr-1 text-[#8aa29a] dark:text-[#94b8b0]">
            Priority (highest → lowest):
          </span>
          {PRIORITY_ORDER.map((t, i) => {
            const m = TYPE_META[t];
            return (
              <div key={t} className="flex items-center gap-1.5">
                <span className="rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold"
                  style={{ background: m.bg, borderColor: m.border, color: m.text }}>
                  {m.label}
                </span>
                {i < PRIORITY_ORDER.length - 1 && (
                  <span className="text-[12px] text-[#c5bdb4] dark:text-[#6e8580]">›</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
          When multiple plans apply to a booking, the highest priority plan wins. Room-specific plans beat global plans of the same priority.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Plans',    value: String(plans.length),                                                   color: '#23766a',  bg: 'var(--rp-teal-bg)' },
          { label: 'Active Plans',   value: String(activePlans.length),                                             color: '#1b342f',  bg: 'var(--rp-teal-bg)' },
          { label: 'Types Used',     value: String(byType.length),                                                  color: '#b89040',  bg: 'var(--rp-amber-bg)' },
          { label: 'Rooms Covered',  value: plans.some(p => !p.roomId) ? 'All' : String(new Set(plans.map(p => p.roomId)).size), color: '#b8724a', bg: 'var(--rp-coral-bg)' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-[14px] border bg-white dark:bg-white/5 p-4"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-[8px] w-[8px] rounded-full" style={{ background: color }} />
              <p className="text-[11px] font-medium text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
            </div>
            <p className="text-[24px] font-semibold tracking-[-0.02em] text-[#18231f] dark:text-[#dfd9d0]">{value}</p>
          </div>
        ))}
      </div>

      {/* Plans list */}
      <div className="rounded-[14px] border bg-white dark:bg-white/5 overflow-hidden"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div className="border-b px-5 py-4" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
          <h2 className="text-[14px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">All Rate Plans</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#23766a' }} />
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <div className="flex h-[56px] w-[56px] items-center justify-center rounded-[14px]"
              style={{ background: 'var(--rp-teal-bg)' }}>
              <Tags className="h-7 w-7" style={{ color: '#23766a' }} />
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#18231f] dark:text-[#dfd9d0]">No rate plans yet</p>
              <p className="text-[12.5px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">
                Create your first rate plan to start dynamic pricing
              </p>
            </div>
            <button onClick={openCreate}
              className="mt-2 flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              <Plus className="h-4 w-4" /> Create Rate Plan
            </button>
          </div>
        ) : (
          <div>
            {plans.map((plan, idx) => {
              const meta = TYPE_META[plan.type];
              return (
                <div key={plan.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[#faf9f7] dark:hover:bg-white/5 transition-colors"
                  style={{
                    borderBottom: idx < plans.length - 1 ? '1px solid rgba(0,0,0,0.04)' : undefined,
                    opacity: plan.isActive ? 1 : 0.55,
                  }}>
                  {/* Type pill */}
                  <span className="shrink-0 rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
                    style={{ background: meta.bg, borderColor: meta.border, color: meta.text }}>
                    {meta.label}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium truncate text-[#18231f] dark:text-[#dfd9d0]">{plan.name}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                        <BedDouble className="h-3 w-3" />
                        {plan.room ? `${plan.room.name} #${plan.room.number}` : 'All Rooms'}
                      </span>
                      {(plan.startDate || plan.endDate) && (
                        <span className="flex items-center gap-1 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                          <CalendarDays className="h-3 w-3" />
                          {plan.startDate ? plan.startDate.slice(0, 10) : '∞'} → {plan.endDate ? plan.endDate.slice(0, 10) : '∞'}
                        </span>
                      )}
                      {plan.daysOfWeek.length > 0 && (
                        <span className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                          {DAYS.filter((_, i) => plan.daysOfWeek.includes(i)).join(', ')}
                        </span>
                      )}
                      {plan.minNights > 1 && (
                        <span className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">Min {plan.minNights}n</span>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="shrink-0 text-right">
                    <p className="text-[18px] font-semibold tracking-[-0.02em]" style={{ color: '#23766a' }}>
                      {formatCurrency(plan.price)}
                    </p>
                    <p className="text-[11px] text-[#8aa29a] dark:text-[#94b8b0]">/ night</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => toggleActive(plan)} title={plan.isActive ? 'Deactivate' : 'Activate'}
                      className="rounded-[7px] p-1.5 transition-colors hover:bg-[#e3f2ef]">
                      {plan.isActive
                        ? <ToggleRight className="h-5 w-5" style={{ color: '#23766a' }} />
                        : <ToggleLeft className="h-5 w-5 text-[#c5bdb4] dark:text-[#6e8580]" />}
                    </button>
                    <button onClick={() => openEdit(plan)} title="Edit"
                      className="rounded-[7px] p-1.5 transition-colors hover:bg-[#f4f1eb]">
                      <Pencil className="h-4 w-4 text-[#8aa29a] dark:text-[#94b8b0]" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${plan.name}"?`)) deletePlan(plan.id); }}
                      title="Delete" className="rounded-[7px] p-1.5 transition-colors hover:bg-[#fef2f2]">
                      <Trash2 className="h-4 w-4" style={{ color: '#c43c3c' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rate resolution info */}
      <div className="rounded-[14px] border p-4"
        style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.25)' }}>
        <div className="flex items-start gap-3">
          <Star className="h-[18px] w-[18px] shrink-0 mt-0.5" style={{ color: '#b89040' }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#7a5c2a' }}>How rate resolution works</p>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: '#9e7c3a' }}>
              When a booking is made, the system checks all active plans for the room and date range.
              Plans are ranked: <strong>Promo</strong> › <strong>Seasonal</strong> › <strong>Weekend</strong> › <strong>Early Bird</strong> › <strong>Last Minute</strong> › <strong>Standard</strong>.
              Room-specific plans beat global (All Rooms) plans of the same type. If no plan matches, the room's base price is used.
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <PlanModal
          plan={editPlan}
          rooms={rooms}
          onClose={() => { setShowModal(false); setEditPlan(undefined); }}
        />
      )}
    </PageShell>
  );
}
