'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { housekeepingApi, roomsApi, staffApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Modal } from '@/components/ui/modal';
import { formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, CheckSquare, Clock, AlertCircle, CheckCircle2,
  Bed, User, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react';

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

const TASK_TYPES = ['DAILY', 'DEEP_CLEAN', 'TURNDOWN', 'CHECKOUT', 'CHECKIN'] as const;
const STATUS_FILTERS = ['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

const TYPE_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  DAILY:      { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Daily' },
  DEEP_CLEAN: { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', label: 'Deep Clean' },
  TURNDOWN:   { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Turndown' },
  CHECKOUT:   { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)',  text: '#c43c3c', label: 'Checkout' },
  CHECKIN:    { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Check-In' },
};

const STATUS_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  PENDING:     { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Pending' },
  IN_PROGRESS: { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)', text: '#23766a', label: 'In Progress' },
  COMPLETED:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)', text: '#23766a', label: 'Completed' },
  SKIPPED:     { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Skipped' },
};

const selectCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[8px] text-[13px] text-[#18231f] focus:outline-none focus:ring-1 focus:ring-resort-600/20';
const labelCls  = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

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
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20 resize-none" />
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t" style={{ borderColor: 'var(--rp-border)' }}>
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-[8px] text-[13px] font-medium text-[#6b8880] transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="rounded-[9px] px-5 py-[8px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)' }}>
            {loading ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function HousekeepingPage() {
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
    <div className="space-y-4 animate-fade-up">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Housekeeping</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Schedule and track room cleaning tasks</p>
        </div>
        {canManage && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80"
            style={{ background: 'var(--rp-btn-accent)' }}
          >
            <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} /> New Task
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Tasks',  value: total || 0,    icon: CheckSquare, bg: 'var(--rp-teal-bg)', color: '#23766a' },
          { label: 'Pending',      value: pendingCount,   icon: Clock,       bg: 'var(--rp-amber-bg)', color: '#b89040' },
          { label: 'In Progress',  value: inProgressCount,icon: AlertCircle, bg: 'var(--rp-coral-bg)', color: '#b8724a' },
          { label: 'Completed',    value: completedCount, icon: CheckCircle2,bg: 'var(--rp-teal-bg)', color: '#23766a' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px] bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: bg }}>
              <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a]">{label}</div>
              <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#18231f]">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8aa29a]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search room or staff…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[8px] pl-9 pr-4 text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(1); }}
          className="rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[8px] text-[13px] text-[#18231f] focus:outline-none focus:ring-1 focus:ring-resort-600/20 max-w-[160px]"
        />
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => {
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className="rounded-[8px] border px-[12px] py-[7px] text-[12px] font-medium transition-colors"
                style={active
                  ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#1b342f' }
                  : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#94b8b0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}>
                {s ? s.replace('_', ' ') : 'All'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
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
              <CheckSquare className="h-7 w-7 text-[#c5bdb4]" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#18231f]">
                {search || statusFilter || dateFilter ? 'No tasks found' : 'No tasks scheduled'}
              </p>
              <p className="mt-1 text-[12.5px] text-[#8aa29a]">
                {search || statusFilter || dateFilter ? 'Try adjusting your filters' : 'Create your first housekeeping task'}
              </p>
            </div>
            {!search && !statusFilter && !dateFilter && canManage && (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0]"
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
                <tr className="border-b text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a]"
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
                          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#e3f2ef]">
                            <Bed className="h-[13px] w-[13px] text-[#23766a]" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[13.5px] font-medium text-[#18231f]">{task.room.name}</p>
                            <p className="text-[11.5px] text-[#8aa29a]">#{task.room.number} · Floor {task.room.floor}</p>
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
                            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#e3f2ef] text-[10px] font-bold text-[#23766a]">
                              {task.assignedTo.user.firstName[0]}{task.assignedTo.user.lastName[0]}
                            </div>
                            <span className="text-[13px] text-[#18231f]">
                              {task.assignedTo.user.firstName} {task.assignedTo.user.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[12.5px] italic text-[#c5bdb4]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-[14px]">
                        <div className="flex items-center gap-1.5 text-[13px] text-[#18231f]">
                          <CalendarDays className="h-[13px] w-[13px] text-[#8aa29a]" />
                          {formatDate(task.scheduledDate)}
                        </div>
                        {task.completedAt && (
                          <p className="mt-px text-[11.5px] text-[#23766a]">Done {formatDate(task.completedAt)}</p>
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
                              style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#8aa29a]">
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
