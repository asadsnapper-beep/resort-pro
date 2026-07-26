'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi, vendorsApi, roomsApi } from '@/lib/api';
import { ModalShell } from '@/components/ui/modal-shell';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Archive, AlertTriangle, Pencil, ChevronLeft, ChevronRight,
  History, Clock, Loader2, Wrench, ShieldAlert,
} from 'lucide-react';
import { PageShell, PageHeader, ActionButton } from '@/components/patterns';

interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: string;
  condition: string;
  locationRoomId?: string | null;
  locationRoom?: { name: string; number: string } | null;
  locationLabel?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  warrantyExpiresAt?: string | null;
  vendorId?: string | null;
  vendor?: { id: string; name: string } | null;
  notes?: string | null;
}

interface MaintenanceLog {
  id: string;
  type: 'SERVICE' | 'REPAIR' | 'INSPECTION';
  cost?: number | null;
  performedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface Vendor { id: string; name: string; }
interface Room { id: string; name: string; number: string; }

const CATEGORIES = ['', 'FURNITURE', 'ELECTRONICS', 'APPLIANCE', 'KITCHEN_EQUIPMENT', 'VEHICLE', 'IT_EQUIPMENT', 'OTHER'] as const;
const STATUSES = ['IN_USE', 'IN_REPAIR', 'IN_STORAGE', 'RETIRED'] as const;

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  IN_USE:     { bg: 'var(--rp-teal-bg)', text: '#23766a', label: 'In Use' },
  IN_REPAIR:  { bg: 'var(--rp-amber-bg)', text: '#b89040', label: 'In Repair' },
  IN_STORAGE: { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)', label: 'In Storage' },
  RETIRED:    { bg: 'var(--rp-red-bg)', text: '#c43c3c', label: 'Retired' },
};

const LOG_META: Record<string, { bg: string; text: string; Icon: typeof Wrench }> = {
  SERVICE:     { bg: 'var(--rp-teal-bg)', text: '#23766a', Icon: Wrench },
  REPAIR:      { bg: 'var(--rp-red-bg)', text: '#c43c3c', Icon: Wrench },
  INSPECTION:  { bg: 'var(--rp-amber-bg)', text: '#b89040', Icon: ShieldAlert },
};

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

