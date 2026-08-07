'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { dashboardApi, websiteApi, bookingsApi, attendanceApi } from '@/lib/api';
import { NewBookingModal } from '@/components/bookings/NewBookingModal';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import {
  BedDouble, CalendarCheck, CalendarX, TrendingUp, Users,
  Ticket, Sparkles, ArrowUp, ArrowDown, UtensilsCrossed,
  LogIn, LogOut, CheckCircle2, Clock, Wrench, Globe, Tag, AlertCircle, Banknote,
  ClipboardList, CalendarDays, LayoutGrid, ChevronRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

type IconFamily = 'teal' | 'gold' | 'coral';

const ICON_STYLES: Record<IconFamily, { bg: string; color: string }> = {
  teal:  { bg: 'var(--rp-teal-bg)', color: '#183153' },
  gold:  { bg: 'var(--rp-amber-bg)', color: '#b89040' },
  coral: { bg: 'var(--rp-coral-bg)', color: '#b8724a' },
};

function ClockWidget() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['attendance-today'], queryFn: () => attendanceApi.myToday() });
  const attendance = data?.data?.data as { clockIn?: string; clockOut?: string; status?: string; hoursWorked?: number } | null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
  const clockInMutation = useMutation({
    mutationFn: () => attendanceApi.clockIn(),
    onSuccess: (res) => { invalidate(); toast({ title: res.data.message }); },
    onError: (err: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: err?.response?.data?.error, variant: 'destructive' }),
  });
  const clockOutMutation = useMutation({
    mutationFn: () => attendanceApi.clockOut(),
    onSuccess: () => { invalidate(); toast({ title: 'Clocked out' }); },
    onError: (err: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: err?.response?.data?.error, variant: 'destructive' }),
  });

  if (isLoading) return null;

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  if (!attendance?.clockIn) {
    return (
      <button onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}
        className="flex items-center gap-1.5 rounded-[9px] border px-3 py-[9px] text-[13px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-50"
        style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
        <LogIn className="h-[13px] w-[13px]" /> Clock In
      </button>
    );
  }
  if (!attendance.clockOut) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px]" style={{ color: attendance.status === 'LATE' ? '#c43c3c' : 'var(--rp-text-muted)' }}>
          In at {fmtTime(attendance.clockIn)}{attendance.status === 'LATE' ? ' (Late)' : ''}
        </span>
        <button onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending}
          className="flex items-center gap-1.5 rounded-[9px] border px-3 py-[9px] text-[13px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-50"
          style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
          <LogOut className="h-[13px] w-[13px]" /> Clock Out
        </button>
      </div>
    );
  }
  return (
    <span className="text-[12px]" style={{ color: 'var(--rp-text-muted)' }}>
      Worked {attendance.hoursWorked?.toFixed(1)}h today
    </span>
  );
}

function HeroStatCard({
  title, value, unit, subtext, icon: Icon, family, dark = false,
}: {
  title: string; value: string | number; unit?: string;
  subtext?: string; icon: React.ElementType; family: IconFamily; dark?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const style = ICON_STYLES[family];
  const bg = dark ? '#183153' : isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : dark ? 'var(--rp-border-md)' : 'var(--rp-border)';
  return (
    <div
      className="rounded-[14px] p-[22px] border"
      style={{ background: bg, borderColor: border, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: dark ? '#698599' : isDark ? '#a9c1d0' : 'var(--rp-text-muted)' }}>
          {title}
        </span>
        <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px]"
          style={{ background: dark || isDark ? 'rgba(255,255,255,0.08)' : style.bg }}>
          <Icon className="h-[13px] w-[13px]" strokeWidth={2.3} style={{ color: dark ? '#d4a853' : style.color }} />
        </div>
      </div>
      <div>
        <span className="text-[40px] font-semibold leading-none tracking-[-0.03em]"
          style={{ color: dark ? '#ece7df' : isDark ? '#f8fafc' : 'var(--rp-text)' }}>
          {value}
        </span>
        {unit && <span className="ml-px text-[19px] font-normal" style={{ color: dark ? 'var(--rp-text-accent)' : isDark ? '#a9c1d0' : 'var(--rp-text-muted)' }}>{unit}</span>}
      </div>
      {subtext && <p className="mt-[10px] text-[12px]" style={{ color: dark ? 'var(--rp-text-accent)' : isDark ? '#a9c1d0' : 'var(--rp-text-muted)' }}>{subtext}</p>}
    </div>
  );
}

