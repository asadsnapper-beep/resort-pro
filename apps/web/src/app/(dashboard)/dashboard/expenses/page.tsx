'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  { value: 'SALARIES',       label: 'Salaries & Wages',   color: '#6366f1' },
  { value: 'UTILITIES',      label: 'Utilities',          color: '#22c55e' },
  { value: 'MAINTENANCE',    label: 'Maintenance',        color: '#f59e0b' },
  { value: 'CLEANING',       label: 'Cleaning',           color: '#14b8a6' },
  { value: 'FOOD_BEVERAGE',  label: 'Food & Beverage',   color: '#ec4899' },
  { value: 'SUPPLIES',       label: 'Supplies',           color: '#8b5cf6' },
  { value: 'MARKETING',      label: 'Marketing',          color: '#f97316' },
  { value: 'INSURANCE',      label: 'Insurance',          color: '#06b6d4' },
  { value: 'RENT',           label: 'Rent / Lease',       color: '#84cc16' },
  { value: 'EQUIPMENT',      label: 'Equipment',          color: '#a855f7' },
  { value: 'TRANSPORTATION', label: 'Transportation',     color: '#eab308' },
  { value: 'OTHER',          label: 'Other',              color: '#94a3b8' },
] as const;

type CategoryValue = typeof CATEGORIES[number]['value'];

const PAYMENT_MODES = ['CASH', 'BANK', 'CARD', 'OTHER'] as const;

function catLabel(v: string) {
  return CATEGORIES.find(c => c.value === v)?.label ?? v;
}
function catColor(v: string) {
  return CATEGORIES.find(c => c.value === v)?.color ?? '#94a3b8';
}

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
  date: todayStr(),
  category: 'OTHER',
  description: '',
  amount: '',
  vendor: '',
  paymentMode: 'CASH',
  notes: '',
};

// ── Tooltip ───────────────────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: { background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#e5e7eb' },
};

// ── Expense Modal ─────────────────────────────────────────────────────────────

