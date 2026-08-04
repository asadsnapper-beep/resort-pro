'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
// shadcn cards removed — using native divs with design tokens
import { useToast } from '@/hooks/use-toast';
import {
  FileBarChart2, Calendar, Mail, Printer, TrendingUp,
  LogIn, LogOut, AlertTriangle, Sparkles, Wrench,
  Banknote, CreditCard, Building2, ArrowRight,
  Send, MessageCircle, Bell, BellOff, Clock, CheckCircle2,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
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
    <div className="rounded-[14px] border bg-white p-5"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{label}</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-[#183153]">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-[#94a3b8]">{sub}</p>}
        </div>
        <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[9px]" style={{ background: color }}>
          <Icon className="h-[15px] w-[15px] text-white" />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }: {
  icon: React.ElementType; title: string; count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-[14px] w-[14px]" style={{ color: '#183153' }} />
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[#183153]">{title}</h3>
      {count !== undefined && (
        <span className="ml-1 rounded-[6px] border px-[8px] py-[2px] text-[11px] font-bold"
          style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── Dispatch Settings Panel ───────────────────────────────────────────────────
function DispatchSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { data: dispatchRes } = useQuery({
    queryKey: ['report-dispatch'],
    queryFn: () => reportsApi.getDispatch(),
  });

  const dispatch = dispatchRes?.data?.data;

  const [form, setForm] = useState({
    enabled: false,
    dispatchTime: '22:00',
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    whatsappEnabled: false,
    whatsappPhone: '',
  });

  useEffect(() => {
    if (dispatch) {
      setForm({
        enabled:          dispatch.enabled          ?? false,
        dispatchTime:     dispatch.dispatchTime      ?? '22:00',
        telegramEnabled:  dispatch.telegramEnabled   ?? false,
        telegramBotToken: dispatch.telegramBotToken  ?? '',
        telegramChatId:   dispatch.telegramChatId    ?? '',
        whatsappEnabled:  dispatch.whatsappEnabled   ?? false,
        whatsappPhone:    dispatch.whatsappPhone      ?? '',
      });
    }
  }, [dispatch]);

  const saveMut = useMutation({
    mutationFn: () => reportsApi.saveDispatch({
      ...form,
      telegramBotToken: form.telegramBotToken || null,
      telegramChatId:   form.telegramChatId   || null,
      whatsappPhone:    form.whatsappPhone     || null,
    }),
    onSuccess: () => {
      toast({ title: 'Settings saved', description: 'Auto-dispatch settings updated.' });
      qc.invalidateQueries({ queryKey: ['report-dispatch'] });
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  });

  const [testingChannel, setTestingChannel] = useState<'telegram' | 'whatsapp' | null>(null);
  const testMut = useMutation({
    mutationFn: (channel: 'telegram' | 'whatsapp') => reportsApi.testDispatch(channel),
    onMutate: (channel) => setTestingChannel(channel),
    onSuccess: (_, channel) => {
      toast({ title: `✅ Test ${channel === 'telegram' ? 'Telegram' : 'WhatsApp'} sent!`, description: 'Check your device for the test report.' });
      setTestingChannel(null);
    },
    onError: (err: any, channel) => {
      const msg = err?.response?.data?.error ?? 'Delivery failed.';
      toast({ title: `${channel} test failed`, description: msg, variant: 'destructive' });
      setTestingChannel(null);
    },
  });

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const inputCls = 'mt-1 block w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#183153] focus:outline-none focus:ring-2 focus:ring-[#183153]/30';

  return (
    <div className="rounded-[14px] border bg-white no-print"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]" style={{ background: isDark ? 'rgba(24,49,83,0.2)' : 'var(--rp-teal-bg)' }}>
            <Bell className="h-[14px] w-[14px]" style={{ color: '#183153' }} />
          </div>
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.07em] text-[#183153]">Auto-Dispatch Daily Report</span>
        </div>
        <button
          onClick={() => set('enabled', !form.enabled)}
          className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
          style={{ background: form.enabled ? '#183153' : '#d1cfc9' }}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      <p className="px-5 pb-4 text-[12px] text-[#64748b]">
        Send the daily report automatically to Telegram and/or WhatsApp every evening.
      </p>

      <div className="px-5 pb-5 space-y-5 border-t" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        <div className="pt-4 flex items-center gap-3">
          <Clock className="h-4 w-4 shrink-0 text-[#64748b] dark:text-[#a9c1d0]" />
          <div className="flex-1">
            <label className="text-[11.5px] font-medium text-[#64748b]">Send Time (24h, server timezone)</label>
            <input type="time" value={form.dispatchTime} onChange={e => set('dispatchTime', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* ── Telegram ── */}
        <div className="rounded-[10px] border p-4 space-y-3" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)', background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface-2)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-[14px] w-[14px]" style={{ color: '#183153' }} />
              <span className="text-[13px] font-medium text-[#183153]">Telegram</span>
            </div>
            <button
              onClick={() => set('telegramEnabled', !form.telegramEnabled)}
              className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
              style={{ background: form.telegramEnabled ? '#183153' : '#d1cfc9' }}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.telegramEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {form.telegramEnabled && (
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-[#64748b]">Bot Token</label>
                <input type="password" placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWxyz" value={form.telegramBotToken}
                  onChange={e => set('telegramBotToken', e.target.value)} className={inputCls} />
                <p className="mt-0.5 text-[11px] text-[#64748b]">Create a bot via <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: '#183153' }}>@BotFather</a> to get a token.</p>
              </div>
              <div>
                <label className="text-[11px] text-[#64748b]">Chat ID</label>
                <input type="text" placeholder="-1001234567890 or your personal chat ID" value={form.telegramChatId}
                  onChange={e => set('telegramChatId', e.target.value)} className={inputCls} />
                <p className="mt-0.5 text-[11px] text-[#64748b]">Send a message to the bot, then call <code className="rounded px-1" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-surface-4)' }}>/getUpdates</code> to find your chat_id.</p>
              </div>
              <button onClick={() => testMut.mutate('telegram')} disabled={testingChannel === 'telegram' || !form.telegramBotToken || !form.telegramChatId}
                className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] transition-colors disabled:opacity-50"
                style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                {testingChannel === 'telegram' ? '⏳ Sending…' : <><Send className="h-3 w-3" /> Send Test Message</>}
              </button>
            </div>
          )}
        </div>

        {/* ── WhatsApp ── */}
        <div className="rounded-[10px] border p-4 space-y-3" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)', background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface-2)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-[14px] w-[14px]" style={{ color: '#183153' }} />
              <span className="text-[13px] font-medium text-[#183153]">WhatsApp</span>
            </div>
            <button
              onClick={() => set('whatsappEnabled', !form.whatsappEnabled)}
              className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
              style={{ background: form.whatsappEnabled ? '#183153' : '#d1cfc9' }}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.whatsappEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {form.whatsappEnabled && (
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-[#64748b]">Recipient Phone Number</label>
                <input type="tel" placeholder="+8801XXXXXXXXX" value={form.whatsappPhone}
                  onChange={e => set('whatsappPhone', e.target.value)} className={inputCls} />
                <p className="mt-0.5 text-[11px] text-[#64748b]">Uses the WhatsApp gateway from Settings → SMS & WhatsApp.</p>
              </div>
              <button onClick={() => testMut.mutate('whatsapp')} disabled={testingChannel === 'whatsapp' || !form.whatsappPhone}
                className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] transition-colors disabled:opacity-50"
                style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                {testingChannel === 'whatsapp' ? '⏳ Sending…' : <><MessageCircle className="h-3 w-3" /> Send Test Message</>}
              </button>
            </div>
          )}
        </div>

        {dispatch?.lastDispatchedAt && (
          <div className="flex items-center gap-2 text-[12px] text-[#64748b] dark:text-[#a9c1d0]">
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#183153' }} />
            Last sent: {new Date(dispatch.lastDispatchedAt).toLocaleString()} (date: {dispatch.lastDispatchDate})
          </div>
        )}

        <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {saveMut.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
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

      <PageShell gap={6}>
        {/* ── Header ── */}
        <PageHeader
          title="Daily Report"
          subtitle="End-of-day summary for front desk & management"
          align="responsive"
          className="no-print"
          actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Date navigator */}
            <div className="flex items-center overflow-hidden rounded-[9px] border" style={{ borderColor: 'var(--rp-border-md)' }}>
              <button onClick={() => changeDate(-1)}
                className="px-3 py-2 text-[13px] hover:bg-[#f4f1eb] transition-colors border-r"
                style={{ borderColor: 'var(--rp-border)' }}>←</button>
              <input type="date" value={date} max={toLocalDate(new Date())} onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 text-[13px] bg-transparent focus:outline-none cursor-pointer text-[#183153]" />
              <button onClick={() => changeDate(1)} disabled={date >= toLocalDate(new Date())}
                className="px-3 py-2 text-[13px] hover:bg-[#f4f1eb] transition-colors border-l disabled:opacity-40"
                style={{ borderColor: 'var(--rp-border)' }}>→</button>
            </div>

            {date !== toLocalDate(new Date()) && (
              <button onClick={() => setDate(toLocalDate(new Date()))}
                className="rounded-[9px] border px-3 py-2 text-[12px] transition-colors hover:bg-[#f4f1eb]"
                style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Today</button>
            )}

            {/* Email button */}
            <button
              onClick={() => setShowEmailInput(!showEmailInput)}
              className="flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-[13px] transition-colors hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>

            {/* Print */}
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-[13px] transition-colors hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
          }
        />

        {/* Email input row */}
        {showEmailInput && (
          <div className="flex items-center gap-2 no-print">
            <input type="email" placeholder="recipient@email.com (leave blank for account email)"
              value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)}
              className="flex-1 rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-2 text-[13px] text-[#183153] focus:outline-none focus:ring-2 focus:ring-[#183153]/30" />
            <button onClick={() => emailMut.mutate()} disabled={emailMut.isPending}
              className="rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {emailMut.isPending ? 'Sending…' : 'Send Report'}
            </button>
            <button onClick={() => setShowEmailInput(false)}
              className="rounded-[9px] border px-3 py-2 text-[13px] transition-colors hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              Cancel
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-[14px] animate-pulse" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-surface-4)' }} />
              ))}
            </div>
            <div className="h-48 rounded-[14px] animate-pulse" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-surface-4)' }} />
            <div className="h-48 rounded-[14px] animate-pulse" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-surface-4)' }} />
          </div>
        )}

        {report && (
          <div id="report-content" className="space-y-6">
            {/* Report date banner */}
            <div className="rounded-[12px] border px-5 py-4 flex items-center justify-between"
              style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)' }}>
              <div className="flex items-center gap-3">
                <Calendar className="h-[18px] w-[18px]" style={{ color: '#183153' }} />
                <div>
                  <p className="text-[13.5px] font-semibold" style={{ color: '#183153' }}>{formatDisplayDate(date)}</p>
                  <p className="text-[12px]" style={{ color: '#183153' }}>{report.tenant.name}</p>
                </div>
              </div>
              <span className="text-[11.5px]" style={{ color: '#6386a3' }}>Generated {new Date().toLocaleTimeString()}</span>
            </div>

            {/* ── KPI strip ── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Occupancy" value={`${report.occupancy.rate}%`}
                sub={`${report.occupancy.occupied} / ${report.occupancy.totalRooms} rooms`} icon={TrendingUp} color="#183153" />
              <KpiCard label="Total Revenue" value={formatCurrency(report.revenue.total)}
                sub="Rooms + F&B + Extras" icon={Banknote} color="#183153" />
              <KpiCard label="Arrivals" value={report.arrivals.length}
                sub={`${report.arrivals.filter((a: any) => a.status === 'CHECKED_IN').length} checked in`} icon={LogIn} color="#b89040" />
              <KpiCard label="Departures" value={report.departures.length}
                sub={`${report.departures.filter((d: any) => d.status === 'CHECKED_OUT').length} checked out`} icon={LogOut} color="#b8724a" />
            </div>

            {/* ── Revenue & Payments ── */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue breakdown */}
              <div className="rounded-[14px] border bg-white p-5"
                style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="pb-3"><SectionHeader icon={Banknote} title="Revenue Breakdown" /></div>
                <div className="space-y-3">
                  {[
                    { label: 'Room Revenue', amount: report.revenue.rooms, color: '#183153' },
                    { label: 'Restaurant & F&B', amount: report.revenue.restaurant, color: '#b8724a' },
                    { label: 'Extras & Charges', amount: report.revenue.extras, color: '#b89040' },
                  ].map(({ label, amount, color }) => {
                    const pct = report.revenue.total > 0 ? Math.round((amount / report.revenue.total) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-[13px] mb-1.5">
                          <span style={{ color: 'var(--rp-text-muted)' }}>{label}</span>
                          <span className="font-medium text-[#183153] dark:text-[#f8fafc]">{formatCurrency(amount)}</span>
                        </div>
                        <div className="h-[6px] w-full rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-surface-4)' }}>
                          <div className="h-[6px] rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t flex justify-between text-[13px] font-semibold" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                    <span style={{ color: 'var(--rp-text)' }}>Total</span>
                    <span style={{ color: '#183153' }}>{formatCurrency(report.revenue.total)}</span>
                  </div>
                </div>
              </div>

              {/* Payment methods */}
              <div className="rounded-[14px] border bg-white p-5"
                style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="pb-3"><SectionHeader icon={CreditCard} title="Payment Methods" /></div>
                <div className="space-y-2">
                  {[
                    { label: 'Cash', icon: Banknote, amount: report.payments.cash, accent: '#183153', accentBg: 'var(--rp-teal-bg)' },
                    { label: 'Card / Online', icon: CreditCard, amount: report.payments.card, accent: '#183153', accentBg: 'var(--rp-teal-bg)' },
                    { label: 'Bank Transfer', icon: Building2, amount: report.payments.bankTransfer, accent: '#b89040', accentBg: 'var(--rp-amber-bg)' },
                    { label: 'Other', icon: Banknote, amount: report.payments.other, accent: 'var(--rp-text-muted)', accentBg: 'var(--rp-surface-3)' },
                  ].map(({ label, icon: Icon, amount, accent, accentBg }) => (
                    <div key={label} className="flex items-center justify-between rounded-[9px] p-3"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface-2)' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px]" style={{ background: accentBg }}>
                          <Icon className="h-[13px] w-[13px]" style={{ color: accent }} />
                        </div>
                        <span className="text-[13px] text-[#183153] dark:text-[#f8fafc]">{label}</span>
                      </div>
                      <span className="text-[13px] font-semibold" style={{ color: amount > 0 ? accent : 'var(--rp-text-muted)' }}>
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Arrivals table ── */}
            <div className="rounded-[14px] border bg-white p-5"
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="pb-3"><SectionHeader icon={LogIn} title="Arrivals" count={report.arrivals.length} /></div>
              {report.arrivals.length === 0 ? (
                <p className="text-[13px] text-center py-6 text-[#64748b] dark:text-[#a9c1d0]">No arrivals today</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface-2)' }}>
                        {['Guest','Room','Nights','Check-out','Status'].map((h, i) => (
                          <th key={h} className={`pb-2.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i > 1 ? 'text-right' : ''}`}
                            style={{ color: 'var(--rp-text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.arrivals.map((a: any) => (
                        <tr key={a.bookingId} className="border-b hover:bg-[#faf9f7] dark:hover:bg-white/5 transition-colors"
                          style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                          <td className="py-2.5 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{a.guestName}</td>
                          <td className="py-2.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{a.room}</td>
                          <td className="py-2.5 text-[13px] text-right text-[#64748b] dark:text-[#a9c1d0]">{a.nights}n</td>
                          <td className="py-2.5 text-[13px] text-right text-[#64748b] dark:text-[#a9c1d0]">{a.checkOut}</td>
                          <td className="py-2.5 text-right">
                            <span className="inline-block rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold"
                              style={a.status === 'CHECKED_IN'
                                ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }
                                : { background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)', color: '#b89040' }}>
                              {a.status === 'CHECKED_IN' ? 'In' : 'Due'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Departures table ── */}
            <div className="rounded-[14px] border bg-white p-5"
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="pb-3"><SectionHeader icon={LogOut} title="Departures" count={report.departures.length} /></div>
              {report.departures.length === 0 ? (
                <p className="text-[13px] text-center py-6 text-[#64748b] dark:text-[#a9c1d0]">No departures today</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface-2)' }}>
                        {['Guest','Room','Bill','Paid','Balance','Status'].map((h, i) => (
                          <th key={h} className={`pb-2.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i > 1 ? 'text-right' : ''}`}
                            style={{ color: 'var(--rp-text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.departures.map((d: any) => {
                        const balance = d.totalBill - d.paidAmount;
                        return (
                          <tr key={d.bookingId} className="border-b hover:bg-[#faf9f7] dark:hover:bg-white/5 transition-colors"
                            style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                            <td className="py-2.5 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{d.guestName}</td>
                            <td className="py-2.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{d.room}</td>
                            <td className="py-2.5 text-[13px] text-right text-[#183153] dark:text-[#f8fafc]">{formatCurrency(d.totalBill)}</td>
                            <td className="py-2.5 text-[13px] text-right font-medium" style={{ color: '#183153' }}>{formatCurrency(d.paidAmount)}</td>
                            <td className="py-2.5 text-[13px] text-right font-medium"
                              style={{ color: balance > 0 ? '#c43c3c' : '#183153' }}>
                              {balance > 0 ? formatCurrency(balance) : '✓ Settled'}
                            </td>
                            <td className="py-2.5 text-right">
                              <span className="inline-block rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold"
                                style={d.status === 'CHECKED_OUT'
                                  ? { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }
                                  : { background: 'var(--rp-coral-bg)', borderColor: 'rgba(184,114,74,0.2)', color: '#b8724a' }}>
                                {d.status === 'CHECKED_OUT' ? 'Out' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Operations ── */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* No-shows */}
              <div className="rounded-[14px] border bg-white p-5"
                style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="pb-3"><SectionHeader icon={AlertTriangle} title="No-Shows" count={report.noShows.length} /></div>
                {report.noShows.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-center">
                    <span className="text-2xl mb-1">✅</span>
                    <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No no-shows today</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.noShows.map((n: any) => (
                      <div key={n.bookingId} className="flex items-center gap-2.5 rounded-[9px] p-2.5"
                        style={{ background: isDark ? 'rgba(196,60,60,0.15)' : 'var(--rp-red-bg)' }}>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: '#c43c3c' }} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate text-[#183153] dark:text-[#f8fafc]">{n.guestName}</p>
                          <p className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">{n.room}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Housekeeping */}
              <div className="rounded-[14px] border bg-white p-5"
                style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="pb-3"><SectionHeader icon={Sparkles} title="Housekeeping" /></div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-[9px] p-3" style={{ background: isDark ? 'rgba(24,49,83,0.2)' : 'var(--rp-teal-bg)' }}>
                    <span className="text-[13px]" style={{ color: '#183153' }}>Completed</span>
                    <span className="text-[22px] font-semibold" style={{ color: '#183153' }}>{report.housekeeping.completed}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[9px] p-3" style={{ background: isDark ? 'rgba(184,144,64,0.18)' : 'var(--rp-amber-bg)' }}>
                    <span className="text-[13px]" style={{ color: '#b89040' }}>Pending</span>
                    <span className="text-[22px] font-semibold" style={{ color: '#b89040' }}>{report.housekeeping.pending}</span>
                  </div>
                  {(report.housekeeping.completed + report.housekeeping.pending) > 0 && (
                    <div className="h-[6px] rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-surface-4)' }}>
                      <div className="h-[6px] rounded-full transition-all" style={{
                        background: '#183153',
                        width: `${Math.round((report.housekeeping.completed / (report.housekeeping.completed + report.housekeeping.pending)) * 100)}%`,
                      }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Maintenance */}
              <div className="rounded-[14px] border bg-white p-5"
                style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="pb-3"><SectionHeader icon={Wrench} title="Maintenance" /></div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-[9px] p-3" style={{ background: isDark ? 'rgba(196,60,60,0.15)' : 'var(--rp-red-bg)' }}>
                    <span className="text-[13px]" style={{ color: '#c43c3c' }}>Open Tickets</span>
                    <span className="text-[22px] font-semibold" style={{ color: '#c43c3c' }}>{report.maintenance.open}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[9px] p-3" style={{ background: isDark ? 'rgba(24,49,83,0.2)' : 'var(--rp-teal-bg)' }}>
                    <span className="text-[13px]" style={{ color: '#183153' }}>Resolved Today</span>
                    <span className="text-[22px] font-semibold" style={{ color: '#183153' }}>{report.maintenance.resolvedToday}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print footer */}
            <div className="hidden print:block pt-4 border-t text-[11px] text-center" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
              <p>{report.tenant.name} · Daily Report · {formatDisplayDate(date)} · Generated {new Date().toLocaleString()}</p>
              <p className="mt-1">Confidential — ResortPro</p>
            </div>
          </div>
        )}

        {!isLoading && !report && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FileBarChart2 className="h-12 w-12 text-[#94a3b8] dark:text-[#7f99ab]" />
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No report data for {date}</p>
            <button onClick={() => refetch()}
              className="mt-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Auto-Dispatch Settings ── */}
        <DispatchSettings />
      </PageShell>
    </>
  );
}
