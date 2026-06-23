'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '@/lib/api';
import { ConfirmModal } from '@/components/ui/modal';
import { StaffModal } from '@/components/staff/StaffModal';
import { StaffDetailSheet } from '@/components/staff/StaffDetailSheet';
import { formatDate, getInitials } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import {
  Plus, Search, Users, Building2, ChevronLeft, ChevronRight,
  X, Clock, Monitor, ShieldOff,
} from 'lucide-react';

interface Staff {
  id: string;
  department: string;
  position: string;
  phone?: string;
  hireDate: string;
  isActive: boolean;
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

const DEPARTMENTS = ['', 'FRONT_DESK', 'HOUSEKEEPING', 'RESTAURANT', 'MAINTENANCE', 'SECURITY', 'MANAGEMENT'] as const;

const DEPT_META: Record<string, { bg: string; border: string; text: string }> = {
  FRONT_DESK:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  HOUSEKEEPING: { bg: 'var(--rp-teal-soft)', border: 'rgba(35,118,106,0.15)', text: 'var(--rp-text-accent)' },
  RESTAURANT:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  MAINTENANCE:  { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  SECURITY:     { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  MANAGEMENT:   { bg: '#1b342f', border: 'rgba(27,52,47,0.4)',    text: '#dfd9d0' },
};

const ROLE_META: Record<string, { bg: string; border: string; text: string }> = {
  OWNER:        { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  MANAGER:      { bg: '#1b342f', border: 'rgba(27,52,47,0.4)',    text: '#dfd9d0' },
  RECEPTIONIST: { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)', text: '#23766a' },
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

function formatDept(d: string) { return d.replace(/_/g, ' '); }

export default function StaffPage() {
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
    <div className="space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Staff</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">
            {total > 0 ? `${total} team member${total !== 1 ? 's' : ''}` : 'Manage your team'}
          </p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Staff',     value: total || 0,                        Icon: Users,     iconBg: 'var(--rp-teal-bg)', iconColor: '#23766a' },
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
              <p className="text-[12.5px] font-medium text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
            </div>
            <p className="text-[26px] font-semibold leading-none text-[#18231f] dark:text-[#dfd9d0]">{value}</p>
          </div>
        ))}
      </div>

      {/* Pending Invites */}
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
                      <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{inv.email}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="rounded-[6px] border px-[7px] py-[2px] text-[10.5px] font-semibold"
                          style={{ background: rm.bg, borderColor: rm.border, color: rm.text }}>
                          {ROLE_LABELS[inv.role] ?? inv.role}
                        </span>
                        <span className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                          Sent {formatDate(inv.createdAt)} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => cancelInviteMutation.mutate(inv.id)}
                    disabled={cancelInviteMutation.isPending}
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:bg-[#fef2f2] disabled:opacity-50 text-[#c5bdb4] dark:text-[#6e8580]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9bbdb7' }} />
          <input
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search by name, email, or position…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[9px] pl-9 pr-3 text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30"
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

      {/* Table */}
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
              <Users className="h-7 w-7" style={{ color: '#23766a' }} />
            </div>
            <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">
              {searchInput || deptFilter ? 'No staff found' : 'No staff yet'}
            </p>
            <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
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
                              style={{ background: 'var(--rp-teal-bg)', color: '#23766a' }}>
                              {getInitials(s.user.firstName, s.user.lastName)}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                              style={{ background: s.isActive ? '#4ade80' : 'var(--rp-text-faint)' }} />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                              {s.user.firstName} {s.user.lastName}
                            </p>
                            <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{s.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
                          style={{ background: dm.bg, borderColor: dm.border, color: dm.text }}>
                          {formatDept(s.department)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[#4a6e66] dark:text-[#6d9990]">{s.position}</td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {hasAccess ? (
                          <div className="flex items-center gap-1.5">
                            <Monitor className="h-3.5 w-3.5" style={{ color: '#9bbdb7' }} />
                            <span className="rounded-[6px] border px-[7px] py-[2px] text-[11px] font-semibold"
                              style={{ background: rm.bg, borderColor: rm.border, color: rm.text }}>
                              {ROLE_LABELS[s.user.role ?? ''] ?? s.user.role}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[#c5bdb4] dark:text-[#6e8580]">
                            <ShieldOff className="h-3.5 w-3.5" />
                            <span className="text-[12px]">No access</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[12.5px] hidden lg:table-cell text-[#8aa29a] dark:text-[#94b8b0]">
                        {formatDate(s.hireDate)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
                          style={s.isActive
                            ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
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

      {/* Modals */}
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
