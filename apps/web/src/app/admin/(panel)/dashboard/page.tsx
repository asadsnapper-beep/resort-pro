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
  Loader2, ExternalLink, CheckCircle2, AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

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
  }>;
  planBreakdown: Array<{ plan: string; count: number }>;
};

function StatCard({
  icon: Icon, label, value, sub, color, href,
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; href?: string;
}) {
  const content = (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {href && <ExternalLink className="w-3.5 h-3.5 text-gray-600" />}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    adminEndpoints.stats()
      .then((r) => setStats(r.data.data))
      .catch(() => toast({ title: 'Failed to load stats', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const handleImpersonate = async (tenantId: string, tenantName: string) => {
    setImpersonating(tenantId);
    try {
      const res = await adminEndpoints.impersonate(tenantId);
      const { token, refreshToken, user, tenant } = res.data.data;
      setAuth(user, tenant, token, refreshToken);
      toast({ title: `Impersonating ${tenantName}`, description: 'You are now logged in as the resort owner.' });
      router.push('/dashboard');
    } catch {
      toast({ title: 'Impersonation failed', variant: 'destructive' });
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

  const planColors: Record<string, string> = {
    FREE: 'bg-gray-700 text-gray-300',
    STARTER: 'bg-blue-500/20 text-blue-400',
    PROFESSIONAL: 'bg-indigo-500/20 text-indigo-400',
    ENTERPRISE: 'bg-purple-500/20 text-purple-400',
  };

  const statusColors: Record<string, string> = {
    trialing: 'bg-amber-500/20 text-amber-400',
    active: 'bg-green-500/20 text-green-400',
    past_due: 'bg-red-500/20 text-red-400',
    canceled: 'bg-gray-700 text-gray-400',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">ResortPro SaaS platform stats</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign} label="Monthly Recurring Revenue"
          value={`$${stats.mrr.toLocaleString()}`}
          sub={`${stats.paidTenants} paid tenants`}
          color="bg-green-500/20 text-green-400"
          href="/admin/billing"
        />
        <StatCard
          icon={Building2} label="Total Tenants"
          value={stats.totalTenants}
          sub={`${stats.activeTenants} active`}
          color="bg-indigo-500/20 text-indigo-400"
          href="/admin/tenants"
        />
        <StatCard
          icon={Activity} label="On Trial"
          value={stats.trialingTenants}
          sub="Free trial accounts"
          color="bg-amber-500/20 text-amber-400"
        />
        <StatCard
          icon={ShieldAlert} label="Suspended"
          value={stats.suspendedTenants}
          sub="Inactive tenants"
          color="bg-red-500/20 text-red-400"
        />
        <StatCard
          icon={Users} label="Total Users"
          value={stats.totalUsers.toLocaleString()}
          color="bg-blue-500/20 text-blue-400"
          href="/admin/users"
        />
        <StatCard
          icon={BedDouble} label="Total Rooms"
          value={stats.totalRooms.toLocaleString()}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          icon={CalendarDays} label="Total Bookings"
          value={stats.totalBookings.toLocaleString()}
          color="bg-teal-500/20 text-teal-400"
        />
        <StatCard
          icon={TrendingUp} label="Paid Tenants"
          value={stats.paidTenants}
          sub="Active subscriptions"
          color="bg-emerald-500/20 text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Plan Distribution</h2>
          <div className="space-y-3">
            {stats.planBreakdown.map((p) => (
              <div key={p.plan} className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${planColors[p.plan] || 'bg-gray-700 text-gray-300'}`}>
                  {p.plan}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${Math.round((p.count / stats.totalTenants) * 100)}%` }}
                    />
                  </div>
                  <span className="text-white text-sm font-medium w-6 text-right">{p.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent signups */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Recent Signups</h2>
            <Link href="/admin/tenants" className="text-indigo-400 text-xs hover:text-indigo-300">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentTenants.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300 uppercase">
                  {t.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.planStatus] || 'bg-gray-700 text-gray-400'}`}>
                    {t.planStatus}
                  </span>
                  {!t.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                      suspended
                    </span>
                  )}
                  <button
                    onClick={() => handleImpersonate(t.id, t.name)}
                    disabled={impersonating === t.id}
                    className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 whitespace-nowrap"
                  >
                    {impersonating === t.id ? '...' : 'Login as →'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
