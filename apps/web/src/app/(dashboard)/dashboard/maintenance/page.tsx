'use client';

import { ModalShell } from '@/components/ui/modal-shell';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceApi, roomsApi, staffApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import {
  Wrench, Plus, Loader2, CheckCircle2, AlertTriangle,
  Clock, ChevronDown, Wind, Droplets, Zap, Sofa,
  DoorOpen, Wifi, Tv, HelpCircle, User, BedDouble, Trash2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Priority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
type IssueType = 'AC' | 'PLUMBING' | 'ELECTRICAL' | 'FURNITURE' | 'DOOR' | 'WIFI' | 'TV' | 'OTHER';

interface Ticket {
  id: string;
  issueType: IssueType;
  description: string;
  priority: Priority;
  status: Status;
  assignedTo: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  room: { id: string; name: string; number: string; floor?: number | null };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_META: Record<Priority, { label: string; bg: string; border: string; text: string; dot: string }> = {
  URGENT: { label: 'Urgent', bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.18)',  text: '#c43c3c', dot: '#c43c3c' },
  HIGH:   { label: 'High',   bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)', text: '#b8724a', dot: '#b8724a' },
  NORMAL: { label: 'Normal', bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)', text: '#23766a', dot: '#23766a' },
  LOW:    { label: 'Low',    bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', dot: 'var(--rp-text-muted)' },
};

const STATUS_META: Record<Status, { label: string; bg: string; border: string; text: string; icon: React.ElementType }> = {
  OPEN:        { label: 'Open',        bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.18)',  text: '#c43c3c', icon: AlertTriangle },
  IN_PROGRESS: { label: 'In Progress', bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)', text: '#b89040', icon: Clock },
  RESOLVED:    { label: 'Resolved',    bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)', text: '#23766a', icon: CheckCircle2 },
};

const ISSUE_META: Record<IssueType, { label: string; icon: React.ElementType; emoji: string }> = {
  AC:          { label: 'A/C',        icon: Wind,       emoji: '❄️' },
  PLUMBING:    { label: 'Plumbing',   icon: Droplets,   emoji: '🔧' },
  ELECTRICAL:  { label: 'Electrical', icon: Zap,        emoji: '⚡' },
  FURNITURE:   { label: 'Furniture',  icon: Sofa,       emoji: '🪑' },
  DOOR:        { label: 'Door/Lock',  icon: DoorOpen,   emoji: '🚪' },
  WIFI:        { label: 'Wi-Fi',      icon: Wifi,       emoji: '📶' },
  TV:          { label: 'TV/AV',      icon: Tv,         emoji: '📺' },
  OTHER:       { label: 'Other',      icon: HelpCircle, emoji: '🔩' },
};

const PRIORITY_ORDER: Priority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

// ── Create Ticket Modal ───────────────────────────────────────────────────────
function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    roomId: '',
    issueType: '' as IssueType | '',
    description: '',
    priority: 'NORMAL' as Priority,
    assignedTo: '',
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const { data: roomsRes } = useQuery({
    queryKey: ['rooms-all'],
    queryFn: () => roomsApi.list({ limit: 200, isActive: true }),
    select: r => (r.data.data?.data ?? []) as { id: string; name: string; number: string }[],
  });

  const { data: staffRes } = useQuery({
    queryKey: ['staff-all'],
    queryFn: () => staffApi.list({ limit: 200 }),
    select: r => (r.data.data?.data ?? []) as { id: string; userId: string; user?: { firstName: string; lastName: string } }[],
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => maintenanceApi.create({
      roomId: form.roomId,
      issueType: form.issueType,
      description: form.description,
      priority: form.priority,
      assignedTo: form.assignedTo || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['maintenance-summary'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: '🔧 Maintenance ticket created', description: 'Room marked as under maintenance' });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' }),
  });

  const rooms = roomsRes ?? [];
  const staff = staffRes ?? [];
  const isValid = form.roomId && form.issueType && form.description.trim();

  const selectCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] focus:outline-none focus:ring-1 focus:ring-resort-600/20';
  const labelCls  = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="New Maintenance Ticket"
      maxWidth="520px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={isPending}
            className="flex-1 rounded-[9px] border py-[9px] text-[13px] font-medium text-[#6b8880] transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)' }}>
            Cancel
          </button>
          <button disabled={!isValid || isPending} onClick={() => mutate()}
            className="flex-1 flex items-center justify-center gap-2 rounded-[9px] py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--rp-btn-accent)' }}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            Create Ticket
          </button>
        </div>
      }
    >
      <div className="space-y-5">
          <div>
            <label className={labelCls}>Room *</label>
            <select className={selectCls} value={form.roomId} onChange={e => set('roomId', e.target.value)}>
              <option value="">Select room…</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (#{r.number})</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Issue Type *</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(ISSUE_META) as [IssueType, typeof ISSUE_META[IssueType]][]).map(([type, meta]) => (
                <button key={type} type="button" onClick={() => set('issueType', type)}
                  className="flex flex-col items-center gap-1.5 rounded-[10px] border-2 py-3 px-2 text-[11px] font-semibold transition-all"
                  style={form.issueType === type
                    ? { borderColor: '#23766a', background: 'var(--rp-teal-bg)', color: '#23766a' }
                    : { borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
                  <span className="text-xl">{meta.emoji}</span>
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Description *</label>
            <textarea rows={3} placeholder="Describe the issue in detail…"
              className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20 resize-none"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Priority</label>
            <div className="flex gap-2">
              {PRIORITY_ORDER.map(p => (
                <button key={p} type="button" onClick={() => set('priority', p)}
                  className="flex-1 rounded-[8px] border-2 py-[7px] text-[11.5px] font-semibold transition-all"
                  style={form.priority === p
                    ? { borderColor: PRIORITY_META[p].text, background: PRIORITY_META[p].bg, color: PRIORITY_META[p].text }
                    : { borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Assign To (optional)</label>
            <select className={selectCls} value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}>
              <option value="">Unassigned</option>
              {staff.map(s => (
                <option key={s.userId} value={s.userId}>
                  {s.user ? `${s.user.firstName} ${s.user.lastName}` : s.userId}
                </option>
              ))}
            </select>
          </div>
        </div>
    </ModalShell>
  );
}

// ── Resolve Modal ─────────────────────────────────────────────────────────────
function ResolveModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState(ticket.notes ?? '');

  const { mutate, isPending } = useMutation({
    mutationFn: () => maintenanceApi.resolve(ticket.id, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['maintenance-summary'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: '✅ Ticket resolved', description: `Room ${ticket.room.number} restored to Available` });
      onClose();
    },
    onError: () => toast({ title: 'Failed to resolve', variant: 'destructive' }),
  });

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Resolve Ticket"
      description={`Room ${ticket.room.name} #${ticket.room.number} · ${ISSUE_META[ticket.issueType].emoji} ${ISSUE_META[ticket.issueType].label}`}
      maxWidth="440px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={isPending}
            className="flex-1 rounded-[9px] border py-[9px] text-[13px] font-medium text-[#6b8880] transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)' }}>
            Cancel
          </button>
          <button onClick={() => mutate()} disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-[9px] py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--rp-btn-accent)' }}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Mark Resolved
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-[11.5px] font-medium text-[#6b8880] mb-1.5">Resolution Notes (optional)</label>
          <textarea rows={3} placeholder="What was done to fix the issue?"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20 resize-none"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
    </ModalShell>
  );
}

// ── Ticket Card ───────────────────────────────────────────────────────────────
function TicketCard({ ticket }: { ticket: Ticket }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [resolveOpen, setResolveOpen] = useState(false);

  const issueMeta = ISSUE_META[ticket.issueType];
  const priorityMeta = PRIORITY_META[ticket.priority];
  const statusMeta = STATUS_META[ticket.status];
  const StatusIcon = statusMeta.icon;

  const { mutate: changeStatus, isPending: changingStatus } = useMutation({
    mutationFn: (status: Status) => maintenanceApi.update(ticket.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['maintenance-summary'] });
    },
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const { mutate: deleteTicket } = useMutation({
    mutationFn: () => maintenanceApi.delete(ticket.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['maintenance-summary'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: 'Ticket deleted' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  return (
    <>
      <div className="rounded-[14px] border bg-white dark:bg-white/5 p-5 transition-shadow hover:shadow-sm"
        style={{
          borderColor: ticket.priority === 'URGENT' && ticket.status !== 'RESOLVED'
            ? 'rgba(200,60,60,0.25)' : 'var(--rp-border)',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        }}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-[38px] w-[38px] rounded-[10px] flex items-center justify-center text-[18px] shrink-0"
              style={{ background: 'var(--rp-surface-3)' }}>
              {issueMeta.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13.5px] font-semibold text-[#18231f]">{issueMeta.label}</p>
                <span className="inline-flex items-center rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold"
                  style={{ background: priorityMeta.bg, borderColor: priorityMeta.border, color: priorityMeta.text }}>
                  {priorityMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-[3px]">
                <BedDouble className="h-[11px] w-[11px] text-[#8aa29a] shrink-0" />
                <p className="text-[11.5px] text-[#8aa29a] truncate">
                  {ticket.room.name} #{ticket.room.number}
                  {ticket.room.floor ? ` · Floor ${ticket.room.floor}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold"
              style={{ background: statusMeta.bg, borderColor: statusMeta.border, color: statusMeta.text }}>
              <StatusIcon className="h-[10px] w-[10px]" />
              {statusMeta.label}
            </span>
            {ticket.status !== 'RESOLVED' && (
              <button
                onClick={() => { if (confirm('Delete this ticket?')) deleteTicket(); }}
                className="rounded-[7px] p-1.5 transition-colors hover:bg-[#fef2f2] text-[#c5bdb4] hover:text-[#c43c3c]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-[13px] text-[#6b8880] mb-3 line-clamp-2">{ticket.description}</p>

        {/* Resolution notes */}
        {ticket.notes && ticket.status === 'RESOLVED' && (
          <div className="mb-3 rounded-[8px] px-3 py-2" style={{ background: 'var(--rp-teal-bg)' }}>
            <p className="text-[12px] text-[#23766a]"><strong>Resolution:</strong> {ticket.notes}</p>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          {ticket.assignedTo && (
            <span className="flex items-center gap-1 text-[11.5px] text-[#8aa29a]">
              <User className="h-[11px] w-[11px]" /> Assigned
            </span>
          )}
          <span className="flex items-center gap-1 text-[11.5px] text-[#8aa29a]">
            <Clock className="h-[11px] w-[11px]" />
            {formatDate(ticket.createdAt)}
          </span>
          {ticket.resolvedAt && (
            <span className="flex items-center gap-1 text-[11.5px] text-[#23766a]">
              <CheckCircle2 className="h-[11px] w-[11px]" />
              Resolved {formatDate(ticket.resolvedAt)}
            </span>
          )}
        </div>

        {/* Actions */}
        {ticket.status !== 'RESOLVED' && (
          <div className="flex gap-2">
            {ticket.status === 'OPEN' && (
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] border py-[7px] text-[12px] font-medium transition-colors"
                style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)', color: '#b89040' }}
                onClick={() => changeStatus('IN_PROGRESS')}
                disabled={changingStatus}>
                {changingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                Start Work
              </button>
            )}
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-[7px] text-[12px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80"
              style={{ background: 'var(--rp-btn-accent)' }}
              onClick={() => setResolveOpen(true)}>
              <CheckCircle2 className="h-3 w-3" /> Resolve
            </button>
          </div>
        )}
      </div>

      {resolveOpen && (
        <ResolveModal ticket={ticket} onClose={() => setResolveOpen(false)} />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');

  const { data: summaryRes } = useQuery({
    queryKey: ['maintenance-summary'],
    queryFn: () => maintenanceApi.summary(),
    refetchInterval: 60000,
    select: r => r.data.data as { open: number; inProgress: number; resolvedToday: number; urgent: number },
  });

  const { data: ticketsRes, isLoading } = useQuery({
    queryKey: ['maintenance', statusFilter, priorityFilter],
    queryFn: () => maintenanceApi.list({
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
    }),
    select: r => r.data.data as Ticket[],
  });

  const summary = summaryRes ?? { open: 0, inProgress: 0, resolvedToday: 0, urgent: 0 };
  const tickets = ticketsRes ?? [];

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Maintenance</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Track and resolve room technical issues</p>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80"
          style={{ background: 'var(--rp-btn-accent)' }}
          onClick={() => setShowCreate(true)}>
          <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} /> New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Open',           value: summary.open,          icon: AlertTriangle, bg: 'var(--rp-red-bg)', color: '#c43c3c' },
          { label: 'In Progress',    value: summary.inProgress,    icon: Clock,         bg: 'var(--rp-amber-bg)', color: '#b89040' },
          { label: 'Resolved Today', value: summary.resolvedToday, icon: CheckCircle2,  bg: 'var(--rp-teal-bg)', color: '#23766a' },
          { label: 'Urgent Open',    value: summary.urgent,        icon: Zap,           bg: 'var(--rp-coral-bg)', color: '#b8724a' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px] bg-white dark:bg-white/5"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
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
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 rounded-[10px] p-1" style={{ background: 'var(--rp-surface-3)' }}>
          {(['', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="rounded-[8px] px-3 py-[6px] text-[12px] font-semibold transition-all"
              style={statusFilter === s
                ? { color: 'var(--rp-text)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: 'var(--rp-text-muted)' }}>
              {s === '' ? 'All Status' : STATUS_META[s].label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-[10px] p-1" style={{ background: 'var(--rp-surface-3)' }}>
          {(['', ...PRIORITY_ORDER] as const).map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className="rounded-[8px] px-3 py-[6px] text-[12px] font-semibold transition-all"
              style={priorityFilter === p
                ? { color: 'var(--rp-text)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: 'var(--rp-text-muted)' }}>
              {p === '' ? 'All Priority' : PRIORITY_META[p].label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-[14px]" style={{ background: 'var(--rp-surface-3)' }} />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f4f1]">
            <Wrench className="h-7 w-7 text-[#c5bdb4]" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#18231f]">No maintenance tickets</p>
            <p className="mt-1 text-[12.5px] text-[#8aa29a]">
              {statusFilter || priorityFilter ? 'Try adjusting your filters' : 'All rooms are in good shape!'}
            </p>
          </div>
          {!statusFilter && !priorityFilter && (
            <button
              className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0]"
              style={{ background: 'var(--rp-btn-accent)' }}
              onClick={() => setShowCreate(true)}>
              <Plus className="h-[13px] w-[13px]" /> New Ticket
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
