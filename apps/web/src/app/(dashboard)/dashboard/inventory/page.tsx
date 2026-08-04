'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, vendorsApi, purchaseOrdersApi } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { ModalShell } from '@/components/ui/modal-shell';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Package, AlertTriangle, TrendingDown, TrendingUp,
  Pencil, ArrowUpDown, ChevronLeft, ChevronRight, History, Clock, Loader2,
  Download, Upload, Truck, ClipboardList,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  unitCost: number;
  supplier?: string;
  vendorId?: string | null;
  vendor?: { id: string; name: string } | null;
  avgDailyUsage?: number;
  daysUntilStockout?: number | null;
}

interface Movement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason?: string;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  _count?: { items: number; purchaseOrders: number };
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';
  vendorName: string;
  itemCount: number;
  totalCost: number;
  notes?: string;
  sentAt?: string;
  receivedAt?: string;
  createdAt: string;
}

const CATEGORIES = ['', 'LINEN', 'TOILETRIES', 'CLEANING', 'FOOD_BEVERAGE', 'MAINTENANCE', 'OFFICE', 'OTHER'] as const;

const CAT_META: Record<string, { bg: string; border: string; text: string }> = {
  LINEN:        { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153' },
  TOILETRIES:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.15)', text: '#b8724a' },
  CLEANING:     { bg: 'var(--rp-teal-soft)', border: 'rgba(24,49,83,0.15)', text: 'var(--rp-text-accent)' },
  FOOD_BEVERAGE:{ bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  MAINTENANCE:  { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  OFFICE:       { bg: '#183153', border: 'rgba(24,49,83,0.4)',    text: '#f8fafc' },
  OTHER:        { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
};

const MOVEMENT_META = {
  IN:         { label: 'Stock In',    Icon: TrendingUp,   bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153' },
  OUT:        { label: 'Stock Out',   Icon: TrendingDown, bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  ADJUSTMENT: { label: 'Adjustment', Icon: ArrowUpDown,  bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
};

const PO_STATUS_META: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)' },
  SENT:      { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  RECEIVED:  { bg: 'var(--rp-teal-bg)', text: '#183153' },
  CANCELLED: { bg: 'var(--rp-red-bg)', text: '#c43c3c' },
};

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#183153] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#183153]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#64748b] mb-1.5';

// ── Item Modal ────────────────────────────────────────────────────────────────
function ItemModal({ open, onClose, loading, onSubmit, item, vendors }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  item?: InventoryItem | null;
  vendors: Vendor[];
}) {
  const [form, setForm] = useState({
    name: '', category: '', unit: '', currentStock: '0', minimumStock: '0', unitCost: '0', supplier: '', vendorId: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm({
        name:         item?.name ?? '',
        category:     item?.category ?? '',
        unit:         item?.unit ?? '',
        currentStock: item?.currentStock?.toString() ?? '0',
        minimumStock: item?.minimumStock?.toString() ?? '0',
        unitCost:     item?.unitCost?.toString() ?? '0',
        supplier:     item?.supplier ?? '',
        vendorId:     item?.vendorId ?? '',
      });
    }
  }, [open, item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.unit) {
      toast({ title: 'Missing fields', description: 'Name, category and unit are required', variant: 'destructive' }); return;
    }
    onSubmit({
      name: form.name, category: form.category, unit: form.unit,
      currentStock: parseFloat(form.currentStock) || 0,
      minimumStock: parseFloat(form.minimumStock) || 0,
      unitCost:     parseFloat(form.unitCost) || 0,
      supplier:     form.supplier || undefined,
      vendorId:     form.vendorId || null,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Item' : 'Add Inventory Item'}
      description={item ? `Editing ${item.name}` : 'Add a new item to your inventory'} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Item Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="White Bath Towels" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls + ' cursor-pointer'}>
              <option value="">Select category</option>
              {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Unit *</label>
            <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="pieces, kg, liters…" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Current Stock</label>
            <input value={form.currentStock} onChange={e => set('currentStock', e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Min. Stock</label>
            <input value={form.minimumStock} onChange={e => set('minimumStock', e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Unit Cost</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#aac0d0' }}>$</span>
              <input value={form.unitCost} onChange={e => set('unitCost', e.target.value)} className={inputCls + ' pl-6'} type="number" min="0" step="0.01" />
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Vendor <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
          <select value={form.vendorId} onChange={e => set('vendorId', e.target.value)} className={inputCls + ' cursor-pointer'}>
            <option value="">No vendor linked</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Supplier note <span style={{ color: 'var(--rp-text-faint)' }}>(optional, free text)</span></label>
          <input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Supplier name or contact" className={inputCls} />
        </div>
        <div className="flex gap-3 justify-end pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {item ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Movement Modal ────────────────────────────────────────────────────────────
function MovementModal({ open, onClose, item, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean;
  item: InventoryItem | null;
  onSubmit: (data: { quantity: number; type: string; reason?: string }) => void;
}) {
  const [type, setType]         = useState('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason]     = useState('');

  useEffect(() => {
    if (open) { setType('IN'); setQuantity(''); setReason(''); }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) { toast({ title: 'Invalid quantity', variant: 'destructive' }); return; }
    onSubmit({ quantity: qty, type, reason: reason || undefined });
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Stock Movement"
      description={item ? `Adjusting stock for: ${item.name}` : ''} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Movement Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['IN', 'OUT', 'ADJUSTMENT'] as const).map(v => {
              const m = MOVEMENT_META[v];
              return (
                <button key={v} type="button" onClick={() => setType(v)}
                  className="flex flex-col items-center gap-1.5 rounded-[10px] border-2 p-2.5 text-[11.5px] font-medium transition-all"
                  style={type === v
                    ? { background: m.bg, borderColor: m.border, color: m.text }
                    : { background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-muted)' }}>
                  <m.Icon className="h-4 w-4" /> {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className={labelCls}>
            Quantity ({item?.unit})
            {item && <span className="ml-2 text-[#94a3b8] dark:text-[#7f99ab]">Current: {item.currentStock}</span>}
          </label>
          <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" min="0" step="0.01" placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Reason <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Delivery, guest usage, damage…" className={inputCls} />
        </div>
        <div className="flex gap-3 justify-end pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Record Movement
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── History Modal ─────────────────────────────────────────────────────────────
function HistoryModal({ open, onClose, item }: {
  open: boolean; onClose: () => void; item: InventoryItem | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', item?.id],
    queryFn:  () => inventoryApi.getMovements(item!.id),
    enabled:  open && !!item?.id,
  });

  const movements: Movement[] = data?.data?.data ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Stock Movement History"
      description={item ? `${item.name} — last 50 movements` : ''} className="max-w-lg">
      {isLoading ? (
        <div className="space-y-2 py-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-[10px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
            <Clock className="h-6 w-6 text-[#94a3b8] dark:text-[#7f99ab]" />
          </div>
          <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">No movements yet</p>
          <p className="text-[12px] text-[#64748b] dark:text-[#a9c1d0]">Record a stock movement to see history here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {movements.map(m => {
            const cfg = MOVEMENT_META[m.type];
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-[10px] border p-3 transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                style={{ borderColor: 'var(--rp-border)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
                  style={{ background: cfg.bg }}>
                  <cfg.Icon className="h-4 w-4" style={{ color: cfg.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[6px] border px-[7px] py-[2px] text-[10.5px] font-semibold"
                      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
                      {cfg.label}
                    </span>
                    <span className="text-[13px] font-semibold text-[#183153] dark:text-[#f8fafc]">
                      {m.type === 'OUT' ? '-' : m.type === 'IN' ? '+' : ''}{m.quantity} {item?.unit}
                    </span>
                  </div>
                  {m.reason && <p className="text-[12px] mt-0.5 truncate text-[#64748b] dark:text-[#a9c1d0]">{m.reason}</p>}
                </div>
                <p className="text-[11.5px] shrink-0 text-[#94a3b8] dark:text-[#7f99ab]">
                  {new Date(m.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-end pt-3 mt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button onClick={onClose}
          className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
          style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// ── Vendor Modal ──────────────────────────────────────────────────────────────
function VendorModal({ open, onClose, loading, onSubmit, vendor }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  vendor?: Vendor | null;
}) {
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm({
        name: vendor?.name ?? '', contactName: vendor?.contactName ?? '', phone: vendor?.phone ?? '',
        email: vendor?.email ?? '', address: vendor?.address ?? '', notes: vendor?.notes ?? '',
      });
    }
  }, [open, vendor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast({ title: 'Vendor name is required', variant: 'destructive' }); return; }
    onSubmit({ ...form, contactName: form.contactName || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined });
  };

  return (
    <ModalShell open={open} onClose={onClose} title={vendor ? 'Edit Vendor' : 'Add Vendor'}
      description={vendor ? `Editing ${vendor.name}` : 'Add a supplier you order from'} maxWidth="520px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" form="vendor-form" disabled={loading}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {vendor ? 'Save Changes' : 'Add Vendor'}
          </button>
        </div>
      }>
      <form id="vendor-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Vendor Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dhaka Linen Supplies" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contact Person</label>
            <input value={form.contactName} onChange={e => set('contactName', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input value={form.email} onChange={e => set('email', e.target.value)} type="email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Address</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Create Purchase Order Modal ───────────────────────────────────────────────
function CreatePOModal({ open, onClose, vendors, loading, onSubmit }: {
  open: boolean; onClose: () => void; vendors: Vendor[]; loading: boolean;
  onSubmit: (data: { vendorId: string; notes?: string; items: { inventoryItemId: string; quantityOrdered: number; unitCost: number }[] }) => void;
}) {
  const [vendorId, setVendorId] = useState('');
  const [notes, setNotes]       = useState('');
  const [lines, setLines]       = useState<Record<string, { qty: string; cost: string; checked: boolean }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-low-stock-for-po'],
    queryFn:  () => inventoryApi.list({ lowStock: 'true', limit: 100 }),
    enabled:  open,
  });
  const lowStockItems: InventoryItem[] = data?.data?.data ?? [];

  useEffect(() => {
    if (open) {
      setVendorId(''); setNotes('');
    }
  }, [open]);

  useEffect(() => {
    if (open && lowStockItems.length > 0) {
      const initial: Record<string, { qty: string; cost: string; checked: boolean }> = {};
      for (const item of lowStockItems) {
        const suggested = Math.max(Number(item.minimumStock) * 2 - Number(item.currentStock), Number(item.minimumStock) || 1);
        initial[item.id] = { qty: String(Math.ceil(suggested)), cost: String(item.unitCost), checked: false };
      }
      setLines(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  const toggle = (id: string) => setLines(l => ({ ...l, [id]: { ...l[id], checked: !l[id].checked } }));
  const setLine = (id: string, k: 'qty' | 'cost', v: string) => setLines(l => ({ ...l, [id]: { ...l[id], [k]: v } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) { toast({ title: 'Select a vendor', variant: 'destructive' }); return; }
    const items = Object.entries(lines)
      .filter(([, v]) => v.checked)
      .map(([id, v]) => ({ inventoryItemId: id, quantityOrdered: parseFloat(v.qty) || 0, unitCost: parseFloat(v.cost) || 0 }))
      .filter(i => i.quantityOrdered > 0);
    if (items.length === 0) { toast({ title: 'Select at least one item', variant: 'destructive' }); return; }
    onSubmit({ vendorId, notes: notes || undefined, items });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Create Purchase Order"
      description="Reorder from low-stock items" maxWidth="640px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" form="po-form" disabled={loading}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Purchase Order
          </button>
        </div>
      }>
      <form id="po-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Vendor *</label>
          {vendors.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: 'var(--rp-text-muted)' }}>No vendors yet — add one in the Vendors tab first.</p>
          ) : (
            <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={inputCls + ' cursor-pointer'}>
              <option value="">Select vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className={labelCls}>Items to reorder</label>
          {isLoading ? (
            <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: '#aac0d0' }} /></div>
          ) : lowStockItems.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: 'var(--rp-text-muted)' }}>No items are currently below their minimum stock.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {lowStockItems.map(item => {
                const line = lines[item.id] ?? { qty: '0', cost: '0', checked: false };
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--rp-border)' }}>
                    <input type="checkbox" checked={line.checked} onChange={() => toggle(item.id)} className="h-4 w-4 cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{item.name}</p>
                      <p className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">Current: {item.currentStock} {item.unit} · Min: {item.minimumStock}</p>
                    </div>
                    <input value={line.qty} onChange={e => setLine(item.id, 'qty', e.target.value)} type="number" min="0" step="0.01"
                      className="w-20 rounded-[7px] border border-black/5 bg-[#f4f1eb] px-2 py-1.5 text-[12.5px] text-center" placeholder="Qty" />
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: '#aac0d0' }}>$</span>
                      <input value={line.cost} onChange={e => setLine(item.id, 'cost', e.target.value)} type="number" min="0" step="0.01"
                        className="w-full rounded-[7px] border border-black/5 bg-[#f4f1eb] pl-5 pr-2 py-1.5 text-[12.5px]" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Notes <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions, etc." className={inputCls} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── PO Detail / Receive Modal ─────────────────────────────────────────────────
function PODetailModal({ open, onClose, poId, onSend, onCancel, onReceive, sending, cancelling, receiving }: {
  open: boolean; onClose: () => void; poId: string | null;
  onSend: (id: string) => void; onCancel: (id: string) => void;
  onReceive: (id: string, items: { inventoryItemId: string; quantityReceived: number }[]) => void;
  sending: boolean; cancelling: boolean; receiving: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn:  () => purchaseOrdersApi.get(poId!),
    enabled:  open && !!poId,
  });
  const order = data?.data?.data;
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  useEffect(() => {
    if (order?.items) {
      const init: Record<string, string> = {};
      for (const line of order.items) init[line.inventoryItemId] = String(line.quantityOrdered);
      setReceiveQty(init);
    }
  }, [order]);

  const handleReceive = () => {
    const items = Object.entries(receiveQty).map(([id, v]) => ({ inventoryItemId: id, quantityReceived: parseFloat(v) || 0 })).filter(i => i.quantityReceived > 0);
    if (items.length === 0) { toast({ title: 'Enter received quantity for at least one item', variant: 'destructive' }); return; }
    onReceive(poId!, items);
  };

  return (
    <ModalShell open={open} onClose={onClose} title={order ? order.poNumber : 'Purchase Order'}
      description={order ? `${order.vendor?.name ?? ''} — ${order.status}` : ''} maxWidth="600px"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Close
          </button>
          {order?.status === 'DRAFT' && (
            <>
              <button onClick={() => onCancel(order.id)} disabled={cancelling}
                className="rounded-[9px] border px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ borderColor: 'rgba(200,60,60,0.25)', color: '#c43c3c' }}>
                Cancel Order
              </button>
              <button onClick={() => onSend(order.id)} disabled={sending}
                className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
                style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Mark as Sent
              </button>
            </>
          )}
          {order?.status === 'SENT' && (
            <button onClick={handleReceive} disabled={receiving}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {receiving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Receive Stock
            </button>
          )}
        </div>
      }>
      {isLoading || !order ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: '#aac0d0' }} /></div>
      ) : (
        <div className="space-y-3">
          {order.notes && <p className="text-[12.5px] italic" style={{ color: 'var(--rp-text-muted)' }}>&ldquo;{order.notes}&rdquo;</p>}
          {order.items.map((line: { id: string; inventoryItemId: string; quantityOrdered: number; quantityReceived: number; unitCost: number; inventoryItem: { name: string; unit: string } }) => (
            <div key={line.id} className="flex items-center gap-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--rp-border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{line.inventoryItem.name}</p>
                <p className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">
                  Ordered: {line.quantityOrdered} {line.inventoryItem.unit} · {formatCurrency(line.unitCost)}/unit
                  {line.quantityReceived > 0 && ` · Received: ${line.quantityReceived}`}
                </p>
              </div>
              {order.status === 'SENT' && (
                <input value={receiveQty[line.inventoryItemId] ?? ''} onChange={e => setReceiveQty(q => ({ ...q, [line.inventoryItemId]: e.target.value }))}
                  type="number" min="0" step="0.01"
                  className="w-24 rounded-[7px] border border-black/5 bg-[#f4f1eb] px-2 py-1.5 text-[12.5px] text-center" placeholder="Received" />
              )}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

// ── Vendors Tab ────────────────────────────────────────────────────────────────
function VendorsTab() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsApi.list() });
  const vendors: Vendor[] = data?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: unknown) => vendorsApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); toast({ title: 'Vendor added' }); setAddOpen(false); },
    onError: () => toast({ title: 'Error', description: 'Failed to add vendor', variant: 'destructive' }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => vendorsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); toast({ title: 'Vendor updated' }); setEditVendor(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to update vendor', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Add Vendor
        </button>
      </div>
      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="h-32 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Truck className="h-10 w-10" style={{ color: '#94a3b8' }} />
            <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">No vendors yet</p>
            <p className="text-[12px] text-[#64748b] dark:text-[#a9c1d0]">Add a supplier to start creating purchase orders</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--rp-surface-2)' }}>
                {['Vendor', 'Contact', 'Phone', 'Email', 'Items', 'POs', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#a9c1d0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id} className="transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{v.name}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{v.contactName ?? '—'}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{v.phone ?? '—'}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{v.email ?? '—'}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">{v._count?.items ?? 0}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">{v._count?.purchaseOrders ?? 0}</td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setEditVendor(v)} className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#e5f0f7]" style={{ color: '#aac0d0' }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <VendorModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
      <VendorModal open={!!editVendor} onClose={() => setEditVendor(null)} vendor={editVendor} loading={updateMutation.isPending}
        onSubmit={d => editVendor && updateMutation.mutate({ id: editVendor.id, data: d })} />
    </div>
  );
}

// ── Purchase Orders Tab ───────────────────────────────────────────────────────
function PurchaseOrdersTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: vendorsData } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsApi.list() });
  const vendors: Vendor[] = vendorsData?.data?.data ?? [];

  const { data, isLoading } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => purchaseOrdersApi.list() });
  const orders: PurchaseOrder[] = data?.data?.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-order', detailId] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (d: unknown) => purchaseOrdersApi.create(d),
    onSuccess: () => { invalidate(); toast({ title: 'Purchase order created' }); setCreateOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to create PO', variant: 'destructive' }),
  });
  const sendMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.send(id),
    onSuccess: () => { invalidate(); toast({ title: 'Marked as sent' }); },
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.cancel(id),
    onSuccess: () => { invalidate(); toast({ title: 'Order cancelled' }); setDetailId(null); },
  });
  const receiveMutation = useMutation({
    mutationFn: ({ id, items }: { id: string; items: { inventoryItemId: string; quantityReceived: number }[] }) => purchaseOrdersApi.receive(id, { items }),
    onSuccess: () => { invalidate(); toast({ title: 'Stock updated' }); setDetailId(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to receive order', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Create PO
        </button>
      </div>
      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="h-32 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <ClipboardList className="h-10 w-10" style={{ color: '#94a3b8' }} />
            <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">No purchase orders yet</p>
            <p className="text-[12px] text-[#64748b] dark:text-[#a9c1d0]">Create one from your low-stock items</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--rp-surface-2)' }}>
                {['PO Number', 'Vendor', 'Items', 'Total', 'Status', 'Created', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#a9c1d0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const sm = PO_STATUS_META[o.status];
                return (
                  <tr key={o.id} className="transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{o.poNumber}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{o.vendorName}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">{o.itemCount}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#183153] dark:text-[#f8fafc]">{formatCurrency(o.totalCost)}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: sm.bg, color: sm.text }}>{o.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">{new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setDetailId(o.id)}
                        className="rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-[#e5f0f7]"
                        style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <CreatePOModal open={createOpen} onClose={() => setCreateOpen(false)} vendors={vendors} loading={createMutation.isPending}
        onSubmit={d => createMutation.mutate(d)} />
      <PODetailModal open={!!detailId} onClose={() => setDetailId(null)} poId={detailId}
        onSend={id => sendMutation.mutate(id)} onCancel={id => cancelMutation.mutate(id)}
        onReceive={(id, items) => receiveMutation.mutate({ id, items })}
        sending={sendMutation.isPending} cancelling={cancelMutation.isPending} receiving={receiveMutation.isPending} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'items' | 'vendors' | 'purchase-orders'>('items');
  const [catFilter, setCatFilter]     = useState('');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [addOpen, setAddOpen]         = useState(false);
  const [editItem, setEditItem]       = useState<InventoryItem | null>(null);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', catFilter, search, lowStockOnly, page],
    queryFn: () => inventoryApi.list({
      category: catFilter || undefined,
      search:   search || undefined,
      lowStock: lowStockOnly ? 'true' : undefined,
      page, limit: 30,
    }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn:  () => inventoryApi.stats(),
  });

  const { data: vendorsData } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsApi.list() });
  const vendors: Vendor[] = vendorsData?.data?.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (d: unknown) => inventoryApi.create(d),
    onSuccess: () => { invalidate(); toast({ title: 'Item added' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to add item', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => inventoryApi.update(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Item updated' }); setEditItem(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }),
  });

  const movementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => inventoryApi.addMovement(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Stock updated' }); setMovementItem(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to record movement', variant: 'destructive' }),
  });

  const importMutation = useMutation({
    mutationFn: (rows: unknown[]) => inventoryApi.importCsv(rows),
    onSuccess: (res) => {
      invalidate();
      const { created, updated, errors } = res.data.data;
      toast({ title: 'Import complete', description: `${created} added, ${updated} updated${errors.length ? `, ${errors.length} failed` : ''}` });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to import CSV', variant: 'destructive' }),
  });

  const handleExport = async () => {
    try {
      const res = await inventoryApi.exportCsv();
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'inventory-export.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'Failed to export CSV', variant: 'destructive' });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) { toast({ title: 'CSV has no data rows', variant: 'destructive' }); return; }
      const parseCsvLine = (line: string) => line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const idx = {
        name: headers.findIndex(h => h.includes('name')),
        category: headers.findIndex(h => h.includes('category')),
        unit: headers.findIndex(h => h === 'unit'),
        currentStock: headers.findIndex(h => h.includes('current')),
        minimumStock: headers.findIndex(h => h.includes('minimum')),
        unitCost: headers.findIndex(h => h.includes('cost')),
        supplier: headers.findIndex(h => h.includes('supplier')),
      };
      if (idx.name === -1) { toast({ title: 'CSV must have a "Name" column', variant: 'destructive' }); return; }
      const rows = lines.slice(1).map(l => {
        const cols = parseCsvLine(l);
        return {
          name: cols[idx.name],
          category: idx.category > -1 ? cols[idx.category]?.toUpperCase().replace(' ', '_') : undefined,
          unit: idx.unit > -1 ? cols[idx.unit] : undefined,
          currentStock: idx.currentStock > -1 ? parseFloat(cols[idx.currentStock]) : undefined,
          minimumStock: idx.minimumStock > -1 ? parseFloat(cols[idx.minimumStock]) : undefined,
          unitCost: idx.unitCost > -1 ? parseFloat(cols[idx.unitCost]) : undefined,
          supplier: idx.supplier > -1 ? cols[idx.supplier] : undefined,
        };
      }).filter(r => r.name);
      importMutation.mutate(rows);
    };
    reader.readAsText(file);
  };

  const items: InventoryItem[] = data?.data?.data ?? [];
  const pagination              = data?.data?.pagination;
  const stats                   = statsData?.data?.data ?? { total: 0, lowStockCount: 0, totalValue: 0 };
  const totalItems              = stats.total         ?? 0;
  const lowStockCount           = stats.lowStockCount ?? 0;
  const totalValue              = stats.totalValue    ?? 0;

  return (
    <PageShell gap={6}>

      {/* Header */}
      <PageHeader
        title="Inventory"
        subtitle="Track stock levels, vendors, and purchase orders"
        align="center"
        actions={
          tab === 'items' && (
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}
              className="flex items-center gap-2 rounded-[9px] border px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-50"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import CSV
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-2 rounded-[9px] border px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-[10px] p-1 w-fit" style={{ background: 'var(--rp-surface-3)' }}>
        {([
          { key: 'items', label: 'Items' },
          { key: 'vendors', label: 'Vendors' },
          { key: 'purchase-orders', label: 'Purchase Orders' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="rounded-[8px] px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={tab === t.key
              ? { background: 'var(--rp-surface)', color: 'var(--rp-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
              : { color: 'var(--rp-text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vendors' ? <VendorsTab /> : tab === 'purchase-orders' ? <PurchaseOrdersTab /> : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Items',  value: totalItems,                Icon: Package,       iconBg: 'var(--rp-teal-bg)', iconColor: '#183153' },
              { label: 'Low Stock',    value: lowStockCount,             Icon: AlertTriangle, iconBg: lowStockCount > 0 ? 'var(--rp-red-bg)' : 'var(--rp-teal-bg)', iconColor: lowStockCount > 0 ? '#c43c3c' : '#183153' },
              { label: 'Stock Value',  value: formatCurrency(totalValue), Icon: TrendingUp,   iconBg: 'var(--rp-amber-bg)', iconColor: '#b89040' },
            ].map(({ label, value, Icon, iconBg, iconColor }) => (
              <div key={label} className="rounded-[14px] border bg-white p-4"
                style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[9px]"
                    style={{ background: iconBg }}>
                    <Icon className="h-[16px] w-[16px]" style={{ color: iconColor }} />
                  </div>
                  <p className="text-[12.5px] font-medium text-[#64748b] dark:text-[#a9c1d0]">{label}</p>
                </div>
                <p className="text-[26px] font-semibold leading-none text-[#183153] dark:text-[#f8fafc]">{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#aac0d0' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search items or supplier…"
                className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[9px] pl-9 pr-3 text-[13px] text-[#183153] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#183153]/30" />
            </div>
            <button onClick={() => { setLowStockOnly(v => !v); setPage(1); }}
              className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={lowStockOnly
                ? { background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.25)', color: '#c43c3c' }
                : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              <AlertTriangle className="h-3.5 w-3.5" /> Low Stock Only
            </button>
            {lowStockOnly && lowStockCount > 0 && (
              <button onClick={() => setTab('purchase-orders')}
                className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors hover:opacity-90"
                style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                <ClipboardList className="h-3.5 w-3.5" /> Create PO
              </button>
            )}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c || 'all'} onClick={() => { setCatFilter(c); setPage(1); }}
                  className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={catFilter === c
                    ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                    : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
                  {c ? c.replace('_', ' ') : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-[14px] border bg-white overflow-hidden"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            {isLoading ? (
              <div className="space-y-px">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-[72px] animate-pulse" style={{ background: i % 2 === 0 ? 'var(--rp-surface-2)' : 'var(--rp-surface)' }} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
                  <Package className="h-7 w-7" style={{ color: '#183153' }} />
                </div>
                <p className="text-[13.5px] font-medium text-[#183153] dark:text-[#f8fafc]">
                  {search || catFilter || lowStockOnly ? 'No items found' : 'No inventory yet'}
                </p>
                <p className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">
                  {search || catFilter ? 'Try adjusting filters' : 'Add your first inventory item'}
                </p>
                {!search && !catFilter && !lowStockOnly && (
                  <button onClick={() => setAddOpen(true)}
                    className="flex items-center gap-2 mt-1 rounded-[9px] px-4 py-2 text-[13px] font-medium"
                    style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                    <Plus className="h-4 w-4" /> Add Item
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      {['Item', 'Category', 'Stock', 'Unit Cost', 'Total Value', 'Vendor', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#a9c1d0]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const isLow  = Number(item.currentStock) <= Number(item.minimumStock);
                      const cm     = CAT_META[item.category] ?? CAT_META.OTHER;
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                          style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
                                style={{ background: isLow ? 'var(--rp-red-bg)' : 'var(--rp-teal-bg)' }}>
                                <Package className="h-4 w-4" style={{ color: isLow ? '#c43c3c' : '#183153' }} />
                              </div>
                              <div>
                                <p className="text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{item.name}</p>
                                {isLow && (
                                  <p className="text-[11.5px] flex items-center gap-0.5" style={{ color: '#c43c3c' }}>
                                    <AlertTriangle className="h-3 w-3" /> Low stock
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
                              style={{ background: cm.bg, borderColor: cm.border, color: cm.text }}>
                              {item.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-[13px] font-semibold" style={{ color: isLow ? '#c43c3c' : isDark ? '#f8fafc' : 'var(--rp-text)' }}>
                              {item.currentStock} {item.unit}
                            </p>
                            <p className="text-[11.5px] text-[#94a3b8] dark:text-[#7f99ab]">Min: {item.minimumStock}</p>
                            {item.daysUntilStockout !== null && item.daysUntilStockout !== undefined && (
                              <p className="text-[11px]" style={{ color: item.daysUntilStockout <= 7 ? '#c43c3c' : '#64748b' }}>
                                ~{item.daysUntilStockout} days left
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4 text-[13px] text-[#475569] dark:text-[#9db4c4]">{formatCurrency(Number(item.unitCost))}</td>
                          <td className="px-5 py-4 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">
                            {formatCurrency(Number(item.currentStock) * Number(item.unitCost))}
                          </td>
                          <td className="px-5 py-4 text-[13px] text-[#64748b] dark:text-[#a9c1d0]">{item.vendor?.name ?? item.supplier ?? '—'}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setMovementItem(item)}
                                className="flex items-center gap-1 rounded-[7px] border px-2 py-1 text-[11.5px] font-medium transition-colors hover:bg-[#e5f0f7]"
                                style={{ borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                                <ArrowUpDown className="h-3 w-3" /> Stock
                              </button>
                              <button onClick={() => setHistoryItem(item)}
                                className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#f4ecda] text-[#94a3b8] dark:text-[#7f99ab]" title="View history">
                                <History className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setEditItem(item)}
                                className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#e5f0f7]"
                                style={{ color: '#aac0d0' }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">
                Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-40"
                  style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-40"
                  style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ItemModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} vendors={vendors} />
      <ItemModal open={!!editItem} onClose={() => setEditItem(null)} item={editItem} loading={updateMutation.isPending} vendors={vendors}
        onSubmit={d => editItem && updateMutation.mutate({ id: editItem.id, data: d })} />
      <MovementModal open={!!movementItem} onClose={() => setMovementItem(null)} item={movementItem} loading={movementMutation.isPending}
        onSubmit={d => movementItem && movementMutation.mutate({ id: movementItem.id, data: d })} />
      <HistoryModal open={!!historyItem} onClose={() => setHistoryItem(null)} item={historyItem} />
    </PageShell>
  );
}
