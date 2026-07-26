'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi } from '@/lib/api';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, UtensilsCrossed, Coffee, ChefHat, Pencil, Trash2,
  CheckCircle2, XCircle, Star, Loader2,
} from 'lucide-react';
import { PageShell, PageHeader, ActionButton } from '@/components/patterns';
import { ImageUpload } from '@/components/ui/ImageUpload';

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

const CAT_META: Record<string, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  BREAKFAST: { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', icon: Coffee         },
  LUNCH:     { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', icon: UtensilsCrossed },
  DINNER:    { bg: '#1b342f', border: 'rgba(27,52,47,0.4)',    text: '#dfd9d0', icon: ChefHat         },
  APPETIZER: { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)', text: '#23766a', icon: Star            },
  DESSERT:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.15)', text: '#b8724a', icon: Star            },
  BEVERAGE:  { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.15)', text: 'var(--rp-text-accent)', icon: Coffee         },
  SPECIAL:   { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.25)', text: '#b89040', icon: Star            },
};

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';
const errCls   = 'mt-1 text-[11.5px] text-[#c43c3c]';

function MenuItemModal({ open, onClose, loading, onSubmit, item }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  item?: MenuItem | null;
}) {
  const blankForm = { name: '', description: '', category: '', price: '', isAvailable: true, image: '' };
  const [form, setForm] = useState(blankForm);
  const [err, setErr]   = useState('');
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      setErr('');
      setForm({
        name:        item?.name ?? '',
        description: item?.description ?? '',
        category:    item?.category ?? '',
        price:       item?.price?.toString() ?? '',
        isAvailable: item?.isAvailable ?? true,
        image:       item?.image ?? '',
      });
    }
  }, [open, item]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.price) { setErr('Name, category and price are required'); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) { setErr('Price must be a positive number'); return; }
    setErr('');
    onSubmit({ name: form.name, description: form.description || undefined, category: form.category, price, isAvailable: form.isAvailable, image: form.image || undefined });
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Menu Item' : 'Add Menu Item'}
      description={item ? `Editing ${item.name}` : 'Add a new item to your menu'} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Item Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Classic Club Sandwich" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls + ' cursor-pointer'}>
              <option value="">Select category</option>
              {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Price *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#9bbdb7' }}>$</span>
              <input value={form.price} onChange={e => set('price', e.target.value)} className={inputCls + ' pl-6'} placeholder="12.50" type="number" step="0.01" min="0" />
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
            placeholder="Brief description of the dish…"
            className={inputCls + ' resize-none'} />
        </div>
        <div>
          <ImageUpload value={form.image || null} onChange={url => set('image', url ?? '')}
            folder="menu" label="Dish Photo" hint="Square photo works best · max 5 MB" aspectRatio="square" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center">
            <input type="checkbox" id="available" checked={form.isAvailable} onChange={e => set('isAvailable', e.target.checked)}
              className="sr-only peer" />
            <label htmlFor="available"
              className="flex h-[20px] w-[34px] cursor-pointer items-center rounded-full border transition-colors peer-checked:bg-[#23766a] peer-checked:border-[#23766a]"
              style={{ background: form.isAvailable ? undefined : '#e8e5e0', borderColor: form.isAvailable ? undefined : 'rgba(0,0,0,0.1)' }}>
              <span className="ml-[3px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: form.isAvailable ? 'translateX(14px)' : 'translateX(0)' }} />
            </label>
          </div>
          <label htmlFor="available" className="text-[13px] cursor-pointer text-[#4a6e66] dark:text-[#6d9990]">Available on menu</label>
        </div>
        {err && <p className={errCls}>{err}</p>}
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

export default function RestaurantPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const queryClient = useQueryClient();
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch]       = useState('');
  const [addOpen, setAddOpen]     = useState(false);
  const [editItem, setEditItem]   = useState<MenuItem | null>(null);
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
    onError: () => toast({ title: 'Error', description: 'Failed to update availability', variant: 'destructive' }),
  });

  const allItems: MenuItem[] = data?.data?.data ?? [];
  const items = allItems.filter(i =>
    search === '' ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.description?.toLowerCase().includes(search.toLowerCase())
  );

  const availableCount  = allItems.filter(i => i.isAvailable).length;
  const totalCategories = new Set(allItems.map(i => i.category)).size;

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <PageShell gap={6}>

      {/* Header */}
      <PageHeader
        title="Restaurant & Menu"
        subtitle={allItems.length > 0 ? `${allItems.length} items · ${availableCount} available` : 'Manage your restaurant menu'}
        align="center"
        actions={
          <ActionButton icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            Add Item
          </ActionButton>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Items', value: allItems.length,  Icon: UtensilsCrossed, iconBg: 'var(--rp-teal-bg)', iconColor: '#23766a' },
          { label: 'Available',   value: availableCount,   Icon: CheckCircle2,    iconBg: 'var(--rp-teal-bg)', iconColor: '#23766a' },
          { label: 'Categories',  value: totalCategories,  Icon: ChefHat,         iconBg: 'var(--rp-amber-bg)', iconColor: '#b89040' },
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9bbdb7' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu items…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[9px] pl-9 pr-3 text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c || 'all'} onClick={() => setCatFilter(c)}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={catFilter === c
                ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                : { background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface-3)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              {c || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-[14px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-[14px] border gap-3"
          style={{ borderColor: 'rgba(35,118,106,0.2)', borderStyle: 'dashed', background: isDark ? 'rgba(255,255,255,0.03)' : 'var(--rp-surface-2)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
            <UtensilsCrossed className="h-7 w-7" style={{ color: '#23766a' }} />
          </div>
          <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">
            {search || catFilter ? 'No items found' : 'No menu items yet'}
          </p>
          <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
            {search || catFilter ? 'Try adjusting filters' : 'Add your first menu item to get started'}
          </p>
          {!search && !catFilter && (
            <button onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 mt-1 rounded-[9px] px-4 py-2 text-[13px] font-medium"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              <Plus className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, catItems]) => {
            const cm = CAT_META[category] ?? { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)', text: 'var(--rp-text-muted)', icon: UtensilsCrossed };
            const CatIcon = cm.icon;
            return (
              <div key={category}>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[10px] py-[4px] text-[11.5px] font-semibold"
                    style={{ background: cm.bg, borderColor: cm.border, color: cm.text }}>
                    <CatIcon className="h-3.5 w-3.5" /> {category}
                  </span>
                  <span className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map(item => (
                    <div key={item.id}
                      className="rounded-[14px] border bg-white overflow-hidden transition-all hover:shadow-md"
                      style={{
                        borderColor: 'var(--rp-border)',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                        opacity: item.isAvailable ? 1 : 0.6,
                      }}>
                      {item.image && (
                        <div className="h-32 overflow-hidden">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      {!item.image && (
                        <div className="h-24 flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, #1b342f 0%, #23766a 100%)' }}>
                          <CatIcon className="h-8 w-8 opacity-30 text-white" />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13.5px] font-semibold truncate text-[#18231f] dark:text-[#dfd9d0]">{item.name}</p>
                            {item.description && (
                              <p className="text-[12px] mt-0.5 line-clamp-2 text-[#8aa29a] dark:text-[#94b8b0]">{item.description}</p>
                            )}
                          </div>
                          <p className="text-[13.5px] font-bold shrink-0" style={{ color: '#23766a' }}>
                            {formatCurrency(Number(item.price))}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => toggleMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                            className="flex items-center gap-1.5 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold transition-colors hover:opacity-80"
                            style={item.isAvailable
                              ? { background: isDark ? 'rgba(35,118,106,0.2)' : 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
                              : { background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface-3)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                            {item.isAvailable
                              ? <CheckCircle2 className="h-3 w-3" />
                              : <XCircle className="h-3 w-3" />}
                            {item.isAvailable ? 'Available' : 'Unavailable'}
                          </button>
                          <div className="flex gap-1">
                            <button onClick={() => setEditItem(item)}
                              className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#e3f2ef]"
                              style={{ color: '#9bbdb7' }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteItem(item)}
                              className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#fef2f2] text-[#c5bdb4] dark:text-[#6e8580]">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MenuItemModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
      <MenuItemModal open={!!editItem} onClose={() => setEditItem(null)} item={editItem} loading={updateMutation.isPending}
        onSubmit={d => editItem && updateMutation.mutate({ id: editItem.id, data: d })} />
      <ConfirmModal
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        loading={deleteMutation.isPending}
        title="Remove Menu Item"
        description={`Remove "${deleteItem?.name}" from the menu? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </PageShell>
  );
}
