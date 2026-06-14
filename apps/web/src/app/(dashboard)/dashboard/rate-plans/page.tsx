'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ratePlansApi, roomsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  Plus, Tags, Pencil, Trash2, ToggleLeft, ToggleRight,
  CalendarDays, BedDouble, Star, Loader2, X, Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
const TYPE_META: Record<RatePlanType, { label: string; color: string; description: string }> = {
  STANDARD:    { label: 'Standard',    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',       description: 'Default year-round rate' },
  SEASONAL:    { label: 'Seasonal',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',   description: 'Specific date range pricing' },
  WEEKEND:     { label: 'Weekend',     color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300', description: 'Friday–Sunday rates' },
  PROMO:       { label: 'Promo',       color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',   description: 'Highest priority — overrides all' },
  EARLY_BIRD:  { label: 'Early Bird',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', description: 'Book early discount' },
  LAST_MINUTE: { label: 'Last Minute', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', description: 'Fill rooms last-minute' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_ORDER: RatePlanType[] = ['PROMO', 'SEASONAL', 'WEEKEND', 'EARLY_BIRD', 'LAST_MINUTE', 'STANDARD'];

// ── Plan Modal ────────────────────────────────────────────────────────────────
interface PlanFormData {
  name: string;
  type: RatePlanType;
  price: string;
  roomId: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  minNights: string;
  isActive: boolean;
}

function PlanModal({
  plan,
  rooms,
  onClose,
}: {
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
      // Auto-select Fri/Sat/Sun when switching to WEEKEND type with no days selected
      if (k === 'type' && v === 'WEEKEND' && next.daysOfWeek.length === 0) {
        next.daysOfWeek = [0, 5, 6]; // Sun, Fri, Sat
      }
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
      // Validate date range
      if (form.startDate && form.endDate && form.endDate < form.startDate) {
        throw new Error('End date must be after start date');
      }
      const payload = {
        name: form.name,
        type: form.type,
        price: parseFloat(form.price),
        roomId: form.roomId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        daysOfWeek: form.daysOfWeek,
        minNights: parseInt(form.minNights) || 1,
        isActive: form.isActive,
      };
      return isEdit ? ratePlansApi.update(plan!.id, payload) : ratePlansApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-plans'] });
      toast({ title: isEdit ? 'Rate plan updated' : 'Rate plan created' });
      onClose();
    },
    onError: (e: Error) => {
      if (e.message.includes('End date')) {
        setFormError(e.message);
      } else {
        toast({ title: 'Save failed', variant: 'destructive' });
      }
    },
  });

  const showDateRange = ['SEASONAL', 'PROMO', 'EARLY_BIRD', 'LAST_MINUTE'].includes(form.type);
  const showDaysOfWeek = form.type === 'WEEKEND';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Rate Plan' : 'New Rate Plan'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Rate Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as RatePlanType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('type', t)}
                  className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-all ${
                    form.type === t
                      ? 'border-resort-600 bg-resort-50 dark:bg-resort-900/20 text-resort-700 dark:text-resort-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
              <Info className="h-3 w-3" />{TYPE_META[form.type].description}
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Plan Name</label>
            <input
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-resort-500"
              placeholder={`e.g. ${form.type === 'SEASONAL' ? 'Peak Season 2025' : form.type === 'PROMO' ? 'Summer Sale 30% Off' : 'Standard Rate'}`}
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Price + Room */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Price / Night</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-resort-500"
                placeholder="0.00"
                value={form.price}
                onChange={e => set('price', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Room (optional)</label>
              <select
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-resort-500"
                value={form.roomId}
                onChange={e => set('roomId', e.target.value)}
              >
                <option value="">All Rooms</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name} (#{r.number})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Min nights */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Minimum Nights</label>
            <input
              type="number"
              min="1"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-resort-500"
              value={form.minNights}
              onChange={e => set('minNights', e.target.value)}
            />
          </div>

          {/* Date range (conditional) */}
          {showDateRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Start Date</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-resort-500"
                  value={form.startDate}
                  onChange={e => { setFormError(''); set('startDate', e.target.value); }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">End Date</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-resort-500"
                  value={form.endDate}
                  onChange={e => { setFormError(''); set('endDate', e.target.value); }}
                />
              </div>
            </div>
          )}

          {/* Days of week (conditional) */}
          {showDaysOfWeek && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Applies on Days</label>
              <div className="flex gap-1.5">
                {DAYS.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      form.daysOfWeek.includes(i)
                        ? 'bg-resort-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {day.slice(0, 1)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {form.daysOfWeek.length === 0 ? 'No days selected — rate won\'t apply' : DAYS.filter((_, i) => form.daysOfWeek.includes(i)).join(', ')}
              </p>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-gray-400">Inactive plans won't affect pricing</p>
            </div>
            <button type="button" onClick={() => set('isActive', !form.isActive)}>
              {form.isActive
                ? <ToggleRight className="h-7 w-7 text-resort-600" />
                : <ToggleLeft className="h-7 w-7 text-gray-400" />}
            </button>
          </div>
        </div>

        {formError && (
          <p className="px-6 pb-2 text-xs text-red-500 flex items-center gap-1">
            <span>⚠</span> {formError}
          </p>
        )}
        <div className="flex gap-2 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            className="flex-1 bg-resort-600 hover:bg-resort-700 text-white"
            disabled={!form.name || !form.price || isPending}
            onClick={() => { setFormError(''); mutate(); }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? 'Save Changes' : 'Create Plan'}
          </Button>
        </div>
      </div>
    </div>
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rate-plans'] });
      toast({ title: 'Rate plan deleted' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const plans = plansRes ?? [];
  const rooms = roomsRes ?? [];

  // Group by type for summary
  const activePlans = plans.filter(p => p.isActive);
  const byType = PRIORITY_ORDER.map(t => ({ type: t, count: plans.filter(p => p.type === t).length })).filter(x => x.count > 0);

  const openCreate = () => { setEditPlan(undefined); setShowModal(true); };
  const openEdit = (p: RatePlan) => { setEditPlan(p); setShowModal(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rate Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dynamic pricing by season, day-of-week, or promotion
          </p>
        </div>
        <Button className="bg-resort-600 hover:bg-resort-700 text-white gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Rate Plan
        </Button>
      </div>

      {/* Priority legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Priority (highest → lowest):</span>
            {PRIORITY_ORDER.map((t, i) => (
              <div key={t} className="flex items-center gap-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_META[t].color}`}>
                  {TYPE_META[t].label}
                </span>
                {i < PRIORITY_ORDER.length - 1 && <span className="text-gray-300 dark:text-gray-600 text-xs">›</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            When multiple plans apply to a booking, the highest priority plan wins. Room-specific plans beat global plans of the same priority.
          </p>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Plans</p>
            <p className="text-2xl font-bold mt-1">{plans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Plans</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{activePlans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Types Used</p>
            <p className="text-2xl font-bold mt-1">{byType.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Rooms Covered</p>
            <p className="text-2xl font-bold mt-1">
              {plans.some(p => !p.roomId) ? 'All' : new Set(plans.map(p => p.roomId)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plans table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Rate Plans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-resort-600" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl bg-resort-50 dark:bg-resort-900/20 flex items-center justify-center">
                <Tags className="h-7 w-7 text-resort-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">No rate plans yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">Create your first rate plan to start dynamic pricing</p>
              </div>
              <Button className="mt-2 bg-resort-600 hover:bg-resort-700 text-white gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Create Rate Plan
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {plans.map(plan => {
                const meta = TYPE_META[plan.type];
                return (
                  <div key={plan.id} className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!plan.isActive ? 'opacity-60' : ''}`}>
                    {/* Type badge */}
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{plan.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {/* Room */}
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <BedDouble className="h-3 w-3" />
                          {plan.room ? `${plan.room.name} #${plan.room.number}` : 'All Rooms'}
                        </span>
                        {/* Date range */}
                        {(plan.startDate || plan.endDate) && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <CalendarDays className="h-3 w-3" />
                            {plan.startDate ? plan.startDate.slice(0, 10) : '∞'} → {plan.endDate ? plan.endDate.slice(0, 10) : '∞'}
                          </span>
                        )}
                        {/* Days of week */}
                        {plan.daysOfWeek.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {DAYS.filter((_, i) => plan.daysOfWeek.includes(i)).join(', ')}
                          </span>
                        )}
                        {/* Min nights */}
                        {plan.minNights > 1 && (
                          <span className="text-xs text-gray-500">Min {plan.minNights}n</span>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-resort-700 dark:text-resort-400 text-lg">
                        {formatCurrency(plan.price)}
                      </p>
                      <p className="text-xs text-gray-400">/ night</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(plan)}
                        className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={plan.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {plan.isActive
                          ? <ToggleRight className="h-5 w-5 text-resort-600" />
                          : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                      </button>
                      <button
                        onClick={() => openEdit(plan)}
                        className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${plan.name}"?`)) deletePlan(plan.id);
                        }}
                        className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rate resolution info */}
      <Card className="border-amber-200 dark:border-amber-900/40">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">How rate resolution works</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                When a booking is made, the system checks all active plans for the room and date range.
                Plans are ranked: <strong>Promo</strong> › <strong>Seasonal</strong> › <strong>Weekend</strong> › <strong>Early Bird</strong> › <strong>Last Minute</strong> › <strong>Standard</strong>.
                Room-specific plans beat global (All Rooms) plans of the same type.
                If no plan matches, the room's base price is used.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showModal && (
        <PlanModal
          plan={editPlan}
          rooms={rooms}
          onClose={() => { setShowModal(false); setEditPlan(undefined); }}
        />
      )}
    </div>
  );
}
