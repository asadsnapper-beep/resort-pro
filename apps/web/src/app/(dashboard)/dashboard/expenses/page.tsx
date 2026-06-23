'use client';

import { ModalShell } from '@/components/ui/modal-shell';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import {
  Receipt, Plus, Pencil, Trash2, TrendingUp, TrendingDown,
  DollarSign, BarChart2, Loader2, X, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, AlertCircle,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import {
  format, startOfMonth, addMonths, subMonths, parseISO,
} from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'SALARIES',       label: 'Salaries & Wages', color: '#23766a' },
  { value: 'UTILITIES',      label: 'Utilities',        color: '#b89040' },
  { value: 'MAINTENANCE',    label: 'Maintenance',      color: '#b8724a' },
  { value: 'CLEANING',       label: 'Cleaning',         color: 'var(--rp-text-accent)' },
  { value: 'FOOD_BEVERAGE',  label: 'Food & Beverage',  color: '#c43c3c' },
  { value: 'SUPPLIES',       label: 'Supplies',         color: '#7a5c2a' },
  { value: 'MARKETING',      label: 'Marketing',        color: '#d4a853' },
  { value: 'INSURANCE',      label: 'Insurance',        color: '#9bbdb7' },
  { value: 'RENT',           label: 'Rent / Lease',     color: 'var(--rp-text-subtle)' },
  { value: 'EQUIPMENT',      label: 'Equipment',        color: '#1b342f' },
  { value: 'TRANSPORTATION', label: 'Transportation',   color: 'var(--rp-text-muted)' },
  { value: 'OTHER',          label: 'Other',            color: 'var(--rp-text-faint)' },
] as const;

type CategoryValue = typeof CATEGORIES[number]['value'];

const PAYMENT_MODES = ['CASH', 'BANK', 'CARD', 'OTHER'] as const;

function catLabel(v: string) { return CATEGORIES.find(c => c.value === v)?.label ?? v; }
function catColor(v: string) { return CATEGORIES.find(c => c.value === v)?.color ?? 'var(--rp-text-faint)'; }

// ── Types ─────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  date: string;
  category: CategoryValue;
  description: string;
  amount: number;
  vendor?: string;
  paymentMode?: string;
  notes?: string;
  createdAt: string;
}

interface ExpenseForm {
  date: string;
  category: CategoryValue;
  description: string;
  amount: string;
  vendor: string;
  paymentMode: string;
  notes: string;
}

function todayStr() { return format(new Date(), 'yyyy-MM-dd'); }
function monthStr(d: Date) { return format(d, 'yyyy-MM'); }
function monthLabel(m: string) { return format(parseISO(`${m}-01`), 'MMMM yyyy'); }
function prevMonthStr(m: string) { return monthStr(subMonths(parseISO(`${m}-01`), 1)); }
function nextMonthStr(m: string) { return monthStr(addMonths(parseISO(`${m}-01`), 1)); }
function fmtDate(d: string) { return format(parseISO(d), 'dd MMM'); }

const EMPTY_FORM: ExpenseForm = {
  date: todayStr(), category: 'OTHER', description: '',
  amount: '', vendor: '', paymentMode: 'CASH', notes: '',
};

