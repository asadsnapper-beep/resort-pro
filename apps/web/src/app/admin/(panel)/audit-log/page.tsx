'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import {
  Shield, Search, ChevronLeft, ChevronRight,
  User, Building2, Palette, Settings,
  LogIn, Download, Ban, RefreshCw, ArrowUpDown,
  Clock, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DataTable, type DataColumn, FilterBar } from '@/components/patterns';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ── Action config ────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; Icon: React.ElementType }> = {
  impersonate:     { label: 'Impersonate',    Icon: LogIn },
  suspend:         { label: 'Suspend',         Icon: Ban },
  reactivate:      { label: 'Reactivate',      Icon: RefreshCw },
  plan_change:     { label: 'Plan Change',     Icon: ArrowUpDown },
  extend_trial:    { label: 'Extend Trial',    Icon: Clock },
  export:          { label: 'Data Export',     Icon: Download },
  settings_change: { label: 'Settings Change', Icon: Settings },
  theme_update:    { label: 'Theme Update',    Icon: Palette },
  theme_toggle:    { label: 'Theme Toggle',    Icon: Palette },
  tenant_update:   { label: 'Tenant Update',   Icon: Building2 },
};

const TARGET_ICONS: Record<string, React.ElementType> = {
  tenant:   Building2,
  user:     User,
  theme:    Palette,
  settings: Settings,
};

const ALL_ACTIONS = Object.keys(ACTION_CONFIG);

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatMeta(log: AuditLog): string {
  if (!log.metadata) return '';
  const m = log.metadata;
  if (log.action === 'plan_change') {
    return `${(m.before as any)?.plan ?? '?'} → ${(m.after as any)?.plan ?? '?'}`;
  }
  if (log.action === 'extend_trial') return `+${m.days} days`;
  if (log.action === 'theme_toggle') return `${m.from ? 'active' : 'inactive'} → ${m.to ? 'active' : 'inactive'}`;
  if (log.action === 'settings_change') return `Changed: ${(m.changed as string[])?.join(', ')}`;
  if (log.action === 'impersonate') return `as ${(m as any).ownerEmail ?? ''}`;
  if (log.action === 'export') {
    const s = m.summary as any;
    return `${s?.totalBookings ?? 0} bookings, ${s?.totalGuests ?? 0} guests`;
  }
  return '';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminEndpoints.getAuditLog({
        page,
        ...(filterAction && { action: filterAction }),
        ...(filterEmail && { adminEmail: filterEmail }),
        ...(filterType && { targetType: filterType }),
        ...(filterFrom && { from: filterFrom }),
        ...(filterTo && { to: filterTo }),
      });
      const d = res.data.data;
      setLogs(d.logs);
      setTotal(d.total);
      setPages(d.pages);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterEmail, filterType, filterFrom, filterTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const clearFilters = () => {
    setFilterAction('');
    setFilterEmail('');
    setFilterType('');
    setFilterFrom('');
    setFilterTo('');
    setEmailInput('');
    setPage(1);
  };

  const hasFilters = filterAction || filterEmail || filterType || filterFrom || filterTo;

  const columns: DataColumn<AuditLog>[] = [
    {
      id: 'action', header: 'Action',
      cell: (log) => {
        const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, Icon: Shield };
        const ActionIcon = cfg.Icon;
        return <span className="inline-flex items-center gap-1.5 border border-rp-border-md bg-rp-surface-3 px-2 py-1 text-rp-micro font-semibold text-rp-text">
          <ActionIcon className="h-3 w-3" />{cfg.label}
        </span>;
      },
    },
    {
      id: 'target', header: 'Target',
      cell: (log) => {
        const TargetIcon = TARGET_ICONS[log.targetType] ?? Shield;
        return <div className="flex min-w-40 items-center gap-2">
          <TargetIcon className="h-3.5 w-3.5 shrink-0 text-rp-faint" />
          <div className="min-w-0"><p className="truncate text-sm font-medium text-rp-text">{log.targetName ?? log.targetId ?? '—'}</p><p className="text-rp-micro capitalize text-rp-muted">{log.targetType}</p></div>
        </div>;
      },
    },
    {
      id: 'detail', header: 'Detail',
      cell: (log) => {
        const meta = formatMeta(log);
        return meta ? <span className="bg-rp-surface-3 px-2 py-0.5 font-mono text-rp-micro text-rp-muted">{meta}</span> : <span className="text-rp-faint">—</span>;
      },
    },
    { id: 'admin', header: 'Admin', cell: (log) => <span className="text-sm text-rp-text">{log.adminEmail}</span> },
    { id: 'ip', header: 'IP', cell: (log) => <span className="font-mono text-rp-micro text-rp-muted">{log.ipAddress ?? '—'}</span> },
    {
      id: 'when', header: 'When',
      cell: (log) => <div className="whitespace-nowrap">
        <p className="text-rp-meta text-rp-muted">{timeAgo(log.createdAt)}</p>
        <p className="mt-0.5 text-rp-micro text-rp-faint">{new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>,
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="admin-page-title text-rp-text">Audit Log</h1>
          <p className="mt-1 text-sm text-rp-muted">All admin actions — {total.toLocaleString()} records total</p>
        </div>
        <div className="flex items-center gap-2 border border-rp-brand bg-rp-teal-bg px-3 py-1.5">
          <Shield className="h-4 w-4 text-rp-brand-deep" />
          <span className="text-sm font-semibold text-rp-brand-deep">Tamper-proof</span>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={<>
          <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }} className="h-9 min-w-36 border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg">
            <option value="">All actions</option>
            {ALL_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_CONFIG[a]?.label ?? a}</option>)}
          </select>
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="h-9 min-w-32 border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg">
            <option value="">All targets</option>
            <option value="tenant">Tenant</option>
            <option value="theme">Theme</option>
            <option value="settings">Settings</option>
            <option value="user">User</option>
          </select>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-rp-faint" />
            <input
              type="text"
              placeholder="Admin email… (Enter to apply)"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setFilterEmail(emailInput); setPage(1); } }}
              className="h-9 w-56 border border-rp-border-md bg-rp-surface pl-8 pr-3 text-sm text-rp-text outline-none placeholder:text-rp-faint focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg"
            />
          </label>
          <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} className="h-9 border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg" />
          <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} className="h-9 border border-rp-border-md bg-rp-surface px-3 text-sm text-rp-text outline-none focus:border-rp-brand focus:ring-2 focus:ring-rp-teal-bg" />
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-rp-meta font-semibold text-rp-muted hover:text-rp-danger">
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </>}
      />

      <DataTable
        columns={columns}
        rows={logs}
        getRowKey={(log) => log.id}
        loading={loading}
        emptyTitle="No audit records found"
        emptyDescription={hasFilters ? 'Try adjusting your filters.' : 'Admin actions will appear here.'}
        footer={pages > 1 && <div className="flex items-center justify-between gap-4">
          <p className="text-rp-meta text-rp-muted">Page {page} of {pages} · {total.toLocaleString()} records</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex h-8 w-8 items-center justify-center border border-rp-border-md text-rp-text hover:bg-rp-surface-3 disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page - 2 + i;
              if (p < 1 || p > pages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} className={cn('flex h-8 w-8 items-center justify-center border text-sm font-semibold', p === page ? 'border-rp-brand bg-rp-brand text-rp-btn-accent-text' : 'border-rp-border-md text-rp-muted hover:bg-rp-surface-3')}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="flex h-8 w-8 items-center justify-center border border-rp-border-md text-rp-text hover:bg-rp-surface-3 disabled:opacity-30" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>}
      />
    </div>
  );
}
