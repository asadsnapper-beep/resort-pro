'use client';

import { useState, useEffect } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Loader2, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

type BillingData = {
  mrr: number;
  planBreakdown: Array<{ plan: string; planStatus: string; _count: { _all: number } }>;
  recentPaid: Array<{ id: string; name: string; slug: string; plan: string; currentPeriodEnd: string | null; stripeCustomerId: string | null }>;
  trialExpiringSoon: Array<{ id: string; name: string; slug: string; email: string | null; trialEndsAt: string | null }>;
};

const planPrices: Record<string, number> = { FREE: 0, STARTER: 49, PROFESSIONAL: 99, ENTERPRISE: 199 };

export default function AdminBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminEndpoints.billing()
      .then((r) => setData(r.data.data))
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

  if (!data) return null;

  const activePaid = data.planBreakdown.filter((r) => r.planStatus === 'active');
  const trialingCount = data.planBreakdown.filter((r) => r.planStatus === 'trialing').reduce((s, r) => s + r._count._all, 0);
  const paidCount = activePaid.reduce((s, r) => s + r._count._all, 0);

  // Per-plan revenue
  const planRevenue = activePaid.reduce<Record<string, { count: number; revenue: number }>>((acc, r) => {
    acc[r.plan] = acc[r.plan] || { count: 0, revenue: 0 };
    acc[r.plan].count += r._count._all;
    acc[r.plan].revenue += (planPrices[r.plan] || 0) * r._count._all;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & MRR</h1>
        <p className="text-gray-500 text-sm mt-1">Revenue overview for ResortPro</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">${data.mrr.toLocaleString()}</p>
          <p className="text-gray-400 text-sm mt-1">Monthly Recurring Revenue</p>
          <p className="text-gray-600 text-xs mt-1">ARR: ${(data.mrr * 12).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-bold text-white">{paidCount}</p>
          <p className="text-gray-400 text-sm mt-1">Paying Customers</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-white">{trialingCount}</p>
          <p className="text-gray-400 text-sm mt-1">On Trial</p>
          <p className="text-gray-600 text-xs mt-1">Potential MRR: ${(trialingCount * 49).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by plan */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Revenue by Plan</h2>
          {Object.keys(planRevenue).length === 0 ? (
            <p className="text-gray-500 text-sm">No paid subscriptions yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(planRevenue).map(([plan, { count, revenue }]) => (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{plan}</span>
                      <span className="text-gray-500 text-xs">{count} customers × ${planPrices[plan]}/mo</span>
                    </div>
                    <span className="text-green-400 font-semibold text-sm">${revenue.toLocaleString()}/mo</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.round((revenue / Math.max(data.mrr, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
                <span className="text-gray-400 font-medium">Total MRR</span>
                <span className="text-white font-bold text-lg">${data.mrr.toLocaleString()}/mo</span>
              </div>
            </div>
          )}
        </div>

        {/* Trial expiring soon */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-semibold">Trials Expiring Soon</h2>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-auto">
              {data.trialExpiringSoon.length} in 7 days
            </span>
          </div>
          {data.trialExpiringSoon.length === 0 ? (
            <p className="text-gray-500 text-sm">No trials expiring in the next 7 days.</p>
          ) : (
            <div className="space-y-3">
              {data.trialExpiringSoon.map((t) => {
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
      </div>

      {/* Active subscriptions */}
      {data.recentPaid.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Active Subscriptions</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Tenant</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Plan</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">MRR</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Renews</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Stripe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.recentPaid.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-3">
                    <p className="text-white text-sm font-medium">{t.name}</p>
                    <p className="text-gray-500 text-xs font-mono">{t.slug}</p>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-300">{t.plan}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-green-400">${planPrices[t.plan] || 0}/mo</td>
                  <td className="px-6 py-3 text-xs text-gray-500">
                    {t.currentPeriodEnd ? new Date(t.currentPeriodEnd).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-600 font-mono truncate max-w-32">
                    {t.stripeCustomerId ? t.stripeCustomerId.slice(0, 14) + '...' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
