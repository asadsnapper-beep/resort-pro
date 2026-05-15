'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import {
  Shield, Search, ChevronLeft, ChevronRight,
  User, Building2, Palette, Settings,
  LogIn, Download, Ban, RefreshCw, ArrowUpDown,
  Clock, Filter, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  impersonate:     { label: 'Impersonate',     color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', Icon: LogIn },
  suspend:         { label: 'Suspend',          color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       Icon: Ban },
  reactivate:      { label: 'Reactivate',       color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   Icon: RefreshCw },
  plan_change:     { label: 'Plan Change',      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     Icon: ArrowUpDown },
  extend_trial:    { label: 'Extend Trial',     color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20',     Icon: Clock },
  export:          { label: 'Data Export',      color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   Icon: Download },
  settings_change: { label: 'Settings Change',  color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', Icon: Settings },
  theme_update:    { label: 'Theme Update',     color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20',     Icon: Palette },
  theme_toggle:    { label: 'Theme Toggle',     color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', Icon: Palette },
  tenant_update:   { label: 'Tenant Update',    color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20',       Icon: Building2 },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-gray-400 text-sm mt-1">
            All admin actions — {total.toLocaleString()} records total
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span className="text-indigo-300 text-sm font-medium">Tamper-proof</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-gray-300 text-sm font-medium">Filters</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {/* Action filter */}
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All actions</option>
            {ALL_ACTIONS.map(a => (
              <option key={a} value={a}>{ACTION_CONFIG[a]?.label ?? a}</option>
            ))}
          </select>

          {/* Target type filter */}
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All targets</option>
            <option value="tenant">Tenant</option>
            <option value="theme">Theme</option>
            <option value="settings">Settings</option>
            <option value="user">User</option>
          </select>

          {/* Admin email search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Admin email..."
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { setFilterEmail(emailInput); setPage(1); }
              }}
              className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-indigo-500 placeholder-gray-600"
            />
          </div>

          {/* Date from */}
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          />

          {/* Date to */}
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Loading audit log...
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Shield className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-400 font-medium">No audit records found</p>
            <p className="text-gray-600 text-sm mt-1">
              {hasFilters ? 'Try adjusting your filters' : 'Admin actions will appear here'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Target</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Detail</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Admin</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">IP</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {logs.map(log => {
                  const cfg = ACTION_CONFIG[log.action] ?? {
                    label: log.action, color: 'text-gray-400',
                    bg: 'bg-gray-800 border-gray-700', Icon: Shield,
                  };
                  const ActionIcon = cfg.Icon;
                  const TargetIcon = TARGET_ICONS[log.targetType] ?? Shield;
                  const meta = formatMeta(log);

                  return (
                    <tr key={log.id} className="hover:bg-gray-800/40 transition-colors">
                      {/* Action badge */}
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
                          cfg.bg, cfg.color
                        )}>
                          <ActionIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Target */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <TargetIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <div>
                            <p className="text-gray-200 text-sm font-medium leading-none">
                              {log.targetName ?? log.targetId ?? '—'}
                            </p>
                            <p className="text-gray-600 text-xs mt-0.5 capitalize">{log.targetType}</p>
                          </div>
                        </div>
                      </td>

                      {/* Metadata detail */}
                      <td className="px-4 py-3.5">
                        {meta ? (
                          <span className="text-gray-400 text-xs font-mono bg-gray-800 px-2 py-0.5 rounded">
                            {meta}
                          </span>
                        ) : (
                          <span className="text-gray-700 text-xs">—</span>
                        )}
                      </td>

                      {/* Admin */}
                      <td className="px-4 py-3.5">
                        <span className="text-gray-300 text-sm">{log.adminEmail}</span>
                      </td>

                      {/* IP */}
                      <td className="px-4 py-3.5">
                        <span className="text-gray-500 text-xs font-mono">
                          {log.ipAddress ?? '—'}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-gray-400 text-xs">{timeAgo(log.createdAt)}</p>
                          <p className="text-gray-600 text-xs mt-0.5">
                            {new Date(log.createdAt).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
                <p className="text-gray-500 text-sm">
                  Page {page} of {pages} — {total.toLocaleString()} records
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page - 2 + i;
                    if (p < 1 || p > pages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                          p === page
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
