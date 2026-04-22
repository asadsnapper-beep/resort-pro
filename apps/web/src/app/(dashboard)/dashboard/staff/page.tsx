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
import { Plus, Search, Users, Building2, Shield, ChevronLeft, ChevronRight } from 'lucide-react';

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
    isActive: boolean;
    lastLoginAt?: string;
  };
}

const DEPARTMENTS = ['', 'FRONT_DESK', 'HOUSEKEEPING', 'RESTAURANT', 'MAINTENANCE', 'SECURITY', 'MANAGEMENT'] as const;

const DEPT_COLORS: Record<string, string> = {
  FRONT_DESK: 'bg-blue-100 text-blue-700 border-blue-200',
  HOUSEKEEPING: 'bg-green-100 text-green-700 border-green-200',
  RESTAURANT: 'bg-orange-100 text-orange-700 border-orange-200',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  SECURITY: 'bg-red-100 text-red-700 border-red-200',
  MANAGEMENT: 'bg-purple-100 text-purple-700 border-purple-200',
};

function formatDept(d: string) {
  return d.replace(/_/g, ' ');
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [deactivateStaff, setDeactivateStaff] = useState<Staff | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staff', deptFilter, page],
    queryFn: () => staffApi.list({ department: deptFilter || undefined, page, limit: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => staffApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff member added' });
      setAddOpen(false);
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to add staff', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => staffApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff updated' });
      setEditStaff(null);
      setSelectedStaff(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => staffApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff member deactivated' });
      setDeactivateStaff(null);
      setSelectedStaff(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to deactivate', variant: 'destructive' }),
  });

  const allStaff: Staff[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const total = pagination?.total ?? 0;

  const staff = allStaff.filter((s) =>
    search === '' ||
    `${s.user.firstName} ${s.user.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    s.user.email.toLowerCase().includes(search.toLowerCase()) ||
    s.position.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = allStaff.filter((s) => s.isActive).length;
  const deptCount = new Set(allStaff.map((s) => s.department)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0 ? `${total} staff member${total !== 1 ? 's' : ''} registered` : 'Manage your team'}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Staff', value: total || 0, icon: Users, color: 'bg-resort-50 border-resort-200 text-resort-700' },
          { label: 'Active', value: activeCount, icon: Shield, color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Departments', value: deptCount, icon: Building2, color: 'bg-blue-50 border-blue-200 text-blue-700' },
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

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or position..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {DEPARTMENTS.map((d) => (
            <button
              key={d}
              onClick={() => { setDeptFilter(d); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                deptFilter === d
                  ? 'bg-resort-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
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
                {search || deptFilter ? 'No staff found' : 'No staff yet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || deptFilter ? 'Try adjusting your filters' : 'Add your first team member to get started'}
              </p>
              {!search && !deptFilter && (
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
                    <th className="px-5 py-3 text-left">Contact</th>
                    <th className="px-5 py-3 text-left">Hired</th>
                    <th className="px-5 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staff.map((s) => {
                    const deptClass = DEPT_COLORS[s.department] ?? 'bg-gray-100 text-gray-600 border-gray-200';
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedStaff(s)}
                      >
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
                        <td className="px-5 py-4 text-sm text-muted-foreground">{s.phone ?? '—'}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(s.hireDate)}</td>
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

      <StaffModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        loading={createMutation.isPending}
        onSubmit={(d) => createMutation.mutate(d)}
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
        onEdit={(s) => { setEditStaff(s); setSelectedStaff(null); }}
        onDeactivate={(s) => setDeactivateStaff(s)}
      />
      <ConfirmModal
        open={!!deactivateStaff}
        onClose={() => setDeactivateStaff(null)}
        onConfirm={() => deactivateStaff && deactivateMutation.mutate(deactivateStaff.id)}
        loading={deactivateMutation.isPending}
        title="Deactivate Staff Member"
        description={`Are you sure you want to deactivate ${deactivateStaff?.user.firstName} ${deactivateStaff?.user.lastName}? They will lose access to the system.`}
        confirmLabel="Deactivate"
      />
    </div>
  );
}
