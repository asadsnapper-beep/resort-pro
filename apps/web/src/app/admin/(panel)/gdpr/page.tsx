'use client';

import { useEffect, useState } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  ShieldCheck, Loader2, AlertTriangle, Clock,
  CheckCircle2, Trash2, Download, XCircle, RefreshCw,
  FileJson, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

interface ErasureRequest {
  id: string;
  name: string;
  slug: string;
  plan: string;
  gdprErasureRequestedAt: string;
  gdprErasureRequestedBy: string | null;
  gdprAnonymizedAt: string | null;
  deletedAt: string | null;
  isActive: boolean;
}

interface GdprData {
  pending: number;
  requests: ErasureRequest[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function daysUntilErasure(requestedAt: string) {
  const elapsed = (Date.now() - new Date(requestedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(30 - elapsed));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusOf(r: ErasureRequest) {
  if (r.gdprAnonymizedAt) return 'anonymized';
  const days = daysUntilErasure(r.gdprErasureRequestedAt);
  if (days === 0) return 'due';
  return 'pending';
}

const STATUS_BADGE = {
  pending:    { label: 'Pending',    color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  due:        { label: 'Due Now',    color: 'text-red-400 bg-red-500/10 border-red-500/25' },
  anonymized: { label: 'Anonymized', color: 'text-gray-500 bg-gray-700/40 border-gray-700' },
};

// ── Row component ──────────────────────────────────────────────────────────

function RequestRow({ r, onRefresh }: { r: ErasureRequest; onRefresh: () => void }) {
  const status = statusOf(r);
  const badge = STATUS_BADGE[status];
  const daysLeft = status === 'pending' ? daysUntilErasure(r.gdprErasureRequestedAt) : null;
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    setBusy('export');
    try {
      const res = await adminEndpoints.gdprExport(r.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-export-${r.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export downloaded' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn(
      'bg-gray-900 border rounded-2xl p-5 space-y-3',
      status === 'anonymized' ? 'border-gray-800 opacity-60' : 'border-gray-700'
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <p className={cn('text-sm font-semibold', status === 'anonymized' ? 'text-gray-500 line-through' : 'text-white')}>
              {r.name}
            </p>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', badge.color)}>
              {badge.label}
            </span>
          </div>
          <p className="text-gray-600 text-xs font-mono mt-0.5">{r.slug} · {r.plan}</p>
        </div>

        {/* Actions */}
        {status !== 'anonymized' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExport}
              disabled={!!busy}
              title="Export data as JSON"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              {busy === 'export' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileJson className="w-3 h-3" />}
              Export JSON
            </button>
            <button
              onClick={() => run('cancel', () => adminEndpoints.cancelErasure(r.id))}
              disabled={!!busy}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
            >
              {busy === 'cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Cancel Erasure
            </button>
            <button
              onClick={() => {
                if (!confirm(`Immediately anonymize "${r.name}"? This is irreversible.`)) return;
                run('now', () => adminEndpoints.anonymizeNow(r.id));
              }}
              disabled={!!busy}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {busy === 'now' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Anonymize Now
            </button>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Requested {formatDate(r.gdprErasureRequestedAt)}
          {r.gdprErasureRequestedBy && <> by <span className="text-gray-500">{r.gdprErasureRequestedBy}</span></>}
        </span>
        {status === 'pending' && (
          <span className={cn('flex items-center gap-1 font-medium', daysLeft! <= 5 ? 'text-red-400' : 'text-amber-400')}>
            <AlertTriangle className="w-3 h-3" />
            {daysLeft} day{daysLeft !== 1 ? 's' : ''} until auto-anonymization
          </span>
        )}
        {status === 'due' && (
          <span className="flex items-center gap-1 text-red-400 font-medium">
            <AlertTriangle className="w-3 h-3" />
            Grace period expired — run purge job to anonymize
          </span>
        )}
        {r.gdprAnonymizedAt && (
          <span className="flex items-center gap-1 text-gray-500">
            <CheckCircle2 className="w-3 h-3" />
            Anonymized {formatDate(r.gdprAnonymizedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function GdprPage() {
  const [data, setData] = useState<GdprData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminEndpoints.getGdprRequests()
      .then((r) => setData(r.data.data))
      .catch(() => toast({ title: 'Failed to load GDPR requests', variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const pending = data?.requests.filter((r) => !r.gdprAnonymizedAt) ?? [];
  const done = data?.requests.filter((r) => !!r.gdprAnonymizedAt) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            GDPR Compliance
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage erasure requests · Article 17 (Right to Erasure) · Article 20 (Data Portability)</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Erasures', value: pending.filter((r) => statusOf(r) === 'pending').length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Due for Anonymization', value: pending.filter((r) => statusOf(r) === 'due').length, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Completed', value: done.length, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-400/80 space-y-1 leading-relaxed">
            <p><strong className="text-indigo-300">30-day grace period:</strong> After an erasure request, tenant has 30 days to cancel before data is permanently anonymized.</p>
            <p><strong className="text-indigo-300">Purge job:</strong> Run <code className="bg-indigo-900/50 px-1 rounded">npx tsx src/scripts/gdpr-purge.ts</code> daily (cron) to auto-anonymize expired requests.</p>
            <p><strong className="text-indigo-300">Anonymization:</strong> Replaces PII (names, emails, phone, passport IDs) with hashed placeholders. Financial records are preserved for accounting compliance.</p>
          </div>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Active Requests ({pending.length})
          </h2>
          {pending.map((r) => <RequestRow key={r.id} r={r} onRefresh={load} />)}
        </div>
      )}

      {/* Done */}
      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-gray-600 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Completed ({done.length})
          </h2>
          {done.map((r) => <RequestRow key={r.id} r={r} onRefresh={load} />)}
        </div>
      )}

      {/* Empty */}
      {!data?.requests.length && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldCheck className="w-12 h-12 text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">No erasure requests</p>
          <p className="text-gray-600 text-sm mt-1">Tenants or admins can submit erasure requests (Article 17)</p>
        </div>
      )}
    </div>
  );
}
