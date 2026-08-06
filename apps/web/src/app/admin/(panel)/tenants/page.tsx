'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPlanDisplayName, PLAN_PRICING } from '@resort-pro/types';
import { adminEndpoints } from '@/lib/admin-api';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import {
  ChevronLeft, ChevronRight, Loader2, Download, Flag,
} from 'lucide-react';
import Link from 'next/link';
import { DataTable, type DataColumn, FilterBar, FormField, ConfirmDialog } from '@/components/patterns';
import { ModalShell } from '@/components/ui/modal-shell';

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
  HIGH:   { label: 'High',   cls: 'bg-rp-teal-bg text-rp-brand-deep border border-rp-brand' },
  MEDIUM: { label: 'Medium', cls: 'bg-rp-teal-bg text-rp-brand-deep border border-rp-brand' },
  LOW:    { label: 'Low',    cls: 'bg-rp-surface-3 text-rp-subtle border border-rp-border-md' },
  NONE:   { label: '—',      cls: 'text-rp-faint' },
};

const planColors: Record<string, string> = {
  FREE: 'bg-rp-surface-3 text-rp-subtle border border-rp-border-md',
  STARTER: 'bg-rp-teal-bg text-rp-brand-deep border border-rp-brand',
  PROFESSIONAL: 'bg-rp-teal-bg text-rp-brand-deep border border-rp-brand',
  ENTERPRISE: 'bg-rp-teal-bg text-rp-brand-deep border border-rp-brand',
};

