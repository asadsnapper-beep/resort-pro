'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { housekeepingApi, roomsApi, staffApi, lostFoundApi, minibarApi, laundryApi, bookingsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Modal } from '@/components/ui/modal';
import { ModalShell } from '@/components/ui/modal-shell';
import { formatDate, formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, CheckSquare, Clock, AlertCircle, CheckCircle2,
  Bed, CalendarDays, ChevronLeft, ChevronRight, PackageSearch, Wine, Shirt,
  Loader2, Receipt,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

interface HKTask {
  id: string;
  type: string;
  status: string;
  scheduledDate: string;
  notes?: string;
  completedAt?: string;
  room: { number: string; name: string; floor: number };
  assignedTo?: { id: string; user: { firstName: string; lastName: string } };
}

interface Room { id: string; number: string; name: string; }

interface LostFoundItem {
  id: string;
  description: string;
  category?: string;
  foundDate: string;
  storageLocation?: string;
  status: 'UNCLAIMED' | 'CLAIMED' | 'DISPOSED';
  claimedBy?: string;
  claimedContact?: string;
  room?: { name: string; number: string } | null;
}

interface MinibarCatalogItem { id: string; name: string; price: number; isActive: boolean; }
interface MinibarConsumption {
  id: string; itemName: string; quantity: number; unitPrice: number; billed: boolean;
  createdAt: string; bookingId?: string | null;
  room: { name: string; number: string };
}

interface LaundryOrder {
  id: string; itemCount: number; description?: string; serviceType: string; status: string;
  cost?: number | null; billed: boolean; createdAt: string; bookingId?: string | null;
  room: { name: string; number: string };
}

const TASK_TYPES = ['DAILY', 'DEEP_CLEAN', 'TURNDOWN', 'CHECKOUT', 'CHECKIN'] as const;
const STATUS_FILTERS = ['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

const TYPE_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  DAILY:      { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153', label: 'Daily' },
  DEEP_CLEAN: { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', label: 'Deep Clean' },
  TURNDOWN:   { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Turndown' },
  CHECKOUT:   { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)',  text: '#c43c3c', label: 'Checkout' },
  CHECKIN:    { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153', label: 'Check-In' },
};

const STATUS_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  PENDING:     { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Pending' },
  IN_PROGRESS: { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)', text: '#183153', label: 'In Progress' },
  COMPLETED:   { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)', text: '#183153', label: 'Completed' },
  SKIPPED:     { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Skipped' },
};

const LOST_FOUND_STATUS_META: Record<string, { bg: string; text: string }> = {
  UNCLAIMED: { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  CLAIMED:   { bg: 'var(--rp-teal-bg)', text: '#183153' },
  DISPOSED:  { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)' },
};

const LAUNDRY_STATUS_FLOW = ['REQUESTED', 'IN_PROGRESS', 'READY', 'DELIVERED'] as const;
const LAUNDRY_STATUS_META: Record<string, { bg: string; text: string }> = {
  REQUESTED:   { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  IN_PROGRESS: { bg: 'var(--rp-teal-bg)', text: '#183153' },
  READY:       { bg: 'var(--rp-teal-bg)', text: '#183153' },
  DELIVERED:   { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)' },
};

const selectCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[8px] text-[13px] text-[#183153] focus:outline-none focus:ring-1 focus:ring-resort-600/20';
const labelCls  = 'block text-[11.5px] font-medium text-[#64748b] mb-1.5';

async function tryGetCurrentBookingId(roomId: string): Promise<string | undefined> {
  try {
    const res = await roomsApi.get(roomId);
    return res.data?.data?.currentBooking?.id ?? undefined;
  } catch {
    return undefined;
  }
}

function NewTaskModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, string | undefined>) => void;
}) {
  const { data: roomsData } = useQuery({ queryKey: ['rooms-list'], queryFn: () => roomsApi.list({ limit: 200, isActive: true }) });
  const { data: staffData } = useQuery({ queryKey: ['staff-list'], queryFn: () => staffApi.list({ limit: 100, department: 'HOUSEKEEPING' }) });
  const rooms     = roomsData?.data?.data ?? [];
  const staffList = staffData?.data?.data ?? [];

  const blankForm = { roomId: '', assignedToId: '', type: '', scheduledDate: new Date().toISOString().split('T')[0], notes: '' };
  const [form, setForm] = useState(blankForm);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { if (open) setForm(blankForm); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roomId || !form.type || !form.scheduledDate) {
      toast({ title: 'Missing fields', description: 'Room, type and date are required', variant: 'destructive' }); return;
    }
    onSubmit({
      roomId: form.roomId,
      type: form.type,
      scheduledDate: form.scheduledDate,
      notes: form.notes || undefined,
      assignedToId: form.assignedToId || undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Housekeeping Task" description="Schedule a cleaning or maintenance task" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className={labelCls}>Room *</label>
          <select value={form.roomId} onChange={e => set('roomId', e.target.value)} className={selectCls}>
            <option value="">Select room</option>
            {rooms.map((r: { id: string; number: string; name: string }) => (
              <option key={r.id} value={r.id}>#{r.number} — {r.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Task Type *</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={selectCls}>
              <option value="">Select type</option>
              {TASK_TYPES.map(t => <option key={t} value={t}>{TYPE_PILL[t]?.label ?? t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Scheduled Date *</label>
            <input type="date" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)}
              className={selectCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Assign To (Housekeeping Staff)</label>
          <select value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)} className={selectCls}>
            <option value="">Unassigned</option>
            {staffList.map((s: { id: string; user: { firstName: string; lastName: string } }) => (
              <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            placeholder="Any special instructions..."
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#183153] placeholder:text-[#64748b] focus:outline-none focus:ring-1 focus:ring-resort-600/20 resize-none" />
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t" style={{ borderColor: 'var(--rp-border)' }}>
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-[8px] text-[13px] font-medium text-[#64748b] transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="rounded-[9px] px-5 py-[8px] text-[13px] font-medium text-[#f8fafc] transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)' }}>
            {loading ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Tasks Tab (existing feature, unchanged) ──────────────────────────────────
function TasksTab() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [addOpen, setAddOpen]           = useState(false);
  const [dateFilter, setDateFilter]     = useState('');

  const { user } = useAuthStore();
  const canManage = ['OWNER', 'MANAGER', 'RECEPTIONIST'].includes(user?.role ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['housekeeping', statusFilter, dateFilter, search, page],
    queryFn: () => housekeepingApi.list({ status: statusFilter || undefined, date: dateFilter || undefined, search: search || undefined, page, limit: 20 }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['housekeeping-stats', dateFilter],
    queryFn: () => housekeepingApi.stats({ date: dateFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => housekeepingApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
      queryClient.invalidateQueries({ queryKey: ['housekeeping-stats'] });
      toast({ title: 'Task created' });
      setAddOpen(false);
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to create task', variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => housekeepingApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
      queryClient.invalidateQueries({ queryKey: ['housekeeping-stats'] });
      toast({ title: 'Task updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' }),
  });

  const tasks: HKTask[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const total = pagination?.total ?? 0;

  const stats = statsData?.data?.data ?? { total: 0, pending: 0, inProgress: 0, completed: 0 };
  const pendingCount    = stats.pending    ?? 0;
  const inProgressCount = stats.inProgress ?? 0;
  const completedCount  = stats.completed  ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-end">
        {canManage && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#f8fafc] transition-opacity hover:opacity-80"
            style={{ background: 'var(--rp-btn-accent)' }}
          >
            <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} /> New Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Tasks',  value: total || 0,    icon: CheckSquare, bg: 'var(--rp-teal-bg)', color: '#183153' },
          { label: 'Pending',      value: pendingCount,   icon: Clock,       bg: 'var(--rp-amber-bg)', color: '#b89040' },
          { label: 'In Progress',  value: inProgressCount,icon: AlertCircle, bg: 'var(--rp-coral-bg)', color: '#b8724a' },
          { label: 'Completed',    value: completedCount, icon: CheckCircle2,bg: 'var(--rp-teal-bg)', color: '#183153' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px] bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: bg }}>
              <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#64748b]">{label}</div>
              <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#183153]">{value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748b]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search room or staff…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[8px] pl-9 pr-4 text-[13px] text-[#183153] placeholder:text-[#64748b] focus:outline-none focus:ring-1 focus:ring-resort-600/20"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(1); }}
          className="rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[8px] text-[13px] text-[#183153] focus:outline-none focus:ring-1 focus:ring-resort-600/20 max-w-[160px]"
        />
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => {
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className="rounded-[8px] border px-[12px] py-[7px] text-[12px] font-medium transition-colors"
                style={active
                  ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#183153' }
                  : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#a9c1d0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}>
                {s ? s.replace('_', ' ') : 'All'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="space-y-px p-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-[10px]" style={{ background: 'var(--rp-surface-3)' }} />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f4f1]">
              <CheckSquare className="h-7 w-7 text-[#94a3b8]" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#183153]">
                {search || statusFilter || dateFilter ? 'No tasks found' : 'No tasks scheduled'}
              </p>
              <p className="mt-1 text-[12.5px] text-[#64748b]">
                {search || statusFilter || dateFilter ? 'Try adjusting your filters' : 'Create your first housekeeping task'}
              </p>
            </div>
            {!search && !statusFilter && !dateFilter && canManage && (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#f8fafc]"
                style={{ background: 'var(--rp-btn-accent)' }}
              >
                <Plus className="h-[13px] w-[13px]" /> New Task
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]"
                  style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                  <th className="px-5 py-3 text-left">Room</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Assigned To</th>
                  <th className="px-5 py-3 text-left">Scheduled</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const typeCfg   = TYPE_PILL[task.type]   ?? { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)', text: 'var(--rp-text-subtle)', label: task.type };
                  const statusCfg = STATUS_PILL[task.status] ?? { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)', text: 'var(--rp-text-muted)', label: task.status };
                  return (
                    <tr key={task.id}
                      className="border-b transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                      style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                      <td className="px-5 py-[14px]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#e5f0f7]">
                            <Bed className="h-[13px] w-[13px] text-[#183153]" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[13.5px] font-medium text-[#183153]">{task.room.name}</p>
                            <p className="text-[11.5px] text-[#64748b]">#{task.room.number} · Floor {task.room.floor}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-[14px]">
                        <span className="inline-flex items-center rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
                          style={{ background: typeCfg.bg, borderColor: typeCfg.border, color: typeCfg.text }}>
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-[14px]">
                        {task.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#e5f0f7] text-[10px] font-bold text-[#183153]">
                              {task.assignedTo.user.firstName[0]}{task.assignedTo.user.lastName[0]}
                            </div>
                            <span className="text-[13px] text-[#183153]">
                              {task.assignedTo.user.firstName} {task.assignedTo.user.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[12.5px] italic text-[#94a3b8]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-[14px]">
                        <div className="flex items-center gap-1.5 text-[13px] text-[#183153]">
                          <CalendarDays className="h-[13px] w-[13px] text-[#64748b]" />
                          {formatDate(task.scheduledDate)}
                        </div>
                        {task.completedAt && (
                          <p className="mt-px text-[11.5px] text-[#183153]">Done {formatDate(task.completedAt)}</p>
                        )}
                      </td>
                      <td className="px-5 py-[14px]">
                        <span className="inline-flex items-center rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
                          style={{ background: statusCfg.bg, borderColor: statusCfg.border, color: statusCfg.text }}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-[14px]" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          {task.status === 'PENDING' && (
                            <button
                              onClick={() => statusMutation.mutate({ id: task.id, status: 'IN_PROGRESS' })}
                              className="rounded-[7px] border px-[10px] py-[5px] text-[11.5px] font-medium transition-colors"
                              style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                              Start
                            </button>
                          )}
                          {task.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => statusMutation.mutate({ id: task.id, status: 'COMPLETED' })}
                              className="rounded-[7px] border px-[10px] py-[5px] text-[11.5px] font-medium transition-colors"
                              style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                              Complete
                            </button>
                          )}
                          {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                            <button
                              onClick={() => statusMutation.mutate({ id: task.id, status: 'SKIPPED' })}
                              className="rounded-[7px] border px-[10px] py-[5px] text-[11.5px] font-medium transition-colors"
                              style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                              Skip
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#64748b]">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex h-8 items-center gap-1 rounded-[8px] border px-3 text-[12.5px] font-medium disabled:opacity-40"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              className="flex h-8 items-center gap-1 rounded-[8px] border px-3 text-[12.5px] font-medium disabled:opacity-40"
              style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <NewTaskModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
    </div>
  );
}

// ── Lost & Found Tab ──────────────────────────────────────────────────────────
function LogFoundModal({ open, onClose, loading, onSubmit, rooms }: {
  open: boolean; onClose: () => void; loading: boolean; rooms: Room[];
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ roomId: '', description: '', category: '', storageLocation: '', foundBy: '', notes: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  useEffect(() => { if (open) setForm({ roomId: '', description: '', category: '', storageLocation: '', foundBy: '', notes: '' }); }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description) { toast({ title: 'Description is required', variant: 'destructive' }); return; }
    onSubmit({ ...form, roomId: form.roomId || undefined, category: form.category || undefined, storageLocation: form.storageLocation || undefined, foundBy: form.foundBy || undefined, notes: form.notes || undefined });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Log Found Item" description="Something a guest left behind" maxWidth="500px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button type="submit" form="lf-form" disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Log Item
          </button>
        </div>
      }>
      <form id="lf-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Description *</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Black wallet, phone charger…" className={selectCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Room</label>
            <select value={form.roomId} onChange={e => set('roomId', e.target.value)} className={selectCls}>
              <option value="">Not room-specific</option>
              {rooms.map(r => <option key={r.id} value={r.id}>#{r.number} — {r.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input value={form.category} onChange={e => set('category', e.target.value)} placeholder="Electronics, Clothing…" className={selectCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Storage Location</label>
            <input value={form.storageLocation} onChange={e => set('storageLocation', e.target.value)} placeholder="Front desk drawer" className={selectCls} />
          </div>
          <div>
            <label className={labelCls}>Found By</label>
            <input value={form.foundBy} onChange={e => set('foundBy', e.target.value)} placeholder="Staff name" className={selectCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className={selectCls} />
        </div>
      </form>
    </ModalShell>
  );
}

function ClaimModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: { claimedBy: string; claimedContact?: string }) => void;
}) {
  const [claimedBy, setClaimedBy] = useState('');
  const [claimedContact, setClaimedContact] = useState('');
  useEffect(() => { if (open) { setClaimedBy(''); setClaimedContact(''); } }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimedBy) { toast({ title: 'Guest name is required', variant: 'destructive' }); return; }
    onSubmit({ claimedBy, claimedContact: claimedContact || undefined });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Mark as Claimed" maxWidth="420px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button type="submit" form="claim-form" disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm
          </button>
        </div>
      }>
      <form id="claim-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Guest Name *</label>
          <input value={claimedBy} onChange={e => setClaimedBy(e.target.value)} className={selectCls} />
        </div>
        <div>
          <label className={labelCls}>Contact</label>
          <input value={claimedContact} onChange={e => setClaimedContact(e.target.value)} placeholder="Phone or email" className={selectCls} />
        </div>
      </form>
    </ModalShell>
  );
}

function LostFoundTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const [claimItem, setClaimItem] = useState<LostFoundItem | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['lost-found', statusFilter], queryFn: () => lostFoundApi.list({ status: statusFilter || undefined, limit: 50 }) });
  const { data: roomsData } = useQuery({ queryKey: ['rooms-list'], queryFn: () => roomsApi.list({ limit: 200, isActive: true }) });
  const items: LostFoundItem[] = data?.data?.data ?? [];
  const rooms: Room[] = roomsData?.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lost-found'] });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => lostFoundApi.create(d),
    onSuccess: () => { invalidate(); toast({ title: 'Item logged' }); setLogOpen(false); },
  });
  const claimMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { claimedBy: string; claimedContact?: string } }) => lostFoundApi.claim(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Marked as claimed' }); setClaimItem(null); },
  });
  const disposeMutation = useMutation({
    mutationFn: (id: string) => lostFoundApi.dispose(id),
    onSuccess: () => { invalidate(); toast({ title: 'Marked as disposed' }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {['', 'UNCLAIMED', 'CLAIMED', 'DISPOSED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={statusFilter === s ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' } : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <button onClick={() => setLogOpen(true)} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Log Item
        </button>
      </div>

      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="h-32 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <PackageSearch className="h-10 w-10" style={{ color: '#94a3b8' }} />
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No lost & found items</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--rp-surface-2)' }}>
                {['Item', 'Room', 'Found', 'Storage', 'Status', ''].map(h => <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const sm = LOST_FOUND_STATUS_META[it.status];
                return (
                  <tr key={it.id} className="hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{it.description}</p>
                      {it.category && <p className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">{it.category}</p>}
                      {it.status === 'CLAIMED' && it.claimedBy && <p className="text-[11.5px] text-[#183153]">Claimed by {it.claimedBy}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{it.room ? `#${it.room.number} ${it.room.name}` : '—'}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">{formatDate(it.foundDate)}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{it.storageLocation ?? '—'}</td>
                    <td className="px-5 py-3.5"><span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: sm.bg, color: sm.text }}>{it.status}</span></td>
                    <td className="px-5 py-3.5">
                      {it.status === 'UNCLAIMED' && (
                        <div className="flex gap-1">
                          <button onClick={() => setClaimItem(it)} className="rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e5f0f7]" style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>Claim</button>
                          <button onClick={() => disposeMutation.mutate(it.id)} className="rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#faf0ee]" style={{ borderColor: 'rgba(200,60,60,0.2)', color: '#c43c3c' }}>Dispose</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <LogFoundModal open={logOpen} onClose={() => setLogOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} rooms={rooms} />
      <ClaimModal open={!!claimItem} onClose={() => setClaimItem(null)} loading={claimMutation.isPending}
        onSubmit={d => claimItem && claimMutation.mutate({ id: claimItem.id, data: d })} />
    </div>
  );
}

// ── Minibar Tab ────────────────────────────────────────────────────────────────
function CatalogModal({ open, onClose, catalog, loading, onSubmit }: {
  open: boolean; onClose: () => void; catalog: MinibarCatalogItem[]; loading: boolean;
  onSubmit: (data: { name: string; price: number }) => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  useEffect(() => { if (open) { setName(''); setPrice(''); } }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) { toast({ title: 'Name and price are required', variant: 'destructive' }); return; }
    onSubmit({ name, price: parseFloat(price) });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Minibar Price List" description="Manage catalog items" maxWidth="480px"
      footer={<div className="flex justify-end"><button onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Close</button></div>}>
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1">
            <label className={labelCls}>Item Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Coca-Cola" className={selectCls} />
          </div>
          <div className="w-28">
            <label className={labelCls}>Price</label>
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01" className={selectCls} />
          </div>
          <button type="submit" disabled={loading} className="flex items-center gap-1 rounded-[8px] px-3 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </form>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {catalog.length === 0 ? (
            <p className="text-[12.5px] text-center py-6" style={{ color: 'var(--rp-text-muted)' }}>No catalog items yet</p>
          ) : catalog.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-[8px] border px-3 py-2" style={{ borderColor: 'var(--rp-border)' }}>
              <span className="text-[13px] text-[#183153] dark:text-[#f8fafc]">{c.name}</span>
              <span className="text-[13px] font-medium text-[#183153]">{formatCurrency(c.price)}</span>
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

function LogConsumptionModal({ open, onClose, rooms, catalog, loading, onSubmit }: {
  open: boolean; onClose: () => void; rooms: Room[]; catalog: MinibarCatalogItem[]; loading: boolean;
  onSubmit: (data: { roomId: string; bookingId?: string; items: { minibarItemId: string; quantity: number }[] }) => void;
}) {
  const [roomId, setRoomId] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setRoomId(''); setQty({}); } }, [open]);

  const total = catalog.reduce((s, c) => s + (parseFloat(qty[c.id] || '0') || 0) * c.price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) { toast({ title: 'Select a room', variant: 'destructive' }); return; }
    const items = Object.entries(qty).map(([id, v]) => ({ minibarItemId: id, quantity: parseInt(v, 10) || 0 })).filter(i => i.quantity > 0);
    if (items.length === 0) { toast({ title: 'Enter at least one item quantity', variant: 'destructive' }); return; }
    const bookingId = await tryGetCurrentBookingId(roomId);
    onSubmit({ roomId, bookingId, items });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Log Minibar Consumption" maxWidth="520px"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">Total: {formatCurrency(total)}</span>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
            <button type="submit" form="mb-form" disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Log
            </button>
          </div>
        </div>
      }>
      <form id="mb-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Room *</label>
          <select value={roomId} onChange={e => setRoomId(e.target.value)} className={selectCls}>
            <option value="">Select room</option>
            {rooms.map(r => <option key={r.id} value={r.id}>#{r.number} — {r.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Items Consumed</label>
          {catalog.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: 'var(--rp-text-muted)' }}>No catalog items yet — add some from &ldquo;Manage Price List&rdquo; first.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {catalog.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-[8px] border px-3 py-2" style={{ borderColor: 'var(--rp-border)' }}>
                  <span className="flex-1 text-[13px] text-[#183153] dark:text-[#f8fafc]">{c.name} <span className="text-[#64748b]">· {formatCurrency(c.price)}</span></span>
                  <input value={qty[c.id] ?? ''} onChange={e => setQty(q => ({ ...q, [c.id]: e.target.value }))} type="number" min="0" placeholder="0"
                    className="w-16 rounded-[7px] border border-black/5 bg-[#f4f1eb] px-2 py-1.5 text-[12.5px] text-center" />
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </ModalShell>
  );
}

function MinibarTab() {
  const queryClient = useQueryClient();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['minibar-consumption'], queryFn: () => minibarApi.consumption({ limit: 50 }) });
  const { data: catalogData } = useQuery({ queryKey: ['minibar-catalog'], queryFn: () => minibarApi.catalog() });
  const { data: roomsData } = useQuery({ queryKey: ['rooms-list'], queryFn: () => roomsApi.list({ limit: 200, isActive: true }) });

  const consumption: MinibarConsumption[] = data?.data?.data ?? [];
  const catalog: MinibarCatalogItem[] = catalogData?.data?.data ?? [];
  const rooms: Room[] = roomsData?.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['minibar-consumption'] });

  const catalogMutation = useMutation({
    mutationFn: (d: { name: string; price: number }) => minibarApi.addCatalogItem(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['minibar-catalog'] }); toast({ title: 'Catalog item added' }); },
  });
  const logMutation = useMutation({
    mutationFn: (d: unknown) => minibarApi.logConsumption(d),
    onSuccess: () => { invalidate(); toast({ title: 'Consumption logged' }); setLogOpen(false); },
  });
  const billMutation = useMutation({
    mutationFn: async ({ entry }: { entry: MinibarConsumption }) => {
      await bookingsApi.addInvoiceExtra(entry.bookingId!, { description: `Minibar: ${entry.itemName} x${entry.quantity}`, amount: entry.unitPrice, quantity: entry.quantity });
      return minibarApi.markBilled(entry.id);
    },
    onSuccess: () => { invalidate(); toast({ title: 'Added to guest bill' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to bill — check the booking has an active invoice', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setCatalogOpen(true)} className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
          <Wine className="h-4 w-4" /> Manage Price List
        </button>
        <button onClick={() => setLogOpen(true)} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Log Consumption
        </button>
      </div>

      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="h-32 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
        ) : consumption.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Wine className="h-10 w-10" style={{ color: '#94a3b8' }} />
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No minibar consumption logged</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--rp-surface-2)' }}>
                {['Room', 'Item', 'Qty', 'Cost', 'Date', 'Billed', ''].map(h => <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {consumption.map(c => (
                <tr key={c.id} className="hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">#{c.room.number} {c.room.name}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">{c.itemName}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{c.quantity}</td>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{formatCurrency(c.unitPrice * c.quantity)}</td>
                  <td className="px-5 py-3.5 text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">{formatDate(c.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    {c.billed ? <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: 'var(--rp-teal-bg)', color: '#183153' }}>Billed</span>
                      : <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: 'var(--rp-surface-3)', color: 'var(--rp-text-muted)' }}>Pending</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {!c.billed && c.bookingId && (
                      <button onClick={() => billMutation.mutate({ entry: c })} className="flex items-center gap-1 rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e5f0f7]" style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                        <Receipt className="h-3 w-3" /> Bill
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CatalogModal open={catalogOpen} onClose={() => setCatalogOpen(false)} catalog={catalog} loading={catalogMutation.isPending} onSubmit={d => catalogMutation.mutate(d)} />
      <LogConsumptionModal open={logOpen} onClose={() => setLogOpen(false)} rooms={rooms} catalog={catalog} loading={logMutation.isPending} onSubmit={d => logMutation.mutate(d)} />
    </div>
  );
}

// ── Laundry Tab ────────────────────────────────────────────────────────────────
function NewLaundryModal({ open, onClose, rooms, loading, onSubmit }: {
  open: boolean; onClose: () => void; rooms: Room[]; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ roomId: '', itemCount: '', description: '', serviceType: 'WASH', cost: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  useEffect(() => { if (open) setForm({ roomId: '', itemCount: '', description: '', serviceType: 'WASH', cost: '' }); }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roomId || !form.itemCount) { toast({ title: 'Room and item count are required', variant: 'destructive' }); return; }
    const bookingId = await tryGetCurrentBookingId(form.roomId);
    onSubmit({
      roomId: form.roomId, bookingId, itemCount: parseInt(form.itemCount, 10),
      description: form.description || undefined, serviceType: form.serviceType,
      cost: form.cost ? parseFloat(form.cost) : undefined,
    });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="New Laundry Order" maxWidth="480px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button type="submit" form="laundry-form" disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create Order
          </button>
        </div>
      }>
      <form id="laundry-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Room *</label>
          <select value={form.roomId} onChange={e => set('roomId', e.target.value)} className={selectCls}>
            <option value="">Select room</option>
            {rooms.map(r => <option key={r.id} value={r.id}>#{r.number} — {r.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Item Count *</label>
            <input value={form.itemCount} onChange={e => set('itemCount', e.target.value)} type="number" min="1" className={selectCls} />
          </div>
          <div>
            <label className={labelCls}>Service Type</label>
            <select value={form.serviceType} onChange={e => set('serviceType', e.target.value)} className={selectCls}>
              <option value="WASH">Wash</option>
              <option value="DRY_CLEAN">Dry Clean</option>
              <option value="IRON">Iron</option>
              <option value="WASH_AND_IRON">Wash & Iron</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="3 shirts, 2 pants…" className={selectCls} />
        </div>
        <div>
          <label className={labelCls}>Cost <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
          <input value={form.cost} onChange={e => set('cost', e.target.value)} type="number" min="0" step="0.01" className={selectCls} />
        </div>
      </form>
    </ModalShell>
  );
}

function LaundryTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['laundry', statusFilter], queryFn: () => laundryApi.list({ status: statusFilter || undefined, limit: 50 }) });
  const { data: roomsData } = useQuery({ queryKey: ['rooms-list'], queryFn: () => roomsApi.list({ limit: 200, isActive: true }) });
  const orders: LaundryOrder[] = data?.data?.data ?? [];
  const rooms: Room[] = roomsData?.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['laundry'] });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => laundryApi.create(d),
    onSuccess: () => { invalidate(); toast({ title: 'Order created' }); setAddOpen(false); },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => laundryApi.updateStatus(id, { status }),
    onSuccess: () => { invalidate(); toast({ title: 'Status updated' }); },
  });
  const billMutation = useMutation({
    mutationFn: async (order: LaundryOrder) => {
      await bookingsApi.addInvoiceExtra(order.bookingId!, { description: `Laundry: ${order.description || order.serviceType} (${order.itemCount} items)`, amount: order.cost ?? 0, quantity: 1 });
      return laundryApi.markBilled(order.id);
    },
    onSuccess: () => { invalidate(); toast({ title: 'Added to guest bill' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to bill — check the booking has an active invoice', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {['', ...LAUNDRY_STATUS_FLOW].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={statusFilter === s ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' } : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              {s ? s.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> New Order
        </button>
      </div>

      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="h-32 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Shirt className="h-10 w-10" style={{ color: '#94a3b8' }} />
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No laundry orders</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--rp-surface-2)' }}>
                {['Room', 'Items', 'Service', 'Cost', 'Status', 'Billed', ''].map(h => <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const sm = LAUNDRY_STATUS_META[o.status];
                const nextIdx = LAUNDRY_STATUS_FLOW.indexOf(o.status as typeof LAUNDRY_STATUS_FLOW[number]) + 1;
                const nextStatus = LAUNDRY_STATUS_FLOW[nextIdx];
                return (
                  <tr key={o.id} className="hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">#{o.room.number} {o.room.name}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{o.itemCount} — {o.description ?? '—'}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[#475569] dark:text-[#9db4c4]">{o.serviceType.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{o.cost != null ? formatCurrency(o.cost) : '—'}</td>
                    <td className="px-5 py-3.5"><span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: sm.bg, color: sm.text }}>{o.status.replace('_', ' ')}</span></td>
                    <td className="px-5 py-3.5">
                      {o.billed ? <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: 'var(--rp-teal-bg)', color: '#183153' }}>Billed</span>
                        : <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: 'var(--rp-surface-3)', color: 'var(--rp-text-muted)' }}>Pending</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        {nextStatus && (
                          <button onClick={() => statusMutation.mutate({ id: o.id, status: nextStatus })}
                            className="rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e5f0f7]" style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                            Mark {nextStatus.replace('_', ' ')}
                          </button>
                        )}
                        {!o.billed && o.bookingId && o.cost != null && (
                          <button onClick={() => billMutation.mutate(o)} className="flex items-center gap-1 rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e5f0f7]" style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                            <Receipt className="h-3 w-3" /> Bill
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <NewLaundryModal open={addOpen} onClose={() => setAddOpen(false)} rooms={rooms} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function HousekeepingPage() {
  const [tab, setTab] = useState<'tasks' | 'lost-found' | 'minibar' | 'laundry'>('tasks');

  return (
    <PageShell gap={4}>
      <PageHeader
        title="Housekeeping"
        subtitle="Cleaning tasks, lost & found, minibar, laundry"
      />

      <div className="flex gap-1 rounded-[10px] p-1 w-fit" style={{ background: 'var(--rp-surface-3)' }}>
        {([
          { key: 'tasks', label: 'Tasks' },
          { key: 'lost-found', label: 'Lost & Found' },
          { key: 'minibar', label: 'Minibar' },
          { key: 'laundry', label: 'Laundry' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="rounded-[8px] px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={tab === t.key ? { background: 'var(--rp-surface)', color: 'var(--rp-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: 'var(--rp-text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && <TasksTab />}
      {tab === 'lost-found' && <LostFoundTab />}
      {tab === 'minibar' && <MinibarTab />}
      {tab === 'laundry' && <LaundryTab />}
    </PageShell>
  );
}
