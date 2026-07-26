'use client';

import { ModalShell } from '@/components/ui/modal-shell';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { packagesApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Gift, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight,
  Image, Star, Loader2,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
import { formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PackageItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  priceType: 'PER_STAY' | 'PER_NIGHT';
  inclusions: string[];
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { bookings: number };
}

const INCLUSION_SUGGESTIONS = [
  'Daily Breakfast for 2', 'Airport Transfer (1 way)', 'Airport Transfer (return)',
  'Welcome Drink on Arrival', 'Spa Credit ($50)', 'Late Check-out (2 PM)',
  'Early Check-in (10 AM)', 'Daily Fruit Basket', 'Romantic Turndown Service',
  'Couples Massage (60 min)', 'Snorkeling Equipment', 'Sunset Cruise (2 pax)',
  'Private Pool Access', 'Daily Cocktails (Happy Hour)', 'City Tour (4 hrs)',
  'Complimentary Mini Bar',
];

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

// ── Package Modal ─────────────────────────────────────────────────────────────
function PackageModal({ pkg, onClose }: { pkg?: PackageItem; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!pkg;

  const [name, setName]               = useState(pkg?.name ?? '');
  const [description, setDescription] = useState(pkg?.description ?? '');
  const [price, setPrice]             = useState(String(pkg?.price ?? ''));
  const [priceType, setPriceType]     = useState<'PER_STAY' | 'PER_NIGHT'>(pkg?.priceType ?? 'PER_STAY');
  const [inclusions, setInclusions]   = useState<string[]>(pkg?.inclusions ?? []);
  const [newInclusion, setNewInclusion] = useState('');
  const [imageUrl, setImageUrl]       = useState(pkg?.imageUrl ?? '');
  const [isActive, setIsActive]       = useState(pkg?.isActive ?? true);

  const mutation = useMutation({
    mutationFn: (data: unknown) => isEdit ? packagesApi.update(pkg!.id, data) : packagesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast({ title: isEdit ? 'Package updated' : 'Package created' });
      onClose();
    },
    onError: () => toast({ title: 'Failed to save package', variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return;
    mutation.mutate({ name: name.trim(), description: description.trim() || undefined, price: p, priceType, inclusions, imageUrl: imageUrl.trim() || undefined, isActive });
  };

  const addInclusion = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || inclusions.includes(trimmed)) return;
    setInclusions([...inclusions, trimmed]);
    setNewInclusion('');
  };

  const removeInclusion = (i: number) => setInclusions(inclusions.filter((_, idx) => idx !== i));

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={isEdit ? 'Edit Package' : 'New Package'}
      maxWidth="580px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            className="flex-1 rounded-[9px] border py-2.5 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" form="package-form" disabled={mutation.isPending || !name.trim() || !price}
            className="flex-1 flex items-center justify-center gap-2 rounded-[9px] py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Create Package'}
          </button>
        </div>
      }
    >
      <form id="package-form" onSubmit={handleSubmit}>
        <div className="space-y-5">
            {/* Name */}
            <div>
              <label className={labelCls}>Package Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputCls}
                placeholder='e.g. "Honeymoon Bliss" or "Adventure Package"' />
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Brief description shown to guests..."
                className="w-full resize-none rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30" />
            </div>

            {/* Price + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Price *</label>
                <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                  required placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pricing</label>
                <div className="flex overflow-hidden rounded-[8px] border border-black/5">
                  {(['PER_STAY', 'PER_NIGHT'] as const).map(pt => (
                    <button key={pt} type="button" onClick={() => setPriceType(pt)}
                      className="flex-1 py-[9px] text-[13px] font-medium transition-colors"
                      style={priceType === pt
                        ? { background: '#23766a', color: 'var(--rp-btn-accent-text)' }
                        : { background: 'var(--rp-surface-3)', color: 'var(--rp-text-muted)' }}>
                      {pt === 'PER_STAY' ? 'Per Stay' : 'Per Night'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Inclusions */}
            <div>
              <label className={labelCls}>What's Included</label>

              {inclusions.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {inclusions.map((inc, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded-[7px] border px-2.5 py-1 text-[12px] font-medium"
                      style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
                      <Check className="h-3 w-3 shrink-0" />
                      {inc}
                      <button type="button" onClick={() => removeInclusion(i)}
                        className="transition-colors hover:opacity-60">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input type="text" value={newInclusion} onChange={e => setNewInclusion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInclusion(newInclusion); } }}
                  placeholder="Type and press Enter..." className={inputCls + ' flex-1'} />
                <button type="button" onClick={() => addInclusion(newInclusion)}
                  className="flex items-center justify-center rounded-[8px] px-3 transition-colors"
                  style={{ background: 'var(--rp-teal-bg)', color: '#23766a' }}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Quick-add suggestions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {INCLUSION_SUGGESTIONS.filter(s => !inclusions.includes(s)).slice(0, 8).map(s => (
                  <button key={s} type="button" onClick={() => addInclusion(s)}
                    className="rounded-[7px] border px-2 py-0.5 text-[11.5px] transition-colors hover:border-[#23766a] hover:text-[#23766a]"
                    style={{ borderColor: 'var(--rp-border)', color: 'var(--rp-text-muted)' }}>
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label className={labelCls}>
                <Image className="inline h-3.5 w-3.5 mr-1" />
                Cover Image URL (optional)
              </label>
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..." className={inputCls} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-[10px] border px-4 py-3"
              style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
              <div>
                <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">Available for Booking</p>
                <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">Inactive packages won't be offered to guests</p>
              </div>
              <button type="button" onClick={() => setIsActive(!isActive)}>
                {isActive
                  ? <ToggleRight className="h-7 w-7" style={{ color: '#23766a' }} />
                  : <ToggleLeft className="h-7 w-7 text-[#c5bdb4] dark:text-[#6e8580]" />}
              </button>
            </div>
          </div>

      </form>
    </ModalShell>
  );
}

// ── Package Card ──────────────────────────────────────────────────────────────
function PackageCard({ pkg, onEdit, onDelete, onToggle }: {
  pkg: PackageItem; onEdit: () => void; onDelete: () => void; onToggle: () => void;
}) {
  return (
    <div className="rounded-[14px] border bg-white dark:bg-white/5 overflow-hidden transition-all hover:shadow-md"
      style={{
        borderColor: 'var(--rp-border)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        opacity: pkg.isActive ? 1 : 0.6,
      }}>
      {/* Cover image */}
      {pkg.imageUrl ? (
        <div className="h-40 overflow-hidden">
          <img src={pkg.imageUrl} alt={pkg.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-24 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1b342f 0%, #23766a 100%)' }}>
          <Gift className="h-10 w-10" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
      )}

      <div className="p-4">
        {/* Name + status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold truncate leading-tight text-[#18231f] dark:text-[#dfd9d0]">{pkg.name}</h3>
            {pkg.description && (
              <p className="text-[12px] mt-0.5 line-clamp-2 text-[#8aa29a] dark:text-[#94b8b0]">{pkg.description}</p>
            )}
          </div>
          <span className="shrink-0 rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
            style={pkg.isActive
              ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
              : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
            {pkg.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[18px] font-semibold tracking-[-0.02em]" style={{ color: '#23766a' }}>
            {formatCurrency(pkg.price)}
          </span>
          <span className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
            {pkg.priceType === 'PER_NIGHT' ? '/ night' : '/ stay'}
          </span>
        </div>

        {/* Inclusions */}
        {pkg.inclusions.length > 0 && (
          <div className="mb-3 space-y-1">
            {pkg.inclusions.slice(0, 4).map((inc, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[12px]">
                <Check className="h-3 w-3 shrink-0" style={{ color: '#23766a' }} />
                <span className="truncate text-[#7a9890] dark:text-[#94b8b0]">{inc}</span>
              </div>
            ))}
            {pkg.inclusions.length > 4 && (
              <p className="text-[11.5px] pl-[18px] text-[#8aa29a] dark:text-[#94b8b0]">
                +{pkg.inclusions.length - 4} more
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-2.5"
          style={{ borderColor: 'var(--rp-border)' }}>
          <span className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
            {pkg._count?.bookings ?? 0} booking{pkg._count?.bookings !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={onToggle} title={pkg.isActive ? 'Deactivate' : 'Activate'}
              className="rounded-[7px] p-1.5 transition-colors hover:bg-[#e3f2ef]">
              {pkg.isActive
                ? <ToggleRight className="h-4 w-4" style={{ color: '#23766a' }} />
                : <ToggleLeft className="h-4 w-4 text-[#c5bdb4] dark:text-[#6e8580]" />}
            </button>
            <button onClick={onEdit}
              className="rounded-[7px] p-1.5 transition-colors hover:bg-[#f4f1eb]">
              <Pencil className="h-4 w-4 text-[#8aa29a] dark:text-[#94b8b0]" />
            </button>
            <button onClick={onDelete}
              className="rounded-[7px] p-1.5 transition-colors hover:bg-[#fef2f2]">
              <Trash2 className="h-4 w-4" style={{ color: '#c43c3c' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PackagesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageItem | undefined>(undefined);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const { data: res, isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
  });

  const packages: PackageItem[] = res?.data?.data ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => packagesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages'] }); toast({ title: 'Package deleted' }); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast({
      title: 'Cannot delete package',
      description: e.response?.data?.error ?? 'Failed to delete package',
      variant: 'destructive',
    }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => packagesApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
    onError: () => toast({ title: 'Failed to update package', variant: 'destructive' }),
  });

  const filtered = packages.filter(p => filter === 'all' ? true : filter === 'active' ? p.isActive : !p.isActive);
  const activeCount = packages.filter(p => p.isActive).length;
  const totalBookings = packages.reduce((sum, p) => sum + (p._count?.bookings ?? 0), 0);

  const openCreate = () => { setEditingPkg(undefined); setModalOpen(true); };
  const openEdit   = (pkg: PackageItem) => { setEditingPkg(pkg); setModalOpen(true); };

  return (
    <PageShell gap={6}>
      {/* Header */}
      <PageHeader
        title="Package Deals"
        subtitle="Bundle rooms with experiences — breakfast, spa, transfers and more"
        align="responsive"
        actions={
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            <Plus className="h-4 w-4" /> New Package
          </button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Gift,        label: 'Total Packages', value: packages.length, color: '#23766a', bg: 'var(--rp-teal-bg)' },
          { icon: ToggleRight, label: 'Active',         value: activeCount,     color: '#1b342f', bg: 'var(--rp-teal-bg)' },
          { icon: Star,        label: 'Times Applied',  value: totalBookings,   color: '#b89040', bg: 'var(--rp-amber-bg)' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="flex items-center gap-4 rounded-[14px] border bg-white dark:bg-white/5 p-5"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: bg }}>
              <Icon className="h-[18px] w-[18px]" style={{ color }} />
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
              <p className="text-[24px] font-semibold tracking-[-0.02em] text-[#18231f] dark:text-[#dfd9d0]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="rounded-[8px] border px-3 py-1.5 text-[13px] font-medium transition-colors capitalize"
            style={filter === f
              ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
              : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-72 rounded-[14px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'var(--rp-teal-bg)' }}>
            <Gift className="h-10 w-10" style={{ color: '#23766a' }} />
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#18231f] dark:text-[#dfd9d0]">
              {filter === 'all' ? 'No packages yet' : `No ${filter} packages`}
            </p>
            <p className="text-[12.5px] mt-1 text-[#8aa29a] dark:text-[#94b8b0]">
              {filter === 'all' ? 'Create your first package deal to upsell extras to guests' : ''}
            </p>
          </div>
          {filter === 'all' && (
            <button onClick={openCreate}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              <Plus className="h-4 w-4" /> Create First Package
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(pkg => (
            <PackageCard key={pkg.id} pkg={pkg}
              onEdit={() => openEdit(pkg)}
              onDelete={() => { if (confirm(`Delete "${pkg.name}"? This cannot be undone.`)) deleteMut.mutate(pkg.id); }}
              onToggle={() => toggleMut.mutate({ id: pkg.id, isActive: !pkg.isActive })} />
          ))}
        </div>
      )}

      {/* How it works callout */}
      {packages.length > 0 && (
        <div className="rounded-[14px] border p-5"
          style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
          <p className="text-[13px] font-semibold mb-1" style={{ color: '#1b342f' }}>💡 How to apply packages</p>
          <p className="text-[12px]" style={{ color: '#23766a' }}>
            Open any booking in the <strong>Bookings</strong> page → click the booking → use the <strong>Packages</strong> tab to add or remove packages. The booking total is updated automatically.
          </p>
        </div>
      )}

      {modalOpen && (
        <PackageModal
          pkg={editingPkg}
          onClose={() => { setModalOpen(false); setEditingPkg(undefined); }}
        />
      )}
    </PageShell>
  );
}
