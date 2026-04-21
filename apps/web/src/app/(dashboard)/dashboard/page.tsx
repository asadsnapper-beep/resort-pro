'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import {
  BedDouble, CalendarCheck, CalendarX, TrendingUp, Users,
  Ticket, DollarSign, Sparkles, ArrowUp, ArrowDown,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { Metadata } from 'next';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  change?: number;
  suffix?: string;
  color: string;
}

function StatCard({ title, value, icon: Icon, change, suffix, color }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">
              {value}{suffix && <span className="ml-1 text-lg font-medium text-muted-foreground">{suffix}</span>}
            </p>
            {change !== undefined && (
              <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(change)}% vs last month
              </div>
            )}
          </div>
          <div className={`rounded-xl p-3 ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
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

  const stats = statsRes?.data?.data?.stats;
  const recentBookings = statsRes?.data?.data?.recentBookings || [];
  const lowStock = statsRes?.data?.data?.lowStockAlerts || [];
  const revenueData = revenueRes?.data?.data || [];
  const occupancyData = occupancyRes?.data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded-lg bg-gray-200 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Good morning, {user?.firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening at your resort today
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Rooms" value={stats?.totalRooms || 0} icon={BedDouble} color="bg-resort-600" />
        <StatCard title="Occupancy Rate" value={stats?.occupancyRate || 0} icon={TrendingUp} suffix="%" change={stats?.revenueGrowth} color="bg-blue-500" />
        <StatCard title="Today Check-ins" value={stats?.todayCheckIns || 0} icon={CalendarCheck} color="bg-green-500" />
        <StatCard title="Today Check-outs" value={stats?.todayCheckOuts || 0} icon={CalendarX} color="bg-orange-500" />
        <StatCard title="Active Bookings" value={stats?.activeBookings || 0} icon={Users} color="bg-purple-500" />
        <StatCard title="Monthly Revenue" value={formatCurrency(stats?.monthlyRevenue || 0)} icon={DollarSign} change={stats?.revenueGrowth} color="bg-emerald-500" />
        <StatCard title="Open Tickets" value={stats?.openTickets || 0} icon={Ticket} color="bg-red-500" />
        <StatCard title="Pending Cleaning" value={stats?.pendingHousekeeping || 0} icon={Sparkles} color="bg-yellow-500" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue (Last 12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#309485" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#309485" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#309485" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy Rate (Last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={occupancyData.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v) => [`${v}%`, 'Occupancy']} />
                <Bar dataKey="rate" fill="#309485" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
