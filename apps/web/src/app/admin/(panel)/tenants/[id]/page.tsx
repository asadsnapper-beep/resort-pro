'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminEndpoints } from '@/lib/admin-api';
import { useAdminStore } from '@/store/admin';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  Loader2, ArrowLeft, Building2, Flag,
  ToggleLeft, ToggleRight, Clock, User,
  CheckCircle2, AlertTriangle, Layers, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

interface FlagRow {
  flag: string;
  label: string;
  description: string;
  category: string;
  defaultOn: boolean;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface TenantFlagData {
  tenantId: string;
  tenantName: string;
  flags: FlagRow[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Analytics: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  AI:         'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Reporting:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  UX:         'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Beta:       'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
};

function timeAgo(iso: string | null) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

// ── Flag Toggle Row ────────────────────────────────────────────────────────

function FlagToggleRow({
  row,
  tenantId,
  canEdit,
  onToggled,
}: {
  row: FlagRow;
  tenantId: string;
  canEdit: boolean;
  onToggled: (flag: string, enabled: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    if (!canEdit || toggling) return;
    setToggling(true);
    try {
      await adminEndpoints.toggleTenantFlag(tenantId, row.flag, !row.enabled);
      onToggled(row.flag, !row.enabled);
      toast({
        title: `${row.label} ${!row.enabled ? 'enabled' : 'disabled'}`,
        description: `for ${row.flag}`,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className={cn(
      'flex items-start gap-4 px-5 py-4 border-b border-gray-800/60 last:border-0',
      'hover:bg-gray-800/30 transition-colors'
    )}>
      {/* Toggle */}
      <button
        onClick={toggle}
        disabled={!canEdit || toggling}
        className={cn('shrink-0 mt-0.5 transition-colors', canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}
      >
        {toggling
          ? <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          : row.enabled
            ? <ToggleRight className="w-6 h-6 text-indigo-400" />
            : <ToggleLeft className="w-6 h-6 text-gray-600" />
        }
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn('text-sm font-medium', row.enabled ? 'text-white' : 'text-gray-400')}>
            {row.label}
          </p>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', CATEGORY_COLORS[row.category] ?? CATEGORY_COLORS.Beta)}>
            {row.category}
          </span>
          {row.defaultOn && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-600 text-gray-500 font-medium">
              default on
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{row.description}</p>
        {row.updatedAt && (
          <p className="text-[10px] text-gray-700 mt-1">
            Changed {timeAgo(row.updatedAt)}
            {row.updatedBy && <> by <span className="text-gray-600">{row.updatedBy}</span></>}
          </p>
        )}
      </div>

      {/* Flag key chip */}
      <code className="text-[10px] font-mono text-gray-600 bg-gray-800 px-2 py-1 rounded shrink-0 hidden sm:block">
        {row.flag}
      </code>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TenantFlagsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { hasRole } = useAdminStore();
  const canEdit = hasRole(['SUPER_ADMIN', 'SUPPORT']);

  const [data, setData] = useState<TenantFlagData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    adminEndpoints.getTenantFlags(id)
      .then((r) => setData(r.data.data))
      .catch(() => toast({ title: 'Failed to load flags', variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleToggled = (flag: string, enabled: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        flags: prev.flags.map((f) =>
          f.flag === flag ? { ...f, enabled, updatedAt: new Date().toISOString(), updatedBy: 'you' } : f
        ),
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) return null;

  // Group by category
  const categories = Array.from(new Set(data.flags.map((f) => f.category)));
  const enabledCount = data.flags.filter((f) => f.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-500" />
            <h1 className="text-xl font-bold text-white">{data.tenantName}</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2 flex-wrap">
            <Flag className="w-3.5 h-3.5" />
            Feature Flags
            <span className="text-gray-700">·</span>
            <Link href={`/admin/tenants/${id}/enterprise`} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors text-xs font-medium">
              <Star className="w-3 h-3" /> Enterprise settings
            </Link>
            <span className="text-gray-600">·</span>
            <span className="text-indigo-400 font-medium">{enabledCount}</span>
            <span className="text-gray-600">of {data.flags.length} enabled</span>
          </p>
        </div>
      </div>

      {/* Permission notice for non-editors */}
      {!canEdit && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm">You have read-only access. SUPER_ADMIN or SUPPORT role required to toggle flags.</p>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(CATEGORY_COLORS).map(([cat, style]) => {
          const catFlags = data.flags.filter((f) => f.category === cat);
          const on = catFlags.filter((f) => f.enabled).length;
          return (
            <div key={cat} className={cn('rounded-xl border px-4 py-3', style.replace('text-', 'border-').split(' ')[0], 'bg-gray-900 border-gray-800')}>
              <p className={cn('text-xs font-semibold mb-1', style.split(' ')[0])}>{cat}</p>
              <p className="text-white text-lg font-bold">{on}<span className="text-gray-600 text-sm font-normal">/{catFlags.length}</span></p>
            </div>
          );
        })}
      </div>

      {/* Flags by category */}
      {categories.map((cat) => {
        const catFlags = data.flags.filter((f) => f.category === cat);
        return (
          <div key={cat} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800">
              <Layers className="w-3.5 h-3.5 text-gray-600" />
              <h2 className="text-gray-300 text-sm font-semibold">{cat}</h2>
              <span className="text-xs text-gray-600 ml-auto">
                {catFlags.filter((f) => f.enabled).length}/{catFlags.length} on
              </span>
            </div>
            {catFlags.map((row) => (
              <FlagToggleRow
                key={row.flag}
                row={row}
                tenantId={id}
                canEdit={canEdit}
                onToggled={handleToggled}
              />
            ))}
          </div>
        );
      })}

      {/* Usage hint */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-indigo-300 text-sm font-medium">Using flags in the tenant dashboard</p>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed font-mono">
              import {'{ useFeatureFlag }'} from {'\'@/hooks/use-feature-flag\''};{'\n'}
              const hasAnalytics = useFeatureFlag({'\'beta_analytics\''});
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
