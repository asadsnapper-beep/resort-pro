'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi, attendanceApi, salaryApi, trainingApi } from '@/lib/api';
import { ConfirmModal } from '@/components/ui/modal';
import { ModalShell } from '@/components/ui/modal-shell';
import { StaffModal } from '@/components/staff/StaffModal';
import { StaffDetailSheet } from '@/components/staff/StaffDetailSheet';
import { formatDate, formatCurrency, getInitials } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import {
  Plus, Search, Users, Building2, ChevronLeft, ChevronRight,
  X, Clock, Monitor, ShieldOff, Fingerprint, Upload, Key, DollarSign,
  GraduationCap, Loader2, Check, Pencil,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

interface Staff {
  id: string;
  department: string;
  position: string;
  phone?: string;
  hireDate: string;
  isActive: boolean;
  shiftStartTime?: string;
  baseSalary?: number;
  deviceUserId?: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    isActive: boolean;
    lastLoginAt?: string;
  };
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: string;
  hoursWorked?: number;
  source: string;
  staff: { id: string; user: { firstName: string; lastName: string } };
}

interface SalaryAdjustment {
  id: string;
  type: 'RAISE' | 'BONUS' | 'DEDUCTION';
  amount: number;
  reason?: string;
  effectiveDate: string;
}

interface TrainingSession {
  id: string;
  title: string;
  description?: string;
  scheduledDate: string;
  location?: string;
  trainer?: string;
  department?: string;
  attendeeCount: number;
  attendedCount: number;
}

const DEPARTMENTS = ['', 'FRONT_DESK', 'HOUSEKEEPING', 'RESTAURANT', 'MAINTENANCE', 'SECURITY', 'MANAGEMENT'] as const;

