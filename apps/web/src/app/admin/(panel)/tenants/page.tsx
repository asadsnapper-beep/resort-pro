'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminEndpoints } from '@/lib/admin-api';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import {
  Search, Building2, ChevronLeft, ChevronRight,
  ExternalLink, Loader2, CheckCircle2, AlertTriangle,
  Ban, RefreshCw, UserCheck, Filter, Download, Flag,
} from 'lucide-react';
import Link from 'next/link';

type ChurnRisk = {
  level: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  score: number;
  reasons: string[];
  daysSinceLogin: number | null;
  bookingsLast30: number;
  bookingsPrev30: number;
};

type Tenant = {
  id: string; name: string; slug: string; plan: string; planStatus: string;
  isActive: boolean; email: string | null; phone: string | null; currency: string;
  trialEndsAt: string | null; currentPeriodEnd: string | null; stripeCustomerId: string | null;
  createdAt: string;
  ownerLastLoginAt: string | null;
  churnRisk: ChurnRisk;
  _count: { users: number; rooms: number; bookings: number };
};

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  HIGH:   { label: '🔴 High',   cls: 'bg-red-500/15 text-red-400 border border-red-500/20' },
  MEDIUM: { label: '🟡 Medium', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
  LOW:    { label: '🟢 Low',    cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20' },
  NONE:   { label: '—',         cls: 'text-gray-600' },
};

const planColors: Record<string, string> = {
  FREE: 'bg-gray-700 text-gray-300',
  STARTER: 'bg-blue-500/20 text-blue-400 border border-blue-500/20',
  PROFESSIONAL: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20',
  ENTERPRISE: 'bg-purple-500/20 text-purple-400 border border-purple-500/20',
};

const statusColors: Record<string, string> = {
  trialing: 'bg-amber-500/20 text-amber-400',
  active: 'bg-green-500/20 text-green-400',
  past_due: 'bg-red-500/20 text-red-400',
  canceled: 'bg-gray-700 text-gray-400',
  incomplete: 'bg-orange-500/20 text-orange-400',
};

export default function AdminTenantsPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [editPlan, setEditPlan] = useState('');
  const [editTrialDays, setEditTrialDays] = useState('');

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page) };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.plan = planFilter;
      const res = await adminEndpoints.tenants(params);
      const d = res.data.data;
      setTenants(d.tenants);
      setTotal(d.total);
      setPages(d.pages);
    } catch {
      toast({ title: 'Failed to load tenants', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleImpersonate = async (t: Tenant) => {
    setActionLoading(`imp-${t.id}`);
    try {
      const res = await adminEndpoints.impersonate(t.id);
      const { token, refreshToken, user, tenant } = res.data.data;
      setAuth(user, tenant, token, refreshToken);
      toast({ title: `Logged in as ${t.name}`, description: '2-hour session.' });
      router.push('/dashboard');
    } catch (err: any) {
      toast({ title: err?.response?.data?.error || 'Impersonation failed', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (t: Tenant) => {
    if (!confirm(`Suspend "${t.name}"? They will lose dashboard access.`)) return;
    setActionLoading(`sus-${t.id}`);
    try {
      await adminEndpoints.suspendTenant(t.id);
      toast({ title: `${t.name} suspended` });
      fetchTenants();
    } catch {
      toast({ title: 'Failed to suspend', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (t: Tenant) => {
    setActionLoading(`act-${t.id}`);
    try {
      await adminEndpoints.updateTenant(t.id, { isActive: true });
      toast({ title: `${t.name} reactivated` });
      fetchTenants();
    } catch {
      toast({ title: 'Failed to reactivate', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async (t: Tenant) => {
    setActionLoading(`exp-${t.id}`);
    try {
      const res = await adminEndpoints.exportTenant(t.id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resortpro-export-${t.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Data exported for ${t.name}` });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (t: Tenant) => {
    setEditTenant(t);
    setEditPlan(t.plan);
    setEditTrialDays('');
  };

  const handleSaveEdit = async () => {
    if (!editTenant) return;
    setActionLoading(`edit-${editTenant.id}`);
    try {
      // Update plan
      await adminEndpoints.updateTenant(editTenant.id, { plan: editPlan });

      // Extend trial if specified
      if (editTrialDays) {
        const days = parseInt(editTrialDays);
        if (days > 0) {
          await adminEndpoints.extendTrial(editTenant.id, days);
        }
      }

      toast({ title: `${editTenant.name} updated` });
      setEditTenant(null);
      fetchTenants();
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total tenants</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, slug, email..."
            className="w-full h-9 bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 bg-gray-900 border border-gray-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="paid">Paid</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="h-9 bg-gray-900 border border-gray-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Plans</option>
          <option value="FREE">Free</option>
          <option value="STARTER">Starter</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Plan</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Stats</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Risk</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Joined</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 uppercase">
                        {t.name[0]}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{t.name}</p>
                        <p className="text-gray-500 text-xs font-mono">{t.slug}</p>
                        {t.email && <p className="text-gray-600 text-xs">{t.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${planColors[t.plan] || 'bg-gray-700 text-gray-300'}`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${statusColors[t.planStatus] || 'bg-gray-700 text-gray-400'}`}>
                        {t.planStatus}
                      </span>
                      {!t.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full w-fit bg-red-500/20 text-red-400 border border-red-500/20">
                          suspended
                        </span>
                      )}
                      {t.trialEndsAt && t.planStatus === 'trialing' && (
                        <p className="text-xs text-gray-600">
                          Trial ends {new Date(t.trialEndsAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3 text-xs text-gray-400">
                      <span title="Users">👥 {t._count.users}</span>
                      <span title="Rooms">🛏 {t._count.rooms}</span>
                      <span title="Bookings">📅 {t._count.bookings}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {t.churnRisk && t.churnRisk.level !== 'NONE' ? (
                      <div title={t.churnRisk.reasons.join('\n')}>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${RISK_BADGE[t.churnRisk.level]?.cls}`}>
                          {RISK_BADGE[t.churnRisk.level]?.label}
                        </span>
                        {t.churnRisk.daysSinceLogin !== null && (
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {t.churnRisk.daysSinceLogin}d no login
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-700 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-md hover:bg-gray-700 transition-colors"
                      >
                        Edit
                      </button>
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        title="Feature flags"
                        className="text-xs text-gray-400 hover:text-indigo-400 px-2 py-1 rounded-md hover:bg-indigo-500/10 transition-colors"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => handleExport(t)}
                        disabled={actionLoading === `exp-${t.id}`}
                        title="Export data as JSON"
                        className="text-xs text-gray-400 hover:text-green-400 px-2 py-1 rounded-md hover:bg-green-500/10 transition-colors disabled:opacity-40"
                      >
                        {actionLoading === `exp-${t.id}` ? '...' : <Download className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleImpersonate(t)}
                        disabled={actionLoading === `imp-${t.id}` || !t.isActive}
                        className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-md hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
                      >
                        {actionLoading === `imp-${t.id}` ? '...' : 'Login as →'}
                      </button>
                      {t.isActive ? (
                        <button
                          onClick={() => handleSuspend(t)}
                          disabled={actionLoading === `sus-${t.id}`}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(t)}
                          disabled={actionLoading === `act-${t.id}`}
                          className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded-md hover:bg-green-500/10 transition-colors disabled:opacity-40"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    No tenants found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {pages} ({total} tenants)</p>
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

      {/* Edit Modal */}
      {editTenant && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-1">Edit Tenant</h2>
            <p className="text-gray-400 text-sm mb-5">{editTenant.name} ({editTenant.slug})</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Plan</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="FREE">Free</option>
                  <option value="STARTER">Starter ($49/mo)</option>
                  <option value="PROFESSIONAL">Professional ($99/mo)</option>
                  <option value="ENTERPRISE">Enterprise ($199/mo)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Extend Trial (days)
                  <span className="text-gray-500 font-normal ml-2">Leave blank to not change</span>
                </label>
                <input
                  type="number"
                  value={editTrialDays}
                  onChange={(e) => setEditTrialDays(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                disabled={actionLoading === `edit-${editTenant.id}`}
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {actionLoading === `edit-${editTenant.id}` && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
              <button
                onClick={() => setEditTenant(null)}
                className="flex-1 h-10 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