const tooltipStyle = {
  contentStyle: { background: 'var(--rp-btn-accent)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 },
  labelStyle: { color: '#9bbdb7' },
  itemStyle: { color: 'var(--rp-btn-accent-text)' },
};

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

// ── Expense Modal ─────────────────────────────────────────────────────────────

function ExpenseModal({ expense, onClose, currency }: {
  expense: Expense | null; onClose: () => void; currency: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ExpenseForm>(
    expense ? {
      date: format(parseISO(expense.date.slice(0, 10)), 'yyyy-MM-dd'),
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      vendor: expense.vendor ?? '',
      paymentMode: expense.paymentMode ?? 'CASH',
      notes: expense.notes ?? '',
    } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof ExpenseForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) { setErr('Date, description, and amount are required'); return; }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { setErr('Invalid amount'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        date: form.date, category: form.category, description: form.description, amount: amt,
        vendor: form.vendor || undefined, paymentMode: form.paymentMode || undefined, notes: form.notes || undefined,
      };
      if (expense) { await expensesApi.update(expense.id, payload); toast({ title: 'Expense updated' }); }
      else          { await expensesApi.create(payload);             toast({ title: 'Expense added' }); }
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      qc.invalidateQueries({ queryKey: ['expense-trends'] });
      onClose();
    } catch (e: any) { setErr(e?.response?.data?.error ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={expense ? 'Edit Expense' : 'Add Expense'}
      description={expense ? 'Update expense details' : 'Record a new expense'}
      maxWidth="520px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving}
            className="rounded-[9px] border px-4 py-2 text-[13px] transition-colors hover:bg-[#f4f1eb] dark:hover:bg-white/5 disabled:opacity-50"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {expense ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">{currency}</span>
                <input type="number" min="0" step="0.01" value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  className={inputCls + ' pl-11'} placeholder="0.00" />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Category *</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => set('category', c.value)}
                  className="rounded-[8px] border-2 px-2 py-1.5 text-[11.5px] text-left transition-all"
                  style={{
                    borderColor: form.category === c.value ? c.color : 'var(--rp-border)',
                    background: form.category === c.value ? `${c.color}18` : 'var(--rp-surface-2)',
                    color: form.category === c.value ? c.color : 'var(--rp-text-subtle)',
                    fontWeight: form.category === c.value ? 600 : 400,
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Description *</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="e.g. Monthly electricity bill" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Vendor / Supplier</label>
              <input value={form.vendor} onChange={e => set('vendor', e.target.value)}
                placeholder="e.g. Dhaka Power" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payment Mode</label>
              <select value={form.paymentMode} onChange={e => set('paymentMode', e.target.value)}
                className={inputCls}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Optional additional details..."
              className="w-full resize-none rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30" />
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-[8px] border px-3 py-2"
              style={{ background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-[12.5px]">{err}</span>
            </div>
          )}
        </div>
    </ModalShell>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, change, icon: Icon, color }: {
  label: string; value: string; sub?: string; change?: number;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-[14px] border bg-white dark:bg-white/5 p-5"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[9px]" style={{ background: color }}>
          <Icon className="w-[15px] h-[15px] text-white" />
        </div>
        {change !== undefined && (
          <span className="flex items-center gap-0.5 rounded-[7px] border px-[9px] py-[4px] text-[11px] font-semibold"
            style={change <= 0
              ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
              : { background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }}>
            {change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#18231f]">{value}</p>
      <p className="text-[12px] font-medium text-[#8aa29a] mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-[#c5bdb4] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Pie label ─────────────────────────────────────────────────────────────────

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Chart card shell ──────────────────────────────────────────────────────────

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border bg-white dark:bg-white/5 p-5"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <h3 className="text-[13.5px] font-semibold text-[#18231f]">{title}</h3>
      {sub && <p className="text-[11.5px] text-[#8aa29a] mt-0.5 mb-4">{sub}</p>}
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { tenant } = useAuthStore();
  const currency = (tenant as any)?.currency ?? 'BDT';
  const qc = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(monthStr(new Date()));
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'charts'>('list');

  useEffect(() => { setPage(1); }, [currentMonth, filterCategory]);

  const { data: expensesData, isLoading: listLoading } = useQuery({
    queryKey: ['expenses', currentMonth, filterCategory, page],
    queryFn: () => expensesApi.list({ month: currentMonth, category: filterCategory || undefined, page, limit: 20 }).then(r => r.data.data),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['expense-summary', currentMonth],
    queryFn: () => expensesApi.summary(currentMonth).then(r => r.data.data),
  });

  const { data: trends } = useQuery({
    queryKey: ['expense-trends'],
    queryFn: () => expensesApi.trends().then(r => r.data.data as { month: string; expenses: number; revenue: number; profit: number }[]),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      qc.invalidateQueries({ queryKey: ['expense-trends'] });
      toast({ title: 'Expense deleted' });
      setDeletingId(null);
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const prevMonth = () => setCurrentMonth(m => prevMonthStr(m));
  const nextMonth = () => setCurrentMonth(m => nextMonthStr(m));

  const expenses: Expense[] = expensesData?.expenses ?? [];
  const totalPages = expensesData?.pages ?? 1;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Expenses</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Track operational costs and view profit margins</p>
        </div>
        <button onClick={() => { setEditingExpense(null); setShowModal(true); }}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      {/* Month navigator + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-[9px] border" style={{ borderColor: 'var(--rp-border-md)' }}>
          <button onClick={prevMonth}
            className="border-r px-3 py-2 transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-[13px] font-semibold px-1 text-[#18231f] dark:text-[#dfd9d0]">
            {monthLabel(currentMonth)}
          </span>
          <button onClick={nextMonth} disabled={currentMonth >= monthStr(new Date())}
            className="border-l px-3 py-2 transition-colors hover:bg-[#f4f1eb] disabled:opacity-40"
            style={{ borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="rounded-[9px] border border-black/5 bg-[#f4f1eb] px-3 py-2 text-[13px] text-[#18231f] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* KPI row */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-[14px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Receipt} color="#c43c3c"
            label="Total Expenses" value={formatCurrency(summary.totalExpenses, currency)}
            sub={monthLabel(currentMonth)} change={summary.expenseGrowth} />
          <KpiCard icon={DollarSign} color="#23766a"
            label="Revenue" value={formatCurrency(summary.totalRevenue, currency)}
            sub="Paid payments this month" />
          <KpiCard icon={summary.profit >= 0 ? TrendingUp : TrendingDown}
            color={summary.profit >= 0 ? '#1b342f' : '#c43c3c'}
            label="Net Profit" value={formatCurrency(Math.abs(summary.profit), currency)}
            sub={summary.profit < 0 ? 'Net loss' : 'After expenses'} />
          <KpiCard icon={BarChart2} color="#b89040"
            label="Profit Margin" value={`${summary.profitMargin}%`}
            sub="Revenue − expenses" />
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-0 border-b" style={{ borderColor: 'var(--rp-border)' }}>
        {(['list', 'charts'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors capitalize"
            style={{
              borderColor: activeTab === t ? '#23766a' : 'transparent',
              color: activeTab === t ? '#23766a' : 'var(--rp-text-muted)',
            }}>
            {t === 'list' ? 'Expense List' : 'Charts & Trends'}
          </button>
        ))}
      </div>

      {/* ── List tab ── */}
      {activeTab === 'list' && (
        <div className="rounded-[14px] border bg-white dark:bg-white/5"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          {listLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#23766a' }} />
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt className="h-12 w-12 mb-3 text-[#c5bdb4] dark:text-[#6e8580]" />
              <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">
                No expenses for {monthLabel(currentMonth)}
              </p>
              <p className="text-[12px] mt-1 text-[#8aa29a] dark:text-[#94b8b0]">
                Click "Add Expense" to record your first expense
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ background: 'var(--rp-surface-2)', borderColor: 'rgba(0,0,0,0.04)' }}>
                      {['Date','Category','Description','Vendor','Amount','Mode',''].map((h, i) => (
                        <th key={i}
                          className={`px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${i >= 4 ? 'text-right' : 'text-left'}`}
                          style={{ color: 'var(--rp-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp.id} className="border-b hover:bg-[#faf9f7] dark:hover:bg-white/5 transition-colors"
                        style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap text-[#7a9890] dark:text-[#94b8b0]">
                          {fmtDate(exp.date.slice(0, 10))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold"
                            style={{
                              background: `${catColor(exp.category)}15`,
                              borderColor: `${catColor(exp.category)}30`,
                              color: catColor(exp.category),
                            }}>
                            {catLabel(exp.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] max-w-[200px] truncate text-[#18231f] dark:text-[#dfd9d0]">
                          {exp.description}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                          {exp.vendor ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold whitespace-nowrap text-[#18231f] dark:text-[#dfd9d0]">
                          {formatCurrency(Number(exp.amount), currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {exp.paymentMode ? (
                            <span className="rounded-[6px] border px-[8px] py-[3px] text-[11px]"
                              style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-muted)' }}>
                              {exp.paymentMode}
                            </span>
                          ) : <span style={{ color: 'var(--rp-text-faint)' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEditingExpense(exp); setShowModal(true); }}
                              className="rounded-[7px] p-1.5 transition-colors hover:bg-[#e3f2ef] text-[#8aa29a] dark:text-[#94b8b0]" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {deletingId === exp.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => deleteMutation.mutate(exp.id)} disabled={deleteMutation.isPending}
                                  className="text-[12px] font-medium px-1 hover:underline" style={{ color: '#c43c3c' }}>
                                  Confirm
                                </button>
                                <button onClick={() => setDeletingId(null)}
                                  className="text-[12px] px-1 hover:underline text-[#8aa29a] dark:text-[#94b8b0]">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setDeletingId(exp.id)}
                                className="rounded-[7px] p-1.5 transition-colors hover:bg-[#fef2f2] text-[#8aa29a] dark:text-[#94b8b0]" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-5 py-3"
                  style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                  <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                    Page {page} of {totalPages} · {expensesData?.total} expenses
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="rounded-[8px] border p-1.5 transition-colors hover:bg-[#f4f1eb] disabled:opacity-40"
                      style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="rounded-[8px] border p-1.5 transition-colors hover:bg-[#f4f1eb] disabled:opacity-40"
                      style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Charts tab ── */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie */}
            <ChartCard title="Expenses by Category" sub={monthLabel(currentMonth)}>
              {!summary?.byCategory?.length ? (
                <div className="flex items-center justify-center h-48 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                  No data for this month
                </div>
              ) : (
                <div className="flex gap-4 items-center mt-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={summary.byCategory} dataKey="amount" nameKey="category"
                        cx="50%" cy="50%" outerRadius={80} labelLine={false} label={PieLabel}>
                        {summary.byCategory.map((c: { category: string }) => (
                          <Cell key={c.category} fill={catColor(c.category)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatCurrency(v, currency)]}
                        labelFormatter={(l: string) => catLabel(l)} {...tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {summary.byCategory.map((c: { category: string; amount: number }) => (
                      <div key={c.category} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: catColor(c.category) }} />
                        <span className="flex-1 truncate text-[12px] text-[#7a9890] dark:text-[#94b8b0]">{catLabel(c.category)}</span>
                        <span className="text-[12px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                          {formatCurrency(c.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>

            {/* Bar */}
            <ChartCard title="Category Comparison" sub={monthLabel(currentMonth)}>
              {!summary?.byCategory?.length ? (
                <div className="flex items-center justify-center h-48 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No data</div>
              ) : (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={summary.byCategory.map((c: { category: string; amount: number }) => ({
                      name: catLabel(c.category).split(' ')[0], amount: c.amount, fill: catColor(c.category),
                    }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-surface-4)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip formatter={(v: number) => [formatCurrency(v, currency), 'Amount']} {...tooltipStyle} />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {summary.byCategory.map((c: { category: string }) => (
                          <Cell key={c.category} fill={catColor(c.category)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Revenue vs Expenses trend */}
          <ChartCard title="Revenue vs Expenses — 12 Months" sub="Monthly comparison with profit/loss">
            {!trends?.length ? (
              <div className="flex items-center justify-center h-52 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                No trend data yet
              </div>
            ) : (
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trends} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revGradExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#23766a" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#23766a" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGradExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c43c3c" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#c43c3c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-surface-4)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip formatter={(v: number, name: string) => [formatCurrency(v, currency), name.charAt(0).toUpperCase() + name.slice(1)]}
                      {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--rp-text-muted)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#23766a" strokeWidth={2} fill="url(#revGradExp)" dot={false} name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stroke="#c43c3c" strokeWidth={2} fill="url(#expGradExp)" dot={false} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Net profit bar */}
          {trends && (
            <ChartCard title="Net Profit — 12 Months" sub="Revenue minus expenses each month">
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={trends} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rp-surface-4)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--rp-text-muted)' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : (v <= -1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, currency), 'Net Profit']} {...tooltipStyle} />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                      {trends.map((t, i) => (
                        <Cell key={i} fill={t.profit >= 0 ? '#23766a' : '#c43c3c'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ExpenseModal
          expense={editingExpense}
          currency={currency}
          onClose={() => { setShowModal(false); setEditingExpense(null); }}
        />
      )}
    </div>
  );
}
