'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, websiteApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import {
  BedDouble, CalendarCheck, CalendarX, TrendingUp, Users,
  Ticket, DollarSign, Sparkles, ArrowUp, ArrowDown, UtensilsCrossed,
  LogIn, LogOut, CheckCircle2, Clock, Wrench, Globe, Tag, AlertCircle, Banknote,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

type IconFamily = 'teal' | 'gold' | 'coral';

const ICON_STYLES: Record<IconFamily, { bg: string; color: string }> = {
  teal:  { bg: '#e3f2ef', color: '#23766a' },
  gold:  { bg: '#f4ecda', color: '#b89040' },
  coral: { bg: '#fceee4', color: '#b8724a' },
};

function HeroStatCard({
  title, value, unit, subtext, icon: Icon, family, dark = false,
}: {
  title: string; value: string | number; unit?: string;
  subtext?: string; icon: React.ElementType; family: IconFamily; dark?: boolean;
}) {
  const style = ICON_STYLES[family];
  return (
    <div
      className="rounded-[14px] p-[22px] border"
      style={{
        background: dark ? '#1b342f' : '#ffffff',
        borderColor: dark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.045)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em]" style={{ color: dark ? '#62847c' : '#8aa29a' }}>
          {title}
        </span>
        <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px]"
          style={{ background: dark ? 'rgba(255,255,255,0.08)' : style.bg }}>
          <Icon className="h-[13px] w-[13px]" strokeWidth={2.3} style={{ color: dark ? '#d4a853' : style.color }} />
        </div>
      </div>
      <div>
        <span className="text-[40px] font-semibold leading-none tracking-[-0.03em]"
          style={{ color: dark ? '#ece7df' : '#18231f' }}>
          {value}
        </span>
        {unit && <span className="ml-px text-[19px] font-normal" style={{ color: dark ? '#4a6e66' : '#8aa29a' }}>{unit}</span>}
      </div>
      {subtext && <p className="mt-[10px] text-[12px]" style={{ color: dark ? '#4a6e66' : '#8aa29a' }}>{subtext}</p>}
    </div>
  );
}