function ExpenseModal({
  expense, onClose, currency,
}: {
  expense: Expense | null;
  onClose: () => void;
  currency: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ExpenseForm>(
    expense
      ? {
          date: format(parseISO(expense.date.slice(0, 10)), 'yyyy-MM-dd'),
          category: expense.category,
          description: expense.description,
          amount: String(expense.amount),
          vendor: expense.vendor ?? '',
          paymentMode: expense.paymentMode ?? 'CASH',
          notes: expense.notes ?? '',
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof ExpenseForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) {
      setErr('Date, description, and amount are required'); return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { setErr('Invalid amount'); return; }

    setSaving(true); setErr('');
    try {
      const payload = {
        date:        form.date,
        category:    form.category,
        description: form.description,
        amount:      amt,
        vendor:      form.vendor || undefined,
        paymentMode: form.paymentMode || undefined,
        notes:       form.notes || undefined,
      };

      if (expense) {
        await expensesApi.update(expense.id, payload);
        toast({ title: 'Expense updated' });
      } else {
        await expensesApi.create(payload);
        toast({ title: 'Expense added' });
      }

      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      qc.invalidateQueries({ queryKey: ['expense-trends'] });
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-resort-600" />
            {expense ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{currency}</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.amount} onChange={e => set('amount', e.target.value)}
                  className="pl-12"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set('category', c.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border-2 transition-all text-left"
                  style={{
                    borderColor: form.category === c.value ? c.color : '#e5e7eb',
                    backgroundColor: form.category === c.value ? `${c.color}15` : 'white',
                    color: form.category === c.value ? c.color : '#6b7280',
                    fontWeight: form.category === c.value ? 600 : 400,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <Input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="e.g. Monthly electricity bill"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor / Supplier</label>
              <Input value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="e.g. Dhaka Power" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
              <select
                value={form.paymentMode}
                onChange={e => set('paymentMode', e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Optional additional details..."
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {err && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            className="gap-2 bg-resort-600 hover:bg-resort-700 text-white"
            onClick={handleSave}
            loading={saving}
          >
            {expense ? 'Save Changes' : 'Add Expense'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, change, icon: Icon, color,
}: {
  label: string; value: string; sub?: string; change?: number;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          {change !== undefined && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
              change <= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
            }`}>
              {change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(change)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
        <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Custom Pie label ──────────────────────────────────────────────────────────

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { tenant } = useAuthStore();
  const currency = (tenant as any)?.currency ?? 'USD';
  const qc = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(monthStr(new Date()));
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [editingExpense, setEditingExpense] = useState<Expense | null | 'new'>('new' as any);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'charts'>('list');

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [currentMonth, filterCategory]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: expensesData, isLoading: listLoading } = useQuery({
    queryKey: ['expenses', currentMonth, filterCategory, page],
    queryFn: () => expensesApi.list({
      month: currentMonth,
      category: filterCategory || undefined,
      page,
      limit: 20,
    }).then(r => r.data.data),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['expense-summary', currentMonth],
    queryFn: () => expensesApi.summary(currentMonth).then(r => r.data.data),
  });

  const { data: trends } = useQuery({
    queryKey: ['expense-trends'],
    queryFn: () => expensesApi.trends().then(r => r.data.data as {
      month: string; expenses: number; revenue: number; profit: number;
    }[]),
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
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
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-resort-600" />
            Expenses
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track operational costs and view profit margins</p>
        </div>
        <Button
          className="gap-2 bg-resort-600 hover:bg-resort-700 text-white"
          onClick={() => { setEditingExpense(null); setShowModal(true); }}
        >
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </div>

      {/* ── Month navigator ── */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-2 rounded-lg border hover:bg-gray-50 transition-colors">
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-700 min-w-[110px] text-center">
          {monthLabel(currentMonth)}
        </span>
        <button
          onClick={nextMonth}
          disabled={currentMonth >= monthStr(new Date())}
          className="p-2 rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="ml-3 h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* ── KPI row ── */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Receipt} color="bg-red-50 text-red-600"
            label="Total Expenses" value={formatCurrency(summary.totalExpenses, currency)}
            sub={monthLabel(currentMonth)}
            change={summary.expenseGrowth}
          />
          <KpiCard
            icon={DollarSign} color="bg-indigo-50 text-indigo-600"
            label="Revenue" value={formatCurrency(summary.totalRevenue, currency)}
            sub="Paid payments this month"
          />
          <KpiCard
            icon={summary.profit >= 0 ? TrendingUp : TrendingDown}
            color={summary.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
            label="Net Profit" value={formatCurrency(Math.abs(summary.profit), currency)}
            sub={summary.profit < 0 ? 'Net loss' : 'After expenses'}
          />
          <KpiCard
            icon={BarChart2} color="bg-purple-50 text-purple-600"
            label="Profit Margin" value={`${summary.profitMargin}%`}
            sub="Revenue − expenses"
          />
        </div>
      ) : null}

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b">
        {(['list', 'charts'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === t ? 'border-resort-600 text-resort-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'list' ? 'Expense List' : 'Charts & Trends'}
          </button>
        ))}
      </div>

      {/* ── List tab ── */}
      {activeTab === 'list' && (
        <Card>
          <CardContent className="p-0">
            {listLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-resort-600" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Receipt className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No expenses for {monthLabel(currentMonth)}</p>
                <p className="text-sm text-gray-400 mt-1">Click "Add Expense" to record your first expense</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Category</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Description</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Vendor</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Amount</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Mode</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {expenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                            {fmtDate(exp.date.slice(0, 10))}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${catColor(exp.category)}18`, color: catColor(exp.category) }}
                            >
                              {catLabel(exp.category)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{exp.description}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{exp.vendor ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatCurrency(Number(exp.amount), currency)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {exp.paymentMode ? (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                {exp.paymentMode}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => { setEditingExpense(exp); setShowModal(true); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-resort-600 hover:bg-resort-50 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {deletingId === exp.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => deleteMutation.mutate(exp.id)}
                                    className="text-xs text-red-600 font-medium hover:underline px-1"
                                    disabled={deleteMutation.isPending}
                                  >
                                    Confirm
                                  </button>
                                  <button onClick={() => setDeletingId(null)} className="text-xs text-gray-400 hover:underline px-1">
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingId(exp.id)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Delete"
                                >
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
                  <div className="flex items-center justify-between px-5 py-3 border-t">
                    <p className="text-xs text-gray-500">
                      Page {page} of {totalPages} · {expensesData?.total} expenses
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Charts tab ── */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          {/* Category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Expenses by Category</h3>
                <p className="text-xs text-gray-500 mb-4">{monthLabel(currentMonth)}</p>
                {!summary?.byCategory?.length ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data for this month</div>
                ) : (
                  <div className="flex gap-4 items-center">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie
                          data={summary.byCategory}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%" cy="50%"
                          outerRadius={80}
                          labelLine={false}
                          label={PieLabel}
                        >
                          {summary.byCategory.map((c: { category: string }) => (
                            <Cell key={c.category} fill={catColor(c.category)} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [formatCurrency(v, currency)]}
                          labelFormatter={(l: string) => catLabel(l)}
                          {...tooltipStyle}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {summary.byCategory.map((c: { category: string; amount: number }) => (
                        <div key={c.category} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: catColor(c.category) }} />
                          <span className="text-xs text-gray-600 flex-1 truncate">{catLabel(c.category)}</span>
                          <span className="text-xs font-semibold text-gray-800">
                            {formatCurrency(c.amount, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category bar */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Category Comparison</h3>
                <p className="text-xs text-gray-500 mb-4">{monthLabel(currentMonth)}</p>
                {!summary?.byCategory?.length ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={summary.byCategory.map((c: { category: string; amount: number }) => ({
                        name: catLabel(c.category).split(' ')[0],
                        amount: c.amount,
                        fill: catColor(c.category),
                      }))}
                      margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip
                        formatter={(v: number) => [formatCurrency(v, currency), 'Amount']}
                        {...tooltipStyle}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {summary.byCategory.map((c: { category: string }) => (
                          <Cell key={c.category} fill={catColor(c.category)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue vs Expenses 12-month trend */}
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Revenue vs Expenses — 12 Months</h3>
              <p className="text-xs text-gray-500 mb-4">Monthly comparison with profit/loss</p>
              {!trends?.length ? (
                <div className="flex items-center justify-center h-52 text-gray-400 text-sm">No trend data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trends} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        formatCurrency(v, currency),
                        name.charAt(0).toUpperCase() + name.slice(1),
                      ]}
                      {...tooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" dot={false} name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" dot={false} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Profit trend */}
          {trends && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Net Profit — 12 Months</h3>
                <p className="text-xs text-gray-500 mb-4">Revenue minus expenses each month</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={trends} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : (v <= -1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v, currency), 'Net Profit']}
                      {...tooltipStyle}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                      {trends.map((t, i) => (
                        <Cell key={i} fill={t.profit >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <ExpenseModal
          expense={editingExpense === null ? null : (editingExpense as Expense)}
          currency={currency}
          onClose={() => { setShowModal(false); setEditingExpense(null); }}
        />
      )}
    </div>
  );
}
