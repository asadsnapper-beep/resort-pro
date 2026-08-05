'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  Download, FileText, Building2, DollarSign,
  Search, Loader2, Printer, CheckCircle2, FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlanDisplayName } from '@resort-pro/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planStatus: string;
  isActive: boolean;
  _count: { bookings: number; rooms: number };
}

// ── Helper: trigger browser download from blob ─────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Export Card ────────────────────────────────────────────────────────────────

function ExportCard({
  icon: Icon, iconBg, iconColor, title, description, badge,
  actions,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  badge?: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">{title}</h3>
            {badge && (
              <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">{description}</p>
        </div>
      </div>
      <div className="space-y-2">{actions}</div>
    </div>
  );
}

// ── Download Button ────────────────────────────────────────────────────────────

function DownloadBtn({
  label, sublabel, icon: Icon = Download, loading, onClick, variant = 'default',
}: {
  label: string;
  sublabel?: string;
  icon?: React.ElementType;
  loading?: boolean;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'ghost';
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left disabled:opacity-50',
        variant === 'primary' && 'bg-indigo-600/20 border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300',
        variant === 'default' && 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 text-gray-300',
        variant === 'ghost' && 'bg-transparent border-gray-800 hover:bg-gray-800/50 text-gray-400',
      )}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        : <Icon className="w-4 h-4 shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {sublabel && <p className="text-xs text-gray-600 mt-0.5">{sublabel}</p>}
      </div>
      {!loading && (
        <span className="text-xs text-gray-600 shrink-0">↓</span>
      )}
    </button>
  );
}

// ── Print PDF styles (injected at print time) ──────────────────────────────────

const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden !important; }
    #pdf-report, #pdf-report * { visibility: visible !important; }
    #pdf-report {
      position: fixed !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important;
      background: white !important;
      color: black !important;
      padding: 40px !important;
      font-family: 'Helvetica Neue', Arial, sans-serif !important;
    }
  }
