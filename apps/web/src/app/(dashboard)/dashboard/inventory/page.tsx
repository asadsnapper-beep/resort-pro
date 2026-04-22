'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Package, AlertTriangle, TrendingDown, TrendingUp,
  Pencil, ArrowUpDown, ChevronLeft, ChevronRight,
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

const CATEGORIES = ['', 'LINEN', 'TOILETRIES', 'CLEANING', 'FOOD_BEVERAGE', 'MAINTENANCE', 'OFFICE', 'OTHER'] as const;

const CAT_COLORS: Record<string, string> = {
  LINEN: 'bg-blue-100 text-blue-700',
  TOILETRIES: 'bg-pink-100 text-pink-700',
  CLEANING: 'bg-green-100 text-green-700',
  FOOD_BEVERAGE: 'bg-orange-100 text-orange-700',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700',
  OFFICE: 'bg-purple-100 text-purple-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

function ItemModal({ open, onClose, loading, onSubmit, item }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  item?: InventoryItem | null;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    category: item?.category ?? '',
    unit: item?.unit ?? '',
    currentStock: item?.currentStock?.toString() ?? '0',
    minimumStock: item?.minimumStock?.toString() ?? '0',
    unitCost: item?.unitCost?.toString() ?? '0',
    supplier: item?.supplier ?? '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.unit) {
      toast({ title: 'Missing fields', description: 'Name, category and unit are required', variant: 'destructive' }); return;
    }
    onSubmit({
      name: form.name,
      category: form.category,
      unit: form.unit,
      currentStock: parseFloat(form.currentStock) || 0,
      minimumStock: parseFloat(form.minimumStock) || 0,
      unitCost: parseFloat(form.unitCost) || 0,
      supplier: form.supplier || undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Item' : 'Add Inventory Item'} description={item ? `Editing ${item.name}` : 'Add a new item to your inventory'} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Item Name *</label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="White Bath Towels" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Select category</option>
              {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Unit *</label>
            <Input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="pieces, kg, liters..." />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Current Stock</label>
            <Input value={form.currentStock} onChange={e => set('currentStock', e.target.value)} type="number" min="0" step="0.01" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Min. Stock</label>
            <Input value={form.minimumStock} onChange={e => set('minimumStock', e.target.value)} type="number" min="0" step="0.01" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Unit Cost</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input value={form.unitCost} onChange={e => set('unitCost', e.target.value)} className="pl-6" type="number" min="0" step="0.01" />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Supplier</label>
          <Input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Supplier name or contact" />
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{item ? 'Save Changes' : 'Add Item'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function MovementModal({ open, onClose, item, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean;
  item: InventoryItem | null;
  onSubmit: (data: { quantity: number; type: string; reason?: string }) => void;
}) {
  const [type, setType] = useState('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast({ title: 'Invalid quantity', variant: 'destructive' }); return; }
    onSubmit({ quantity: qty, type, reason: reason || undefined });
    setQuantity(''); setReason('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Stock Movement" description={item ? `Adjusting stock for: ${item.name}` : ''} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Movement Type</label>
          <div className="grid grid-cols-3 gap-2">
            {[{ v: 'IN', label: 'Stock In', icon: TrendingUp, cls: 'text-green-700 border-green-200 bg-green-50' },
              { v: 'OUT', label: 'Stock Out', icon: TrendingDown, cls: 'text-red-700 border-red-200 bg-red-50' },
              { v: 'ADJUSTMENT', label: 'Adjust', icon: ArrowUpDown, cls: 'text-blue-700 border-blue-200 bg-blue-50' }].map(opt => (
              <button key={opt.v} type="button" onClick={() => setType(opt.v)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-xs font-medium transition-all ${type === opt.v ? opt.cls + ' border-opacity-100' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <opt.icon className="h-4 w-4" /> {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Quantity ({item?.unit})
            {item && <span className="ml-2 text-xs text-muted-foreground">Current: {item.currentStock}</span>}
          </label>
          <Input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" min="0" step="0.01" placeholder="0" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Delivery, guest usage, damage..." />
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Record Movement</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', catFilter, lowStockOnly, page],
    queryFn: () => inventoryApi.list({ category: catFilter || undefined, lowStock: lowStockOnly ? 'true' : undefined, page, limit: 30 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => inventoryApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast({ title: 'Item added' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to add item', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => inventoryApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast({ title: 'Item updated' }); setEditItem(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }),
  });

  const movementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => inventoryApi.addMovement(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory'] }); toast({ title: 'Stock updated' }); setMovementItem(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to record movement', variant: 'destructive' }),
  });

  const allItems: InventoryItem[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const total = pagination?.total ?? 0;

  const items = allItems.filter(i =>
    search === '' ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.supplier?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = allItems.filter(i => Number(i.currentStock) <= Number(i.minimumStock)).length;
  const totalValue = allItems.reduce((s, i) => s + Number(i.currentStock) * Number(i.unitCost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track stock levels and movements</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Item</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Items', value: total || 0, icon: Package, color: 'bg-resort-50 border-resort-200 text-resort-700' },
          { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, color: lowStockCount > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Stock Value', value: formatCurrency(totalValue), icon: TrendingUp, color: 'bg-blue-50 border-blue-200 text-blue-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 opacity-70" /><p className="text-xs font-medium opacity-70">{label}</p></div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items or supplier..." className="pl-9" />
        </div>
        <button
          onClick={() => setLowStockOnly(v => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${lowStockOnly ? 'bg-red-600 text-white border-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <AlertTriangle className="h-3.5 w-3.5" /> Low Stock Only
        </button>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${catFilter === c ? 'bg-resort-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {c ? c.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px">{[...Array(6)].map((_, i) => <div key={i} className="h-[72px] bg-gray-50 animate-pulse border-b" />)}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Package className="h-14 w-14 text-gray-200 mb-4" />
              <p className="font-medium text-gray-500">{search || catFilter || lowStockOnly ? 'No items found' : 'No inventory yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{search || catFilter ? 'Try adjusting filters' : 'Add your first inventory item'}</p>
              {!search && !catFilter && !lowStockOnly && <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Item</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Item</th>
                    <th className="px-5 py-3 text-left">Category</th>
                    <th className="px-5 py-3 text-left">Stock</th>
                    <th className="px-5 py-3 text-left">Unit Cost</th>
                    <th className="px-5 py-3 text-left">Total Value</th>
                    <th className="px-5 py-3 text-left">Supplier</th>
                    <th className="px-5 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(item => {
                    const isLow = Number(item.currentStock) <= Number(item.minimumStock);
                    const catClass = CAT_COLORS[item.category] ?? 'bg-gray-100 text-gray-700';
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{item.name}</p>
                              {isLow && (
                                <p className="text-xs text-red-600 flex items-center gap-0.5">
                                  <AlertTriangle className="h-3 w-3" /> Low stock
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${catClass}`}>
                            {item.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className={`text-sm font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.currentStock} {item.unit}
                          </p>
                          <p className="text-xs text-muted-foreground">Min: {item.minimumStock}</p>
                        </td>
                        <td className="px-5 py-4 text-sm">{formatCurrency(Number(item.unitCost))}</td>
                        <td className="px-5 py-4 text-sm font-medium">{formatCurrency(Number(item.currentStock) * Number(item.unitCost))}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{item.supplier ?? '—'}</td>
                        <td className="px-5 py-4">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setMovementItem(item)}>
                              <ArrowUpDown className="h-3 w-3" /> Stock
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-resort-600" onClick={() => setEditItem(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <ItemModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
      <ItemModal open={!!editItem} onClose={() => setEditItem(null)} item={editItem} loading={updateMutation.isPending} onSubmit={d => editItem && updateMutation.mutate({ id: editItem.id, data: d })} />
      <MovementModal open={!!movementItem} onClose={() => setMovementItem(null)} item={movementItem} loading={movementMutation.isPending}
        onSubmit={d => movementItem && movementMutation.mutate({ id: movementItem.id, data: d })} />
    </div>
  );
}