// ── Asset Modal ────────────────────────────────────────────────────────────────
function AssetModal({ open, onClose, loading, onSubmit, asset, vendors, rooms }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  asset?: Asset | null; vendors: Vendor[]; rooms: Room[];
}) {
  const [form, setForm] = useState({
    name: '', category: '', status: 'IN_USE', condition: 'GOOD', locationRoomId: '', locationLabel: '',
    purchaseDate: '', purchasePrice: '', warrantyExpiresAt: '', vendorId: '', notes: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm({
        name: asset?.name ?? '', category: asset?.category ?? '', status: asset?.status ?? 'IN_USE', condition: asset?.condition ?? 'GOOD',
        locationRoomId: asset?.locationRoomId ?? '', locationLabel: asset?.locationLabel ?? '',
        purchaseDate: asset?.purchaseDate ? asset.purchaseDate.slice(0, 10) : '',
        purchasePrice: asset?.purchasePrice?.toString() ?? '',
        warrantyExpiresAt: asset?.warrantyExpiresAt ? asset.warrantyExpiresAt.slice(0, 10) : '',
        vendorId: asset?.vendorId ?? '', notes: asset?.notes ?? '',
      });
    }
  }, [open, asset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) { toast({ title: 'Name and category are required', variant: 'destructive' }); return; }
    onSubmit({
      name: form.name, category: form.category, status: form.status, condition: form.condition,
      locationRoomId: form.locationRoomId || null,
      locationLabel: form.locationRoomId ? undefined : (form.locationLabel || undefined),
      purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : null,
      purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
      warrantyExpiresAt: form.warrantyExpiresAt ? new Date(form.warrantyExpiresAt).toISOString() : null,
      vendorId: form.vendorId || null,
      notes: form.notes || undefined,
    });
  };

  return (
    <ModalShell open={open} onClose={onClose} title={asset ? 'Edit Asset' : 'Add Asset'}
      description={asset ? `Editing ${asset.name}` : 'Add durable property — furniture, equipment, vehicles'} maxWidth="600px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" form="asset-form" disabled={loading}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {asset ? 'Save Changes' : 'Add Asset'}
          </button>
        </div>
      }>
      <form id="asset-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Asset Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Split AC 1.5 Ton" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls + ' cursor-pointer'}>
              <option value="">Select category</option>
              {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls + ' cursor-pointer'}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Location — Room <span style={{ color: 'var(--rp-text-faint)' }}>(if applicable)</span></label>
            <select value={form.locationRoomId} onChange={e => set('locationRoomId', e.target.value)} className={inputCls + ' cursor-pointer'}>
              <option value="">Not a room</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.number})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Or Location Label</label>
            <input value={form.locationLabel} onChange={e => set('locationLabel', e.target.value)} placeholder="Lobby, Kitchen, Admin Office…"
              disabled={!!form.locationRoomId} className={inputCls + (form.locationRoomId ? ' opacity-50' : '')} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Purchase Date</label>
            <input value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} type="date" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Purchase Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: '#9bbdb7' }}>৳</span>
              <input value={form.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} type="number" min="0" step="0.01" className={inputCls + ' pl-6'} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Warranty Until</label>
            <input value={form.warrantyExpiresAt} onChange={e => set('warrantyExpiresAt', e.target.value)} type="date" className={inputCls} />
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
          <label className={labelCls}>Notes</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── Log Maintenance Modal ─────────────────────────────────────────────────────
