'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

type User = {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string;
  tenant: { name: string; slug: string; plan: string };
};

const roleColors: Record<string, string> = {
  OWNER: 'bg-purple-500/20 text-purple-400',
  MANAGER: 'bg-blue-500/20 text-blue-400',
  STAFF: 'bg-gray-700 text-gray-300',
  GUEST: 'bg-green-500/20 text-green-400',
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-gray-500 text-sm mt-1">{total} total users across all tenants</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="w-full h-9 bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="h-9 bg-gray-900 border border-gray-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Roles</option>
          <option value="OWNER">Owner</option>
          <option value="MANAGER">Manager</option>
          <option value="STAFF">Staff</option>
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">User</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Last Login</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300 uppercase">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{u.firstName} {u.lastName}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[u.role] || 'bg-gray-700 text-gray-300'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white text-sm">{u.tenant.name}</p>
                    <p className="text-gray-500 text-xs font-mono">{u.tenant.slug}</p>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Never'
                    }
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {pages} ({total} users)</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
