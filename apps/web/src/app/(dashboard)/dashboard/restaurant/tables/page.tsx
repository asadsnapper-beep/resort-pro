'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantTablesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/hooks/use-toast';
import { Plus, Copy, Check, Pencil, Trash2, LayoutGrid, QrCode } from 'lucide-react';

interface RestaurantTable {
  id: string;
  tableNumber: number;
  label?: string;
  isActive: boolean;
  _count?: { foodOrders: number };
}

const WEB = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function TablesPage() {
  const { tenant } = useAuthStore();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState({ tableNumber: '', label: '' });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant-tables'],
    queryFn: () => restaurantTablesApi.list(),
  });

  const tables: RestaurantTable[] = data?.data?.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { tableNumber: parseInt(form.tableNumber, 10), label: form.label || undefined, isActive: true };
      if (editing) return restaurantTablesApi.update(editing.id, payload);
      return restaurantTablesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
      toast({ title: editing ? 'Table updated' : 'Table created' });
      closeModal();
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.error ?? e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (t: RestaurantTable) => restaurantTablesApi.update(t.id, { isActive: !t.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => restaurantTablesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
      toast({ title: 'Table deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.error ?? e.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ tableNumber: '', label: '' });
    setShowModal(true);
  }

  function openEdit(t: RestaurantTable) {
    setEditing(t);
    setForm({ tableNumber: String(t.tableNumber), label: t.label ?? '' });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm({ tableNumber: '', label: '' });
  }

  function tableUrl(t: RestaurantTable) {
    return `${WEB}/${tenant?.slug}/table/${t.tableNumber}`;
  }

  function copyUrl(t: RestaurantTable) {
    navigator.clipboard.writeText(tableUrl(t));
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-emerald-600" />
            Restaurant Tables
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Each table gets a URL — open it on the tablet for self-ordering
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Table
        </Button>
      </div>

      {/* Setup hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <strong>Tablet setup:</strong> Open the table URL on the Android tablet → enable Android Screen Pinning (Settings → Security → Screen Pinning). Customers can only use the ordering page.
      </div>

      {/* Table list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400">
          <QrCode className="h-12 w-12 mb-3" />
          <p className="font-semibold">No tables yet</p>
          <p className="text-sm mt-1">Add tables and place tablets on each one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map(t => (
            <div key={t.id} className={`rounded-2xl border-2 p-4 space-y-3 ${t.isActive ? 'border-emerald-200 bg-white' : 'border-gray-200 bg-gray-50'}`}>
              {/* Table number + status */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-3xl font-black text-emerald-700">{t.tableNumber}</p>
                  <p className="text-sm text-gray-500">{t.label || 'Table ' + t.tableNumber}</p>
                </div>
                <button
                  onClick={() => toggleMutation.mutate(t)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${t.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}
                >
                  {t.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>

              {/* URL row */}
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-400 truncate flex-1 font-mono">{tableUrl(t)}</span>
                <button onClick={() => copyUrl(t)} className="shrink-0 text-gray-400 hover:text-emerald-600 transition-colors">
                  {copiedId === t.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              {/* Orders count */}
              {t._count && (
                <p className="text-xs text-gray-400">{t._count.foodOrders} orders total</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(t)} className="gap-1.5 flex-1">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() => { if (confirm(`Delete Table ${t.tableNumber}?`)) deleteMutation.mutate(t.id); }}
                  className="text-red-500 hover:text-red-600 hover:border-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={closeModal} title={editing ? `Edit Table ${editing.tableNumber}` : 'Add New Table'}>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-semibold text-gray-700">Table Number *</label>
            <Input
              type="number" min={1}
              value={form.tableNumber}
              onChange={e => setForm(f => ({ ...f, tableNumber: e.target.value }))}
              placeholder="e.g. 5"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Label (optional)</label>
            <Input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Window Seat, VIP 1"
              className="mt-1"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={closeModal} className="flex-1">Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.tableNumber || saveMutation.isPending}
              className="flex-1"
            >
              {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Table'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
