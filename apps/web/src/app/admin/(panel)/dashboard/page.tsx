'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminEndpoints } from '@/lib/admin-api';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import {
  Building2, Users, BedDouble, CalendarDays,
  DollarSign, TrendingUp, Activity, Clock,
  Loader2, ExternalLink, AlertTriangle,
  ShieldAlert, ArrowRight, CheckCircle2,
  UserPlus, Zap, RefreshCw, Eye, TriangleAlert,
  TrendingDown, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

type FailedTenant = {
  id: string; name: string; slug: string; email: string | null;
  plan: string; amount: number; type: 'past_due' | 'trial_expired';
  daysOverdue: number | null; currentPeriodEnd: string | null; trialEndsAt?: string | null;
};
type FailedPaymentsData = {
  pastDue: FailedTenant[];
  expiredTrials: FailedTenant[];
  totalAtRisk: number;
};

type MrrMonth = {
  month: string;
  label: string;
  mrr: number;
  newMrr: number;
  churnedMrr: number;
  expansionMrr: number;
  netMrr: number;
  payingCustomers: number;
};

type ChurnRiskTenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planStatus: string;
  ownerLastLoginAt: string | null;
  churnRisk: {
    level: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    score: number;
    reasons: string[];
    daysSinceLogin: number | null;
    bookingsLast30: number;
    bookingsPrev30: number;
  };
};

type ChurnRiskData = {
  atRisk: ChurnRiskTenant[];
  summary: { total: number; high: number; medium: number; low: number };
};

