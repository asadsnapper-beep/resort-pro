'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Star, Building2, Shield, Palette,
  CheckCircle2, Clock, XCircle, ArrowRight,
  FileText, Wifi, Lock, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface SlaSummary {
  tier: string;
  uptimePercent: number;
  responseTimeH: number;
  contractStart: string;
  contractEnd: string | null;
  signedAt: string | null;
}

interface EnterpriseTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  whitelabelEnabled: boolean;
  ssoEnabled: boolean;
  ssoProvider: string | null;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
  createdAt: string;
  slaAgreement: SlaSummary | null;
}

interface Stats {
  totalTenants: number;
  enterpriseTenants: number;
  activeSlas: number;
  ssoEnabled: number;
  onboardingComplete: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  'Account Created',
  'Profile Complete',
  'SSO Configured',
  'White-label Active',
  'SLA Signed',
  'Training Done',
  'Go-live',
];

const TIER_STYLE: Record<string, string> = {
  ENTERPRISE: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  PROFESSIONAL: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  BASIC: 'text-gray-400 bg-gray-800 border-gray-700',
};

const SSO_ICON: Record<string, string> = {
  google: 'G',
  microsoft: 'M',
  okta: 'O',
  saml: 'S',
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

// ── Onboarding Progress Bar ───────────────────────────────────────────────────

function OnboardingBar({ step, completed }: { step: number; completed: boolean }) {
  const pct = Math.round((step / 6) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', completed ? 'bg-emerald-500' : 'bg-indigo-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 shrink-0 w-8">{pct}%</span>
    </div>
  );
}

// ── Tenant Row ────────────────────────────────────────────────────────────────

function TenantRow({ t }: { t: EnterpriseTenant }) {
  const slaTier = t.slaAgreement?.tier ?? null;

  return (
    <tr className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors group">
      {/* Name */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Star className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{t.name}</p>
            <p className="text-xs text-gray-600">{t.slug}</p>
          </div>
        </div>
      </td>

      {/* SLA */}
      <td className="px-4 py-4">
        {slaTier ? (
          <div>
            <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', TIER_STYLE[slaTier] ?? TIER_STYLE.BASIC)}>
              {slaTier}
            </span>
            <p className="text-[10px] text-gray-600 mt-1">
              {t.slaAgreement!.uptimePercent}% · {t.slaAgreement!.responseTimeH}h SLA
            </p>
          </div>
        ) : (
          <span className="text-xs text-gray-600 italic">No SLA</span>
        )}
      </td>

      {/* SSO */}
      <td className="px-4 py-4">
        {t.ssoEnabled ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-[9px] font-bold text-emerald-400">
                {SSO_ICON[t.ssoProvider ?? ''] ?? '?'}
              </span>
            </div>
            <span className="text-xs text-emerald-400 capitalize">{t.ssoProvider}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>

      {/* White-label */}
      <td className="px-4 py-4">
        {t.whitelabelEnabled
          ? <span className="flex items-center gap-1 text-xs text-purple-400"><Palette className="w-3 h-3" /> Active</span>
          : <span className="text-xs text-gray-600">—</span>
        }
      </td>

      {/* Onboarding */}
      <td className="px-4 py-4 w-40">
        <p className="text-[10px] text-gray-500 mb-1">
          {t.onboardingCompletedAt
            ? <span className="text-emerald-400 font-medium">✓ Complete</span>
            : ONBOARDING_STEPS[t.onboardingStep] ?? 'Unknown'}
        </p>
        <OnboardingBar step={t.onboardingStep} completed={!!t.onboardingCompletedAt} />
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        {t.isActive
          ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span>
          : <span className="text-xs text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Suspended</span>
        }
      </td>

      {/* Action */}
      <td className="px-4 py-4 text-right">
        <Link
          href={`/admin/tenants/${t.id}/enterprise`}
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Manage <ArrowRight className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EnterprisePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<EnterpriseTenant[]>([]);

  useEffect(() => {
    adminEndpoints.getEnterpriseSummary()
      .then((r) => {
        setStats(r.data.data.stats);
        setTenants(r.data.data.tenants);
      })
      .catch(() => toast({ title: 'Failed to load enterprise data', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-400" />
          Enterprise
        </h1>
        <p className="text-gray-500 text-sm mt-1">SLA agreements, white-label branding, and SSO configuration</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard icon={Building2} label="Enterprise tenants" value={stats.enterpriseTenants}
            sub={`of ${stats.totalTenants} total`} color="bg-amber-500/10 text-amber-400 border border-amber-500/20" />
          <StatCard icon={FileText} label="Active SLAs" value={stats.activeSlas} color="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" />
          <StatCard icon={Lock} label="SSO enabled" value={stats.ssoEnabled} color="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" />
          <StatCard icon={Palette} label="White-label" value={tenants.filter((t) => t.whitelabelEnabled).length} color="bg-purple-500/10 text-purple-400 border border-purple-500/20" />
          <StatCard icon={CheckCircle2} label="Onboarding done" value={stats.onboardingComplete} color="bg-teal-500/10 text-teal-400 border border-teal-500/20" />
        </div>
      )}

      {/* Tenants table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" />
          <h2 className="text-white font-semibold text-sm">Enterprise Tenants</h2>
          <span className="text-xs text-gray-600 ml-auto">{tenants.length} accounts</span>
        </div>

        {tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">No enterprise tenants yet</p>
            <p className="text-gray-600 text-xs">Upgrade a tenant to ENTERPRISE plan to see them here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Tenant', 'SLA', 'SSO', 'White-label', 'Onboarding', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => <TenantRow key={t.id} t={t} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-amber-300 text-sm font-medium">Managing enterprise features</p>
            <p className="text-gray-500 text-xs leading-relaxed">
              Click <span className="text-gray-300">"Manage"</span> on any row to configure SLA terms, white-label branding,
              SSO credentials, and track the onboarding checklist for that tenant.
              Only <span className="text-indigo-400">SUPER_ADMIN</span> can write SLA / SSO / white-label settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