const DEPT_META: Record<string, { bg: string; border: string; text: string }> = {
  FRONT_DESK:   { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153' },
  HOUSEKEEPING: { bg: 'var(--rp-teal-soft)', border: 'rgba(24,49,83,0.15)', text: 'var(--rp-text-accent)' },
  RESTAURANT:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  MAINTENANCE:  { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  SECURITY:     { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  MANAGEMENT:   { bg: '#183153', border: 'rgba(24,49,83,0.4)',    text: '#f8fafc' },
};

const ROLE_META: Record<string, { bg: string; border: string; text: string }> = {
  OWNER:        { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  MANAGER:      { bg: '#183153', border: 'rgba(24,49,83,0.4)',    text: '#f8fafc' },
  RECEPTIONIST: { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)', text: '#183153' },
  CHEF:         { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  MARKETER:     { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.15)', text: '#b8724a' },
  DEVELOPER:    { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-subtle)' },
  SHAREHOLDER:  { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  STAFF:        { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner', MANAGER: 'Manager', RECEPTIONIST: 'Receptionist',
  CHEF: 'Chef', MARKETER: 'Marketer', DEVELOPER: 'Developer',
  SHAREHOLDER: 'Shareholder', STAFF: 'Staff',
};

const ATTENDANCE_STATUS_META: Record<string, { bg: string; text: string }> = {
  PRESENT:  { bg: 'var(--rp-teal-bg)', text: '#183153' },
  LATE:     { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  ABSENT:   { bg: 'var(--rp-red-bg)', text: '#c43c3c' },
  ON_LEAVE: { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)' },
};

const ADJ_META: Record<string, { bg: string; text: string }> = {
  RAISE:      { bg: 'var(--rp-teal-bg)', text: '#183153' },
  BONUS:      { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  DEDUCTION:  { bg: 'var(--rp-red-bg)', text: '#c43c3c' },
};

function formatDept(d: string) { return d.replace(/_/g, ' '); }

const selectCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[8px] text-[13px] text-[#183153] focus:outline-none focus:ring-1 focus:ring-resort-600/20';
const labelCls  = 'block text-[11.5px] font-medium text-[#64748b] mb-1.5';

// ── Directory Tab (existing feature, unchanged) ──────────────────────────────
function DirectoryTab() {
  const queryClient = useQueryClient();

  const [deptFilter, setDeptFilter]        = useState('');
  const [searchInput, setSearchInput]      = useState('');
  const search = useDebounce(searchInput, 350);
  const [page, setPage]                    = useState(1);

  const [addOpen,         setAddOpen]        = useState(false);
  const [editStaff,       setEditStaff]       = useState<Staff | null>(null);
  const [selectedStaff,   setSelectedStaff]   = useState<Staff | null>(null);
  const [deactivateStaff, setDeactivateStaff] = useState<Staff | null>(null);
  const [reactivateStaff, setReactivateStaff] = useState<Staff | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staff', deptFilter, search, page],
    queryFn:  () => staffApi.list({ department: deptFilter || undefined, search: search || undefined, page, limit: 20 }),
  });

  const { data: inviteData } = useQuery({
    queryKey: ['staff-invites'],
    queryFn:  () => staffApi.listInvites(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['staff-invites'] });
  };

  const createMutation = useMutation({
    mutationFn: (d: unknown) => staffApi.create(d),
    onSuccess: () => { invalidate(); toast({ title: 'Staff member added' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to add staff', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => staffApi.update(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Staff updated' }); setEditStaff(null); setSelectedStaff(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => staffApi.delete(id),
    onSuccess: () => { invalidate(); toast({ title: 'Staff member deactivated' }); setDeactivateStaff(null); setSelectedStaff(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to deactivate', variant: 'destructive' }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => staffApi.reactivate(id),
    onSuccess: () => { invalidate(); toast({ title: 'Staff member reactivated' }); setReactivateStaff(null); setSelectedStaff(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to reactivate', variant: 'destructive' }),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (id: string) => staffApi.cancelInvite(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff-invites'] }); toast({ title: 'Invite cancelled' }); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to cancel invite', variant: 'destructive' }),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => staffApi.invite(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff-invites'] }); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Invite failed', description: err?.response?.data?.error ?? 'Failed to send invite', variant: 'destructive' }),
  });

  const handleAddStaff = async (data: Record<string, unknown>, giveAccess: boolean) => {
    const { email, role, ...staffData } = data;
    await createMutation.mutateAsync(giveAccess
      ? { ...staffData, email, password: Math.random().toString(36).slice(2) + 'Aa1!', role }
      : staffData
    );
    if (giveAccess && email && role) {
      await inviteMutation.mutateAsync({ email: email as string, role: role as string });
      toast({ title: 'Staff added & invite sent!', description: `Invite email sent to ${email}` });
    }
  };

  const staff: Staff[]                  = data?.data?.data ?? [];
  const pagination                       = data?.data?.pagination;
  const total                            = pagination?.total ?? 0;
  const pendingInvites: PendingInvite[]  = inviteData?.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Staff',     value: total || 0,                        Icon: Users,     iconBg: 'var(--rp-teal-bg)', iconColor: '#183153' },
          { label: 'Pending Invites', value: pendingInvites.length,             Icon: Clock,     iconBg: 'var(--rp-amber-bg)', iconColor: '#b89040' },
          { label: 'Departments',     value: DEPARTMENTS.filter(Boolean).length, Icon: Building2, iconBg: 'var(--rp-surface-3)', iconColor: 'var(--rp-text-subtle)' },
        ].map(({ label, value, Icon, iconBg, iconColor }) => (
          <div key={label} className="rounded-[14px] border bg-white p-4"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[9px]"
                style={{ background: iconBg }}>
                <Icon className="h-[16px] w-[16px]" style={{ color: iconColor }} />
              </div>
              <p className="text-[12.5px] font-medium text-[#64748b] dark:text-[#a9c1d0]">{label}</p>
            </div>
            <p className="text-[26px] font-semibold leading-none text-[#183153] dark:text-[#f8fafc]">{value}</p>
          </div>
        ))}
      </div>

      {pendingInvites.length > 0 && (
        <div className="rounded-[14px] border p-4"
          style={{ background: '#fdf8ed', borderColor: 'rgba(184,144,64,0.25)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px]"
              style={{ background: 'var(--rp-amber-bg)' }}>
              <Clock className="h-3.5 w-3.5" style={{ color: '#b89040' }} />
            </div>
            <h3 className="text-[13px] font-semibold" style={{ color: '#7a5c2a' }}>
              Pending Invites ({pendingInvites.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pendingInvites.map(inv => {
              const rm = ROLE_META[inv.role] ?? ROLE_META.STAFF;
              return (
                <div key={inv.id} className="flex items-center justify-between rounded-[10px] border bg-white px-4 py-2.5"
                  style={{ borderColor: 'rgba(184,144,64,0.15)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ background: 'var(--rp-amber-bg)' }}>
                      <Clock className="h-3.5 w-3.5" style={{ color: '#b89040' }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{inv.email}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="rounded-[6px] border px-[7px] py-[2px] text-[10.5px] font-semibold"
                          style={{ background: rm.bg, borderColor: rm.border, color: rm.text }}>
                          {ROLE_LABELS[inv.role] ?? inv.role}
                        </span>
                        <span className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">
                          Sent {formatDate(inv.createdAt)} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => cancelInviteMutation.mutate(inv.id)}
                    disabled={cancelInviteMutation.isPending}
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:bg-[#fef2f2] disabled:opacity-50 text-[#94a3b8] dark:text-[#7f99ab]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#aac0d0' }} />
          <input
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search by name, email, or position…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[9px] pl-9 pr-3 text-[13px] text-[#183153] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#183153]/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {DEPARTMENTS.map(d => (
            <button key={d || 'all'}
              onClick={() => { setDeptFilter(d); setPage(1); }}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={deptFilter === d
                ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              {d ? formatDept(d) : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] border bg-white overflow-hidden"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="space-y-px">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse" style={{ background: i % 2 === 0 ? 'var(--rp-surface-2)' : 'var(--rp-surface)' }} />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
              <Users className="h-7 w-7" style={{ color: '#183153' }} />
            </div>
            <p className="text-[13.5px] font-medium text-[#183153] dark:text-[#f8fafc]">
              {searchInput || deptFilter ? 'No staff found' : 'No staff yet'}
            </p>
            <p className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">
              {searchInput || deptFilter ? 'Try adjusting your filters' : 'Add your first team member to get started'}
            </p>
            {!searchInput && !deptFilter && (
              <button onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 mt-1 rounded-[9px] px-4 py-2 text-[13px] font-medium"
                style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                <Plus className="h-4 w-4" /> Add Staff
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {['Staff Member', 'Department', 'Position', 'System Access', 'Hired', 'Status'].map((h, i) => (
                    <th key={h}
                      className={`px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em]${i === 3 ? ' hidden md:table-cell' : i >= 4 ? ' hidden lg:table-cell' : ''}`}
                      style={{ color: 'var(--rp-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map(s => {
                  const dm = DEPT_META[s.department] ?? { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)', text: 'var(--rp-text-muted)' };
                  const rm = ROLE_META[s.user.role ?? 'STAFF'] ?? ROLE_META.STAFF;
                  const hasAccess = !!s.user.role;
                  return (
                    <tr key={s.id}
                      className="cursor-pointer transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}
                      onClick={() => setSelectedStaff(s)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold"
                              style={{ background: 'var(--rp-teal-bg)', color: '#183153' }}>
                              {getInitials(s.user.firstName, s.user.lastName)}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                              style={{ background: s.isActive ? '#4ade80' : 'var(--rp-text-faint)' }} />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#183153] dark:text-[#f8fafc]">
                              {s.user.firstName} {s.user.lastName}
                            </p>
                            <p className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">{s.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
                          style={{ background: dm.bg, borderColor: dm.border, color: dm.text }}>
                          {formatDept(s.department)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[#475569] dark:text-[#9db4c4]">{s.position}</td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {hasAccess ? (
                          <div className="flex items-center gap-1.5">
                            <Monitor className="h-3.5 w-3.5" style={{ color: '#aac0d0' }} />
                            <span className="rounded-[6px] border px-[7px] py-[2px] text-[11px] font-semibold"
                              style={{ background: rm.bg, borderColor: rm.border, color: rm.text }}>
                              {ROLE_LABELS[s.user.role ?? ''] ?? s.user.role}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[#94a3b8] dark:text-[#7f99ab]">
                            <ShieldOff className="h-3.5 w-3.5" />
                            <span className="text-[12px]">No access</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[12.5px] hidden lg:table-cell text-[#64748b] dark:text-[#a9c1d0]">
                        {formatDate(s.hireDate)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
                          style={s.isActive
                            ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }
                            : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </span>
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
          <p className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-40"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-40"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <StaffModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        loading={createMutation.isPending || inviteMutation.isPending}
        onSubmit={(d, giveAccess) => handleAddStaff(d as Record<string, unknown>, giveAccess)}
      />
      <StaffModal
        open={!!editStaff}
        onClose={() => setEditStaff(null)}
        staff={editStaff}
        loading={updateMutation.isPending}
        onSubmit={(d) => editStaff && updateMutation.mutate({ id: editStaff.id, data: d })}
      />
      <StaffDetailSheet
        staff={selectedStaff}
        onClose={() => setSelectedStaff(null)}
        onEdit={s => { setEditStaff(s); setSelectedStaff(null); }}
        onDeactivate={s => setDeactivateStaff(s)}
        onReactivate={s => setReactivateStaff(s)}
      />
      <ConfirmModal
        open={!!deactivateStaff}
        onClose={() => setDeactivateStaff(null)}
        onConfirm={() => deactivateStaff && deactivateMutation.mutate(deactivateStaff.id)}
        loading={deactivateMutation.isPending}
        title="Deactivate Staff Member"
        description={`Remove ${deactivateStaff?.user.firstName} ${deactivateStaff?.user.lastName}? They will lose dashboard access.`}
        confirmLabel="Deactivate"
      />
      <ConfirmModal
        open={!!reactivateStaff}
        onClose={() => setReactivateStaff(null)}
        onConfirm={() => reactivateStaff && reactivateMutation.mutate(reactivateStaff.id)}
        loading={reactivateMutation.isPending}
        title="Reactivate Staff Member"
        description={`Reactivate ${reactivateStaff?.user.firstName} ${reactivateStaff?.user.lastName}?`}
        confirmLabel="Reactivate"
      />
    </div>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────────────────
function DesktopDeviceConfig({ deviceKey }: { deviceKey: string }) {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('4370');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    window.resortpro?.getAttendanceDeviceConfig().then(cfg => {
      if (cfg) { setIp(cfg.ip); setPort(String(cfg.port)); setLastSyncedAt(cfg.last_synced_at); }
    });
  }, []);

  const handleSave = async () => {
    if (!ip || !deviceKey) { toast({ title: 'Device IP is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await window.resortpro?.saveAttendanceDeviceConfig({
        ip, port: parseInt(port, 10) || 4370, deviceKey,
        apiBase: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      });
      toast({ title: 'Device connected — polling started' });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await window.resortpro?.pollAttendanceDeviceNow();
      if (res) toast({ title: `Synced ${res.pushed} punch${res.pushed === 1 ? '' : 'es'}` });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-[10px] border p-3 space-y-3" style={{ borderColor: 'rgba(24,49,83,0.2)', background: 'var(--rp-teal-soft)' }}>
      <p className="text-[12.5px] font-medium" style={{ color: 'var(--rp-text)' }}>Connect this PC directly to the device</p>
      <div className="grid grid-cols-2 gap-2">
        <input value={ip} onChange={e => setIp(e.target.value)} placeholder="Device IP e.g. 192.168.1.50" className={selectCls} />
        <input value={port} onChange={e => setPort(e.target.value)} placeholder="Port" className={selectCls} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save & Start Polling
        </button>
        <button onClick={handleSyncNow} disabled={syncing} className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-50" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
          {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Sync Now
        </button>
      </div>
      {lastSyncedAt && <p className="text-[11px]" style={{ color: 'var(--rp-text-faint)' }}>Last synced punch: {new Date(lastSyncedAt).toLocaleString()}</p>}
    </div>
  );
}

function DeviceKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['attendance-device-key'], queryFn: () => attendanceApi.getDeviceKey(), enabled: open });
  const rotateMutation = useMutation({
    mutationFn: () => attendanceApi.rotateDeviceKey(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance-device-key'] }); toast({ title: 'Device key rotated' }); },
  });
  const deviceKey = data?.data?.data?.deviceKey ?? '';
  const webhookUrl = typeof window !== 'undefined' ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/attendance/device-webhook` : '';
  const isDesktopApp = typeof window !== 'undefined' && !!window.resortpro?.isElectron;

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: 'Copied' }); };

  return (
    <ModalShell open={open} onClose={onClose} title="Fingerprint Device Setup" description="For a bridge script or the ResortPro Desktop app" maxWidth="560px"
      footer={<div className="flex justify-end"><button onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Close</button></div>}>
      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: '#aac0d0' }} /></div>
      ) : (
        <div className="space-y-4">
          {isDesktopApp && <DesktopDeviceConfig deviceKey={deviceKey} />}
          <div>
            <label className={labelCls}>Webhook URL <span style={{ color: 'var(--rp-text-faint)' }}>(for a bridge script instead)</span></label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-[8px] border px-3 py-2 text-[12px] break-all" style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>{webhookUrl}</code>
              <button onClick={() => copy(webhookUrl)} className="rounded-[7px] border px-2.5 py-2 text-[11.5px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)' }}>Copy</button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Device Key <span style={{ color: 'var(--rp-text-faint)' }}>(send as X-Attendance-Key header)</span></label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-[8px] border px-3 py-2 text-[12px] break-all" style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>{deviceKey}</code>
              <button onClick={() => copy(deviceKey)} className="rounded-[7px] border px-2.5 py-2 text-[11.5px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)' }}>Copy</button>
            </div>
          </div>
          <p className="text-[12px]" style={{ color: 'var(--rp-text-muted)' }}>
            {isDesktopApp
              ? 'Running in the ResortPro Desktop app — enter the device IP above and it connects directly, no bridge script needed.'
              : <>POST <code>{'{ deviceUserId, timestamp, type: "IN"|"OUT" }'}</code> to the URL above with this key in the <code>X-Attendance-Key</code> header, or open this page from the ResortPro Desktop app to connect directly.</>}
            {' '}Each staff member needs their &ldquo;Fingerprint Device ID&rdquo; set (edit them in the Directory tab) to match the ID configured on the machine.
          </p>
          <button onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isPending}
            className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ borderColor: 'rgba(200,60,60,0.25)', color: '#c43c3c' }}>
            {rotateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Rotate Key
          </button>
        </div>
      )}
    </ModalShell>
  );
}

function CorrectionModal({ open, onClose, record, loading, onSubmit }: {
  open: boolean; onClose: () => void; record: AttendanceRecord | null; loading: boolean;
  onSubmit: (data: { status?: string; clockIn?: string | null; clockOut?: string | null }) => void;
}) {
  const [status, setStatus] = useState('PRESENT');
  useEffect(() => { if (open && record) setStatus(record.status); }, [open, record]);

  return (
    <ModalShell open={open} onClose={onClose} title="Correct Attendance"
      description={record ? `${record.staff.user.firstName} ${record.staff.user.lastName} — ${formatDate(record.date)}` : ''} maxWidth="420px"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button onClick={() => onSubmit({ status })} disabled={loading}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      }>
      <div>
        <label className={labelCls}>Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
          {['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>
    </ModalShell>
  );
}

function AttendanceTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [deviceKeyOpen, setDeviceKeyOpen] = useState(false);
  const [correctRecord, setCorrectRecord] = useState<AttendanceRecord | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['attendance', date], queryFn: () => attendanceApi.list({ date, limit: 100 }) });
  const { data: staffData } = useQuery({ queryKey: ['staff-all'], queryFn: () => staffApi.list({ limit: 200 }) });

  const records: AttendanceRecord[] = data?.data?.data ?? [];
  const allStaff: Staff[] = staffData?.data?.data ?? [];
  const recordByStaff = new Map(records.map(r => [r.staff.id, r]));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['attendance'] });

  const markMutation = useMutation({
    mutationFn: (d: { staffId: string; status: string }) => attendanceApi.mark({ ...d, date }),
    onSuccess: () => { invalidate(); toast({ title: 'Marked' }); },
  });
  const correctMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => attendanceApi.correct(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Attendance corrected' }); setCorrectRecord(null); },
  });
  const importMutation = useMutation({
    mutationFn: (punches: unknown[]) => attendanceApi.import(punches),
    onSuccess: (res) => {
      invalidate();
      const { applied, unmatchedDeviceIds } = res.data.data;
      toast({ title: 'Import complete', description: `${applied} punches applied${unmatchedDeviceIds.length ? `, ${unmatchedDeviceIds.length} unmatched device IDs` : ''}` });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to import CSV', variant: 'destructive' }),
  });

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast({ title: 'CSV has no data rows', variant: 'destructive' }); return; }
      const parseCsvLine = (line: string) => line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) ?? [];
      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const idx = {
        deviceUserId: headers.findIndex(h => h.includes('device') || h.includes('userid') || h.includes('empcode')),
        timestamp: headers.findIndex(h => h.includes('date') || h.includes('time')),
        type: headers.findIndex(h => h.includes('type') || h.includes('in/out') || h.includes('status')),
      };
      if (idx.deviceUserId === -1 || idx.timestamp === -1) {
        toast({ title: 'CSV must have a device/user ID column and a date/time column', variant: 'destructive' }); return;
      }
      const punches = lines.slice(1).map(l => {
        const cols = parseCsvLine(l);
        const typeRaw = idx.type > -1 ? cols[idx.type]?.toUpperCase() : '';
        return {
          deviceUserId: cols[idx.deviceUserId],
          timestamp: cols[idx.timestamp],
          type: typeRaw?.includes('OUT') ? 'OUT' : 'IN',
        };
      }).filter(p => p.deviceUserId && p.timestamp);
      importMutation.mutate(punches);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[8px] text-[13px] text-[#183153]" />
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          <button onClick={() => setDeviceKeyOpen(true)} className="flex items-center gap-2 rounded-[9px] border px-3 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            <Key className="h-4 w-4" /> Device Setup
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import CSV
          </button>
        </div>
      </div>

      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="h-32 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
        ) : allStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Fingerprint className="h-10 w-10" style={{ color: '#94a3b8' }} />
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No staff yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--rp-surface-2)' }}>
                {['Staff', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Source', ''].map(h => <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {allStaff.map(s => {
                const r = recordByStaff.get(s.id);
                const sm = r ? ATTENDANCE_STATUS_META[r.status] : { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-faint)' };
                return (
                  <tr key={s.id} className="hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{s.user.firstName} {s.user.lastName}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{r?.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{r?.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">{r?.hoursWorked != null ? r.hoursWorked.toFixed(1) : '—'}</td>
                    <td className="px-5 py-3.5">
                      {r ? <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: sm.bg, color: sm.text }}>{r.status.replace('_', ' ')}</span> : <span className="text-[12px]" style={{ color: 'var(--rp-text-faint)' }}>No record</span>}
                    </td>
                    <td className="px-5 py-3.5 text-[11.5px]" style={{ color: 'var(--rp-text-faint)' }}>{r?.source ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        {r ? (
                          <button onClick={() => setCorrectRecord(r)} className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] hover:bg-[#e5f0f7]" style={{ color: '#aac0d0' }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <>
                            <button onClick={() => markMutation.mutate({ staffId: s.id, status: 'ABSENT' })} className="rounded-[7px] border px-2 py-1 text-[11px] font-medium hover:bg-[#faf0ee]" style={{ borderColor: 'rgba(200,60,60,0.2)', color: '#c43c3c' }}>Absent</button>
                            <button onClick={() => markMutation.mutate({ staffId: s.id, status: 'ON_LEAVE' })} className="rounded-[7px] border px-2 py-1 text-[11px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Leave</button>
                          </>
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

      <DeviceKeyModal open={deviceKeyOpen} onClose={() => setDeviceKeyOpen(false)} />
      <CorrectionModal open={!!correctRecord} onClose={() => setCorrectRecord(null)} record={correctRecord} loading={correctMutation.isPending}
        onSubmit={d => correctRecord && correctMutation.mutate({ id: correctRecord.id, data: d })} />
    </div>
  );
}

// ── Salary Tab ─────────────────────────────────────────────────────────────────
function AdjustmentModal({ open, onClose, staff, loading, onSubmit }: {
  open: boolean; onClose: () => void; staff: Staff | null; loading: boolean;
  onSubmit: (data: { type: string; amount: number; reason?: string; effectiveDate: string }) => void;
}) {
  const [type, setType] = useState<'RAISE' | 'BONUS' | 'DEDUCTION'>('RAISE');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  useEffect(() => { if (open) { setType('RAISE'); setAmount(''); setReason(''); setEffectiveDate(new Date().toISOString().split('T')[0]); } }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    onSubmit({ type, amount: amt, reason: reason || undefined, effectiveDate });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Record Salary Adjustment" description={staff ? `${staff.user.firstName} ${staff.user.lastName}` : ''} maxWidth="460px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button type="submit" form="adj-form" disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      }>
      <form id="adj-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['RAISE', 'BONUS', 'DEDUCTION'] as const).map(t => {
              const m = ADJ_META[t];
              return (
                <button key={t} type="button" onClick={() => setType(t)}
                  className="rounded-[10px] border-2 p-2.5 text-[11.5px] font-medium transition-all"
                  style={type === t ? { background: m.bg, borderColor: m.text, color: m.text } : { background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-muted)' }}>
                  {t}
                </button>
              );
            })}
          </div>
          {type === 'RAISE' && <p className="mt-1.5 text-[11px]" style={{ color: 'var(--rp-text-faint)' }}>Sets the new base salary (not added on top).</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#aac0d0' }}>৳</span>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.01" className={selectCls + ' pl-6'} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Effective Date</label>
            <input value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} type="date" className={selectCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Reason</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Annual review, performance bonus…" className={selectCls} />
        </div>
      </form>
    </ModalShell>
  );
}

function SalaryTab() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: staffData } = useQuery({ queryKey: ['staff-all'], queryFn: () => staffApi.list({ limit: 200 }) });
  const allStaff: Staff[] = staffData?.data?.data ?? [];
  const selected = allStaff.find(s => s.id === selectedId) ?? null;

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['salary-adjustments', selectedId],
    queryFn: () => salaryApi.adjustments(selectedId!),
    enabled: !!selectedId,
  });
  const adjustments: SalaryAdjustment[] = histData?.data?.data?.adjustments ?? [];

  const addMutation = useMutation({
    mutationFn: (d: unknown) => salaryApi.addAdjustment(selectedId!, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-adjustments', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['staff-all'] });
      toast({ title: 'Adjustment recorded' });
      setAdjustOpen(false);
    },
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-[14px] border bg-white overflow-hidden col-span-1" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div className="max-h-[560px] overflow-y-auto">
          {allStaff.map(s => (
            <button key={s.id} onClick={() => setSelectedId(s.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
              style={selectedId === s.id ? { background: 'var(--rp-teal-bg)' } : {}}
              onMouseEnter={e => { if (selectedId !== s.id) e.currentTarget.style.background = 'var(--rp-surface-2)'; }}
              onMouseLeave={e => { if (selectedId !== s.id) e.currentTarget.style.background = ''; }}>
              <div>
                <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{s.user.firstName} {s.user.lastName}</p>
                <p className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">{s.position}</p>
              </div>
              <span className="text-[12.5px] font-medium" style={{ color: '#183153' }}>{s.baseSalary != null ? formatCurrency(s.baseSalary) : '—'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-2 space-y-3">
        {!selected ? (
          <div className="flex h-64 items-center justify-center rounded-[14px] border" style={{ borderColor: 'var(--rp-border)' }}>
            <p className="text-[13px]" style={{ color: 'var(--rp-text-muted)' }}>Select a staff member to view salary history</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-[14px] border bg-white p-4" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div>
                <p className="text-[13px] font-semibold text-[#183153] dark:text-[#f8fafc]">{selected.user.firstName} {selected.user.lastName}</p>
                <p className="text-[20px] font-semibold" style={{ color: '#183153' }}>{selected.baseSalary != null ? formatCurrency(selected.baseSalary) : 'No base salary set'}</p>
              </div>
              <button onClick={() => setAdjustOpen(true)} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                <Plus className="h-4 w-4" /> Record Adjustment
              </button>
            </div>
            <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              {histLoading ? (
                <div className="h-24 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
              ) : adjustments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <DollarSign className="h-8 w-8" style={{ color: '#94a3b8' }} />
                  <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No adjustments recorded</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--rp-border)' }}>
                  {adjustments.map(a => {
                    const m = ADJ_META[a.type];
                    return (
                      <div key={a.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: m.bg, color: m.text }}>{a.type}</span>
                          <div>
                            <p className="text-[13px] text-[#183153] dark:text-[#f8fafc]">{a.reason || '—'}</p>
                            <p className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">{formatDate(a.effectiveDate)}</p>
                          </div>
                        </div>
                        <span className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{formatCurrency(a.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AdjustmentModal open={adjustOpen} onClose={() => setAdjustOpen(false)} staff={selected} loading={addMutation.isPending} onSubmit={d => addMutation.mutate(d)} />
    </div>
  );
}

// ── Training Tab ───────────────────────────────────────────────────────────────
function NewSessionModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ title: '', description: '', scheduledDate: '', location: '', trainer: '', department: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  useEffect(() => { if (open) setForm({ title: '', description: '', scheduledDate: '', location: '', trainer: '', department: '' }); }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.scheduledDate) { toast({ title: 'Title and date are required', variant: 'destructive' }); return; }
    onSubmit({ ...form, scheduledDate: new Date(form.scheduledDate).toISOString(), description: form.description || undefined, location: form.location || undefined, trainer: form.trainer || undefined, department: form.department || undefined });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="New Training Session" maxWidth="500px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button type="submit" form="ts-form" disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
          </button>
        </div>
      }>
      <form id="ts-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Fire Safety Training" className={selectCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Date *</label>
            <input value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} type="datetime-local" className={selectCls} />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} className={selectCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Trainer</label>
            <input value={form.trainer} onChange={e => set('trainer', e.target.value)} className={selectCls} />
          </div>
          <div>
            <label className={labelCls}>Target Department <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
            <select value={form.department} onChange={e => set('department', e.target.value)} className={selectCls}>
              <option value="">Any / mixed</option>
              {DEPARTMENTS.filter(Boolean).map(d => <option key={d} value={d}>{formatDept(d)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} className={selectCls} />
        </div>
      </form>
    </ModalShell>
  );
}

interface TrainingAttendeeDetail { id: string; staffId: string; status: string; staff: { user: { firstName: string; lastName: string } } }

function SessionDetailModal({ open, onClose, sessionId, allStaff }: {
  open: boolean; onClose: () => void; sessionId: string | null; allStaff: Staff[];
}) {
  const queryClient = useQueryClient();
  const [inviteDept, setInviteDept] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['training-session', sessionId], queryFn: () => trainingApi.get(sessionId!), enabled: open && !!sessionId });
  const session = data?.data?.data as (TrainingSession & { attendees: TrainingAttendeeDetail[] }) | undefined;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['training-session', sessionId] });
    queryClient.invalidateQueries({ queryKey: ['training'] });
  };
  const inviteMutation = useMutation({
    mutationFn: (d: { staffIds?: string[]; department?: string }) => trainingApi.invite(sessionId!, d),
    onSuccess: () => { invalidate(); toast({ title: 'Attendees invited' }); },
  });
  const markMutation = useMutation({
    mutationFn: ({ staffId, status }: { staffId: string; status: string }) => trainingApi.markAttendee(sessionId!, staffId, status),
    onSuccess: () => { invalidate(); },
  });

  const invitedIds = new Set(session?.attendees.map(a => a.staffId) ?? []);
  const availableStaff = allStaff.filter(s => !invitedIds.has(s.id));

  return (
    <ModalShell open={open} onClose={onClose} title={session?.title ?? 'Training Session'}
      description={session ? `${formatDate(session.scheduledDate)}${session.trainer ? ` — ${session.trainer}` : ''}` : ''} maxWidth="560px"
      footer={<div className="flex justify-end"><button onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Close</button></div>}>
      {isLoading || !session ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: '#aac0d0' }} /></div>
      ) : (
        <div className="space-y-4">
          {session.description && <p className="text-[12.5px]" style={{ color: 'var(--rp-text-muted)' }}>{session.description}</p>}

          <div className="flex items-center gap-2">
            <select value={inviteDept} onChange={e => setInviteDept(e.target.value)} className={selectCls}>
              <option value="">Select department to invite</option>
              {DEPARTMENTS.filter(Boolean).map(d => <option key={d} value={d}>{formatDept(d)}</option>)}
            </select>
            <button onClick={() => inviteDept && inviteMutation.mutate({ department: inviteDept })} disabled={!inviteDept || inviteMutation.isPending}
              className="shrink-0 rounded-[8px] px-3 py-2 text-[12.5px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              Invite Dept
            </button>
          </div>

          {availableStaff.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableStaff.map(s => (
                <button key={s.id} onClick={() => inviteMutation.mutate({ staffIds: [s.id] })}
                  className="rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e5f0f7]" style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                  + {s.user.firstName} {s.user.lastName}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            {session.attendees.length === 0 ? (
              <p className="text-[12.5px] text-center py-4" style={{ color: 'var(--rp-text-muted)' }}>No attendees invited yet</p>
            ) : session.attendees.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-[8px] border px-3 py-2" style={{ borderColor: 'var(--rp-border)' }}>
                <span className="text-[13px] text-[#183153] dark:text-[#f8fafc]">{a.staff.user.firstName} {a.staff.user.lastName}</span>
                <div className="flex items-center gap-1.5">
                  {a.status === 'INVITED' ? (
                    <>
                      <button onClick={() => markMutation.mutate({ staffId: a.staffId, status: 'ATTENDED' })} className="rounded-[6px] border px-2 py-1 text-[11px] font-medium hover:bg-[#e5f0f7]" style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>Attended</button>
                      <button onClick={() => markMutation.mutate({ staffId: a.staffId, status: 'MISSED' })} className="rounded-[6px] border px-2 py-1 text-[11px] font-medium hover:bg-[#faf0ee]" style={{ borderColor: 'rgba(200,60,60,0.2)', color: '#c43c3c' }}>Missed</button>
                    </>
                  ) : (
                    <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={a.status === 'ATTENDED' ? { background: 'var(--rp-teal-bg)', color: '#183153' } : { background: 'var(--rp-red-bg)', color: '#c43c3c' }}>{a.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function TrainingTab() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['training'], queryFn: () => trainingApi.list() });
  const { data: staffData } = useQuery({ queryKey: ['staff-all'], queryFn: () => staffApi.list({ limit: 200 }) });
  const sessions: TrainingSession[] = data?.data?.data ?? [];
  const allStaff: Staff[] = staffData?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: unknown) => trainingApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['training'] }); toast({ title: 'Session created' }); setAddOpen(false); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> New Session
        </button>
      </div>

      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="h-32 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <GraduationCap className="h-10 w-10" style={{ color: '#94a3b8' }} />
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No training sessions yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--rp-surface-2)' }}>
                {['Session', 'Date', 'Trainer', 'Department', 'Attendance', ''].map(h => <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  <td className="px-5 py-3.5">
                    <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{s.title}</p>
                    {s.location && <p className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">{s.location}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">{formatDate(s.scheduledDate)}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#475569] dark:text-[#9db4c4]">{s.trainer ?? '—'}</td>
                  <td className="px-5 py-3.5 text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">{s.department ? formatDept(s.department) : 'Any'}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">
                    <div className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" style={{ color: '#183153' }} /> {s.attendedCount}/{s.attendeeCount}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setDetailId(s.id)} className="rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e5f0f7]" style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NewSessionModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
      <SessionDetailModal open={!!detailId} onClose={() => setDetailId(null)} sessionId={detailId} allStaff={allStaff} />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const [tab, setTab] = useState<'directory' | 'attendance' | 'salary' | 'training'>('directory');

  return (
    <PageShell gap={6}>
      <PageHeader
        title="Staff"
        subtitle="Directory, attendance, salary, training"
      />

      <div className="flex gap-1 rounded-[10px] p-1 w-fit" style={{ background: 'var(--rp-surface-3)' }}>
        {([
          { key: 'directory', label: 'Directory' },
          { key: 'attendance', label: 'Attendance' },
          { key: 'salary', label: 'Salary' },
          { key: 'training', label: 'Training' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="rounded-[8px] px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={tab === t.key ? { background: 'var(--rp-surface)', color: 'var(--rp-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: 'var(--rp-text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'directory' && <DirectoryTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'salary' && <SalaryTab />}
      {tab === 'training' && <TrainingTab />}
    </PageShell>
  );
}
