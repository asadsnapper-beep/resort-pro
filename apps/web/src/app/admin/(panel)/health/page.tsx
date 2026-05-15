'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  Activity, Loader2, Server, Database, Cpu,
  RefreshCw, Clock, Zap, AlertTriangle, CheckCircle2,
  MemoryStick, Globe, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────

interface HealthData {
  process: {
    nodeVersion: string;
    platform: string;
    uptimeSec: number;
    uptimeHuman: string;
    memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number; externalMb: number };
    env: string;
  };
  database: {
    size: string;
    activeConnections: number;
    topTables: { name: string; rowEstimate: number; size: string }[];
  };
  platform: {
    totalTenants: number;
    totalUsers: number;
    totalBookings: number;
    activeSubscriptions: number;
  };
  requests: {
    window: string;
    rpm: number;
    total: number;
    totalAllTime: number;
    errors: number;
    clientErrors: number;
    errorRate: number;
    latency: { p50: number; p95: number; p99: number; avg: number };
    slowEndpoints: { endpoint: string; count: number; avgMs: number; errors: number }[];
    statusBreakdown: Record<string, number>;
    buckets: { time: string; count: number; errors: number }[];
    uptimeMs: number;
  };
  checkedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function healthColor(errorRate: number) {
  if (errorRate >= 5) return { dot: 'bg-red-400', text: 'text-red-400', label: 'Degraded' };
  if (errorRate >= 1) return { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Warning' };
  return { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Healthy' };
}

function latencyColor(ms: number) {
  if (ms > 1000) return 'text-red-400';
  if (ms > 300) return 'text-amber-400';
  return 'text-emerald-400';
}

function memPercent(used: number, total: number) {
  return total ? Math.round((used / total) * 100) : 0;
}

// ── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, color = 'text-indigo-400', bg = 'bg-indigo-500/10',
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; bg?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      <p className="text-gray-500 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-gray-700 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await adminEndpoints.getHealth();
      setData(res.data.data);
      setLastRefresh(new Date());
    } catch {
      if (!silent) toast({ title: 'Failed to load health data', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) return null;

  const { process: proc, database: db, platform, requests: req } = data;
  const health = healthColor(req.errorRate);
  const heapPct = memPercent(proc.memory.heapUsedMb, proc.memory.heapTotalMb);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-400" />
            Platform Health
          </h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full animate-pulse', health.dot)} />
            <span className={health.text}>{health.label}</span>
            <span className="text-gray-700">·</span>
            <span>{req.errorRate}% error rate (last {req.window})</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <p className="text-xs text-gray-600">
              Updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-xs"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Req/min" value={req.rpm}
          sub={`${req.total.toLocaleString()} in last ${req.window}`}
          icon={Zap} color="text-cyan-400" bg="bg-cyan-500/10"
        />
        <MetricCard
          label="p95 Latency" value={`${req.latency.p95}ms`}
          sub={`p50: ${req.latency.p50}ms · avg: ${req.latency.avg}ms`}
          icon={Clock}
          color={latencyColor(req.latency.p95)}
          bg="bg-indigo-500/10"
        />
        <MetricCard
          label="Error Rate" value={`${req.errorRate}%`}
          sub={`${req.errors} 5xx · ${req.clientErrors} 4xx`}
          icon={AlertTriangle}
          color={req.errorRate >= 5 ? 'text-red-400' : req.errorRate >= 1 ? 'text-amber-400' : 'text-emerald-400'}
          bg={req.errorRate >= 5 ? 'bg-red-500/10' : req.errorRate >= 1 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}
        />
        <MetricCard
          label="API Uptime" value={proc.uptimeHuman}
          sub={`Node ${proc.nodeVersion} · ${proc.env}`}
          icon={Server} color="text-indigo-400" bg="bg-indigo-500/10"
        />
      </div>

      {/* Request volume chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          Request Volume — Last 60 min (5-min buckets)
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={req.buckets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradErr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Area type="monotone" dataKey="count" name="Requests" stroke="#6366f1" fill="url(#gradReq)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="errors" name="5xx Errors" stroke="#ef4444" fill="url(#gradErr)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <MemoryStick className="w-4 h-4 text-purple-400" />
            Memory Usage
          </h2>
          {[
            { label: 'Heap Used', used: proc.memory.heapUsedMb, total: proc.memory.heapTotalMb, color: 'bg-indigo-500' },
            { label: 'RSS (total)', used: proc.memory.rssMb, total: proc.memory.rssMb, color: 'bg-purple-500' },
            { label: 'External', used: proc.memory.externalMb, total: proc.memory.externalMb, color: 'bg-cyan-500' },
          ].map(({ label, used, total, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-300 font-medium">{used} MB{total !== used ? ` / ${total} MB` : ''}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', color)}
                  style={{ width: `${Math.min(100, total !== used ? memPercent(used, total) : 100)}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-600">
            Heap: {heapPct}% used · Platform: {proc.platform} · {proc.nodeVersion}
          </p>
        </div>

        {/* Latency breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-400" />
            Latency Percentiles
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={[
                { name: 'p50', ms: req.latency.p50 },
                { name: 'avg', ms: req.latency.avg },
                { name: 'p95', ms: req.latency.p95 },
                { name: 'p99', ms: req.latency.p99 },
              ]}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} unit="ms" />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="ms" name="Latency" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DB stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-semibold">Database</h2>
            <span className="ml-auto text-xs text-gray-500">
              {db.size} · {db.activeConnections} connections
            </span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {db.topTables.map((t) => (
              <div key={t.name} className="flex items-center gap-3 px-5 py-2.5">
                <p className="text-gray-300 text-xs font-mono flex-1">{t.name}</p>
                <span className="text-gray-500 text-xs">{t.rowEstimate.toLocaleString()} rows</span>
                <span className="text-gray-600 text-xs w-16 text-right">{t.size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Slow endpoints */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-semibold">Slowest Endpoints</h2>
            <span className="ml-auto text-xs text-gray-500">last {req.window}</span>
          </div>
          {req.slowEndpoints.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
              No requests recorded yet
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {req.slowEndpoints.map((e) => (
                <div key={e.endpoint} className="flex items-center gap-3 px-5 py-2.5">
                  <p className="text-gray-400 text-xs font-mono flex-1 truncate" title={e.endpoint}>{e.endpoint}</p>
                  <span className={cn('text-xs font-semibold tabular-nums', latencyColor(e.avgMs))}>
                    {e.avgMs}ms
                  </span>
                  <span className="text-gray-600 text-xs">{e.count}req</span>
                  {e.errors > 0 && (
                    <span className="text-red-400 text-xs">{e.errors}err</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Platform counts + status breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Tenants', value: platform.totalTenants, icon: Globe, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Users', value: platform.totalUsers, icon: Cpu, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: 'Bookings', value: platform.totalBookings, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Paid Tenants', value: platform.activeSubscriptions, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'All-time Requests', value: req.totalAllTime.toLocaleString(), icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>
    </div>
  );
}
