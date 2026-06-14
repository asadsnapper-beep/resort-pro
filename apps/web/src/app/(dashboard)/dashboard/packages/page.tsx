'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { packagesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Gift, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight,
  Image, Star,
} from 'lucide-react';
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

// ── Suggested inclusions for quick-add ────────────────────────────────────────
const INCLUSION_SUGGESTIONS = [
  'Daily Breakfast for 2',
  'Airport Transfer (1 way)',
  'Airport Transfer (return)',
  'Welcome Drink on Arrival',
  'Spa Credit ($50)',
  'Late Check-out (2 PM)',
  'Early Check-in (10 AM)',
  'Daily Fruit Basket',
  'Romantic Turndown Service',
  'Couples Massage (60 min)',
  'Snorkeling Equipment',
  'Sunset Cruise (2 pax)',
  'Private Pool Access',
  'Daily Cocktails (Happy Hour)',
  'City Tour (4 hrs)',
  'Complimentary Mini Bar',
];

// ── Package Modal ─────────────────────────────────────────────────────────────
function PackageModal({
  pkg,
  onClose,
}: {
  pkg?: PackageItem;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!pkg;

  const [name, setName] = useState(pkg?.name ?? '');
  const [description, setDescription] = useState(pkg?.description ?? '');
  const [price, setPrice] = useState(String(pkg?.price ?? ''));
  const [priceType, setPriceType] = useState<'PER_STAY' | 'PER_NIGHT'>(pkg?.priceType ?? 'PER_STAY');
  const [inclusions, setInclusions] = useState<string[]>(pkg?.inclusions ?? []);
  const [newInclusion, setNewInclusion] = useState('');
  const [imageUrl, setImageUrl] = useState(pkg?.imageUrl ?? '');
  const [isActive, setIsActive] = useState(pkg?.isActive ?? true);

  const mutation = useMutation({
    mutationFn: (data: unknown) =>
      isEdit ? packagesApi.update(pkg!.id, data) : packagesApi.create(data),
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
    mutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      price: p,
      priceType,
      inclusions,
      imageUrl: imageUrl.trim() || undefined,
      isActive,
    });
  };

  const addInclusion = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || inclusions.includes(trimmed)) return;
    setInclusions([...inclusions, trimmed]);
    setNewInclusion('');
  };

  const removeInclusion = (i: number) => setInclusions(inclusions.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-resort-700 to-resort-600">
          <div className="flex items-center gap-2 text-white">
            <Gift className="h-5 w-5" />
            <h2 className="text-base font-semibold">{isEdit ? 'Edit Package' : 'New Package'}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Package Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "Honeymoon Bliss" or "Adventure Package"'
                required
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description shown to guests..."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500 resize-none"
              />
            </div>

            {/* Price + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pricing</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  {(['PER_STAY', 'PER_NIGHT'] as const).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPriceType(pt)}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                        priceType === pt
                          ? 'bg-resort-600 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pt === 'PER_STAY' ? 'Per Stay' : 'Per Night'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Inclusions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                What's Included
              </label>

              {/* Current inclusions */}
              {inclusions.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {inclusions.map((inc, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-resort-50 dark:bg-resort-900/20 text-resort-700 dark:text-resort-300 text-xs font-medium border border-resort-200 dark:border-resort-700"
                    >
                      <Check className="h-3 w-3" />
                      {inc}
                      <button type="button" onClick={() => removeInclusion(i)} className="hover:text-red-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add inclusion input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInclusion}
                  onChange={(e) => setNewInclusion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInclusion(newInclusion); } }}
                  placeholder="Type and press Enter..."
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500"
                />
                <button
                  type="button"
                  onClick={() => addInclusion(newInclusion)}
                  className="px-3 py-2 rounded-lg bg-resort-100 dark:bg-resort-900/30 text-resort-700 dark:text-resort-400 hover:bg-resort-200 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Quick-add suggestions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {INCLUSION_SUGGESTIONS.filter((s) => !inclusions.includes(s)).slice(0, 8).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addInclusion(s)}
                    className="px-2 py-0.5 text-xs rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-resort-400 hover:text-resort-600 transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Image className="inline h-3.5 w-3.5 mr-1" />
                Cover Image URL (optional)
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500"
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available for Booking</span>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`transition-colors ${isActive ? 'text-resort-600' : 'text-gray-400'}`}
              >
                {isActive ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !name.trim() || !price}
              className="flex-1 py-2.5 rounded-lg bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Package Card ──────────────────────────────────────────────────────────────
function PackageCard({
  pkg,
  onEdit,
  onDelete,
  onToggle,
}: {
  pkg: PackageItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${!pkg.isActive ? 'opacity-60' : ''}`}>
      {/* Cover image */}
      {pkg.imageUrl && (
        <div className="h-40 overflow-hidden">
          <img src={pkg.imageUrl} alt={pkg.name} className="w-full h-full object-cover" />
        </div>
      )}
      {!pkg.imageUrl && (
        <div className="h-24 bg-gradient-to-br from-resort-600 to-resort-400 flex items-center justify-center">
          <Gift className="h-10 w-10 text-white/60" />
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">{pkg.name}</h3>
            {pkg.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pkg.description}</p>
            )}
          </div>
          <div className="shrink-0">
            {pkg.isActive ? (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">Active</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">Inactive</span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold text-resort-600">{formatCurrency(pkg.price)}</span>
          <span className="text-xs text-muted-foreground">
            {pkg.priceType === 'PER_NIGHT' ? '/ night' : '/ stay'}
          </span>
        </div>

        {/* Inclusions */}
        {pkg.inclusions.length > 0 && (
          <div className="mb-3 space-y-1">
            {pkg.inclusions.slice(0, 4).map((inc, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="truncate">{inc}</span>
              </div>
            ))}
            {pkg.inclusions.length > 4 && (
              <p className="text-xs text-muted-foreground pl-4.5">+{pkg.inclusions.length - 4} more</p>
            )}
          </div>
        )}

        {/* Stats + Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs text-muted-foreground">
            {pkg._count?.bookings ?? 0} booking{pkg._count?.bookings !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggle}
              title={pkg.isActive ? 'Deactivate' : 'Activate'}
              className={`p-1.5 rounded-lg transition-colors ${pkg.isActive ? 'text-resort-600 hover:bg-resort-50 dark:hover:bg-resort-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              {pkg.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast({ title: 'Package deleted' });
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast({
        title: 'Cannot delete package',
        description: e.response?.data?.error ?? 'Failed to delete package',
        variant: 'destructive',
      });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      packagesApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
    onError: () => toast({ title: 'Failed to update package', variant: 'destructive' }),
  });

  const filtered = packages.filter((p) =>
    filter === 'all' ? true : filter === 'active' ? p.isActive : !p.isActive,
  );

  const activeCount = packages.filter((p) => p.isActive).length;
  const totalBookings = packages.reduce((sum, p) => sum + (p._count?.bookings ?? 0), 0);

  const openCreate = () => { setEditingPkg(undefined); setModalOpen(true); };
  const openEdit = (pkg: PackageItem) => { setEditingPkg(pkg); setModalOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Gift className="h-6 w-6 text-resort-600" />
            Package Deals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bundle rooms with experiences — breakfast, spa, transfers and more
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Package
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl p-3 bg-resort-600">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Packages</p>
              <p className="text-2xl font-bold">{packages.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl p-3 bg-emerald-500">
              <ToggleRight className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl p-3 bg-blue-500">
              <Star className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Times Applied</p>
              <p className="text-2xl font-bold">{totalBookings}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-resort-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Package grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-72 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="h-20 w-20 rounded-full bg-resort-50 dark:bg-resort-900/20 flex items-center justify-center">
            <Gift className="h-10 w-10 text-resort-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {filter === 'all' ? 'No packages yet' : `No ${filter} packages`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'all' ? 'Create your first package deal to upsell extras to guests' : ''}
            </p>
          </div>
          {filter === 'all' && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create First Package
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={() => openEdit(pkg)}
              onDelete={() => {
                if (confirm(`Delete "${pkg.name}"? This cannot be undone.`)) {
                  deleteMut.mutate(pkg.id);
                }
              }}
              onToggle={() => toggleMut.mutate({ id: pkg.id, isActive: !pkg.isActive })}
            />
          ))}
        </div>
      )}

      {/* How it works callout */}
      {packages.length > 0 && (
        <Card className="border-dashed border-resort-200 dark:border-resort-800 bg-resort-50/50 dark:bg-resort-900/10">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-resort-700 dark:text-resort-300 mb-1">💡 How to apply packages</p>
            <p className="text-xs text-resort-600 dark:text-resort-400">
              Open any booking in the <strong>Bookings</strong> page → click the booking → use the <strong>Packages</strong> tab to add or remove packages. The booking total is updated automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      {modalOpen && (
        <PackageModal
          pkg={editingPkg}
          onClose={() => { setModalOpen(false); setEditingPkg(undefined); }}
        />
      )}
    </div>
  );
}
