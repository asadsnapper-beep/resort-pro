'use client';

import { useState, useEffect } from 'react';
import { PLAN_PRICING } from '@resort-pro/types';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  DollarSign, Loader2, AlertTriangle, Clock,
  TrendingUp, TrendingDown, Users, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Line,
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type MonthData = {
  month: string;
  label: string;
  mrr: number;
  newMrr: number;
  churnedMrr: number;
  expansionMrr: number;
  netMrr: number;
  payingCustomers: number;
};

type MrrMetrics = {
  currentMrr: number;
  arr: number;
  arpu: number;
  mrrGrowthRate: number;
  nrr: number;
  ltv: Record<string, number>;
  totalChurnedMrr: number;
  currentPayingCustomers: number;
};

type MrrGrowthData = {
  months: MonthData[];
  metrics: MrrMetrics;
};

type BillingData = {
  mrr: number;
  planBreakdown: Array<{ plan: string; planStatus: string; _count: { _all: number } }>;
  recentPaid: Array<{ id: string; name: string; slug: string; plan: string; currentPeriodEnd: string | null; stripeCustomerId: string | null }>;
  trialExpiringSoon: Array<{ id: string; name: string; slug: string; email: string | null; trialEndsAt: string | null }>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const planPrices: Record<string, number> = {
  FREE: PLAN_PRICING.FREE.monthlyUsd,
  STARTER: PLAN_PRICING.STARTER.monthlyUsd,
  PROFESSIONAL: PLAN_PRICING.PROFESSIONAL.monthlyUsd,
  ENTERPRISE: PLAN_PRICING.ENTERPRISE.monthlyUsd,
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: '#3b82f6',
  PROFESSIONAL: '#6366f1',
  ENTERPRISE: '#8b5cf6',
};

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function MrrTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-medium">${p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Metric Card ────────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, iconBg, iconColor, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: { value: string; up: boolean | null };
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-4.5 h-4.5 w-[18px] h-[18px]', iconColor)} />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
            trend.up === true ? 'text-emerald-400 bg-emerald-500/10' :
            trend.up === false ? 'text-red-400 bg-red-500/10' :
            'text-gray-400 bg-gray-800'
          )}>
            {trend.up === true ? <ArrowUpRight className="w-3 h-3" /> :
             trend.up === false ? <ArrowDownRight className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [growth, setGrowth] = useState<MrrGrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'mrr' | 'breakdown'>('mrr');

  useEffect(() => {
    Promise.all([
      adminEndpoints.billing(),
      adminEndpoints.getMrrGrowth(),
    ])
      .then(([bRes, gRes]) => {
        setBilling(bRes.data.data);
        setGrowth(gRes.data.data);
      })
      .catch(() => toast({ title: 'Failed to load billing data', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!billing || !growth) return null;

  const activePaid = billing.planBreakdown.filter(r => r.planStatus === 'active');
  const trialingCount = billing.planBreakdown.filter(r => r.planStatus === 'trialing').reduce((s, r) => s + r._count._all, 0);
  const paidCount = activePaid.reduce((s, r) => s + r._count._all, 0);
  const planRevenue = activePaid.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
    acc[r.plan] = acc[r.plan] || { count: 0, revenue: 0 };
    acc[r.plan].count += r._count._all;
    acc[r.plan].revenue += (planPrices[r.plan] || 0) * r._count._all;
    return acc;
  }, {});

  const { metrics, months } = growth;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & MRR</h1>
        <p className="text-gray-500 text-sm mt-1">Revenue analytics for ResortPro</p>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Monthly Recurring Revenue"
          value={`$${metrics.currentMrr.toLocaleString()}`}
          sub={`ARR: $${metrics.arr.toLocaleString()}`}
          icon={DollarSign}
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-400"
          trend={{
            value: `${metrics.mrrGrowthRate > 0 ? '+' : ''}${metrics.mrrGrowthRate}% vs last mo`,
            up: metrics.mrrGrowthRate > 0 ? true : metrics.mrrGrowthRate < 0 ? false : null,
          }}
        />
        <MetricCard
          label="Paying Customers"
          value={String(paidCount)}
          sub={`${trialingCount} on trial`}
          icon={Users}
          iconBg="bg-indigo-500/15"
          iconColor="text-indigo-400"
        />
        <MetricCard
          label="ARPU"
          value={`$${metrics.arpu}`}
          sub="Avg revenue per user"
          icon={BarChart3}
          iconBg="bg-blue-500/15"
          iconColor="text-blue-400"
        />
        <MetricCard
          label="Net Revenue Retention"
          value={`${metrics.nrr}%`}
          sub={metrics.nrr >= 100 ? 'Expansion exceeds churn' : 'Below 100% — churn present'}
          icon={metrics.nrr >= 100 ? TrendingUp : TrendingDown}
          iconBg={metrics.nrr >= 100 ? 'bg-cyan-500/15' : 'bg-amber-500/15'}
          iconColor={metrics.nrr >= 100 ? 'text-cyan-400' : 'text-amber-400'}
          trend={{
            value: metrics.nrr >= 100 ? 'Healthy' : 'Needs attention',
            up: metrics.nrr >= 100,
          }}
        />
      </div>

      {/* MRR Growth Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold">MRR Growth — Last 12 Months</h2>
            <p className="text-gray-500 text-xs mt-0.5">Based on tenant subscription data</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setChartView('mrr')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
                chartView === 'mrr' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              Total MRR
            </button>
            <button
              onClick={() => setChartView('breakdown')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
                chartView === 'breakdown' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              Breakdown
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          {chartView === 'mrr' ? (
            <ComposedChart data={months} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
                width={55}
              />
              <Tooltip content={<MrrTooltip />} />
              <Area
                type="monotone"
                dataKey="mrr"
                name="Total MRR"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#mrrGrad)"
                dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#6366f1' }}
              />
              <Line
                type="monotone"
                dataKey="payingCustomers"
                name="Customers"
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                yAxisId={0}
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={months} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
                width={55}
              />
              <Tooltip content={<MrrTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                iconType="square"
                iconSize={8}
              />
              <Bar dataKey="newMrr" name="New MRR" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="churnedMrr" name="Churned MRR" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Line
                type="monotone"
                dataKey="mrr"
                name="Total MRR"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>

        {/* Chart footer stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-800">
          <div className="text-center">
            <p className="text-emerald-400 font-bold text-lg">
              ${months.reduce((s, m) => s + m.newMrr, 0).toLocaleString()}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">New MRR (12mo)</p>
          </div>
          <div className="text-center">
            <p className="text-red-400 font-bold text-lg">
              ${metrics.totalChurnedMrr.toLocaleString()}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">Churned MRR (12mo)</p>
          </div>
          <div className="text-center">
            <p className={cn('font-bold text-lg', metrics.mrrGrowthRate >= 0 ? 'text-indigo-400' : 'text-red-400')}>
              {metrics.mrrGrowthRate > 0 ? '+' : ''}{metrics.mrrGrowthRate}%
            </p>
            <p className="text-gray-500 text-xs mt-0.5">MoM Growth</p>
          </div>
        </div>
      </div>

      {/* LTV + Revenue by Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LTV per plan */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-white font-semibold">LTV by Plan</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">estimated</span>
          </div>
          <div className="space-y-4">
            {Object.entries(metrics.ltv).filter(([, v]) => v > 0).map(([plan, ltv]) => (
              <div key={plan}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PLAN_COLORS[plan] || '#6b7280' }}
                    />
                    <span className="text-gray-300 text-sm font-medium">{plan}</span>
                    <span className="text-gray-600 text-xs">${planPrices[plan]}/mo</span>
                  </div>
                  <span className="text-white font-bold">${ltv.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (ltv / Math.max(...Object.values(metrics.ltv))) * 100)}%`,
                      backgroundColor: PLAN_COLORS[plan] || '#6b7280',
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="text-gray-700 text-xs pt-2">
              LTV = Plan Price ÷ Monthly Churn Rate
            </p>
          </div>
        </div>

        {/* Revenue by plan */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-5">Revenue by Plan</h2>
          {Object.keys(planRevenue).length === 0 ? (
            <p className="text-gray-500 text-sm">No paid subscriptions yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(planRevenue).map(([plan, { count, revenue }]) => (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{plan}</span>
                      <span className="text-gray-500 text-xs">{count} × ${planPrices[plan]}/mo</span>
                    </div>
                    <span className="text-emerald-400 font-semibold text-sm">${revenue.toLocaleString()}/mo</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((revenue / Math.max(billing.mrr, 1)) * 100)}%`,
                        backgroundColor: PLAN_COLORS[plan] || '#6366f1',
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
                <span className="text-gray-400 font-medium">Total MRR</span>
                <span className="text-white font-bold text-lg">${billing.mrr.toLocaleString()}/mo</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trial expiring soon + Active subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trial expiring */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-semibold">Trials Expiring Soon</h2>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-auto">
              {billing.trialExpiringSoon.length} in 7 days
            </span>
          </div>
          {billing.trialExpiringSoon.length === 0 ? (
            <p className="text-gray-500 text-sm">No trials expiring in the next 7 days.</p>
          ) : (
            <div className="space-y-3">
              {billing.trialExpiringSoon.map(t => {
                const daysLeft = t.trialEndsAt
                  ? Math.max(0, Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : 0;
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400 uppercase">
                      {t.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{t.name}</p>
                      <p className="text-gray-500 text-xs">{t.email || t.slug}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${daysLeft <= 2 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {daysLeft}d left
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active subscriptions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h2 className="text-white font-semibold">Active Subscriptions</h2>
          </div>
          {billing.recentPaid.length === 0 ? (
            <p className="text-gray-500 text-sm">No active subscriptions yet.</p>
          ) : (
            <div className="space-y-2">
              {billing.recentPaid.slice(0, 6).map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-800/50 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 uppercase shrink-0">
                    {t.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{t.name}</p>
                    <p className="text-gray-600 text-xs">
                      Renews: {t.currentPeriodEnd ? new Date(t.currentPeriodEnd).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-emerald-400 text-sm font-semibold">${planPrices[t.plan] ?? 0}/mo</p>
                    <p className="text-gray-600 text-xs">{t.plan}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