function CompactStatCard({
  title, value, icon: Icon, family,
}: {
  title: string; value: string | number; icon: React.ElementType; family: IconFamily;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const style = ICON_STYLES[family];
  return (
    <div className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px]"
      style={{
        background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      }}>
      <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
        style={{ background: isDark ? 'rgba(255,255,255,0.08)' : style.bg }}>
        <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color: style.color }} />
      </div>
      <div>
        <div className="mb-[3px] text-[10px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: isDark ? '#a9c1d0' : 'var(--rp-text-muted)' }}>{title}</div>
        <div className="text-[22px] font-semibold leading-none tracking-[-0.02em]"
          style={{ color: isDark ? '#f8fafc' : 'var(--rp-text)' }}>{value}</div>
      </div>
    </div>
  );
}

const STATUS_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  CONFIRMED:   { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153', label: 'Confirmed' },
  CHECKED_IN:  { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'In House'  },
  CHECKED_OUT: { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Checked Out'},
  PENDING:     { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', label: 'Pending'   },
  CANCELLED:   { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)',  text: '#c43c3c', label: 'Cancelled' },
  NO_SHOW:     { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'No Show'   },
};

function BookingStatusPill({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? STATUS_PILL.PENDING;
  return (
    <span className="shrink-0 rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
      style={{ background: s.bg, borderColor: s.border, color: s.text }}>
      {s.label}
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const isDark = resolvedTheme === 'dark';
  const cardBg = isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'var(--rp-border)';
  const canViewWebsiteStats = ['OWNER', 'MANAGER', 'MARKETER', 'DEVELOPER'].includes(user?.role ?? '');

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
    enabled: canViewWebsiteStats,
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
          <h1 className="font-display text-[27px] font-medium tracking-[-0.01em] text-[#183153]">
            {greeting}, {user?.firstName}
          </h1>
          <p className="mt-[5px] text-[13px] text-[#64748b]">
            {today}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ClockWidget />
          {['OWNER', 'MANAGER', 'RECEPTIONIST'].includes(user?.role ?? '') && (
            <button
              onClick={() => setNewBookingOpen(true)}
              className="rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#f8fafc] transition-opacity hover:opacity-80"
              style={{ background: 'var(--rp-btn-accent)' }}
            >
              + New Booking
            </button>
          )}
        </div>
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
      {/* Quick Access — the 4 everyday-use pages, big and first thing seen after login.
          Only for roles that can actually reach these pages (matches sidebar nav roles). */}
      {['OWNER', 'MANAGER', 'RECEPTIONIST'].includes(user?.role ?? '') && (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-up [animation-delay:60ms]">
        {([
          { href: '/dashboard/rooms',      label: 'Rooms',      icon: BedDouble,     family: 'teal' as IconFamily },
          { href: '/dashboard/front-desk', label: 'Front Desk', icon: ClipboardList, family: 'gold' as IconFamily },
          { href: '/dashboard/bookings',   label: 'Bookings',   icon: CalendarDays,  family: 'coral' as IconFamily },
          { href: '/dashboard/calendar',   label: 'Calendar',   icon: LayoutGrid,    family: 'teal' as IconFamily },
        ]).map(({ href, label, icon: Icon, family }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-[14px] border p-[18px] transition-transform hover:-translate-y-0.5"
            style={{ background: cardBg, borderColor: cardBorder, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : ICON_STYLES[family].bg }}>
              <Icon className="h-5 w-5" strokeWidth={2.2} style={{ color: ICON_STYLES[family].color }} />
            </div>
            <span className="text-[15px] font-semibold" style={{ color: isDark ? '#f8fafc' : 'var(--rp-text)' }}>{label}</span>
            <ChevronRight className="ml-auto h-4 w-4 opacity-40 transition-transform group-hover:translate-x-0.5"
              style={{ color: isDark ? '#a9c1d0' : 'var(--rp-text-muted)' }} />
          </Link>
        ))}
      </div>
      )}

      {/* Primary stat cards — 4 hero */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-up [animation-delay:110ms]">
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 animate-fade-up [animation-delay:160ms]">
        <CompactStatCard title="Active Bookings" value={stats?.activeBookings || 0} icon={Users} family="gold" />
        <CompactStatCard title="Total Rooms" value={stats?.totalRooms || 0} icon={BedDouble} family="teal" />
        <CompactStatCard title="Open Tickets" value={stats?.openTickets || 0} icon={AlertCircle} family="coral" />
        <CompactStatCard title="Pending Clean" value={stats?.pendingHousekeeping || 0} icon={Sparkles} family="teal" />
        <CompactStatCard title="Maintenance" value={(stats as { openMaintenance?: number })?.openMaintenance || 0} icon={Wrench} family="teal" />
      </div>

      {/* Today's Arrivals & Departures */}
      <div className="grid gap-3 lg:grid-cols-2 animate-fade-up [animation-delay:210ms]">
        {/* Arrivals */}
        <div className="rounded-[14px] border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between border-b px-5 py-[15px]" style={{ borderColor: dividerColor }}>
            <div className="flex items-center gap-2">
              <LogIn className="h-[13px] w-[13px] text-[#183153]" strokeWidth={2.5} />
              <span className="text-[13px] font-semibold text-[#183153]">Today's Arrivals</span>
              <span className="rounded-full bg-[#e5f0f7] px-2 py-px text-[11px] font-semibold text-[#183153]">{arrivals.length}</span>
            </div>
            <a href="/dashboard/bookings?status=CONFIRMED" className="text-[12px] font-medium text-[#183153] hover:underline">View all →</a>
          </div>
          {arrivals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-gray-200" />
              <p className="text-[13px] text-[#64748b]">No arrivals today</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: dividerColor }}>
              {arrivals.map((b: any) => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#faf9f7] dark:hover:bg-white/5 transition-colors">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#e5f0f7] text-[12px] font-semibold text-[#183153]">
                    {b.guest.firstName[0]}{b.guest.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#183153] truncate">{b.guest.firstName} {b.guest.lastName}</p>
                    <p className="mt-0.5 text-[12px] text-[#64748b]">Room {b.room.number} · {b.nights} nights</p>
                  </div>
                  {b.status === 'CHECKED_IN' ? (
                    <span className="rounded-[7px] border border-[#183153]/20 bg-[#e5f0f7] px-[11px] py-[5px] text-[11.5px] font-medium text-[#183153]">In</span>
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
        <div className="rounded-[14px] border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between border-b px-5 py-[15px]" style={{ borderColor: dividerColor }}>
            <div className="flex items-center gap-2">
              <LogOut className="h-[13px] w-[13px] text-[#183153]" strokeWidth={2.5} />
              <span className="text-[13px] font-semibold text-[#183153]">Today's Departures</span>
              <span className="rounded-full bg-[#e5f0f7] px-2 py-px text-[11px] font-semibold text-[#183153]">{departures.length}</span>
            </div>
            <span className="text-[12px] text-[#64748b]">{inHouseCount} in-house</span>
          </div>
          {departures.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-gray-200" />
              <p className="text-[13px] text-[#64748b]">No departures today</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: dividerColor }}>
              {departures.map((b: any) => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#faf9f7] dark:hover:bg-white/5 transition-colors">
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#e5f0f7] text-[12px] font-semibold text-[#183153]">
                    {b.guest.firstName[0]}{b.guest.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#183153] truncate">{b.guest.firstName} {b.guest.lastName}</p>
                    <p className="mt-0.5 text-[12px] text-[#64748b]">Room {b.room.number} · {b.nights}n stay</p>
                  </div>
                  {b.status === 'CHECKED_OUT' ? (
                    <span className="rounded-[7px] border border-black/8 bg-[#f5f4f1] px-[11px] py-[5px] text-[11.5px] font-medium text-[#64748b]">Out</span>
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
      <div className="grid gap-3 lg:grid-cols-2 animate-fade-up [animation-delay:260ms]">
        {/* Revenue Chart */}
        <div className="rounded-[14px] border px-[22px] py-[18px]"
          style={{ background: cardBg, borderColor: cardBorder, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#183153]">Revenue</p>
              <p className="text-[11px] text-[#64748b]">Last 12 months</p>
            </div>
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[#e5f0f7]">
              <TrendingUp className="h-[12px] w-[12px] text-[#183153]" strokeWidth={2.5} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#183153" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#183153" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), 'Revenue']}
                contentStyle={{ background: 'var(--rp-btn-accent)', border: 'none', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#aac0d0' }}
                itemStyle={{ color: '#ece7df' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#183153" fill="url(#revenueGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy Chart */}
        <div className="rounded-[14px] border px-[22px] py-[18px]"
          style={{ background: cardBg, borderColor: cardBorder, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#183153]">Occupancy Rate</p>
              <p className="text-[11px] text-[#64748b]">Last 14 days</p>
            </div>
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[#f4ecda]">
              <BedDouble className="h-[12px] w-[12px] text-[#b89040]" strokeWidth={2.5} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={occupancyData.slice(-14)} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Occupancy']}
                contentStyle={{ background: 'var(--rp-btn-accent)', border: 'none', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#aac0d0' }}
                itemStyle={{ color: '#ece7df' }}
              />
              <Bar dataKey="rate" fill="#183153" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Website Visitors Widget */}
      {websiteStats && (websiteStats.total30d > 0 || true) && (
        <div className="rounded-[14px] border px-[22px] py-[18px] animate-fade-up [animation-delay:300ms]"
          style={{ background: cardBg, borderColor: cardBorder, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[#fceee4]">
                <Globe className="h-[12px] w-[12px] text-[#b8724a]" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#183153]">Website Visitors</p>
                <p className="text-[11px] text-[#64748b]">Last 30 days</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#183153]">{websiteStats.total30d}</p>
              <p className="mt-[3px] text-[11px] text-[#64748b]">
                <span className="font-medium text-[#183153]">{websiteStats.todayViews}</span> today
                {' · '}
                <a href="/dashboard/website" className="text-[#183153] hover:underline">Edit site →</a>
              </p>
            </div>
          </div>
          {websiteStats.total30d === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Globe className="h-8 w-8 text-[#94a3b8]" />
              <p className="text-[13px] text-[#64748b]">No visitors yet. Share your booking website to start tracking.</p>
              <a href="/dashboard/website" className="text-[12px] font-medium text-[#183153] hover:underline">Set up your website →</a>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={72}>
              <AreaChart data={websiteStats.chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="visitorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b8724a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#b8724a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  formatter={(v: number) => [v, 'Visitors']}
                  contentStyle={{ background: 'var(--rp-btn-accent)', border: 'none', borderRadius: 10, fontSize: 11 }}
                  labelStyle={{ color: '#aac0d0' }}
                  itemStyle={{ color: '#ece7df' }}
                />
                <Area type="monotone" dataKey="views" stroke="#b8724a" fill="url(#visitorGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Recent Bookings + Low Stock */}
      <div className="grid gap-3 lg:grid-cols-3 animate-fade-up [animation-delay:340ms]">
        {/* Recent Bookings */}
        <div className="lg:col-span-2 rounded-[14px] border overflow-hidden"
          style={{ background: cardBg, borderColor: cardBorder, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between border-b px-5 py-[15px]"
            style={{ borderColor: dividerColor }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[#e5f0f7]">
                <Users className="h-[12px] w-[12px] text-[#183153]" strokeWidth={2.5} />
              </div>
              <span className="text-[13px] font-semibold text-[#183153]">Recent Bookings</span>
            </div>
            <a href="/dashboard/bookings" className="text-[12px] font-medium text-[#183153] hover:underline">View all →</a>
          </div>
          {recentBookings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Users className="h-8 w-8 text-[#94a3b8]" />
              <p className="text-[13px] text-[#64748b]">No recent bookings</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: dividerColor }}>
              {recentBookings.map((booking: Record<string, unknown>) => {
                const guest = booking.guest as { firstName: string; lastName: string };
                const room = booking.room as { name: string };
                const initials = `${guest?.firstName?.[0] ?? ''}${guest?.lastName?.[0] ?? ''}`;
                return (
                  <div key={booking.id as string} className="flex items-center gap-3 px-5 py-[13px] hover:bg-[#faf9f7] dark:hover:bg-white/5 transition-colors">
                    <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#e5f0f7] text-[11px] font-semibold text-[#183153]">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-[#183153] truncate">
                        {guest?.firstName} {guest?.lastName}
                      </p>
                      <p className="mt-px text-[11.5px] text-[#64748b]">
                        {room?.name} · {formatDate(booking.checkIn as string)} → {formatDate(booking.checkOut as string)}
                      </p>
                    </div>
                    <BookingStatusPill status={booking.status as string} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-[14px] border overflow-hidden"
          style={{ background: cardBg, borderColor: cardBorder, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-2.5 border-b px-5 py-[15px]"
            style={{ borderColor: dividerColor }}>
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[#fceee4]">
              <AlertCircle className="h-[12px] w-[12px] text-[#b8724a]" strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-semibold text-[#183153]">Low Stock</span>
          </div>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertCircle className="h-8 w-8 text-[#94a3b8]" />
              <p className="text-[13px] text-[#64748b]">All stock levels OK</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: dividerColor }}>
              {lowStock.map((item: Record<string, unknown>) => (
                <div key={item.id as string} className="flex items-center justify-between px-5 py-[13px]">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-[#183153] truncate">{item.name as string}</p>
                    <p className="mt-px text-[11.5px] text-[#64748b]">{String(item.currentStock)} {item.unit as string} left</p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-[7px] border border-[#b8724a]/20 bg-[#fceee4] px-[10px] py-[4px] text-[11px] font-semibold text-[#b8724a]">
                    Low
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>} {/* end non-STAFF block */}

      <NewBookingModal
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        loading={false}
        onSubmit={async (data) => {
          try {
            await bookingsApi.create(data);
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            toast({ title: 'Booking confirmed!', description: 'Guest reservation has been created.' });
            setNewBookingOpen(false);
          } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            toast({ title: 'Booking failed', description: e?.response?.data?.error || 'Please try again', variant: 'destructive' });
          }
        }}
      />
    </div>
  );
}