function CompactStatCard({
  title, value, icon: Icon, family,
}: {
  title: string; value: string | number; icon: React.ElementType; family: IconFamily;
}) {
  const style = ICON_STYLES[family];
  return (
    <div className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px]"
      style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.045)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
        style={{ background: style.bg }}>
        <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color: style.color }} />
      </div>
      <div>
        <div className="mb-[3px] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a]">{title}</div>
        <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#18231f]">{value}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: statsRes, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
    refetchInterval: 60000,
  });

  const { data: revenueRes } = useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: () => dashboardApi.getRevenue(),
  });

  const { data: occupancyRes } = useQuery({
    queryKey: ['dashboard-occupancy'],
    queryFn: () => dashboardApi.getOccupancy(),
  });

  const { data: todayRes } = useQuery({
    queryKey: ['today'],
    queryFn: () => dashboardApi.getToday(),
    refetchInterval: 60000,
  });

  const { data: websiteStatsRes } = useQuery({
    queryKey: ['website-stats'],
    queryFn: () => websiteApi.getStats(),
    refetchInterval: 300000, // refresh every 5 min
  });

  const stats = statsRes?.data?.data?.stats;
  const recentBookings = statsRes?.data?.data?.recentBookings || [];
  const lowStock = statsRes?.data?.data?.lowStockAlerts || [];
  const revenueData = revenueRes?.data?.data || [];
  const occupancyData = occupancyRes?.data?.data || [];
  const todayData = todayRes?.data?.data;
  const arrivals: any[] = todayData?.arrivals || [];
  const departures: any[] = todayData?.departures || [];
  const websiteStats = websiteStatsRes?.data?.data;
  const inHouseCount: number = todayData?.summary?.inHouseCount || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded-lg bg-gray-200 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })();
  const today = new Date().toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3 px-[2px] py-[2px]">
      {/* Header */}
      <div className="flex items-end justify-between mb-4 animate-fade-up">
        <div>
          <h1 className="font-display text-[27px] font-medium tracking-[-0.01em] text-[#18231f]">
            {greeting}, {user?.firstName}
          </h1>
          <p className="mt-[5px] text-[13px] text-[#7a9890]">
            {today}
          </p>
        </div>
        <a
          href="/dashboard/bookings/new"
          className="rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80"
          style={{ background: '#1b342f' }}
        >
          + New Booking
        </a>
      </div>

      {/* Stat Cards & Charts — hidden for housekeeping staff */}
      {user?.role === 'STAFF' && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800 px-5 py-6 flex items-center gap-4">
          <Sparkles className="h-8 w-8 text-yellow-500 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800 dark:text-yellow-300">Your Tasks</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">Head to <a href="/dashboard/housekeeping" className="underline font-medium">Housekeeping</a> to view and update your assigned tasks for today.</p>
          </div>
        </div>
      )}
      {user?.role === 'CHEF' && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 px-5 py-6 flex items-center gap-4">
          <UtensilsCrossed className="h-8 w-8 text-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Kitchen Orders</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">Head to <a href="/dashboard/orders" className="underline font-medium">F&B Orders</a> to view incoming orders and update their status.</p>
          </div>
        </div>
      )}
      {user?.role !== 'STAFF' && user?.role !== 'CHEF' && <>
      {/* Primary stat cards — 4 hero */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-up [animation-delay:60ms]">
        <HeroStatCard
          title="Occupancy" value={stats?.occupancyRate || 0} unit="%"
          subtext={`${stats?.totalRooms || 0} rooms · ${Math.round(((stats?.occupancyRate || 0) / 100) * (stats?.totalRooms || 0))} occupied`}
          icon={TrendingUp} family="teal"
        />
        <HeroStatCard
          title="Check-ins Today" value={stats?.todayCheckIns || 0}
          subtext="Confirmed arrivals"
          icon={CalendarCheck} family="teal"
        />
        <HeroStatCard
          title="Check-outs Today" value={stats?.todayCheckOuts || 0}
          subtext={`${inHouseCount} currently in-house`}
          icon={CalendarX} family="teal"
        />
        {['OWNER', 'MANAGER', 'SHAREHOLDER'].includes(user?.role ?? '') ? (
          <HeroStatCard
            title="Monthly Revenue" value={formatCurrency(stats?.monthlyRevenue || 0)}
            subtext={stats?.revenueGrowth !== undefined ? `${stats.revenueGrowth >= 0 ? '+' : ''}${stats.revenueGrowth}% vs last month` : undefined}
            icon={Banknote} family="gold" dark
          />
        ) : (
          <HeroStatCard
            title="Active Bookings" value={stats?.activeBookings || 0}
            subtext="Currently active"
            icon={Users} family="gold"
          />
        )}
      </div>

      {/* Secondary compact cards — 5 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 animate-fade-up [animation-delay:110ms]">
        <CompactStatCard title="Active Bookings" value={stats?.activeBookings || 0} icon={Users} family="gold" />
        <CompactStatCard title="Total Rooms" value={stats?.totalRooms || 0} icon={BedDouble} family="teal" />
        <CompactStatCard title="Open Tickets" value={stats?.openTickets || 0} icon={AlertCircle} family="coral" />
        <CompactStatCard title="Pending Clean" value={stats?.pendingHousekeeping || 0} icon={Sparkles} family="teal" />
        <CompactStatCard title="Maintenance" value={(stats as { openMaintenance?: number })?.openMaintenance || 0} icon={Wrench} family="teal" />
      </div>

      {/* Today's Arrivals & Departures */}
      <div className="grid gap-3 lg:grid-cols-2 animate-fade-up [animation-delay:160ms]">
        {/* Arrivals */}
        <div className="rounded-[14px] border overflow-hidden" style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.045)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between border-b px-5 py-[15px]" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-2">
              <LogIn className="h-[13px] w-[13px] text-[#23766a]" strokeWidth={2.5} />
              <span className="text-[13px] font-semibold text-[#18231f]">Today's Arrivals</span>
              <span className="rounded-full bg-[#e3f2ef] px-2 py-px text-[11px] font-semibold text-[#23766a]">{arrivals.length}</span>
            </div>
            <a href="/dashboard/bookings?status=CONFIRMED" className="text-[12px] font-medium text-[#23766a] hover:underline">View all →</a>
          </div>
          {arrivals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-gray-200" />
              <p className="text-[13px] text-[#8aa29a]">No arrivals today</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
              {arrivals.map((b: any) => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#faf9f7] transition-colors">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#e3f2ef] text-[12px] font-semibold text-[#23766a]">
                    {b.guest.firstName[0]}{b.guest.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#18231f] truncate">{b.guest.firstName} {b.guest.lastName}</p>
                    <p className="mt-0.5 text-[12px] text-[#8aa29a]">Room {b.room.number} · {b.nights} nights</p>
                  </div>
                  {b.status === 'CHECKED_IN' ? (
                    <span className="rounded-[7px] border border-[#23766a]/20 bg-[#e3f2ef] px-[11px] py-[5px] text-[11.5px] font-medium text-[#23766a]">In</span>
                  ) : (
                    <div className="flex items-center gap-[5px] rounded-[7px] border border-[#c9a04a]/20 bg-[#fef5e7] px-[11px] py-[5px]">
                      <div className="h-[5px] w-[5px] rounded-full bg-[#c9a04a]" />
                      <span className="text-[11.5px] font-medium text-[#a8843a]">Due</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Departures */}
        <div className="rounded-[14px] border overflow-hidden" style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.045)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between border-b px-5 py-[15px]" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-2">
              <LogOut className="h-[13px] w-[13px] text-[#23766a]" strokeWidth={2.5} />
              <span className="text-[13px] font-semibold text-[#18231f]">Today's Departures</span>
              <span className="rounded-full bg-[#e3f2ef] px-2 py-px text-[11px] font-semibold text-[#23766a]">{departures.length}</span>
            </div>
            <span className="text-[12px] text-[#8aa29a]">{inHouseCount} in-house</span>
          </div>
          {departures.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-gray-200" />
              <p className="text-[13px] text-[#8aa29a]">No departures today</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
              {departures.map((b: any) => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#faf9f7] transition-colors">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#e3f2ef] text-[12px] font-semibold text-[#23766a]">
                    {b.guest.firstName[0]}{b.guest.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#18231f] truncate">{b.guest.firstName} {b.guest.lastName}</p>
                    <p className="mt-0.5 text-[12px] text-[#8aa29a]">Room {b.room.number} · {b.nights}n stay</p>
                  </div>
                  {b.status === 'CHECKED_OUT' ? (
                    <span className="rounded-[7px] border border-black/8 bg-[#f5f4f1] px-[11px] py-[5px] text-[11.5px] font-medium text-[#8aa29a]">Out</span>
                  ) : (
                    <div className="flex items-center gap-[5px] rounded-[7px] border border-[#c9a04a]/20 bg-[#fef5e7] px-[11px] py-[5px]">
                      <div className="h-[5px] w-[5px] rounded-full bg-[#c9a04a]" />
                      <span className="text-[11.5px] font-medium text-[#a8843a]">Pending</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-3 lg:grid-cols-2 animate-fade-up [animation-delay:210ms]">
        {/* Revenue Chart */}
        <div className="rounded-[14px] border px-[22px] py-[18px]"
          style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.045)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#18231f]">Revenue</p>
              <p className="text-[11px] text-[#8aa29a]">Last 12 months</p>
            </div>
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[#e3f2ef]">
              <TrendingUp className="h-[12px] w-[12px] text-[#23766a]" strokeWidth={2.5} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#23766a" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#23766a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8aa29a' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8aa29a' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), 'Revenue']}
                contentStyle={{ background: '#1b342f', border: 'none', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#9bbdb7' }}
                itemStyle={{ color: '#ece7df' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#23766a" fill="url(#revenueGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy Chart */}
        <div className="rounded-[14px] border px-[22px] py-[18px]"
          style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.045)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#18231f]">Occupancy Rate</p>
              <p className="text-[11px] text-[#8aa29a]">Last 14 days</p>
            </div>
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[#f4ecda]">
              <BedDouble className="h-[12px] w-[12px] text-[#b89040]" strokeWidth={2.5} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={occupancyData.slice(-14)} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8aa29a' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8aa29a' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Occupancy']}
                contentStyle={{ background: '#1b342f', border: 'none', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#9bbdb7' }}
                itemStyle={{ color: '#ece7df' }}
              />
              <Bar dataKey="rate" fill="#23766a" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Website Visitors Widget (optional — only shows if tracking data exists) */}
      {websiteStats && (websiteStats.total30d > 0 || true) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-500" />
              Website Visitors
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-gray-700">{websiteStats.todayViews} today</span>
              <span>·</span>
              <span>{websiteStats.total30d} last 30 days</span>
              <a href="/dashboard/website" className="text-indigo-600 hover:underline ml-1">Edit site →</a>
            </div>
          </CardHeader>
          <CardContent>
            {websiteStats.total30d === 0 ? (
              <div className="flex flex-col items-center py-4 gap-2 text-center">
                <Globe className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-muted-foreground">No visitors yet. Share your booking website to start tracking.</p>
                <a href="/dashboard/website" className="text-xs text-indigo-600 hover:underline">Set up your website →</a>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={websiteStats.chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="visitorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    formatter={(v: number) => [v, 'Visitors']}
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#9ca3af' }}
                    itemStyle={{ color: '#e5e7eb' }}
                  />
                  <Area type="monotone" dataKey="views" stroke="#6366f1" fill="url(#visitorGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Bookings + Low Stock */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Bookings</CardTitle>
            <a href="/dashboard/bookings" className="text-xs text-resort-600 hover:underline">View all</a>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent bookings</p>
              ) : (
                recentBookings.map((booking: Record<string, unknown>) => (
                  <div key={booking.id as string} className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(booking.guest as { firstName: string; lastName: string })?.firstName} {(booking.guest as { firstName: string; lastName: string })?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(booking.room as { name: string })?.name} · {formatDate(booking.checkIn as string)} → {formatDate(booking.checkOut as string)}
                      </p>
                    </div>
                    <StatusBadge status={booking.status as string} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">All stock levels OK</p>
              ) : (
                lowStock.map((item: Record<string, unknown>) => (
                  <div key={item.id as string} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.name as string}</p>
                      <p className="text-xs text-muted-foreground">{String(item.currentStock)} {item.unit as string} left</p>
                    </div>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Low</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </>} {/* end non-STAFF block */}
    </div>
  );
}
