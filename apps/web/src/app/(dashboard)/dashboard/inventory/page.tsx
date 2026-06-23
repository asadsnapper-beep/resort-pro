'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Package, AlertTriangle, TrendingDown, TrendingUp,
  Pencil, ArrowUpDown, ChevronLeft, ChevronRight, History, Clock, Loader2,
} from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  unitCost: number;
  supplier?: string;
}

interface Movement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason?: string;
  createdAt: string;
}

const CATEGORIES = ['', 'LINEN', 'TOILETRIES', 'CLEANING', 'FOOD_BEVERAGE', 'MAINTENANCE', 'OFFICE', 'OTHER'] as const;

const CAT_META: Record<string, { bg: string; border: string; text: string }> = {
  LINEN:        { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  TOILETRIES:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.15)', text: '#b8724a' },
  CLEANING:     { bg: 'var(--rp-teal-soft)', border: 'rgba(35,118,106,0.15)', text: 'var(--rp-text-accent)' },
  FOOD_BEVERAGE:{ bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  MAINTENANCE:  { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  OFFICE:       { bg: '#1b342f', border: 'rgba(27,52,47,0.4)',    text: '#dfd9d0' },
  OTHER:        { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
};

const MOVEMENT_META = {
  IN:         { label: 'Stock In',    Icon: TrendingUp,   bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  OUT:        { label: 'Stock Out',   Icon: TrendingDown, bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  ADJUSTMENT: { label: 'Adjustment', Icon: ArrowUpDown,  bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
};

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

// ── Item Modal ────────────────────────────────────────────────────────────────
function ItemModal({ open, onClose, loading, onSubmit, item }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  item?: InventoryItem | null;
}) {
  const [form, setForm] = useState({
    name: '', category: '', unit: '', currentStock: '0', minimumStock: '0', unitCost: '0', supplier: '',
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#9bbdb7' }}>$</span>
              <input value={form.unitCost} onChange={e => set('unitCost', e.target.value)} className={inputCls + ' pl-6'} type="number" min="0" step="0.01" />
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Supplier <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
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
            {item && <span className="ml-2 text-[#c5bdb4] dark:text-[#6e8580]">Current: {item.currentStock}</span>}
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
            <Clock className="h-6 w-6 text-[#c5bdb4] dark:text-[#6e8580]" />
          </div>
          <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">No movements yet</p>
          <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">Record a stock movement to see history here</p>
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
                    <span className="text-[13px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                      {m.type === 'OUT' ? '-' : m.type === 'IN' ? '+' : ''}{m.quantity} {item?.unit}
                    </span>
                  </div>
                  {m.reason && <p className="text-[12px] mt-0.5 truncate text-[#8aa29a] dark:text-[#94b8b0]">{m.reason}</p>}
                </div>
                <p className="text-[11.5px] shrink-0 text-[#c5bdb4] dark:text-[#6e8580]">
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const queryClient = useQueryClient();
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

  const items: InventoryItem[] = data?.data?.data ?? [];
  const pagination              = data?.data?.pagination;
  const stats                   = statsData?.data?.data ?? { total: 0, lowStockCount: 0, totalValue: 0 };
  const totalItems              = stats.total         ?? 0;
  const lowStockCount           = stats.lowStockCount ?? 0;
  const totalValue              = stats.totalValue    ?? 0;

  return (
    <div className="space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Inventory</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Track stock levels and movements</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Items',  value: totalItems,                Icon: Package,       iconBg: 'var(--rp-teal-bg)', iconColor: '#23766a' },
          { label: 'Low Stock',    value: lowStockCount,             Icon: AlertTriangle, iconBg: lowStockCount > 0 ? 'var(--rp-red-bg)' : 'var(--rp-teal-bg)', iconColor: lowStockCount > 0 ? '#c43c3c' : '#23766a' },
          { label: 'Stock Value',  value: formatCurrency(totalValue), Icon: TrendingUp,   iconBg: 'var(--rp-amber-bg)', iconColor: '#b89040' },
        ].map(({ label, value, Icon, iconBg, iconColor }) => (
          <div key={label} className="rounded-[14px] border bg-white p-4"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[9px]"
                style={{ background: iconBg }}>
                <Icon className="h-[16px] w-[16px]" style={{ color: iconColor }} />
              </div>
              <p className="text-[12.5px] font-medium text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
            </div>
            <p className="text-[26px] font-semibold leading-none text-[#18231f] dark:text-[#dfd9d0]">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9bbdb7' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search items or supplier…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[9px] pl-9 pr-3 text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30" />
        </div>
        <button onClick={() => { setLowStockOnly(v => !v); setPage(1); }}
          className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={lowStockOnly
            ? { background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.25)', color: '#c43c3c' }
            : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
          <AlertTriangle className="h-3.5 w-3.5" /> Low Stock Only
        </button>
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
              <Package className="h-7 w-7" style={{ color: '#23766a' }} />
            </div>
            <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">
              {search || catFilter || lowStockOnly ? 'No items found' : 'No inventory yet'}
            </p>
            <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
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
                  {['Item', 'Category', 'Stock', 'Unit Cost', 'Total Value', 'Supplier', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">
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
                    <tr key={item.id} className="transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5 dark:hover:bg-white/5"
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
                            style={{ background: isLow ? 'var(--rp-red-bg)' : 'var(--rp-teal-bg)' }}>
                            <Package className="h-4 w-4" style={{ color: isLow ? '#c43c3c' : '#23766a' }} />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{item.name}</p>
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
                        <p className="text-[13px] font-semibold" style={{ color: isLow ? '#c43c3c' : isDark ? '#dfd9d0' : 'var(--rp-text)' }}>
                          {item.currentStock} {item.unit}
                        </p>
                        <p className="text-[11.5px] text-[#c5bdb4] dark:text-[#6e8580]">Min: {item.minimumStock}</p>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[#4a6e66] dark:text-[#6d9990]">{formatCurrency(Number(item.unitCost))}</td>
                      <td className="px-5 py-4 text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">
                        {formatCurrency(Number(item.currentStock) * Number(item.unitCost))}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">{item.supplier ?? '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setMovementItem(item)}
                            className="flex items-center gap-1 rounded-[7px] border px-2 py-1 text-[11.5px] font-medium transition-colors hover:bg-[#e3f2ef]"
                            style={{ borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
                            <ArrowUpDown className="h-3 w-3" /> Stock
                          </button>
                          <button onClick={() => setHistoryItem(item)}
                            className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#f4ecda] text-[#c5bdb4] dark:text-[#6e8580]" title="View history">
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditItem(item)}
                            className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#e3f2ef]"
                            style={{ color: '#9bbdb7' }}>
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
          <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
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

      <ItemModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
      <ItemModal open={!!editItem} onClose={() => setEditItem(null)} item={editItem} loading={updateMutation.isPending}
        onSubmit={d => editItem && updateMutation.mutate({ id: editItem.id, data: d })} />
      <MovementModal open={!!movementItem} onClose={() => setMovementItem(null)} item={movementItem} loading={movementMutation.isPending}
        onSubmit={d => movementItem && movementMutation.mutate({ id: movementItem.id, data: d })} />
      <HistoryModal open={!!historyItem} onClose={() => setHistoryItem(null)} item={historyItem} />
    </div>
  );
}
