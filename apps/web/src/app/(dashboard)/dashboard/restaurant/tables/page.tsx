'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantTablesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/hooks/use-toast';
import { Plus, Copy, Check, Pencil, Trash2, LayoutGrid, QrCode, Loader2 } from 'lucide-react';

interface RestaurantTable {
  id: string;
  tableNumber: number;
  label?: string;
  isActive: boolean;
  _count?: { foodOrders: number };
}

const WEB = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

export default function TablesPage() {
  const { tenant } = useAuthStore();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<RestaurantTable | null>(null);
  const [form, setForm]           = useState({ tableNumber: '', label: '' });
  const [copiedId, setCopiedId]   = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant-tables'],
    queryFn:  () => restaurantTablesApi.list(),
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] }); toast({ title: 'Table deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.error ?? e.message, variant: 'destructive' }),
  });

  function openCreate() { setEditing(null); setForm({ tableNumber: '', label: '' }); setShowModal(true); }
  function openEdit(t: RestaurantTable) { setEditing(t); setForm({ tableNumber: String(t.tableNumber), label: t.label ?? '' }); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); setForm({ tableNumber: '', label: '' }); }

  function tableUrl(t: RestaurantTable) { return `${WEB}/${tenant?.slug}/table/${t.tableNumber}`; }
  function copyUrl(t: RestaurantTable) {
    navigator.clipboard.writeText(tableUrl(t));
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6 animate-fade-up max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f] flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
              <LayoutGrid className="h-4 w-4" style={{ color: '#23766a' }} />
            </div>
            Restaurant Tables
          </h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Each table gets a URL — open it on the tablet for self-ordering</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Add Table
        </button>
      </div>

      {/* Setup hint */}
      <div className="flex items-start gap-3 rounded-[12px] border px-4 py-3"
        style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
        <QrCode className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#23766a' }} />
        <p className="text-[12.5px]" style={{ color: '#1b342f' }}>
          <strong>Tablet setup:</strong> Open the table URL on the Android tablet → enable Android Screen Pinning (Settings → Security → Screen Pinning). Customers can only use the ordering page.
        </p>
      </div>

      {/* Table grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-[14px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-[14px] gap-3"
          style={{ borderColor: 'rgba(35,118,106,0.2)', borderStyle: 'dashed', border: '1.5px dashed rgba(35,118,106,0.25)', background: 'var(--rp-surface-2)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
            <QrCode className="h-7 w-7" style={{ color: '#23766a' }} />
          </div>
          <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">No tables yet</p>
          <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">Add tables and place tablets on each one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map(t => (
            <div key={t.id} className="rounded-[14px] border bg-white p-4 space-y-3 transition-all hover:shadow-md"
              style={{
                borderColor: t.isActive ? 'rgba(35,118,106,0.25)' : 'var(--rp-border)',
                boxShadow: t.isActive ? '0 0 0 1px rgba(35,118,106,0.08)' : '0 1px 6px rgba(0,0,0,0.04)',
                background: t.isActive ? 'var(--rp-surface)' : 'var(--rp-surface-2)',
              }}>
              {/* Number + toggle */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[32px] font-bold leading-none" style={{ color: t.isActive ? '#1b342f' : 'var(--rp-text-faint)' }}>
                    {t.tableNumber}
                  </p>
                  <p className="text-[12px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">{t.label || `Table ${t.tableNumber}`}</p>
                </div>
                <button onClick={() => toggleMutation.mutate(t)}
                  className="rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold transition-colors hover:opacity-80"
                  style={t.isActive
                    ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
                    : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                  {t.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>

              {/* URL */}
              <div className="flex items-center gap-2 rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-2">
                <span className="text-[11.5px] truncate flex-1 font-mono text-[#6b8880] dark:text-[#94b8b0]">{tableUrl(t)}</span>
                <button onClick={() => copyUrl(t)}
                  className="shrink-0 transition-colors hover:opacity-70" style={{ color: '#9bbdb7' }}>
                  {copiedId === t.id
                    ? <Check className="h-3.5 w-3.5" style={{ color: '#23766a' }} />
                    : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Orders count */}
              {t._count && (
                <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{t._count.foodOrders} orders total</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => openEdit(t)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] border py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[#f4f1eb]"
                  style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => { if (confirm(`Delete Table ${t.tableNumber}?`)) deleteMutation.mutate(t.id); }}
                  className="flex items-center justify-center rounded-[8px] border px-3 py-1.5 transition-colors hover:bg-[#fef2f2] hover:border-red-200"
                  style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-faint)' }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={closeModal} title={editing ? `Edit Table ${editing.tableNumber}` : 'Add New Table'}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Table Number *</label>
            <input type="number" min={1}
              value={form.tableNumber}
              onChange={e => setForm(f => ({ ...f, tableNumber: e.target.value }))}
              placeholder="e.g. 5"
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Label <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Window Seat, VIP 1"
              className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={closeModal}
              className="flex-1 rounded-[9px] border py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              Cancel
            </button>
            <button onClick={() => saveMutation.mutate()}
              disabled={!form.tableNumber || saveMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-[9px] py-2 text-[13px] font-medium disabled:opacity-50"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Table'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