`;

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState({ tenants: true, allCsv: false, revCsv: false, pdf: false });
  const [tenantLoading, setTenantLoading] = useState<string | null>(null);
  const [mrrData, setMrrData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const setLoad = (key: keyof typeof loading, val: boolean) =>
    setLoading(prev => ({ ...prev, [key]: val }));

  // Fetch tenants list + stats for PDF
  const fetchData = useCallback(async () => {
    try {
      const [tr, mr, sr] = await Promise.all([
        adminEndpoints.tenants({ page: '1' }),
        adminEndpoints.getMrrGrowth(),
        adminEndpoints.stats(),
      ]);
      setTenants(tr.data.data.tenants);
      setMrrData(mr.data.data);
      setStats(sr.data.data);
    } catch {
      toast({ title: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoad('tenants', false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Download handlers ──────────────────────────────────────────────────────

  const handleAllTenantsCsv = async () => {
    setLoad('allCsv', true);
    try {
      const res = await adminEndpoints.exportTenantsCsv();
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data as Blob, `resortpro-tenants-${date}.csv`);
      toast({ title: 'Tenants CSV downloaded' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setLoad('allCsv', false);
    }
  };

  const handleRevenueCsv = async () => {
    setLoad('revCsv', true);
    try {
      const res = await adminEndpoints.exportRevenueCsv();
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data as Blob, `resortpro-revenue-${date}.csv`);
      toast({ title: 'Revenue CSV downloaded' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setLoad('revCsv', false);
    }
  };

  const handleTenantCsv = async (t: Tenant) => {
    setTenantLoading(t.id);
    try {
      const res = await adminEndpoints.exportTenantCsv(t.id);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data as Blob, `resortpro-${t.slug}-bookings-${date}.csv`);
      toast({ title: `${t.name} — bookings CSV downloaded` });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setTenantLoading(null);
    }
  };

  const handlePrintPdf = () => {
    setShowPdfPreview(true);
    setTimeout(() => {
      window.print();
      setShowPdfPreview(false);
    }, 300);
  };

  const filtered = tenants.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase())
  );

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Export Center</h1>
          <p className="text-gray-500 text-sm mt-1">Download platform data as CSV or PDF</p>
        </div>

        {/* Export cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Revenue exports */}
          <ExportCard
            icon={DollarSign}
            iconBg="bg-emerald-500/15"
            iconColor="text-emerald-400"
            title="Revenue Reports"
            description="MRR history, billing summary, plan breakdown"
            badge="Finance"
            actions={
              <>
                <DownloadBtn
                  label="Revenue CSV — 12 months"
                  sublabel="Month, MRR, New MRR, Paying Customers"
                  icon={FileSpreadsheet}
                  loading={loading.revCsv}
                  onClick={handleRevenueCsv}
                  variant="primary"
                />
                <DownloadBtn
                  label="Revenue Report PDF"
                  sublabel="Branded summary — ready to share"
                  icon={Printer}
                  loading={loading.pdf}
                  onClick={handlePrintPdf}
                  variant="default"
                />
              </>
            }
          />

          {/* All tenants */}
          <ExportCard
            icon={Building2}
            iconBg="bg-indigo-500/15"
            iconColor="text-indigo-400"
            title="All Tenants"
            description="Full tenant list with plan, billing, usage stats"
            badge="Admin"
            actions={
              <DownloadBtn
                label="All Tenants CSV"
                sublabel={`${tenants.length} tenants — 21 columns including Stripe IDs`}
                icon={FileSpreadsheet}
                loading={loading.allCsv}
                onClick={handleAllTenantsCsv}
                variant="primary"
              />
            }
          />
        </div>

        {/* Per-tenant booking CSV */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Per-Tenant Booking Export</h3>
              <p className="text-gray-500 text-sm mt-0.5">Download all bookings for a specific resort as CSV</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resort name or slug..."
              className="w-full h-9 bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Tenant list */}
          {loading.tenants ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">No tenants found</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {filtered.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/40 hover:bg-gray-800 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 uppercase shrink-0">
                    {t.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{t.name}</p>
                    <p className="text-gray-600 text-xs">
                      {t.slug} · {t._count.bookings} bookings · {getPlanDisplayName(t.plan)}
                    </p>
                  </div>
                  {!t.isActive && (
                    <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded shrink-0">
                      suspended
                    </span>
                  )}
                  <button
                    onClick={() => handleTenantCsv(t)}
                    disabled={tenantLoading === t.id}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                  >
                    {tenantLoading === t.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Download className="w-3 h-3" />
                    }
                    CSV
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-gray-700 text-xs mt-3">
            Includes: Confirmation #, Status, Check-in/out, Amount, Guest details, Room info
          </p>
        </div>
      </div>

      {/* ── PDF Report (print target) ──────────────────────────────────────── */}
      {showPdfPreview && mrrData && stats && (
        <div
          id="pdf-report"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            background: 'white',
            color: '#111',
            padding: 40,
            zIndex: 9999,
            fontFamily: 'Helvetica Neue, Arial, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0 }}>ResortPro</h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Platform Revenue Report</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Generated: {today}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Confidential — Internal Use Only</p>
              </div>
            </div>
          </div>

          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Monthly Recurring Revenue', value: `$${mrrData.metrics.currentMrr.toLocaleString()}` },
              { label: 'Annual Recurring Revenue', value: `$${mrrData.metrics.arr.toLocaleString()}` },
              { label: 'Paying Customers', value: String(mrrData.metrics.currentPayingCustomers) },
              { label: 'ARPU', value: `$${mrrData.metrics.arpu}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px' }}>
                <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111' }}>{value}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* MRR Table */}
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 10 }}>Monthly MRR History</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 28 }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                {['Month', 'MRR', 'New MRR', 'Churned MRR', 'Net MRR', 'Customers'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#374151', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mrrData.months.map((m: any, i: number) => (
                <tr key={m.month} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{m.label}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#059669' }}>${m.mrr.toLocaleString()}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', color: '#10b981' }}>+${m.newMrr.toLocaleString()}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', color: m.churnedMrr > 0 ? '#ef4444' : '#9ca3af' }}>
                    {m.churnedMrr > 0 ? `-$${m.churnedMrr.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', color: m.netMrr >= 0 ? '#059669' : '#ef4444' }}>
                    {m.netMrr >= 0 ? `+$${m.netMrr.toLocaleString()}` : `-$${Math.abs(m.netMrr).toLocaleString()}`}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{m.payingCustomers}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Additional metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px', color: '#374151' }}>Platform Summary</h3>
              {[
                ['Total Tenants', stats.totalTenants],
                ['Active Tenants', stats.activeTenants],
                ['On Trial', stats.trialingTenants],
                ['Suspended', stats.suspendedTenants],
                ['Total Users', stats.totalUsers],
                ['Total Bookings', stats.totalBookings],
              ].map(([label, val]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px', color: '#374151' }}>Revenue Metrics</h3>
              {[
                ['MRR Growth Rate', `${mrrData.metrics.mrrGrowthRate > 0 ? '+' : ''}${mrrData.metrics.mrrGrowthRate}%`],
                ['Net Revenue Retention', `${mrrData.metrics.nrr}%`],
                ['ARPU', `$${mrrData.metrics.arpu}/mo`],
                ['ARR', `$${mrrData.metrics.arr.toLocaleString()}`],
                ...Object.entries(mrrData.metrics.ltv).map(([plan, ltv]) => [`LTV (${plan})`, `$${(ltv as number).toLocaleString()}`]),
              ].map(([label, val]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 28, paddingTop: 14, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>
              ResortPro · Confidential · Generated {today} · Data sourced from platform database
            </p>
          </div>
        </div>
      )}
    </>
  );
}
