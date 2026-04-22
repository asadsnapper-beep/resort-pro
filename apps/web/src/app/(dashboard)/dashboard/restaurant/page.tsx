'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, UtensilsCrossed, Coffee, ChefHat, Pencil, Trash2,
  CheckCircle2, XCircle, Star,
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  isAvailable: boolean;
  image?: string;
}

const CATEGORIES = ['', 'BREAKFAST', 'LUNCH', 'DINNER', 'APPETIZER', 'DESSERT', 'BEVERAGE', 'SPECIAL'] as const;

const CAT_ICONS: Record<string, React.ElementType> = {
  BREAKFAST: Coffee,
  LUNCH: UtensilsCrossed,
  DINNER: ChefHat,
  APPETIZER: Star,
  DESSERT: Star,
  BEVERAGE: Coffee,
  SPECIAL: Star,
};

const CAT_COLORS: Record<string, string> = {
  BREAKFAST: 'bg-amber-100 text-amber-700',
  LUNCH: 'bg-orange-100 text-orange-700',
  DINNER: 'bg-red-100 text-red-700',
  APPETIZER: 'bg-green-100 text-green-700',
  DESSERT: 'bg-pink-100 text-pink-700',
  BEVERAGE: 'bg-blue-100 text-blue-700',
  SPECIAL: 'bg-purple-100 text-purple-700',
};

function MenuItemModal({ open, onClose, loading, onSubmit, item }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  item?: MenuItem | null;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    category: item?.category ?? '',
    price: item?.price?.toString() ?? '',
    isAvailable: item?.isAvailable ?? true,
    image: item?.image ?? '',
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // Reset when item changes
  useState(() => {
    setForm({
      name: item?.name ?? '',
      description: item?.description ?? '',
      category: item?.category ?? '',
      price: item?.price?.toString() ?? '',
      isAvailable: item?.isAvailable ?? true,
      image: item?.image ?? '',
    });
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.price) {
      toast({ title: 'Missing fields', description: 'Name, category and price are required', variant: 'destructive' }); return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      toast({ title: 'Invalid price', description: 'Price must be a positive number', variant: 'destructive' }); return;
    }
    onSubmit({ name: form.name, description: form.description || undefined, category: form.category, price, isAvailable: form.isAvailable, image: form.image || undefined });
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Menu Item' : 'Add Menu Item'} description={item ? `Editing ${item.name}` : 'Add a new item to your menu'} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Item Name *</label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Classic Club Sandwich" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Select category</option>
              {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Price *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input value={form.price} onChange={e => set('price', e.target.value)} className="pl-6" placeholder="12.50" type="number" step="0.01" min="0" />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
            placeholder="Brief description of the dish..."
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Image URL</label>
          <Input value={form.image} onChange={e => set('image', e.target.value)} placeholder="https://..." type="url" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="available" checked={form.isAvailable} onChange={e => set('isAvailable', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-resort-600 focus:ring-resort-500" />
          <label htmlFor="available" className="text-sm font-medium text-gray-700">Available on menu</label>
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{item ? 'Save Changes' : 'Add Item'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RestaurantPage() {
  const queryClient = useQueryClient();
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['menu', catFilter],
    queryFn: () => menuApi.list({ category: catFilter || undefined, limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => menuApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); toast({ title: 'Menu item added' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to add item', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => menuApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); toast({ title: 'Menu item updated' }); setEditItem(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => menuApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['menu'] }); toast({ title: 'Menu item removed' }); setDeleteItem(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => menuApi.update(id, { isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu'] }),
  });

  const allItems: MenuItem[] = data?.data?.data ?? [];
  const items = allItems.filter(i =>
    search === '' ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.description?.toLowerCase().includes(search.toLowerCase())
  );

  const availableCount = allItems.filter(i => i.isAvailable).length;
  const totalCategories = new Set(allItems.map(i => i.category)).size;

  // Group items by category for card view
  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurant & Menu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {allItems.length > 0 ? `${allItems.length} items · ${availableCount} available` : 'Manage your restaurant menu'}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Items', value: allItems.length, icon: UtensilsCrossed, color: 'bg-resort-50 border-resort-200 text-resort-700' },
          { label: 'Available', value: availableCount, icon: CheckCircle2, color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Categories', value: totalCategories, icon: ChefHat, color: 'bg-blue-50 border-blue-200 text-blue-700' },
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
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu items..." className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${catFilter === c ? 'bg-resort-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {c || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <UtensilsCrossed className="h-14 w-14 text-gray-200 mb-4" />
          <p className="font-medium text-gray-500">{search || catFilter ? 'No items found' : 'No menu items yet'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{search || catFilter ? 'Try adjusting filters' : 'Add your first menu item to get started'}</p>
          {!search && !catFilter && <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Item</Button>}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, catItems]) => {
            const CatIcon = CAT_ICONS[category] ?? UtensilsCrossed;
            const catColor = CAT_COLORS[category] ?? 'bg-gray-100 text-gray-700';
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${catColor}`}>
                    <CatIcon className="h-3.5 w-3.5" /> {category}
                  </span>
                  <span className="text-xs text-muted-foreground">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map(item => (
                    <Card key={item.id} className={`overflow-hidden transition-all hover:shadow-md ${!item.isAvailable ? 'opacity-60' : ''}`}>
                      {item.image && (
                        <div className="h-32 overflow-hidden">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                            {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                          </div>
                          <p className="text-sm font-bold text-resort-700 flex-shrink-0">{formatCurrency(Number(item.price))}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => toggleMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                            className={`flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${item.isAvailable ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {item.isAvailable ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {item.isAvailable ? 'Available' : 'Unavailable'}
                          </button>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-resort-600" onClick={() => setEditItem(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => setDeleteItem(item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MenuItemModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
      <MenuItemModal open={!!editItem} onClose={() => setEditItem(null)} item={editItem} loading={updateMutation.isPending} onSubmit={d => editItem && updateMutation.mutate({ id: editItem.id, data: d })} />
      <ConfirmModal
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title="Remove Menu Item"
        description={`Remove "${deleteItem?.name}" from the menu? This cannot be undone.`}
      />
    </div>
  );
}
