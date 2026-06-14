'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const DEPT_COLORS: Record<string, string> = {
  FRONT_DESK:   'bg-blue-100 text-blue-700 border-blue-200',
  HOUSEKEEPING: 'bg-green-100 text-green-700 border-green-200',
  RESTAURANT:   'bg-orange-100 text-orange-700 border-orange-200',
  MAINTENANCE:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  SECURITY:     'bg-red-100 text-red-700 border-red-200',
  MANAGEMENT:   'bg-purple-100 text-purple-700 border-purple-200',
};

const ROLE_COLORS: Record<string, string> = {
  OWNER:        'bg-yellow-100 text-yellow-800',
  MANAGER:      'bg-purple-100 text-purple-700',
  RECEPTIONIST: 'bg-blue-100 text-blue-700',
  CHEF:         'bg-red-100 text-red-700',
  MARKETER:     'bg-pink-100 text-pink-700',
  DEVELOPER:    'bg-indigo-100 text-indigo-700',
  SHAREHOLDER:  'bg-amber-100 text-amber-700',
  STAFF:        'bg-gray-100 text-gray-600',
};

const ROLE_LABELS: Record<string, string> = {
  OWNER:        'Owner',
  MANAGER:      'Manager',
  RECEPTIONIST: 'Receptionist',
  CHEF:         'Chef',
  MARKETER:     'Marketer',
  DEVELOPER:    'Developer',
  SHAREHOLDER:  'Shareholder',
  STAFF:        'Staff',
};

function formatDept(d: string) { return d.replace(/_/g, ' '); }

export default function StaffPage() {
  const queryClient = useQueryClient();

  const [deptFilter, setDeptFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [page, setPage] = useState(1);

  const [addOpen,         setAddOpen]         = useState(false);
  const [editStaff,       setEditStaff]        = useState<Staff | null>(null);
  const [selectedStaff,   setSelectedStaff]    = useState<Staff | null>(null);
  const [deactivateStaff, setDeactivateStaff]  = useState<Staff | null>(null);
  const [reactivateStaff, setReactivateStaff]  = useState<Staff | null>(null);

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

  // Handle StaffModal submit — either HR-only or HR + invite
  const handleAddStaff = async (data: Record<string, unknown>, giveAccess: boolean) => {
    const { email, role, ...staffData } = data;

    // Always create the HR record first
    await createMutation.mutateAsync(giveAccess
      ? { ...staffData, email, password: Math.random().toString(36).slice(2) + 'Aa1!', role }
      : staffData
    );

    // If system access requested, send invite
    if (giveAccess && email && role) {
      await inviteMutation.mutateAsync({ email: email as string, role: role as string });
      toast({ title: 'Staff added & invite sent!', description: `Invite email sent to ${email}` });
    }
  };

  const staff: Staff[] = data?.data?.data ?? [];
  const pagination     = data?.data?.pagination;
  const total          = pagination?.total ?? 0;
  const pendingInvites: PendingInvite[] = inviteData?.data?.data ?? [];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0 ? `${total} team member${total !== 1 ? 's' : ''}` : 'Manage your team'}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Staff',     value: total || 0,            icon: Users,     color: 'bg-resort-50 border-resort-200 text-resort-700' },
          { label: 'Pending Invites', value: pendingInvites.length, icon: Clock,     color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Departments',     value: DEPARTMENTS.filter(Boolean).length, icon: Building2, color: 'bg-blue-50 border-blue-200 text-blue-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 opacity-70" />
              <p className="text-xs font-medium opacity-70">{label}</p>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">
              Pending Invites ({pendingInvites.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className={`font-semibold px-1.5 py-0.5 rounded ${ROLE_COLORS[inv.role] ?? ROLE_COLORS.STAFF}`}>
                        {ROLE_LABELS[inv.role] ?? inv.role}
                      </span>
                      {' · '}Sent {formatDate(inv.createdAt)}
                      {' · '}Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => cancelInviteMutation.mutate(inv.id)}
                  disabled={cancelInviteMutation.isPending}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Cancel invite"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search by name, email, or position…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {DEPARTMENTS.map(d => (
            <button key={d}
              onClick={() => { setDeptFilter(d); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                deptFilter === d
                  ? 'bg-resort-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {d ? formatDept(d) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px">
              {[...Array(6)].map((_, i) => <div key={i} className="h-[72px] bg-gray-50 animate-pulse border-b" />)}
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="h-14 w-14 text-gray-200 mb-4" />
              <p className="font-medium text-gray-500">
                {searchInput || deptFilter ? 'No staff found' : 'No staff yet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchInput || deptFilter ? 'Try adjusting your filters' : 'Add your first team member to get started'}
              </p>
              {!searchInput && !deptFilter && (
                <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Staff
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Staff Member</th>
                    <th className="px-5 py-3 text-left">Department</th>
                    <th className="px-5 py-3 text-left">Position</th>
                    <th className="px-5 py-3 text-left hidden md:table-cell">System Access</th>
                    <th className="px-5 py-3 text-left hidden lg:table-cell">Hired</th>
                    <th className="px-5 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staff.map(s => {
                    const deptClass = DEPT_COLORS[s.department] ?? 'bg-gray-100 text-gray-600 border-gray-200';
                    const hasAccess = !!s.user.role;
                    const roleClass = ROLE_COLORS[s.user.role ?? ''] ?? ROLE_COLORS.STAFF;
                    return (
                      <tr key={s.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedStaff(s)}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-resort-100 text-sm font-bold text-resort-700">
                                {getInitials(s.user.firstName, s.user.lastName)}
                              </div>
                              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${s.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{s.user.firstName} {s.user.lastName}</p>
                              <p className="text-xs text-muted-foreground">{s.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${deptClass}`}>
                            {formatDept(s.department)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">{s.position}</td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          {hasAccess ? (
                            <div className="flex items-center gap-1.5">
                              <Monitor className="h-3.5 w-3.5 text-[#1a6b5e]" />
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${roleClass}`}>
                                {ROLE_LABELS[s.user.role ?? ''] ?? s.user.role}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <ShieldOff className="h-3.5 w-3.5" />
                              <span className="text-xs">No access</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground hidden lg:table-cell">
                          {formatDate(s.hireDate)}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
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
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
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