const RISK_CONFIG = {
  HIGH:   { label: 'High Risk',   bg: 'bg-red-500/10',    border: 'border-red-500/20',    text: 'text-red-400',    dot: 'bg-red-500',    bar: 'bg-red-500' },
  MEDIUM: { label: 'Medium Risk', bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400',  dot: 'bg-amber-500',  bar: 'bg-amber-500' },
  LOW:    { label: 'Low Risk',    bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500', bar: 'bg-yellow-500' },
  NONE:   { label: 'Safe',        bg: 'bg-gray-800',      border: 'border-gray-700',      text: 'text-gray-400',   dot: 'bg-gray-600',   bar: 'bg-gray-600' },
};

type Stats = {
  totalTenants: number;
  activeTenants: number;
  trialingTenants: number;
  paidTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalBookings: number;
  totalRooms: number;
  mrr: number;
  recentTenants: Array<{
    id: string; name: string; slug: string;
    plan: string; planStatus: string; isActive: boolean; createdAt: string;
    trialEndsAt: string | null;
  }>;
  planBreakdown: Array<{ plan: string; count: number }>;
};

const PLAN_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  FREE:         { bg: 'bg-gray-700/50',       text: 'text-gray-400',  dot: 'bg-gray-500' },
  STARTER:      { bg: 'bg-blue-500/10',        text: 'text-blue-400',  dot: 'bg-blue-500' },
  PROFESSIONAL: { bg: 'bg-indigo-500/10',      text: 'text-indigo-400', dot: 'bg-indigo-500' },
  ENTERPRISE:   { bg: 'bg-purple-500/10',      text: 'text-purple-400', dot: 'bg-purple-500' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  trialing: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  active:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  past_due: { bg: 'bg-red-500/10',   text: 'text-red-400' },
  canceled: { bg: 'bg-gray-700/50',  text: 'text-gray-400' },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  href,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconBg: string;
  iconColor: string;
  href?: string;
  trend?: { value: string; up: boolean };
}) {
  const inner = (
    <div className={cn(
      'group bg-gray-900 border border-gray-800 rounded-2xl p-5 transition-all',
      href && 'hover:border-gray-700 cursor-pointer',
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        {href && (
          <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
        )}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
      {trend && (
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trend.up ? 'text-emerald-400' : 'text-red-400')}>
          <TrendingUp className={cn('w-3 h-3', !trend.up && 'rotate-180')} />
          {trend.value}
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function TrialProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [churnData, setChurnData] = useState<ChurnRiskData | null>(null);
  const [mrrGrowth, setMrrGrowth] = useState<MrrMonth[] | null>(null);
  const [failedPayments, setFailedPayments] = useState<FailedPaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [statsRes, churnRes, mrrRes, failedRes] = await Promise.all([
        adminEndpoints.stats(),
        adminEndpoints.getChurnRisk(),
        adminEndpoints.getMrrGrowth(),
        adminEndpoints.getFailedPayments(),
      ]);
      setStats(statsRes.data.data);
      setChurnData(churnRes.data.data);
      setMrrGrowth(mrrRes.data.data?.monthly ?? null);
      setFailedPayments(failedRes.data.data ?? null);
    } catch {
      toast({ title: 'Failed to load stats', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleImpersonate = async (tenantId: string, tenantName: string) => {
    setImpersonating(tenantId);
    try {
      const res = await adminEndpoints.impersonate(tenantId);
      const { token, refreshToken, user, tenant } = res.data.data;
      setAuth(user, tenant, token, refreshToken);
      toast({ title: `Logged in as ${tenantName}`, description: '2-hour session active.' });
      router.push('/dashboard');
    } catch {
      toast({ title: 'Login failed', variant: 'destructive' });
    } finally {
      setImpersonating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!stats) return null;

  const conversionRate = stats.totalTenants > 0
    ? Math.round((stats.paidTenants / stats.totalTenants) * 100)
    : 0;

  const trialConversionPotential = stats.mrr + (stats.trialingTenants * 49);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-gray-500 text-sm mt-1">ResortPro SaaS — real-time platform metrics</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Revenue row — most important first */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-indigo-900/40 to-indigo-800/20 border border-indigo-500/20 rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-indigo-300 font-medium">Monthly Recurring Revenue</p>
              <p className="text-4xl font-extrabold text-white mt-1">${stats.mrr.toLocaleString()}</p>
              <p className="text-indigo-400/70 text-sm mt-1">ARR: ${(stats.mrr * 12).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-indigo-500/15 grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-white">{stats.paidTenants}</p>
              <p className="text-xs text-indigo-300/60">Paying customers</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{conversionRate}%</p>
              <p className="text-xs text-indigo-300/60">Conversion rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">${trialConversionPotential.toLocaleString()}</p>
              <p className="text-xs text-indigo-300/60">Max potential MRR</p>
            </div>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-3">
          <KpiCard
            icon={Building2} label="Total Tenants"
            value={stats.totalTenants}
            sub={`${stats.activeTenants} active`}
            iconBg="bg-indigo-500/10" iconColor="text-indigo-400"
            href="/admin/tenants"
          />
          <KpiCard
            icon={Activity} label="On Trial"
            value={stats.trialingTenants}
            sub="Free trial accounts"
            iconBg="bg-amber-500/10" iconColor="text-amber-400"
          />
          <KpiCard
            icon={Users} label="Total Users"
            value={stats.totalUsers.toLocaleString()}
            iconBg="bg-blue-500/10" iconColor="text-blue-400"
            href="/admin/users"
          />
          <KpiCard
            icon={ShieldAlert} label="Suspended"
            value={stats.suspendedTenants}
            sub={stats.suspendedTenants > 0 ? 'Need attention' : 'All good'}
            iconBg="bg-red-500/10" iconColor="text-red-400"
          />
        </div>
      </div>

      {/* Smart Alerts — today's action list */}
      {(() => {
        const alerts: { level: 'red' | 'yellow' | 'blue'; text: string; action?: React.ReactNode }[] = [];

        // Failed payments
        if (failedPayments?.pastDue.length) {
          failedPayments.pastDue.forEach(t => {
            alerts.push({
              level: 'red',
              text: `${t.name} — $${t.amount}/mo payment failed${t.daysOverdue ? ` (${t.daysOverdue}d ago)` : ''}`,
              action: t.email ? (
                <a href={`mailto:${t.email}`} className="shrink-0 rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 transition-colors">
                  Email
                </a>
              ) : undefined,
            });
          });
        }

        // Trials ending in ≤ 3 days
        if (churnData?.atRisk) {
          const trialsEndingSoon = stats?.recentTenants.filter(t => {
            if (t.planStatus !== 'trialing' || !t.trialEndsAt) return false;
            const days = Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 86_400_000);
            return days <= 3 && days >= 0;
          }) ?? [];
          trialsEndingSoon.forEach(t => {
            const days = Math.ceil((new Date(t.trialEndsAt!).getTime() - Date.now()) / 86_400_000);
            alerts.push({
              level: 'yellow',
              text: `${t.name} trial ends in ${days === 0 ? 'today' : `${days}d`} — not yet converted`,
            });
          });
        }

        // High churn risk
        churnData?.atRisk.filter(t => t.churnRisk.level === 'HIGH').slice(0, 2).forEach(t => {
          alerts.push({
            level: 'blue',
            text: `${t.name} — high churn risk (${t.churnRisk.reasons[0] ?? 'inactive'})`,
            action: (
              <button
                onClick={() => handleImpersonate(t.id, t.name)}
                disabled={impersonating === t.id}
                className="shrink-0 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
              >
                {impersonating === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'View'}
              </button>
            ),
          });
        });

        if (alerts.length === 0) return null;

        const colorMap = {
          red:    { border: 'border-red-500/20',    bg: 'bg-red-500/8',    dot: 'bg-red-500',    text: 'text-red-300' },
          yellow: { border: 'border-amber-500/20',  bg: 'bg-amber-500/8',  dot: 'bg-amber-400',  text: 'text-amber-300' },
          blue:   { border: 'border-indigo-500/20', bg: 'bg-indigo-500/8', dot: 'bg-indigo-400', text: 'text-indigo-300' },
        };

        return (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Today's Action List</h2>
              <span className="ml-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                {alerts.length}
              </span>
            </div>
            <div className="space-y-2">
              {alerts.map((a, i) => {
                const c = colorMap[a.level];
                return (
                  <div key={i} className={cn('flex items-center gap-3 rounded-xl border px-4 py-2.5', c.border, c.bg)}>
                    <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full', c.dot)} />
                    <p className={cn('flex-1 text-xs font-medium', c.text)}>{a.text}</p>
                    {a.action}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Revenue Breakdown */}
      {mrrGrowth && mrrGrowth.length > 0 && (() => {
        const current = mrrGrowth[mrrGrowth.length - 1];
        const chartData = mrrGrowth.slice(-6).map(m => ({
          label: m.label.split(' ')[0], // short month name
          mrr: m.mrr,
          new: m.newMrr,
          churned: m.churnedMrr,
        }));
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* MRR Movement cards */}
            <div className="flex flex-col gap-3">
              {[
                {
                  label: 'New MRR', value: current.newMrr, icon: TrendingUp,
                  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20',
                  desc: 'New paying customers this month',
                },
                {
                  label: 'Churned MRR', value: current.churnedMrr, icon: TrendingDown,
                  color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20',
                  desc: 'Revenue lost this month',
                },
                {
                  label: 'Net MRR Change', value: current.netMrr, icon: Minus,
                  color: current.netMrr >= 0 ? 'text-blue-400' : 'text-orange-400',
                  bg: current.netMrr >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-orange-500/10 border-orange-500/20',
                  desc: 'New − Churned this month',
                },
              ].map(({ label, value, icon: Icon, color, bg, desc }) => (
                <div key={label} className={cn('flex items-center gap-4 rounded-xl border p-4', bg)}>
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900/60')}>
                    <Icon className={cn('h-4 w-4', color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={cn('text-xl font-bold', color)}>
                      {value < 0 ? '-' : value > 0 && label !== 'Net MRR Change' ? '+' : value > 0 ? '+' : ''}
                      ${Math.abs(value).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-600 truncate">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* MRR Trend Chart */}
            <div className="lg:col-span-2 rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">MRR Trend</p>
                  <p className="text-xs text-gray-500">{current.payingCustomers} paying customers · last 6 months</p>
                </div>
                <Link href="/admin/billing" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  Full report <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, 'MRR']}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#6366f1" fill="url(#mrrGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          icon={BedDouble} label="Total Rooms"
          value={stats.totalRooms.toLocaleString()}
          iconBg="bg-purple-500/10" iconColor="text-purple-400"
        />
        <KpiCard
          icon={CalendarDays} label="Total Bookings"
          value={stats.totalBookings.toLocaleString()}
          iconBg="bg-teal-500/10" iconColor="text-teal-400"
        />
        <KpiCard
          icon={TrendingUp} label="Avg Rooms/Tenant"
          value={stats.totalTenants > 0 ? (stats.totalRooms / stats.totalTenants).toFixed(1) : '0'}
          sub="Platform average"
          iconBg="bg-cyan-500/10" iconColor="text-cyan-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan breakdown with better visuals */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Plan Distribution</h2>
            <Link
              href="/admin/billing"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Revenue <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {stats.planBreakdown.length === 0 ? (
              <p className="text-gray-500 text-sm">No tenants yet.</p>
            ) : (
              stats.planBreakdown.map((p) => {
                const colors = PLAN_COLORS[p.plan] || PLAN_COLORS.FREE;
                return (
                  <div key={p.plan}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', colors.dot)} />
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', colors.bg, colors.text)}>
                          {p.plan}
                        </span>
                      </div>
                      <span className="text-white text-sm font-semibold">{p.count}</span>
                    </div>
                    <TrialProgressBar value={p.count} max={stats.totalTenants} />
                  </div>
                );
              })
            )}
          </div>

          {/* Quick stats below */}
          <div className="mt-5 pt-4 border-t border-gray-800 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-white font-bold">{conversionRate}%</p>
              <p className="text-xs text-gray-500 mt-0.5">Conversion</p>
            </div>
            <div>
              <p className="text-white font-bold">{stats.trialingTenants}</p>
              <p className="text-xs text-gray-500 mt-0.5">Trialing</p>
            </div>
            <div>
              <p className="text-white font-bold">{stats.suspendedTenants}</p>
              <p className="text-xs text-gray-500 mt-0.5">Suspended</p>
            </div>
          </div>
        </div>

        {/* Recent signups */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Recent Signups</h2>
            <Link href="/admin/tenants" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {stats.recentTenants.length === 0 ? (
              <p className="text-gray-500 text-sm">No tenants yet.</p>
            ) : (
              stats.recentTenants.map((t) => {
                const statusColor = STATUS_COLORS[t.planStatus] || STATUS_COLORS.canceled;
                const daysLeft = t.trialEndsAt
                  ? Math.max(0, Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : null;

                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 uppercase shrink-0">
                      {t.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">{t.name}</p>
                        {!t.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">SUSPENDED</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusColor.bg, statusColor.text)}>
                          {t.planStatus}
                        </span>
                        {daysLeft !== null && t.planStatus === 'trialing' && (
                          <span className={cn('text-[10px] font-medium', daysLeft <= 3 ? 'text-red-400' : 'text-gray-500')}>
                            {daysLeft}d left
                          </span>
                        )}
                        <span className="text-[10px] text-gray-600">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/admin/tenants`}
                        className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                        title="View tenant"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => handleImpersonate(t.id, t.name)}
                        disabled={impersonating === t.id || !t.isActive}
                        className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400 hover:text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-40"
                        title="Login as this tenant"
                      >
                        {impersonating === t.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Zap className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Failed Payments Queue */}
      {failedPayments && failedPayments.pastDue.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-gray-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Failed Payments</h2>
                <p className="text-xs text-gray-500">
                  ${failedPayments.totalAtRisk.toLocaleString()} at risk · {failedPayments.pastDue.length} tenant{failedPayments.pastDue.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Link href="/admin/billing" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
              Billing <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {failedPayments.pastDue.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-xs font-bold uppercase text-gray-300">
                  {t.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-gray-500">
                    {t.plan} · ${t.amount}/mo
                    {t.daysOverdue !== null && t.daysOverdue > 0 && (
                      <span className="ml-2 text-red-400">{t.daysOverdue}d overdue</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.email && (
                    <a
                      href={`mailto:${t.email}?subject=Your ResortPro payment failed`}
                      className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
                    >
                      Email
                    </a>
                  )}
                  <Link
                    href={`/admin/tenants`}
                    className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Churn Risk Widget */}
      {churnData && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
                <TriangleAlert className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Churn Risk</h2>
                <p className="text-gray-500 text-xs">Based on login activity + booking trends</p>
              </div>
            </div>
            <Link href="/admin/tenants" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              All tenants <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'High Risk', count: churnData.summary.high, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
              { label: 'Medium Risk', count: churnData.summary.medium, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
              { label: 'Low Risk', count: churnData.summary.low, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={cn('rounded-xl border px-4 py-3 text-center', bg)}>
                <p className={cn('text-2xl font-bold', color)}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* At-risk tenant rows */}
          {churnData.atRisk.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-gray-400 font-medium text-sm">All tenants look healthy!</p>
              <p className="text-gray-600 text-xs mt-1">No churn signals detected</p>
            </div>
          ) : (
            <div className="space-y-2">
              {churnData.atRisk.slice(0, 6).map(t => {
                const cfg = RISK_CONFIG[t.churnRisk.level];
                return (
                  <div key={t.id} className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border',
                    cfg.bg, cfg.border
                  )}>
                    {/* Risk score bar */}
                    <div className="w-8 h-8 rounded-lg bg-gray-900/60 flex items-center justify-center shrink-0">
                      <span className={cn('text-xs font-bold', cfg.text)}>{t.churnRisk.score}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white text-sm font-medium truncate">{t.name}</p>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0', cfg.bg, cfg.text, 'border', cfg.border)}>
                          {cfg.label}
                        </span>
                      </div>
                      {/* Reasons */}
                      <p className="text-gray-500 text-xs truncate">
                        {t.churnRisk.reasons.slice(0, 2).join(' · ')}
                      </p>
                      {/* Mini stats */}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-gray-600">
                          {t.churnRisk.daysSinceLogin !== null
                            ? `Last login: ${t.churnRisk.daysSinceLogin}d ago`
                            : 'Never logged in'}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          Bookings: {t.churnRisk.bookingsLast30} this month
                        </span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="w-20 shrink-0">
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', cfg.bar)}
                          style={{ width: `${t.churnRisk.score}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-0.5 text-right">{t.plan}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: Building2,
              label: 'Manage Tenants',
              sub: 'View, edit, suspend',
              href: '/admin/tenants',
              color: 'text-indigo-400',
              bg: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20',
            },
            {
              icon: DollarSign,
              label: 'Billing & MRR',
              sub: 'Revenue breakdown',
              href: '/admin/billing',
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20',
            },
            {
              icon: Users,
              label: 'All Users',
              sub: 'Search across tenants',
              href: '/admin/users',
              color: 'text-blue-400',
              bg: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20',
            },
            {
              icon: Zap,
              label: 'Platform Settings',
              sub: 'Plans, trial duration',
              href: '/admin/settings',
              color: 'text-amber-400',
              bg: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20',
            },
          ].map(({ icon: Icon, label, sub, href, color, bg }) => (
            <Link
              key={href}
              href={href}
              className={cn('flex items-center gap-3 p-4 rounded-xl border transition-colors', bg)}
            >
              <Icon className={cn('w-5 h-5 shrink-0', color)} />
              <div className="min-w-0">
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-xs text-gray-500 truncate">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
