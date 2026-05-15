'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceApi, roomsApi, staffApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import {
  Wrench, Plus, X, Loader2, CheckCircle2, AlertTriangle,
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
const PRIORITY_META: Record<Priority, { label: string; color: string; dot: string }> = {
  URGENT: { label: 'Urgent',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',      dot: 'bg-red-500' },
  HIGH:   { label: 'High',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', dot: 'bg-orange-500' },
  NORMAL: { label: 'Normal',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',  dot: 'bg-blue-500' },
  LOW:    { label: 'Low',     color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',      dot: 'bg-gray-400' },
};

const STATUS_META: Record<Status, { label: string; color: string; icon: React.ElementType }> = {
  OPEN:        { label: 'Open',        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       icon: AlertTriangle },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  RESOLVED:    { label: 'Resolved',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
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
    queryFn: () => roomsApi.list(),
    select: r => (r.data.data?.rooms ?? r.data.data ?? []) as { id: string; name: string; number: string }[],
  });

  const { data: staffRes } = useQuery({
    queryKey: ['staff-all'],
    queryFn: () => staffApi.list(),
    select: r => (r.data.data?.staff ?? r.data.data ?? []) as { id: string; userId: string; user?: { firstName: string; lastName: string } }[],
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold">New Maintenance Ticket</h2>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Room */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Room *</label>
            <select
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-resort-500"
              value={form.roomId}
              onChange={e => set('roomId', e.target.value)}
            >
              <option value="">Select room...</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name} (#{r.number})</option>
              ))}
            </select>
          </div>

          {/* Issue type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Issue Type *</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(ISSUE_META) as [IssueType, typeof ISSUE_META[IssueType]][]).map(([type, meta]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set('issueType', type)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 text-xs font-semibold transition-all ${
                    form.issueType === type
                      ? 'border-resort-500 bg-resort-50 dark:bg-resort-900/20 text-resort-700'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{meta.emoji}</span>
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Description *</label>
            <textarea
              rows={3}
              placeholder="Describe the issue in detail..."
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-resort-500 resize-none"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Priority</label>
            <div className="flex gap-2">
              {PRIORITY_ORDER.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('priority', p)}
                  className={`flex-1 rounded-xl border-2 py-2 text-xs font-semibold transition-all ${
                    form.priority === p
                      ? `border-current ${PRIORITY_META[p].color}`
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign to */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Assign To (optional)</label>
            <select
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-resort-500"
              value={form.assignedTo}
              onChange={e => set('assignedTo', e.target.value)}
            >
              <option value="">Unassigned</option>
              {staff.map(s => (
                <option key={s.userId} value={s.userId}>
                  {s.user ? `${s.user.firstName} ${s.user.lastName}` : s.userId}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            className="flex-1 bg-resort-600 hover:bg-resort-700 text-white gap-2"
            disabled={!isValid || isPending}
            onClick={() => mutate()}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            Create Ticket
          </Button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-1">Resolve Ticket</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Room <strong>{ticket.room.name} #{ticket.room.number}</strong> · {ISSUE_META[ticket.issueType].emoji} {ISSUE_META[ticket.issueType].label}
        </p>
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Resolution Notes (optional)</label>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            placeholder="What was done to fix the issue?"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            onClick={() => mutate()}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Mark Resolved
          </Button>
        </div>
      </div>
    </div>
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
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
      <div className={`rounded-2xl border bg-white dark:bg-gray-900 p-5 transition-shadow hover:shadow-md ${
        ticket.priority === 'URGENT' && ticket.status !== 'RESOLVED'
          ? 'border-red-200 dark:border-red-900/40'
          : 'border-gray-100 dark:border-gray-800'
      }`}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Issue icon */}
            <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg shrink-0">
              {issueMeta.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{issueMeta.label}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityMeta.color}`}>
                  {priorityMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <BedDouble className="h-3 w-3 text-gray-400 shrink-0" />
                <p className="text-xs text-gray-500 truncate">
                  {ticket.room.name} #{ticket.room.number}
                  {ticket.room.floor ? ` · Floor ${ticket.room.floor}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Status badge + actions */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${statusMeta.color}`}>
              <StatusIcon className="h-3 w-3" />
              {statusMeta.label}
            </span>
            {ticket.status !== 'RESOLVED' && (
              <button
                onClick={() => {
                  if (confirm('Delete this ticket?')) deleteTicket();
                }}
                className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{ticket.description}</p>

        {/* Resolution notes */}
        {ticket.notes && ticket.status === 'RESOLVED' && (
          <div className="mb-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
            <p className="text-xs text-emerald-700 dark:text-emerald-400"><strong>Resolution:</strong> {ticket.notes}</p>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3 flex-wrap">
          {ticket.assignedTo && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              Assigned
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(ticket.createdAt)}
          </span>
          {ticket.resolvedAt && (
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="h-3 w-3" />
              Resolved {formatDate(ticket.resolvedAt)}
            </span>
          )}
        </div>

        {/* Actions */}
        {ticket.status !== 'RESOLVED' && (
          <div className="flex gap-2">
            {ticket.status === 'OPEN' && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/20 text-xs"
                onClick={() => changeStatus('IN_PROGRESS')}
                disabled={changingStatus}
              >
                {changingStatus ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                Start Work
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
              onClick={() => setResolveOpen(true)}
            >
              <CheckCircle2 className="h-3 w-3" /> Resolve
            </Button>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Maintenance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track and resolve room technical issues</p>
        </div>
        <Button
          className="bg-resort-600 hover:bg-resort-700 text-white gap-2"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open',          value: summary.open,          color: 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/40',       text: 'text-red-700 dark:text-red-400',       icon: AlertTriangle },
          { label: 'In Progress',   value: summary.inProgress,    color: 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/40', text: 'text-amber-700 dark:text-amber-400',   icon: Clock },
          { label: 'Resolved Today',value: summary.resolvedToday, color: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
          { label: 'Urgent Open',   value: summary.urgent,        color: 'border-rose-200 bg-rose-50 dark:bg-rose-900/10 dark:border-rose-900/40',    text: 'text-rose-700 dark:text-rose-400',     icon: Zap },
        ].map(({ label, value, color, text, icon: Icon }) => (
          <div key={label} className={`rounded-2xl border p-5 ${color}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${text}`} />
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
            </div>
            <p className={`text-3xl font-bold ${text}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {(['', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {s === '' ? 'All Status' : STATUS_META[s].label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {(['', ...PRIORITY_ORDER] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                priorityFilter === p
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {p === '' ? 'All Priority' : PRIORITY_META[p].label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Wrench className="h-8 w-8 text-gray-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">No maintenance tickets</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {statusFilter || priorityFilter ? 'Try adjusting your filters' : 'All rooms are in good shape!'}
            </p>
          </div>
          {!statusFilter && !priorityFilter && (
            <Button className="mt-2 bg-resort-600 hover:bg-resort-700 text-white gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New Ticket
            </Button>
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