const statusColors: Record<string, string> = {
  trialing: 'bg-rp-teal-bg text-rp-brand-deep border border-rp-brand',
  active: 'bg-rp-surface-3 text-rp-text border border-rp-border-md',
  past_due: 'bg-rp-teal-bg text-rp-brand-deep border border-rp-brand',
  canceled: 'bg-rp-surface-3 text-rp-subtle border border-rp-border-md',
  incomplete: 'bg-rp-teal-bg text-rp-brand-deep border border-rp-brand',
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
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
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
    setActionLoading(`sus-${t.id}`);
    try {
      await adminEndpoints.suspendTenant(t.id);
      toast({ title: `${t.name} suspended` });
      fetchTenants();
    } catch {
      toast({ title: 'Failed to suspend', variant: 'destructive' });
      throw new Error('Failed to suspend');
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

  const columns: DataColumn<Tenant>[] = [
    {
      id: 'tenant', header: 'Tenant',
      cell: (tenant) => <div className="flex min-w-52 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-rp-brand bg-rp-teal-bg text-rp-meta font-bold uppercase text-rp-brand-deep">{tenant.name[0]}</span>
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-rp-text">{tenant.name}</p><p className="truncate text-rp-meta text-rp-muted">{tenant.slug}{tenant.email ? ` · ${tenant.email}` : ''}</p></div>
      </div>,
    },
    { id: 'plan', header: 'Plan', cell: (tenant) => <span className={`inline-flex border px-2 py-1 text-rp-micro font-semibold ${planColors[tenant.plan] || planColors.FREE}`}>{getPlanDisplayName(tenant.plan)}</span> },
    {
      id: 'status', header: 'Status', cell: (tenant) => <div className="flex min-w-28 flex-col items-start gap-1">
        <span className={`inline-flex border px-2 py-0.5 text-rp-micro font-semibold ${statusColors[tenant.planStatus] || statusColors.canceled}`}>{tenant.planStatus}</span>
        {!tenant.isActive && <span className="border border-rp-brand bg-rp-teal-bg px-2 py-0.5 text-rp-micro font-semibold text-rp-brand-deep">suspended</span>}
        {tenant.trialEndsAt && tenant.planStatus === 'trialing' && <p className="text-rp-micro text-rp-muted">Trial ends {new Date(tenant.trialEndsAt).toLocaleDateString()}</p>}
      </div>,
    },
    { id: 'stats', header: 'Stats', cell: (tenant) => <div className="admin-table-stats whitespace-nowrap text-rp-subtle">{tenant._count.users} users · {tenant._count.rooms} rooms · {tenant._count.bookings} bookings</div> },
    {
      id: 'risk', header: 'Risk', cell: (tenant) => tenant.churnRisk?.level !== 'NONE' ? <div title={tenant.churnRisk.reasons.join('\n')}>
        <span className={`inline-flex border px-2 py-0.5 text-rp-micro font-semibold ${RISK_BADGE[tenant.churnRisk.level]?.cls}`}>{RISK_BADGE[tenant.churnRisk.level]?.label}</span>
        {tenant.churnRisk.daysSinceLogin !== null && <p className="mt-1 text-rp-micro text-rp-muted">{tenant.churnRisk.daysSinceLogin}d no login</p>}
      </div> : <span className="text-rp-faint">—</span>,
    },
    { id: 'joined', header: 'Joined', cell: (tenant) => <span className="whitespace-nowrap text-rp-body text-rp-muted">{new Date(tenant.createdAt).toLocaleDateString()}</span> },
    {
      id: 'actions', header: 'Actions', headerClassName: 'text-right', className: 'text-right',
      cell: (tenant) => <div className="flex min-w-64 items-center justify-end gap-1 text-rp-body font-semibold">
        <button onClick={() => openEdit(tenant)} className="border border-transparent px-2 py-1 text-rp-text hover:border-rp-border-md hover:bg-rp-surface-3">Edit</button>
        <Link href={`/admin/tenants/${tenant.id}`} title="Feature flags" className="border border-transparent p-1.5 text-rp-subtle hover:border-rp-border-md hover:bg-rp-surface-3"><Flag className="h-3.5 w-3.5" /></Link>
        <button onClick={() => handleExport(tenant)} disabled={actionLoading === `exp-${tenant.id}`} title="Export data as JSON" className="border border-transparent p-1.5 text-rp-subtle hover:border-rp-border-md hover:bg-rp-surface-3 disabled:opacity-40">{actionLoading === `exp-${tenant.id}` ? '…' : <Download className="h-3.5 w-3.5" />}</button>
        <button onClick={() => handleImpersonate(tenant)} disabled={actionLoading === `imp-${tenant.id}` || !tenant.isActive} className="border border-transparent px-2 py-1 text-rp-brand-deep hover:border-rp-brand hover:bg-rp-teal-bg disabled:opacity-40">{actionLoading === `imp-${tenant.id}` ? '…' : 'Login as →'}</button>
        {tenant.isActive ? <button onClick={() => setSuspendTarget(tenant)} disabled={actionLoading === `sus-${tenant.id}`} className="border border-transparent px-2 py-1 text-rp-brand-deep hover:border-rp-brand hover:bg-rp-teal-bg disabled:opacity-40">Suspend</button> : <button onClick={() => handleReactivate(tenant)} disabled={actionLoading === `act-${tenant.id}`} className="border border-transparent px-2 py-1 text-rp-brand-deep hover:border-rp-brand hover:bg-rp-teal-bg disabled:opacity-40">Reactivate</button>}
      </div>,
    },
  ];

  const activeFilters = [
    statusFilter && { key: 'status', label: `Status: ${statusFilter}` },
    planFilter && { key: 'plan', label: `Plan: ${getPlanDisplayName(planFilter)}` },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const resetFilters = () => { setSearch(''); setStatusFilter(''); setPlanFilter(''); setPage(1); };

  return <div className="w-full space-y-6">
    <div>
      <h1 className="admin-page-title text-rp-text">Tenants</h1>
      <p className="mt-1 text-sm text-rp-muted">{total} total tenants</p>
    </div>

    <FilterBar
      search={search}
      onSearchChange={(value) => { setSearch(value); setPage(1); }}
      searchPlaceholder="Search name, slug, email…"
      activeFilters={activeFilters}
      onRemoveFilter={(key) => { if (key === 'status') setStatusFilter(''); if (key === 'plan') setPlanFilter(''); setPage(1); }}
      onReset={resetFilters}
      filters={<>
        <label className="text-rp-meta font-semibold text-rp-subtle">Status
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="mt-1 block h-9 min-w-36 border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg"><option value="">All statuses</option><option value="active">Active</option><option value="trialing">Trialing</option><option value="paid">Paid</option><option value="suspended">Suspended</option></select>
        </label>
        <label className="text-rp-meta font-semibold text-rp-subtle">Plan
          <select value={planFilter} onChange={(event) => { setPlanFilter(event.target.value); setPage(1); }} className="mt-1 block h-9 min-w-36 border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg"><option value="">All plans</option><option value="FREE">{PLAN_PRICING.FREE.displayName}</option><option value="STARTER">{PLAN_PRICING.STARTER.displayName}</option><option value="PROFESSIONAL">{PLAN_PRICING.PROFESSIONAL.displayName}</option><option value="ENTERPRISE">{PLAN_PRICING.ENTERPRISE.displayName}</option></select>
        </label>
      </>}
    />

    <DataTable columns={columns} rows={tenants} getRowKey={(tenant) => tenant.id} loading={loading} emptyTitle="No tenants match these filters" emptyDescription="Try adjusting your search or reset the filters." footer={<div className="flex items-center justify-between gap-4"><p className="text-rp-meta text-rp-muted">Page {page} of {pages} · {total} tenants</p>{pages > 1 && <div className="flex gap-2"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="flex h-8 w-8 items-center justify-center border border-rp-border-md text-rp-text hover:bg-rp-surface-3 disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page === pages} className="flex h-8 w-8 items-center justify-center border border-rp-border-md text-rp-text hover:bg-rp-surface-3 disabled:opacity-30" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div>}</div>} />

    {editTenant && <ModalShell variant="admin" open onClose={() => setEditTenant(null)} title="Edit Tenant" description={`${editTenant.name} · ${editTenant.slug}`} footer={<div className="flex justify-end gap-2"><button onClick={() => setEditTenant(null)} className="h-9 border border-rp-border-md px-4 text-sm font-semibold text-rp-text hover:bg-rp-surface-3">Cancel</button><button onClick={handleSaveEdit} disabled={actionLoading === `edit-${editTenant.id}`} className="inline-flex h-9 items-center gap-2 bg-rp-brand px-4 text-sm font-semibold text-rp-btn-accent-text hover:bg-rp-brand-hover disabled:opacity-50">{actionLoading === `edit-${editTenant.id}` && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</button></div>}>
      <div className="space-y-4"><FormField label="Plan"><select value={editPlan} onChange={(event) => setEditPlan(event.target.value)} className="h-10 w-full border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg"><option value="FREE">{PLAN_PRICING.FREE.displayName}</option><option value="STARTER">{PLAN_PRICING.STARTER.displayName} (${PLAN_PRICING.STARTER.monthlyUsd}/mo)</option><option value="PROFESSIONAL">{PLAN_PRICING.PROFESSIONAL.displayName} (${PLAN_PRICING.PROFESSIONAL.monthlyUsd}/mo)</option><option value="ENTERPRISE">{PLAN_PRICING.ENTERPRISE.displayName} (${PLAN_PRICING.ENTERPRISE.monthlyUsd}/mo)</option></select></FormField><FormField label="Extend trial (days)" help="Leave blank to keep the current trial date."><input type="number" value={editTrialDays} onChange={(event) => setEditTrialDays(event.target.value)} placeholder="e.g. 30" className="h-10 w-full border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none placeholder:text-rp-faint focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg" /></FormField></div>
    </ModalShell>}

    <ConfirmDialog
      open={!!suspendTarget}
      onClose={() => setSuspendTarget(null)}
      onConfirm={() => handleSuspend(suspendTarget as Tenant)}
      title="Suspend tenant"
      description={`"${suspendTarget?.name}" will immediately lose dashboard access. You can reactivate them anytime.`}
      confirmLabel="Suspend"
      tone="danger"
    />
  </div>;
}
