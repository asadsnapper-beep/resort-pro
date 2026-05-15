'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  FileBarChart2, Calendar, Mail, Printer, TrendingUp,
  LogIn, LogOut, AlertTriangle, Sparkles, Wrench,
  DollarSign, Banknote, CreditCard, Building2, ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, count }: {
  icon: React.ElementType; title: string; count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{title}</h3>
      {count !== undefined && (
        <span className="ml-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-bold text-gray-600 dark:text-gray-300">
          {count}
        </span>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(toLocalDate(new Date()));
  const [emailAddr, setEmailAddr] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  const { data: res, isLoading, refetch } = useQuery({
    queryKey: ['daily-report', date],
    queryFn: () => reportsApi.getDaily(date),
  });

  const emailMut = useMutation({
    mutationFn: () => reportsApi.emailDaily(date, emailAddr || undefined),
    onSuccess: () => {
      toast({ title: 'Report emailed', description: `Sent to ${emailAddr || 'your account email'}` });
      setShowEmailInput(false);
      setEmailAddr('');
    },
    onError: () => toast({ title: 'Failed to send email', variant: 'destructive' }),
  });

  const report = res?.data?.data;

  const handlePrint = () => window.print();

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const changeDate = (delta: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setDate(toLocalDate(d));
  };

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #report-content, #report-content * { visibility: visible !important; }
          #report-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileBarChart2 className="h-6 w-6 text-resort-600" />
              Daily Report
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              End-of-day summary for front desk & management
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date navigator */}
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => changeDate(-1)}
                className="px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-r border-gray-200 dark:border-gray-700"
              >
                ←
              </button>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  max={toLocalDate(new Date())}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-2 text-sm bg-transparent focus:outline-none cursor-pointer"
                />
              </div>
              <button
                onClick={() => changeDate(1)}
                disabled={date >= toLocalDate(new Date())}
                className="px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-l border-gray-200 dark:border-gray-700 disabled:opacity-40"
              >
                →
              </button>
            </div>

            {/* Today shortcut */}
            {date !== toLocalDate(new Date()) && (
              <button
                onClick={() => setDate(toLocalDate(new Date()))}
                className="px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Today
              </button>
            )}

            {/* Email button */}
            <button
              onClick={() => setShowEmailInput(!showEmailInput)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Email
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        {/* Email input row */}
        {showEmailInput && (
          <div className="flex items-center gap-2 no-print">
            <input
              type="email"
              placeholder="recipient@email.com (leave blank for account email)"
              value={emailAddr}
              onChange={(e) => setEmailAddr(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-resort-500"
            />
            <button
              onClick={() => emailMut.mutate()}
              disabled={emailMut.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-resort-600 text-white hover:bg-resort-700 transition-colors disabled:opacity-50"
            >
              {emailMut.isPending ? 'Sending…' : 'Send Report'}
            </button>
            <button
              onClick={() => setShowEmailInput(false)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
            <div className="h-48 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="h-48 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          </div>
        )}

        {report && (
          <div id="report-content" className="space-y-6">
            {/* Report date banner */}
            <div className="rounded-xl border border-resort-200 bg-resort-50 dark:bg-resort-900/10 dark:border-resort-800 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-resort-600" />
                <div>
                  <p className="text-sm font-semibold text-resort-800 dark:text-resort-300">
                    {formatDisplayDate(date)}
                  </p>
                  <p className="text-xs text-resort-600 dark:text-resort-400">{report.tenant.name}</p>
                </div>
              </div>
              <span className="text-xs text-resort-500">Generated {new Date().toLocaleTimeString()}</span>
            </div>

            {/* ── KPI strip ── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Occupancy"
                value={`${report.occupancy.rate}%`}
                sub={`${report.occupancy.occupied} / ${report.occupancy.totalRooms} rooms`}
                icon={TrendingUp}
                color="bg-resort-600"
              />
              <KpiCard
                label="Total Revenue"
                value={formatCurrency(report.revenue.total)}
                sub={`Rooms + F&B + Extras`}
                icon={DollarSign}
                color="bg-emerald-500"
              />
              <KpiCard
                label="Arrivals"
                value={report.arrivals.length}
                sub={`${report.arrivals.filter((a: any) => a.status === 'CHECKED_IN').length} checked in`}
                icon={LogIn}
                color="bg-blue-500"
              />
              <KpiCard
                label="Departures"
                value={report.departures.length}
                sub={`${report.departures.filter((d: any) => d.status === 'CHECKED_OUT').length} checked out`}
                icon={LogOut}
                color="bg-indigo-500"
              />
            </div>

            {/* ── Revenue & Payments ── */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <SectionHeader icon={DollarSign} title="Revenue Breakdown" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Room Revenue', amount: report.revenue.rooms, color: 'bg-resort-500' },
                    { label: 'Restaurant & F&B', amount: report.revenue.restaurant, color: 'bg-orange-500' },
                    { label: 'Extras & Charges', amount: report.revenue.extras, color: 'bg-purple-500' },
                  ].map(({ label, amount, color }) => {
                    const pct = report.revenue.total > 0 ? Math.round((amount / report.revenue.total) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{formatCurrency(amount)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between font-semibold text-sm">
                    <span>Total</span>
                    <span className="text-resort-600">{formatCurrency(report.revenue.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Payment methods */}
              <Card>
                <CardHeader className="pb-3">
                  <SectionHeader icon={CreditCard} title="Payment Methods" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: 'Cash', icon: Banknote, amount: report.payments.cash, color: 'text-emerald-600' },
                      { label: 'Card / Online', icon: CreditCard, amount: report.payments.card, color: 'text-blue-600' },
                      { label: 'Bank Transfer', icon: Building2, amount: report.payments.bankTransfer, color: 'text-purple-600' },
                      { label: 'Other', icon: DollarSign, amount: report.payments.other, color: 'text-gray-600' },
                    ].map(({ label, icon: Icon, amount, color }) => (
                      <div key={label} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2.5">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <span className="text-sm">{label}</span>
                        </div>
                        <span className={`text-sm font-semibold ${amount > 0 ? color : 'text-muted-foreground'}`}>
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Arrivals table ── */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader icon={LogIn} title="Arrivals" count={report.arrivals.length} />
              </CardHeader>
              <CardContent>
                {report.arrivals.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-6">No arrivals today</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-gray-100 dark:border-gray-800">
                          <th className="pb-2 font-medium">Guest</th>
                          <th className="pb-2 font-medium">Room</th>
                          <th className="pb-2 font-medium text-right">Nights</th>
                          <th className="pb-2 font-medium text-right">Check-out</th>
                          <th className="pb-2 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {report.arrivals.map((a: any) => (
                          <tr key={a.bookingId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="py-2.5 font-medium">{a.guestName}</td>
                            <td className="py-2.5 text-muted-foreground">{a.room}</td>
                            <td className="py-2.5 text-right">{a.nights}n</td>
                            <td className="py-2.5 text-right text-muted-foreground">{a.checkOut}</td>
                            <td className="py-2.5 text-right">
                              {a.status === 'CHECKED_IN' ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">In</span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">Due</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Departures table ── */}
            <Card>
              <CardHeader className="pb-3">
                <SectionHeader icon={LogOut} title="Departures" count={report.departures.length} />
              </CardHeader>
              <CardContent>
                {report.departures.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-6">No departures today</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-gray-100 dark:border-gray-800">
                          <th className="pb-2 font-medium">Guest</th>
                          <th className="pb-2 font-medium">Room</th>
                          <th className="pb-2 font-medium text-right">Bill</th>
                          <th className="pb-2 font-medium text-right">Paid</th>
                          <th className="pb-2 font-medium text-right">Balance</th>
                          <th className="pb-2 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {report.departures.map((d: any) => {
                          const balance = d.totalBill - d.paidAmount;
                          return (
                            <tr key={d.bookingId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                              <td className="py-2.5 font-medium">{d.guestName}</td>
                              <td className="py-2.5 text-muted-foreground">{d.room}</td>
                              <td className="py-2.5 text-right">{formatCurrency(d.totalBill)}</td>
                              <td className="py-2.5 text-right text-emerald-600">{formatCurrency(d.paidAmount)}</td>
                              <td className={`py-2.5 text-right font-medium ${balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                {balance > 0 ? formatCurrency(balance) : '✓ Settled'}
                              </td>
                              <td className="py-2.5 text-right">
                                {d.status === 'CHECKED_OUT' ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">Out</span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium">Pending</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Operations ── */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* No-shows */}
              <Card>
                <CardHeader className="pb-3">
                  <SectionHeader icon={AlertTriangle} title="No-Shows" count={report.noShows.length} />
                </CardHeader>
                <CardContent>
                  {report.noShows.length === 0 ? (
                    <div className="flex flex-col items-center py-4 text-center">
                      <span className="text-2xl mb-1">✅</span>
                      <p className="text-sm text-muted-foreground">No no-shows today</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {report.noShows.map((n: any) => (
                        <div key={n.bookingId} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/10">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.guestName}</p>
                            <p className="text-xs text-muted-foreground">{n.room}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Housekeeping */}
              <Card>
                <CardHeader className="pb-3">
                  <SectionHeader icon={Sparkles} title="Housekeeping" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                      <span className="text-sm text-emerald-700 dark:text-emerald-400">Completed</span>
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{report.housekeeping.completed}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                      <span className="text-sm text-amber-700 dark:text-amber-400">Pending</span>
                      <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">{report.housekeeping.pending}</span>
                    </div>
                    {(report.housekeeping.completed + report.housekeeping.pending) > 0 && (
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-2 rounded-full bg-emerald-500 transition-all"
                          style={{
                            width: `${Math.round(
                              (report.housekeeping.completed /
                                (report.housekeeping.completed + report.housekeeping.pending)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance */}
              <Card>
                <CardHeader className="pb-3">
                  <SectionHeader icon={Wrench} title="Maintenance" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/10">
                      <span className="text-sm text-red-700 dark:text-red-400">Open Tickets</span>
                      <span className="text-2xl font-bold text-red-700 dark:text-red-400">{report.maintenance.open}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                      <span className="text-sm text-emerald-700 dark:text-emerald-400">Resolved Today</span>
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{report.maintenance.resolvedToday}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Print footer */}
            <div className="hidden print:block pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
              <p>{report.tenant.name} · Daily Report · {formatDisplayDate(date)} · Generated {new Date().toLocaleString()}</p>
              <p className="mt-1">Confidential — ResortPro</p>
            </div>
          </div>
        )}

        {!isLoading && !report && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FileBarChart2 className="h-12 w-12 text-gray-300" />
            <p className="text-muted-foreground">No report data for {date}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 px-4 py-2 text-sm rounded-lg bg-resort-600 text-white hover:bg-resort-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </>
  );
}
