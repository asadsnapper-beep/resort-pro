'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminEndpoints } from '@/lib/admin-api';
import { useAdminStore } from '@/store/admin';
import { toast } from '@/hooks/use-toast';
import {
  Globe, CheckCircle2, XCircle, Clock, Shield, ShieldCheck,
  ShieldAlert, Loader2, Trash2, RefreshCw, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DomainTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  customDomain: string;
  domainVerified: boolean;
  domainVerifiedAt: string | null;
  sslStatus: string | null;
  sslProvisionedAt: string | null;
  sslExpiresAt: string | null;
  sslError: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  verified: number;
  sslActive: number;
  pending: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const SSL_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  active:       { label: 'Active',        icon: ShieldCheck, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  provisioning: { label: 'Provisioning',  icon: Shield,      cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  pending:      { label: 'Pending',       icon: Clock,       cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  error:        { label: 'Error',         icon: ShieldAlert, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  none:         { label: 'No SSL',        icon: Globe,       cls: 'text-gray-500 bg-gray-800 border-gray-700' },
};

function SslBadge({ status }: { status: string | null }) {
  const cfg = SSL_CONFIG[status ?? 'none'] ?? SSL_CONFIG.none;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', cfg.cls)}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3 border', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ── Domain Row ────────────────────────────────────────────────────────────────

function DomainRow({
  t, canEdit, onForceVerify, onRemove, onSslUpdate,
}: {
  t: DomainTenant;
  canEdit: boolean;
  onForceVerify: (id: string) => void;
  onRemove: (id: string, name: string, domain: string) => void;
  onSslUpdate: (id: string, domain: string) => void;
}) {
  const expiry = daysUntil(t.sslExpiresAt);
  const expiryWarning = expiry !== null && expiry < 30;

  return (
    <tr className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors group">
      {/* Tenant */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{t.name}</p>
            <p className="text-xs text-gray-600">{t.slug}</p>
          </div>
        </div>
      </td>

      {/* Domain */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5">
          <a
            href={`https://${t.customDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:text-indigo-300 font-mono transition-colors flex items-center gap-1"
          >
            {t.customDomain}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </td>

      {/* DNS verified */}
      <td className="px-4 py-4">
        {t.domainVerified ? (
          <div>
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
            {t.domainVerifiedAt && (
              <p className="text-[10px] text-gray-600 mt-0.5">
                {new Date(t.domainVerifiedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <div>
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Clock className="w-3.5 h-3.5" /> Unverified
            </span>
            {canEdit && (
              <button
                onClick={() => onForceVerify(t.id)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-0.5 flex items-center gap-0.5 transition-colors"
              >
                <RefreshCw className="w-2.5 h-2.5" /> Force verify
              </button>
            )}
          </div>
        )}
      </td>

      {/* SSL */}
      <td className="px-4 py-4">
        <SslBadge status={t.sslStatus} />
        {expiry !== null && (
          <p className={cn('text-[10px] mt-1', expiryWarning ? 'text-amber-400' : 'text-gray-600')}>
            {expiryWarning ? '⚠ ' : ''}Expires in {expiry}d
          </p>
        )}
        {t.sslError && (
          <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-32" title={t.sslError}>
            {t.sslError}
          </p>
        )}
        {canEdit && t.sslStatus !== 'active' && t.domainVerified && (
          <button
            onClick={() => onSslUpdate(t.id, t.customDomain)}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 mt-0.5 flex items-center gap-0.5 transition-colors"
          >
            <Shield className="w-2.5 h-2.5" /> Activate SSL
          </button>
        )}
      </td>

      {/* Plan */}
      <td className="px-4 py-4">
        <span className="text-xs text-gray-400">{t.plan}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/admin/tenants/${t.id}`}
            className="text-xs text-gray-500 hover:text-white border border-gray-700 px-2 py-1 rounded-lg transition-colors"
          >
            Flags
          </Link>
          {canEdit && (
            <button
              onClick={() => onRemove(t.id, t.name, t.customDomain)}
              className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DomainsPage() {
  const { hasRole } = useAdminStore();
  const canEdit = hasRole(['SUPER_ADMIN']);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<DomainTenant[]>([]);

  const load = () => {
    setLoading(true);
    adminEndpoints.getDomains()
      .then((r) => {
        setStats(r.data.data.stats);
        setTenants(r.data.data.tenants);
      })
      .catch(() => toast({ title: 'Failed to load domains', variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleForceVerify = async (id: string) => {
    try {
      await adminEndpoints.forceVerifyDomain(id);
      toast({ title: 'Domain force-verified ✓' });
      load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' });
    }
  };

  const handleRemove = async (id: string, name: string, domain: string) => {
    if (!confirm(`Remove domain "${domain}" from ${name}? This will also clear SSL status.`)) return;
    try {
      await adminEndpoints.removeDomain(id);
      toast({ title: 'Domain removed' });
      load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' });
    }
  };

  const handleActivateSsl = async (id: string, domain: string) => {
    try {
      // Simulate cert-manager callback: mark SSL active with 90-day expiry
      const sslExpiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
      await adminEndpoints.updateSslStatus(id, { sslStatus: 'active', sslExpiresAt });
      toast({ title: `SSL activated for ${domain}` });
      load();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.response?.data?.error, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-400" />
            Custom Domains
          </h1>
          <p className="text-gray-500 text-sm mt-1">DNS verification and SSL certificate management</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Globe}        label="Total domains"   value={stats.total}    color="bg-indigo-500/10 text-indigo-400 border-indigo-500/20" />
          <StatCard icon={CheckCircle2} label="DNS verified"    value={stats.verified} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20" />
          <StatCard icon={ShieldCheck}  label="SSL active"      value={stats.sslActive} color="bg-teal-500/10 text-teal-400 border-teal-500/20" />
          <StatCard icon={Clock}        label="Pending verify"  value={stats.pending}  color="bg-amber-500/10 text-amber-400 border-amber-500/20" />
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <h2 className="text-white font-semibold text-sm">All Custom Domains</h2>
          <span className="text-xs text-gray-600 ml-auto">{tenants.length} domains</span>
        </div>

        {tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No custom domains configured yet</p>
            <p className="text-gray-600 text-xs">Tenants can add custom domains in Dashboard → Settings → Custom Domain</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Tenant', 'Domain', 'DNS', 'SSL', 'Plan', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <DomainRow
                    key={t.id}
                    t={t}
                    canEdit={canEdit}
                    onForceVerify={handleForceVerify}
                    onRemove={handleRemove}
                    onSslUpdate={handleActivateSsl}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DNS instructions info box */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-white text-sm font-semibold">DNS Setup Instructions (for tenants)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500 leading-relaxed">
          <div>
            <p className="text-gray-400 font-semibold mb-1">Option A — CNAME (recommended)</p>
            <code className="block bg-gray-800 rounded-lg p-2 text-gray-300 font-mono">
              {'{your-domain}'} CNAME {'{slug}'}.resortpro.app
            </code>
            <p className="mt-1">Works for subdomains (e.g. www.resort.com, booking.resort.com)</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-1">Option B — A Record (root domains)</p>
            <code className="block bg-gray-800 rounded-lg p-2 text-gray-300 font-mono">
              {'{your-domain}'} A {'<server-ip>'}
            </code>
            <p className="mt-1">Required for apex domains (e.g. resort.com without www)</p>
          </div>
        </div>
        <p className="text-xs text-gray-600">DNS propagation takes 1–48 hours. SSL is auto-provisioned after DNS is verified via Let's Encrypt.</p>
      </div>
    </div>
  );
}
