'use client';

import { createPortal } from 'react-dom';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { invoiceApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Download, Mail, Plus, Trash2,
  CheckCircle2, Clock, AlertTriangle, FileText,
  CreditCard, Banknote, Building2, Loader2, X,
  Pencil, Save,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface InvoiceItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoicePayment {
  id: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
  paidAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmt: number;
  discountNote?: string;
  total: number;
  paidAmount: number;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  booking?: { id: string; confirmationNo: string } | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

/* ── Status config ─────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400' },
  SENT:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  PAID:      { label: 'Paid',      color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  PARTIAL:   { label: 'Partial',   color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  OVERDUE:   { label: 'Overdue',   color: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-400',   dot: 'bg-gray-300' },
};

const METHOD_ICON: Record<string, React.ReactNode> = {
  CASH:          <Banknote className="h-3.5 w-3.5" />,
  CARD:          <CreditCard className="h-3.5 w-3.5" />,
  BANK_TRANSFER: <Building2 className="h-3.5 w-3.5" />,
  STRIPE:        <CreditCard className="h-3.5 w-3.5" />,
  OTHER:         <CreditCard className="h-3.5 w-3.5" />,
};

const ITEM_CATEGORIES = ['ROOM', 'FOOD', 'SERVICE', 'LAUNDRY', 'MINIBAR', 'OTHER'] as const;

/* ════════════════════════════════════════════════════════════════════════════ */
export default function InvoiceDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const qc     = useQueryClient();
  const { tenant, token } = useAuthStore();

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const handleDownloadPdf = useCallback(async () => {
    if (!token) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(invoiceApi.pdfUrl(id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'PDF download failed', variant: 'destructive' });
    } finally {
      setDownloadingPdf(false);
    }
  }, [id, token]);
  const currency   = tenant?.currency ?? 'BDT';
  const fmt = (n: number) => `${currency} ${Number(n).toLocaleString()}`;

  /* ── State ── */
  const [showAddItem,     setShowAddItem]     = useState(false);
  const [showPayment,     setShowPayment]     = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);

  const [newItem, setNewItem] = useState({ description: '', category: 'OTHER', quantity: 1, unitPrice: 0 });
  const [payForm, setPayForm] = useState({ amount: 0, method: 'CASH', reference: '', note: '' });
  const [settingsForm, setSettingsForm] = useState({ taxRate: 0, discountAmt: 0, discountNote: '', dueDate: '', notes: '' });

  /* ── Query ── */
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn:  () => invoiceApi.get(id),
  });
  const inv: Invoice | null = data?.data?.data ?? null;

  /* ── Mutations ── */
  const invalidate = () => qc.invalidateQueries({ queryKey: ['invoice', id] });

  const addItemMut = useMutation({
    mutationFn: () => invoiceApi.addItem(id, { ...newItem, quantity: Number(newItem.quantity), unitPrice: Number(newItem.unitPrice) }),
    onSuccess: () => { invalidate(); setShowAddItem(false); setNewItem({ description: '', category: 'OTHER', quantity: 1, unitPrice: 0 }); toast({ title: 'Item added' }); },
    onError:   () => toast({ title: 'Error', description: 'Failed to add item', variant: 'destructive' }),
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId: string) => invoiceApi.deleteItem(id, itemId),
    onSuccess: () => { invalidate(); toast({ title: 'Item removed' }); },
  });

  const paymentMut = useMutation({
    mutationFn: () => invoiceApi.recordPayment(id, { ...payForm, amount: Number(payForm.amount) }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setShowPayment(false);
      setPayForm({ amount: 0, method: 'CASH', reference: '', note: '' });
      toast({ title: '✓ Payment recorded' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: () => invoiceApi.update(id, {
      taxRate:      settingsForm.taxRate     ? Number(settingsForm.taxRate)     : undefined,
      discountAmt:  settingsForm.discountAmt ? Number(settingsForm.discountAmt) : undefined,
      discountNote: settingsForm.discountNote || undefined,
      dueDate:      settingsForm.dueDate     || undefined,
      notes:        settingsForm.notes       || undefined,
    }),
    onSuccess: () => { invalidate(); setEditingSettings(false); toast({ title: 'Invoice updated' }); },
    onError:   () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const sendMut = useMutation({
    mutationFn: () => invoiceApi.send(id),
    onSuccess: () => { invalidate(); toast({ title: '✓ Invoice sent to guest\'s email' }); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to send email', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: () => invoiceApi.delete(id),
    onSuccess: () => { router.push('/dashboard/invoices'); toast({ title: 'Invoice deleted' }); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Cannot delete', description: err?.response?.data?.error, variant: 'destructive' }),
  });

  /* ── Loading ── */
  if (isLoading || !inv) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  const cfg         = STATUS_CFG[inv.status] ?? STATUS_CFG.DRAFT;
  const outstanding = Number(inv.total) - Number(inv.paidAmount);
  const canEdit     = !['PAID', 'CANCELLED'].includes(inv.status);

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => router.push('/dashboard/invoices')}
            className="h-9 w-9 flex items-center justify-center rounded-lg border hover:bg-gray-50 transition-colors mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{inv.invoiceNumber}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.color}`}>
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} /> {cfg.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Created {new Date(inv.createdAt).toLocaleDateString()}
              {inv.booking && (
                <> · Booking <span className="font-mono text-blue-600">{inv.booking.confirmationNo}</span></>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {inv.guestEmail && (
            <Button variant="outline" className="gap-2" onClick={() => sendMut.mutate()} loading={sendMut.isPending}>
              <Mail className="h-4 w-4" /> Send Email
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={handleDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </Button>
          {outstanding > 0 && inv.status !== 'CANCELLED' && (
            <Button className="gap-2" onClick={() => { setPayForm(f => ({ ...f, amount: outstanding })); setShowPayment(true); }}>
              <CheckCircle2 className="h-4 w-4" /> Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* LEFT — Guest + Items */}
        <div className="lg:col-span-2 space-y-5">

          {/* Guest info */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Bill To</p>
              <p className="font-bold text-gray-900 text-lg">{inv.guestName}</p>
              {inv.guestEmail && <p className="text-sm text-muted-foreground">{inv.guestEmail}</p>}
              {inv.guestPhone && <p className="text-sm text-muted-foreground">{inv.guestPhone}</p>}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Line Items</h3>
                {canEdit && (
                  <button onClick={() => setShowAddItem(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-resort-600 hover:text-resort-700">
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2 text-center">Category</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="w-6" />
                </div>

                {inv.items.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No items yet. Add a line item.</p>
                ) : (
                  inv.items.map(item => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 px-2 py-2.5 rounded-lg hover:bg-gray-50 items-center group">
                      <div className="col-span-5">
                        <p className="text-sm font-medium text-gray-900 leading-snug">{item.description}</p>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.category}</span>
                      </div>
                      <div className="col-span-2 text-center text-sm text-gray-600">{item.quantity}</div>
                      <div className="col-span-2 text-right">
                        <p className="text-sm font-semibold text-gray-900">{fmt(item.total)}</p>
                        <p className="text-xs text-muted-foreground">{fmt(item.unitPrice)} each</p>
                      </div>
                      <div className="col-span-1 text-right">
                        {canEdit && (
                          <button onClick={() => deleteItemMut.mutate(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add item form */}
              {showAddItem && (
                <div className="mt-4 rounded-xl border border-resort-200 bg-resort-50/40 p-4 space-y-4">
                  <p className="text-sm font-semibold text-gray-800">New Line Item</p>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Description</label>
                    <Input
                      value={newItem.description}
                      onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))}
                      placeholder="e.g. Room Service, Laundry, Airport Transfer"
                      autoFocus
                    />
                  </div>

                  {/* Category + Qty */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Category</label>
                      <select
                        value={newItem.category}
                        onChange={e => setNewItem(f => ({ ...f, category: e.target.value }))}
                        className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-resort-500">
                        {ITEM_CATEGORIES.map(c => (
                          <option key={c} value={c}>
                            {c === 'ROOM' ? '🛏 Room' : c === 'FOOD' ? '🍽 Food & Beverage' : c === 'SERVICE' ? '🛎 Service' : c === 'LAUNDRY' ? '👕 Laundry' : c === 'MINIBAR' ? '🍹 Minibar' : '📦 Other'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Quantity</label>
                      <Input
                        type="number" min="1"
                        value={newItem.quantity}
                        onChange={e => setNewItem(f => ({ ...f, quantity: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  {/* Unit price + live total */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Unit Price ({currency})</label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={newItem.unitPrice || ''}
                      onChange={e => setNewItem(f => ({ ...f, unitPrice: Number(e.target.value) }))}
                      placeholder="0.00"
                    />
                    {newItem.unitPrice > 0 && newItem.quantity > 0 && (
                      <p className="text-xs text-resort-700 font-medium pt-0.5">
                        Total: {fmt(newItem.unitPrice * newItem.quantity)}
                        {newItem.quantity > 1 && <span className="text-gray-400 font-normal"> ({newItem.quantity} × {fmt(newItem.unitPrice)})</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => addItemMut.mutate()} loading={addItemMut.isPending}
                      disabled={!newItem.description.trim() || newItem.unitPrice <= 0}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAddItem(false); setNewItem({ description: '', category: 'OTHER', quantity: 1, unitPrice: 0 }); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment history */}
          {inv.payments.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Payment History</h3>
                <div className="space-y-2">
                  {inv.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                          {METHOD_ICON[p.method]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.method.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.paidAt).toLocaleDateString()}
                            {p.reference && ` · Ref: ${p.reference}`}
                          </p>
                          {p.note && <p className="text-xs text-gray-400">{p.note}</p>}
                        </div>
                      </div>
                      <p className="font-semibold text-green-700">{fmt(p.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT — Totals + Settings */}
        <div className="space-y-5">

          {/* Totals */}
          <Card>
            <CardContent className="p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Summary</p>
              {[
                { label: 'Subtotal', value: fmt(inv.subtotal) },
                ...(Number(inv.taxRate) > 0 ? [{ label: `Tax (${inv.taxRate}%)`, value: fmt(inv.taxAmount) }] : []),
                ...(Number(inv.discountAmt) > 0 ? [{ label: `Discount${inv.discountNote ? ` (${inv.discountNote})` : ''}`, value: `-${fmt(inv.discountAmt)}` }] : []),
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="text-gray-900">{row.value}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex items-center justify-between">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-xl text-gray-900">{fmt(inv.total)}</span>
              </div>
              {Number(inv.paidAmount) > 0 && (
                <div className="flex items-center justify-between text-sm text-green-600">
                  <span>Paid</span>
                  <span className="font-semibold">{fmt(inv.paidAmount)}</span>
                </div>
              )}
              {outstanding > 0 && (
                <div className="flex items-center justify-between text-sm font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
                  <span>Outstanding</span>
                  <span>{fmt(outstanding)}</span>
                </div>
              )}
              {outstanding <= 0 && inv.status === 'PAID' && (
                <div className="flex items-center gap-2 text-sm font-semibold text-green-600 bg-green-50 rounded-lg px-3 py-2 mt-2">
                  <CheckCircle2 className="h-4 w-4" /> Fully Paid
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Settings</p>
                {!editingSettings ? (
                  <button onClick={() => {
                    setSettingsForm({
                      taxRate:      String(inv.taxRate) as unknown as number,
                      discountAmt:  String(inv.discountAmt) as unknown as number,
                      discountNote: inv.discountNote ?? '',
                      dueDate:      inv.dueDate ? inv.dueDate.slice(0, 10) : '',
                      notes:        inv.notes ?? '',
                    });
                    setEditingSettings(true);
                  }}
                    className="text-xs text-resort-600 hover:text-resort-700 flex items-center gap-1">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                ) : (
                  <button onClick={() => setEditingSettings(false)}
                    className="text-xs text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {!editingSettings ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax Rate</span><span>{inv.taxRate}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{fmt(inv.discountAmt)}</span></div>
                  {inv.dueDate && <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span>{new Date(inv.dueDate).toLocaleDateString()}</span></div>}
                  {inv.notes && <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{inv.notes}</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Tax Rate (%)</label>
                    <Input type="number" min="0" max="100"
                      value={settingsForm.taxRate}
                      onChange={e => setSettingsForm(f => ({ ...f, taxRate: e.target.value as unknown as number }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Discount ({currency})</label>
                    <Input type="number" min="0"
                      value={settingsForm.discountAmt}
                      onChange={e => setSettingsForm(f => ({ ...f, discountAmt: e.target.value as unknown as number }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Discount Note</label>
                    <Input value={settingsForm.discountNote}
                      onChange={e => setSettingsForm(f => ({ ...f, discountNote: e.target.value }))}
                      placeholder="e.g. Loyalty discount"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Due Date</label>
                    <Input type="date" value={settingsForm.dueDate}
                      onChange={e => setSettingsForm(f => ({ ...f, dueDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Notes</label>
                    <textarea
                      value={settingsForm.notes}
                      onChange={e => setSettingsForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      placeholder="Internal notes or guest message"
                    />
                  </div>
                  <Button size="sm" className="w-full gap-2" onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
                    <Save className="h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger zone */}
          {canEdit && (
            <button
              onClick={() => { if (confirm('Delete this invoice?')) deleteMut.mutate(); }}
              className="w-full text-xs text-red-400 hover:text-red-600 hover:underline py-1">
              {inv.paidAmount > 0 ? 'Cancel invoice' : 'Delete invoice'}
            </button>
          )}
        </div>
      </div>

      {/* ── Record Payment Modal ──────────────────────────────────────────── */}
      {showPayment && createPortal((
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowPayment(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Record Payment</h3>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Amount ({currency})</label>
              <Input type="number" min="0"
                value={payForm.amount}
                onChange={e => setPayForm(f => ({ ...f, amount: Number(e.target.value) }))}
              />
              {outstanding > 0 && (
                <button onClick={() => setPayForm(f => ({ ...f, amount: outstanding }))}
                  className="text-xs text-resort-600 hover:underline mt-1">
                  Use outstanding amount ({fmt(outstanding)})
                </button>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Payment Method</label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map(m => (
                  <button key={m} onClick={() => setPayForm(f => ({ ...f, method: m }))}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-colors ${
                      payForm.method === m ? 'border-resort-600 bg-resort-50 text-resort-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {METHOD_ICON[m]}
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Reference (optional)</label>
              <Input value={payForm.reference}
                onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="Transaction ID, receipt #"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <Input value={payForm.note}
                onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Paid at check-out"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={() => paymentMut.mutate()}
                loading={paymentMut.isPending} disabled={payForm.amount <= 0}>
                <CheckCircle2 className="h-4 w-4" /> Record
              </Button>
            </div>
          </div>
        </>
      ), document.body)}
    </div>
  );
}