function LogMaintenanceModal({ open, onClose, asset, loading, onSubmit }: {
  open: boolean; onClose: () => void; asset: Asset | null; loading: boolean;
  onSubmit: (data: { type: string; cost?: number; performedBy?: string; notes?: string }) => void;
}) {
  const [type, setType] = useState<'SERVICE' | 'REPAIR' | 'INSPECTION'>('SERVICE');
  const [cost, setCost] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => { if (open) { setType('SERVICE'); setCost(''); setPerformedBy(''); setNotes(''); } }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ type, cost: cost ? parseFloat(cost) : undefined, performedBy: performedBy || undefined, notes: notes || undefined });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Log Maintenance"
      description={asset ? `${asset.name} — ${asset.assetTag}` : ''} maxWidth="480px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" form="log-form" disabled={loading}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Log
          </button>
        </div>
      }>
      <form id="log-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['SERVICE', 'REPAIR', 'INSPECTION'] as const).map(v => {
              const m = LOG_META[v];
              return (
                <button key={v} type="button" onClick={() => setType(v)}
                  className="flex flex-col items-center gap-1.5 rounded-[10px] border-2 p-2.5 text-[11.5px] font-medium transition-all"
                  style={type === v ? { background: m.bg, borderColor: m.text, color: m.text } : { background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-muted)' }}>
                  <m.Icon className="h-4 w-4" /> {v}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Cost <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
            <input value={cost} onChange={e => setCost(e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Performed By</label>
            <input value={performedBy} onChange={e => setPerformedBy(e.target.value)} placeholder="Technician or vendor" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was done…" className={inputCls} />
        </div>
      </form>
    </ModalShell>
  );
}

// ── History Modal ──────────────────────────────────────────────────────────────
function HistoryModal({ open, onClose, asset }: { open: boolean; onClose: () => void; asset: Asset | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['asset-logs', asset?.id],
    queryFn: () => assetsApi.getLogs(asset!.id),
    enabled: open && !!asset?.id,
  });
  const logs: MaintenanceLog[] = data?.data?.data ?? [];

  return (
    <ModalShell open={open} onClose={onClose} title="Maintenance History" description={asset ? `${asset.name} — ${asset.assetTag}` : ''} maxWidth="560px"
      footer={
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Close</button>
        </div>
      }>
      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: '#9bbdb7' }} /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Clock className="h-9 w-9" style={{ color: '#c5bdb4' }} />
          <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No maintenance logged yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {logs.map(l => {
            const m = LOG_META[l.type];
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-[10px] border p-3" style={{ borderColor: 'var(--rp-border)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]" style={{ background: m.bg }}>
                  <m.Icon className="h-4 w-4" style={{ color: m.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[6px] px-[7px] py-[2px] text-[10.5px] font-semibold" style={{ background: m.bg, color: m.text }}>{l.type}</span>
                    {l.cost != null && <span className="text-[12.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{formatCurrency(l.cost)}</span>}
                  </div>
                  {(l.performedBy || l.notes) && (
                    <p className="text-[12px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">{[l.performedBy, l.notes].filter(Boolean).join(' — ')}</p>
                  )}
                </div>
                <p className="text-[11.5px] shrink-0 text-[#c5bdb4] dark:text-[#6e8580]">
                  {new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const queryClient = useQueryClient();
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [logAsset, setLogAsset] = useState<Asset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assets', catFilter, statusFilter, search, page],
    queryFn: () => assetsApi.list({ category: catFilter || undefined, status: statusFilter || undefined, search: search || undefined, page, limit: 30 }),
  });
  const { data: statsData } = useQuery({ queryKey: ['asset-stats'], queryFn: () => assetsApi.stats() });
  const { data: vendorsData } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsApi.list() });
  const { data: roomsData } = useQuery({ queryKey: ['rooms-for-assets'], queryFn: () => roomsApi.list({ limit: 200 }) });

  const vendors: Vendor[] = vendorsData?.data?.data ?? [];
  const rooms: Room[] = Array.isArray(roomsData?.data?.data) ? roomsData.data.data : (roomsData?.data?.data?.data ?? []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (d: unknown) => assetsApi.create(d),
    onSuccess: () => { invalidate(); toast({ title: 'Asset added' }); setAddOpen(false); },
    onError: () => toast({ title: 'Error', description: 'Failed to add asset', variant: 'destructive' }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => assetsApi.update(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Asset updated' }); setEditAsset(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to update asset', variant: 'destructive' }),
  });
  const logMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => assetsApi.addLog(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Maintenance logged' }); setLogAsset(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to log maintenance', variant: 'destructive' }),
  });

  const assets: Asset[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const stats = statsData?.data?.data ?? { total: 0, inRepair: 0, totalValue: 0 };

  return (
    <PageShell gap={6}>
      <PageHeader
        title="Assets"
        subtitle="Furniture, equipment, vehicles — resort-owned property"
        align="center"
        actions={
          <ActionButton icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            Add Asset
          </ActionButton>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Assets', value: stats.total, Icon: Archive, iconBg: 'var(--rp-teal-bg)', iconColor: '#23766a' },
          { label: 'In Repair', value: stats.inRepair, Icon: Wrench, iconBg: stats.inRepair > 0 ? 'var(--rp-amber-bg)' : 'var(--rp-teal-bg)', iconColor: stats.inRepair > 0 ? '#b89040' : '#23766a' },
          { label: 'Total Value', value: formatCurrency(stats.totalValue), Icon: ShieldAlert, iconBg: 'var(--rp-teal-bg)', iconColor: '#23766a' },
        ].map(({ label, value, Icon, iconBg, iconColor }) => (
          <div key={label} className="rounded-[14px] border bg-white p-4" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[9px]" style={{ background: iconBg }}>
                <Icon className="h-[16px] w-[16px]" style={{ color: iconColor }} />
              </div>
              <p className="text-[12.5px] font-medium text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
            </div>
            <p className="text-[26px] font-semibold leading-none text-[#18231f] dark:text-[#dfd9d0]">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9bbdb7' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or tag…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[9px] pl-9 pr-3 text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => { setStatusFilter(f => f === s ? '' : s); setPage(1); }}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={statusFilter === s
                ? { background: STATUS_META[s].bg, borderColor: STATUS_META[s].text, color: STATUS_META[s].text }
                : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c || 'all'} onClick={() => { setCatFilter(c); setPage(1); }}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={catFilter === c
                ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              {c ? c.replace(/_/g, ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="space-y-px">{[...Array(5)].map((_, i) => <div key={i} className="h-[64px] animate-pulse" style={{ background: i % 2 === 0 ? 'var(--rp-surface-2)' : 'var(--rp-surface)' }} />)}</div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
              <Archive className="h-7 w-7" style={{ color: '#23766a' }} />
            </div>
            <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">
              {search || catFilter || statusFilter ? 'No assets found' : 'No assets yet'}
            </p>
            <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
              {search || catFilter || statusFilter ? 'Try adjusting filters' : 'Add your first piece of resort property'}
            </p>
            {!search && !catFilter && !statusFilter && (
              <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 mt-1 rounded-[9px] px-4 py-2 text-[13px] font-medium"
                style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                <Plus className="h-4 w-4" /> Add Asset
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {['Asset', 'Category', 'Location', 'Value', 'Vendor', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map(a => {
                  const sm = STATUS_META[a.status];
                  const warrantyDays = daysUntil(a.warrantyExpiresAt);
                  const warrantySoon = warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= 30;
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]" style={{ background: 'var(--rp-teal-bg)' }}>
                            <Archive className="h-4 w-4" style={{ color: '#23766a' }} />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{a.name}</p>
                            <p className="text-[11.5px] text-[#c5bdb4] dark:text-[#6e8580]">{a.assetTag}</p>
                            {warrantySoon && (
                              <p className="text-[11px] flex items-center gap-0.5" style={{ color: '#c43c3c' }}>
                                <AlertTriangle className="h-3 w-3" /> Warranty expires in {warrantyDays}d
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[12.5px] text-[#4a6e66] dark:text-[#6d9990]">{a.category.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-4 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                        {a.locationRoom ? `${a.locationRoom.name} (${a.locationRoom.number})` : a.locationLabel || '—'}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[#18231f] dark:text-[#dfd9d0]">{a.purchasePrice != null ? formatCurrency(a.purchasePrice) : '—'}</td>
                      <td className="px-5 py-4 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">{a.vendor?.name ?? '—'}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: sm.bg, color: sm.text }}>{sm.label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setLogAsset(a)}
                            className="flex items-center gap-1 rounded-[7px] border px-2 py-1 text-[11.5px] font-medium transition-colors hover:bg-[#e3f2ef]"
                            style={{ borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
                            <Wrench className="h-3 w-3" /> Log
                          </button>
                          <button onClick={() => setHistoryAsset(a)}
                            className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#f4ecda] text-[#c5bdb4] dark:text-[#6e8580]" title="History">
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditAsset(a)}
                            className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#e3f2ef]" style={{ color: '#9bbdb7' }}>
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

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, pagination.total)} of {pagination.total}</p>
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

      <AssetModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} vendors={vendors} rooms={rooms} />
      <AssetModal open={!!editAsset} onClose={() => setEditAsset(null)} asset={editAsset} loading={updateMutation.isPending} vendors={vendors} rooms={rooms}
        onSubmit={d => editAsset && updateMutation.mutate({ id: editAsset.id, data: d })} />
      <LogMaintenanceModal open={!!logAsset} onClose={() => setLogAsset(null)} asset={logAsset} loading={logMutation.isPending}
        onSubmit={d => logAsset && logMutation.mutate({ id: logAsset.id, data: d })} />
      <HistoryModal open={!!historyAsset} onClose={() => setHistoryAsset(null)} asset={historyAsset} />
    </PageShell>
  );
}
