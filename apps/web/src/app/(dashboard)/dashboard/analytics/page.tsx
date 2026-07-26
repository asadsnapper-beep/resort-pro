'use client';

import { useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { formatCurrency } from '@/lib/utils';
import {
  Banknote, TrendingUp, TrendingDown, BedDouble, Users,
  CalendarCheck, BarChart2, ArrowUp, ArrowDown, Loader2,
  Globe, Star, Clock, Receipt, PiggyBank,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kpis {
  ytdRevenue: number; mtdRevenue: number; revenueGrowth: number;
  occupancyRate: number; adr: number; revpar: number;
  totalBookings30: number; bookingGrowth: number; confirmedBookings: number;
  totalGuests: number; newGuests30: number; avgStayDays: number;
  // Expense KPIs (may be 0 if no expenses yet)
  mtdExpenses: number; expenseGrowth: number; profitMarginMTD: number;
}

interface Analytics {
  kpis: Kpis;
  revenueByMonth: { month: string; revenue: number }[];
  byRoomType: { type: string; bookings: number; revenue: number }[];
  bySources: { source: string; count: number }[];
  topNationalities: { country: string; count: number }[];
  expenseByCategory: { category: string; amount: number }[];
}

// ── Colors ────────────────────────────────────────────────────────────────────

const ROOM_COLORS = ['#23766a', '#d4a853', '#b8724a', 'var(--rp-text-accent)', '#7a5c2a', '#9bbdb7'];
const SOURCE_COLORS = ['#23766a', '#d4a853', '#b8724a', 'var(--rp-text-accent)', '#9bbdb7'];

const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite',
  VILLA: 'Villa', COTTAGE: 'Cottage', BUNGALOW: 'Bungalow',
};

// ── Shared tooltip style ──────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: { background: 'var(--rp-btn-accent)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 },
  labelStyle: { color: '#9bbdb7' },
  itemStyle: { color: 'var(--rp-btn-accent-text)' },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, change, icon: Icon, color, prefix,
}: {
  label: string; value: string | number; sub?: string; change?: number;
  icon: React.ElementType; color: string; prefix?: string;
}) {
  return (
    <div className="rounded-[14px] border bg-white p-5"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[9px]" style={{ background: color }}>
          <Icon className="w-[15px] h-[15px] text-white" />
        </div>
        {change !== undefined && (
          <span className="flex items-center gap-0.5 rounded-[7px] border px-[9px] py-[4px] text-[11px] font-semibold"
            style={change >= 0
              ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
              : { background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }}>
            {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-[22px] font-semibold text-[#18231f] tracking-[-0.02em]">
        {prefix}{value}
      </p>
      <p className="text-[12px] font-medium text-[#8aa29a] mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-[#c5bdb4] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border bg-white p-5"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div className="mb-4">
        <h3 className="text-[13.5px] font-semibold text-[#18231f]">{title}</h3>
        {sub && <p className="text-[11.5px] text-[#8aa29a] mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border px-3 py-2 text-xs shadow-xl"
      style={{ background: 'var(--rp-btn-accent)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <p className="text-[#9bbdb7] mb-1">{label}</p>
      <p className="text-[#dfd9d0] font-semibold">{formatCurrency(payload[0].value, currency)}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { tenant } = useAuthStore();
  const currency = (tenant as any)?.currency ?? 'BDT';
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<{ date: string; rate: number }[]>([]);

  useEffect(() => {
    Promise.all([
      dashboardApi.getAnalytics(),
      dashboardApi.getOccupancy(),
    ]).then(([a, o]) => {
      setData(a.data.data);
      setOccupancy(o.data.data);
    }).catch(() => {
      setError('Failed to load analytics. Please refresh the page.');
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#23766a' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[13px]" style={{ color: '#c43c3c' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, revenueByMonth, byRoomType, bySources, topNationalities, expenseByCategory } = data;

  const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
    SALARIES: '#6366f1', UTILITIES: '#22c55e', MAINTENANCE: '#f59e0b',
    CLEANING: '#14b8a6', FOOD_BEVERAGE: '#ec4899', SUPPLIES: '#8b5cf6',
    MARKETING: '#f97316', INSURANCE: '#06b6d4', RENT: '#84cc16',
    EQUIPMENT: '#a855f7', TRANSPORTATION: '#eab308', OTHER: '#94a3b8',
  };
  const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
    SALARIES: 'Salaries', UTILITIES: 'Utilities', MAINTENANCE: 'Maintenance',
    CLEANING: 'Cleaning', FOOD_BEVERAGE: 'Food & Bev', SUPPLIES: 'Supplies',
    MARKETING: 'Marketing', INSURANCE: 'Insurance', RENT: 'Rent',
    EQUIPMENT: 'Equipment', TRANSPORTATION: 'Transport', OTHER: 'Other',
  };

  // Trim occupancy to every-other-day labels to avoid crowding
  const occData = occupancy.filter((_, i) => i % 3 === 0 || i === occupancy.length - 1);

  return (
    <PageShell gap={6}>
      {/* Header */}
      <PageHeader
        title="Analytics"
        subtitle="Revenue, occupancy, guests, and booking insights"
      />

      {/* ── KPI Grid — Revenue & Operations ── */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-3">Revenue & Operations</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard icon={Banknote} color="#23766a"
            label="Revenue YTD" value={formatCurrency(kpis.ytdRevenue, currency)}
            sub={`${formatCurrency(kpis.mtdRevenue, currency)} this month`} change={kpis.revenueGrowth} />
          <KpiCard icon={BedDouble} color="#1b342f"
            label="Occupancy Rate" value={`${kpis.occupancyRate}%`} sub="Currently occupied" />
          <KpiCard icon={TrendingUp} color="#b89040"
            label="ADR" value={formatCurrency(kpis.adr, currency)} sub="Avg daily rate (90d)" />
          <KpiCard icon={Star} color="var(--rp-text-accent)"
            label="RevPAR" value={formatCurrency(kpis.revpar, currency)} sub="Revenue per avail. room" />
          <KpiCard icon={CalendarCheck} color="#23766a"
            label="Bookings (30d)" value={kpis.totalBookings30}
            sub={`${kpis.confirmedBookings} active now`} change={kpis.bookingGrowth} />
          <KpiCard icon={Users} color="#b8724a"
            label="Total Guests" value={kpis.totalGuests.toLocaleString()}
            sub={`+${kpis.newGuests30} new this month`} />
          <KpiCard icon={Clock} color="#23766a"
            label="Avg Stay" value={`${kpis.avgStayDays}d`} sub="Last 90 days" />
          <KpiCard icon={Globe} color="#7a5c2a"
            label="Nationalities" value={topNationalities.length} sub="Countries represented" />
        </div>
      </div>

      {/* ── KPI Grid — Expenses & Profitability ── */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-3">Expenses & Profitability</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KpiCard icon={Receipt} color="#c43c3c"
            label="Expenses (MTD)" value={formatCurrency(kpis.mtdExpenses ?? 0, currency)}
            sub="Total costs this month"
            change={kpis.expenseGrowth !== undefined ? -(kpis.expenseGrowth) : undefined} />
          <KpiCard
            icon={kpis.profitMarginMTD >= 0 ? PiggyBank : TrendingDown}
            color={kpis.profitMarginMTD >= 0 ? '#23766a' : '#c43c3c'}
            label="Net Profit (MTD)" value={formatCurrency((kpis.mtdRevenue ?? 0) - (kpis.mtdExpenses ?? 0), currency)}
            sub="Revenue minus expenses" />
          <KpiCard icon={BarChart2} color="var(--rp-text-accent)"
            label="Profit Margin" value={`${kpis.profitMarginMTD ?? 0}%`} sub="This month" />
        </div>
      </div>

      {/* ── Revenue trend ── */}
      <ChartCard title="Revenue — Last 12 Months" sub="Paid payments by month">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueByMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#23766a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#23766a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-surface-4)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => {
                const sym: Record<string,string> = { BDT:'৳',USD:'$',EUR:'€',GBP:'£',INR:'₹',AUD:'A$',CAD:'C$',SGD:'S$',AED:'د.إ',THB:'฿',IDR:'Rp',MYR:'RM',JPY:'¥',PHP:'₱' };
                const s = sym[currency] ?? currency;
                return `${s}${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`;
              }} />
            <Tooltip content={<RevenueTooltip currency={currency} />} />
            <Area type="monotone" dataKey="revenue" stroke="#23766a" strokeWidth={2} fill="url(#revGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Occupancy + Room breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy */}
        <ChartCard title="Occupancy Rate" sub="Last 30 days (%)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={occData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-surface-4)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Occupancy']}
                {...tooltipStyle}
              />
              <Line type="monotone" dataKey="rate" stroke="#23766a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Room type breakdown */}
        <ChartCard title="Revenue by Room Type" sub="Last 90 days">
          {byRoomType.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No booking data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byRoomType.map((r) => ({ ...r, type: ROOM_TYPE_LABELS[r.type] ?? r.type }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-surface-4)" />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v, currency), 'Revenue']}
                  {...tooltipStyle}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {byRoomType.map((_, i) => <Cell key={i} fill={ROOM_COLORS[i % ROOM_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Sources + Nationalities ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking sources */}
        <ChartCard title="Booking Sources" sub="Last 90 days">
          {bySources.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={bySources}
                  layout="vertical"
                  margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-surface-4)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="source" type="category" width={72} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [v, 'Bookings']} {...tooltipStyle} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {bySources.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-3">
                {bySources.map((s, i) => (
                  <div key={s.source} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                    <span className="text-xs text-gray-600">{s.source} ({s.count})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Top nationalities */}
        <ChartCard title="Guest Nationalities" sub="Top countries">
          {topNationalities.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No nationality data</div>
          ) : (
            <div className="space-y-2.5 mt-1">
              {topNationalities.map((n, i) => {
                const max = topNationalities[0].count;
                const pct = Math.round((n.count / max) * 100);
                return (
                  <div key={n.country} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-28 shrink-0 truncate">{n.country}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${Math.max(pct, 8)}%`, background: ROOM_COLORS[i % ROOM_COLORS.length] }}
                      >
                        <span className="text-[10px] text-white font-semibold">{n.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Expense breakdown by category ── */}
      {expenseByCategory && expenseByCategory.length > 0 && (
        <ChartCard title="Expenses by Category (MTD)" sub="This month's spend breakdown">
          <div className="flex gap-6 items-center">
            <ResponsiveContainer width="40%" height={200}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  labelLine={false}
                >
                  {expenseByCategory.map((c) => (
                    <Cell key={c.category} fill={EXPENSE_CATEGORY_COLORS[c.category] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v, currency)]}
                  labelFormatter={(l: string) => EXPENSE_CATEGORY_LABELS[l] ?? l}
                  {...tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {expenseByCategory.map((c) => {
                const total = expenseByCategory.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? Math.round((c.amount / total) * 100) : 0;
                return (
                  <div key={c.category} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: EXPENSE_CATEGORY_COLORS[c.category] ?? '#94a3b8' }} />
                    <span className="text-xs text-gray-600 flex-1">{EXPENSE_CATEGORY_LABELS[c.category] ?? c.category}</span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                    <span className="text-xs font-semibold text-gray-800">{formatCurrency(c.amount, currency)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>
      )}

      {/* ── Bookings by room type — count ── */}
      {byRoomType.length > 0 && (
        <ChartCard title="Bookings by Room Type" sub="Count — last 90 days">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {byRoomType.map((r, i) => (
              <div key={r.type} className="rounded-[10px] border p-3 text-center"
                style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
                <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: ROOM_COLORS[i % ROOM_COLORS.length] }} />
                <p className="text-[18px] font-semibold text-[#18231f]">{r.bookings}</p>
                <p className="text-[11.5px] text-[#8aa29a] mt-0.5">{ROOM_TYPE_LABELS[r.type] ?? r.type}</p>
                <p className="text-[10.5px] text-[#c5bdb4] mt-0.5">{formatCurrency(r.revenue, currency)}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </PageShell>
  );
}
