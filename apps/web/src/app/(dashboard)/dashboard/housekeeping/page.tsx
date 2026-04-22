'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { housekeepingApi, roomsApi, staffApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
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
const TYPE_COLORS: Record<string, string> = {
  DAILY: 'bg-blue-100 text-blue-700',
  DEEP_CLEAN: 'bg-purple-100 text-purple-700',
  TURNDOWN: 'bg-amber-100 text-amber-700',
  CHECKOUT: 'bg-red-100 text-red-700',
  CHECKIN: 'bg-green-100 text-green-700',
};

function NewTaskModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, string>) => void;
}) {
  const { data: roomsData } = useQuery({ queryKey: ['rooms-list'], queryFn: () => roomsApi.list({ limit: 100 }) });
  const { data: staffData } = useQuery({ queryKey: ['staff-list'], queryFn: () => staffApi.list({ limit: 100, department: 'HOUSEKEEPING' }) });
  const rooms = roomsData?.data?.data ?? [];
  const staffList = staffData?.data?.data ?? [];

  const [form, setForm] = useState({ roomId: '', assignedToId: '', type: '', scheduledDate: new Date().toISOString().split('T')[0], notes: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roomId || !form.type || !form.scheduledDate) {
      toast({ title: 'Missing fields', description: 'Room, type and date are required', variant: 'destructive' }); return;
    }
    onSubmit({ ...form, ...(form.assignedToId ? {} : { assignedToId: undefined as unknown as string }) });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Housekeeping Task" description="Schedule a cleaning or maintenance task" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Room *</label>
          <select value={form.roomId} onChange={e => set('roomId', e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Select room</option>
            {rooms.map((r: { id: string; number: string; name: string }) => (
              <option key={r.id} value={r.id}>#{r.number} — {r.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Task Type *</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Select type</option>
              {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Scheduled Date *</label>
            <Input type="date" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Assign To (Housekeeping Staff)</label>
          <select value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Unassigned</option>
            {staffList.map((s: { id: string; user: { firstName: string; lastName: string } }) => (
              <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            placeholder="Any special instructions..."
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Task</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function HousekeepingPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['housekeeping', statusFilter, dateFilter, page],
    queryFn: () => housekeepingApi.list({ status: statusFilter || undefined, date: dateFilter || undefined, page, limit: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => housekeepingApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['housekeeping'] }); toast({ title: 'Task created' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to create task', variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => housekeepingApi.updateStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['housekeeping'] }); toast({ title: 'Task updated' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' }),
  });

  const allTasks: HKTask[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const total = pagination?.total ?? 0;

  const tasks = allTasks.filter(t =>
    search === '' ||
    t.room.name.toLowerCase().includes(search.toLowerCase()) ||
    t.room.number.includes(search) ||
    (t.assignedTo && `${t.assignedTo.user.firstName} ${t.assignedTo.user.lastName}`.toLowerCase().includes(search.toLowerCase()))
  );

  const pendingCount = allTasks.filter(t => t.status === 'PENDING').length;
  const inProgressCount = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const completedCount = allTasks.filter(t => t.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Housekeeping</h1>
          <p className="mt-1 text-sm text-muted-foreground">Schedule and track room cleaning tasks</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: total || 0, icon: CheckSquare, color: 'bg-resort-50 border-resort-200 text-resort-700' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'In Progress', value: inProgressCount, icon: AlertCircle, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'bg-green-50 border-green-200 text-green-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 opacity-70" /><p className="text-xs font-medium opacity-70">{label}</p></div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search room or staff..." className="pl-9" />
        </div>
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="max-w-[160px]" />
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-resort-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s ? s.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px">{[...Array(6)].map((_, i) => <div key={i} className="h-[72px] bg-gray-50 animate-pulse border-b" />)}</div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <CheckSquare className="h-14 w-14 text-gray-200 mb-4" />
              <p className="font-medium text-gray-500">{search || statusFilter ? 'No tasks found' : 'No tasks scheduled'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{search || statusFilter ? 'Try adjusting filters' : 'Create your first housekeeping task'}</p>
              {!search && !statusFilter && <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> New Task</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Room</th>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Assigned To</th>
                    <th className="px-5 py-3 text-left">Scheduled</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Bed className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{task.room.name}</p>
                            <p className="text-xs text-muted-foreground">#{task.room.number} · Floor {task.room.floor}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[task.type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {task.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {task.assignedTo ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {task.assignedTo.user.firstName} {task.assignedTo.user.lastName}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(task.scheduledDate)}
                        </div>
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={task.status} /></td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {task.status === 'PENDING' && (
                            <Button size="sm" variant="outline" className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                              onClick={() => statusMutation.mutate({ id: task.id, status: 'IN_PROGRESS' })}>
                              Start
                            </Button>
                          )}
                          {task.status === 'IN_PROGRESS' && (
                            <Button size="sm" variant="outline" className="text-xs text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => statusMutation.mutate({ id: task.id, status: 'COMPLETED' })}>
                              Complete
                            </Button>
                          )}
                          {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                            <Button size="sm" variant="outline" className="text-xs text-gray-500 hover:bg-gray-50"
                              onClick={() => statusMutation.mutate({ id: task.id, status: 'SKIPPED' })}>
                              Skip
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <NewTaskModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
    </div>
  );
}
