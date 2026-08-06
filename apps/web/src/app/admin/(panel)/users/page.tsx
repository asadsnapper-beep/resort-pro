'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DataTable, type DataColumn, FilterBar } from '@/components/patterns';

type User = {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string;
  tenant: { name: string; slug: string; plan: string };
};

const roleColors: Record<string, string> = {
  OWNER: 'border-rp-brand bg-rp-teal-bg text-rp-brand-deep',
  MANAGER: 'border-rp-border-md bg-rp-surface-3 text-rp-text',
  STAFF: 'border-rp-border-md bg-rp-surface-3 text-rp-subtle',
  GUEST: 'border-rp-border-md bg-rp-surface-3 text-rp-subtle',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page) };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await adminEndpoints.users(params);
      const d = res.data.data;
      setUsers(d.users);
      setTotal(d.total);
      setPages(d.pages);
    } catch {
      toast({ title: 'Failed to load users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const activeFilters = roleFilter ? [{ key: 'role', label: `Role: ${roleFilter}` }] : [];

  const columns: DataColumn<User>[] = [
    {
      id: 'user', header: 'User',
      cell: (u) => <div className="flex min-w-52 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-rp-brand bg-rp-teal-bg text-rp-meta font-bold uppercase text-rp-brand-deep">{u.firstName[0]}{u.lastName[0]}</span>
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-rp-text">{u.firstName} {u.lastName}</p><p className="truncate text-rp-meta text-rp-muted">{u.email}</p></div>
      </div>,
    },
    { id: 'role', header: 'Role', cell: (u) => <span className={`inline-flex border px-2 py-1 text-rp-micro font-semibold ${roleColors[u.role] || roleColors.STAFF}`}>{u.role}</span> },
    {
      id: 'tenant', header: 'Tenant',
      cell: (u) => <div className="min-w-0"><p className="truncate text-sm text-rp-text">{u.tenant.name}</p><p className="truncate text-rp-meta text-rp-muted">{u.tenant.slug}</p></div>,
    },
    {
      id: 'lastLogin', header: 'Last login',
      cell: (u) => <span className="whitespace-nowrap text-rp-body text-rp-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}</span>,
    },
    {
      id: 'status', header: 'Status',
      cell: (u) => <span className={`inline-flex border px-2 py-0.5 text-rp-micro font-semibold ${u.isActive ? 'border-rp-brand bg-rp-teal-bg text-rp-brand-deep' : 'border-rp-danger bg-rp-red-bg text-rp-danger'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>,
    },
  ];

  return <div className="w-full space-y-6">
    <div>
      <h1 className="admin-page-title text-rp-text">Users</h1>
      <p className="mt-1 text-sm text-rp-muted">{total} total users across all tenants</p>
    </div>

    <FilterBar
      search={search}
      onSearchChange={(value) => { setSearch(value); setPage(1); }}
      searchPlaceholder="Search by name or email…"
      activeFilters={activeFilters}
      onRemoveFilter={() => { setRoleFilter(''); setPage(1); }}
      onReset={() => { setSearch(''); setRoleFilter(''); setPage(1); }}
      filters={
        <label className="text-rp-meta font-semibold text-rp-subtle">Role
          <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="mt-1 block h-9 min-w-36 border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg">
            <option value="">All roles</option>
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
          </select>
        </label>
      }
    />

    <DataTable
      columns={columns}
      rows={users}
      getRowKey={(u) => u.id}
      loading={loading}
      emptyTitle="No users match these filters"
      emptyDescription="Try adjusting your search or reset the filters."
      footer={pages > 1 && <div className="flex items-center justify-between gap-4">
        <p className="text-rp-meta text-rp-muted">Page {page} of {pages} · {total} users</p>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex h-8 w-8 items-center justify-center border border-rp-border-md text-rp-text hover:bg-rp-surface-3 disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="flex h-8 w-8 items-center justify-center border border-rp-border-md text-rp-text hover:bg-rp-surface-3 disabled:opacity-30" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>}
    />
  </div>;
}
