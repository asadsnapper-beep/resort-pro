'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminEndpoints } from '@/lib/admin-api';
import {
  Palette, Plus, Pencil, X, Check, ToggleLeft, ToggleRight,
  Sparkles, Users, ArrowUpDown, Loader2, ExternalLink,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Theme {
  key:          string;
  name:         string;
  description:  string | null;
  previewImage: string | null;
  isActive:     boolean;
  isPremium:    boolean;
  sortOrder:    number;
  usageCount:   number;
  createdAt:    string;
}

/* ── Preview images for known themes ──────────────────────────────────────── */
const PREVIEW_IMAGES: Record<string, string> = {
  luxe:    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80',
  minimal: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400&q=80',
  coastal: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
};

const PALETTE_HINT: Record<string, { primary: string; accent: string }> = {
  luxe:    { primary: '#1a6b5e', accent: '#d4a853' },
  minimal: { primary: '#2563eb', accent: '#0f172a' },
  coastal: { primary: '#0891b2', accent: '#d97706' },
};

/* ── Empty form state ──────────────────────────────────────────────────────── */
const EMPTY_FORM = { name: '', description: '', previewImage: '', isPremium: false, sortOrder: 99 };

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminThemesPage() {
  const qc = useQueryClient();

  const [editKey,   setEditKey]   = useState<string | null>(null);
  const [editForm,  setEditForm]  = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [showAdd,   setShowAdd]   = useState(false);
  const [addForm,   setAddForm]   = useState({ key: '', ...EMPTY_FORM });

  /* ── Data ────────────────────────────────────────────────────────────────── */
  const { data, isLoading } = useQuery<Theme[]>({
    queryKey: ['admin-themes'],
    queryFn: () => adminEndpoints.getThemes().then(r => r.data.data),
  });

  /* ── Mutations ───────────────────────────────────────────────────────────── */
  const saveMut = useMutation({
    mutationFn: ({ key, form }: { key: string; form: typeof EMPTY_FORM }) =>
      adminEndpoints.updateTheme(key, {
        name:         form.name,
        description:  form.description || undefined,
        previewImage: form.previewImage || undefined,
        isPremium:    form.isPremium,
        sortOrder:    Number(form.sortOrder),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-themes'] });
      setEditKey(null);
      toast({ title: 'Theme saved' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save theme', variant: 'destructive' }),
  });

  const addMut = useMutation({
    mutationFn: (f: typeof addForm) =>
      adminEndpoints.updateTheme(f.key, {
        name:         f.name,
        description:  f.description || undefined,
        previewImage: f.previewImage || undefined,
        isPremium:    f.isPremium,
        sortOrder:    Number(f.sortOrder),
        isActive:     true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-themes'] });
      setShowAdd(false);
      setAddForm({ key: '', ...EMPTY_FORM });
      toast({ title: 'Theme added' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to add theme', variant: 'destructive' }),
  });

  const toggleMut = useMutation({
    mutationFn: (key: string) => adminEndpoints.toggleTheme(key),
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ['admin-themes'] });
      toast({ title: `Theme ${key} toggled` });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to toggle theme', variant: 'destructive' }),
  });

  /* ── Helpers ─────────────────────────────────────────────────────────────── */
  const startEdit = (t: Theme) => {
    setEditKey(t.key);
    setEditForm({
      name:         t.name,
      description:  t.description ?? '',
      previewImage: t.previewImage ?? '',
      isPremium:    t.isPremium,
      sortOrder:    t.sortOrder,
    });
  };

  /* ── Loading ─────────────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const themes = data ?? [];

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Palette className="h-6 w-6 text-indigo-400" />
            Theme Management
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage available themes. Active themes appear in the owner dashboard theme picker.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Theme
        </button>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Themes',    value: themes.length },
          { label: 'Active',          value: themes.filter(t => t.isActive).length },
          { label: 'Total Resorts Using Themes', value: themes.reduce((s, t) => s + t.usageCount, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Theme list ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {themes.map(theme => {
          const isEditing = editKey === theme.key;
          const preview   = theme.previewImage || PREVIEW_IMAGES[theme.key];
          const palette   = PALETTE_HINT[theme.key];

          return (
            <div
              key={theme.key}
              className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${
                theme.isActive ? 'border-gray-800' : 'border-gray-800 opacity-60'
              }`}
            >
              {/* ── Row header ─────────────────────────────────────────────── */}
              <div className="flex items-center gap-4 p-4">
                {/* Preview thumbnail */}
                <div className="h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                  {preview ? (
                    <img src={preview} alt={theme.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      No image
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{theme.name}</span>
                    <code className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-mono">
                      {theme.key}
                    </code>
                    {theme.isPremium && (
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Premium
                      </span>
                    )}
                    {theme.isActive ? (
                      <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-xs text-gray-500 bg-gray-700/40 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{theme.description ?? '—'}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-600">
                    <span className="flex items-center gap-1"><ArrowUpDown className="h-3 w-3" /> Sort: {theme.sortOrder}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {theme.usageCount} resort{theme.usageCount !== 1 ? 's' : ''}</span>
                    {palette && (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full inline-block border border-gray-700" style={{ backgroundColor: palette.primary }} />
                        <span className="h-3 w-3 rounded-full inline-block border border-gray-700" style={{ backgroundColor: palette.accent }} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Preview link */}
                  <a
                    href={`http://localhost:3000/${theme.key}-demo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                    title="Preview"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  {/* Edit / Cancel */}
                  {isEditing ? (
                    <button
                      onClick={() => setEditKey(null)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(theme)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}

                  {/* Toggle active */}
                  <button
                    onClick={() => toggleMut.mutate(theme.key)}
                    disabled={toggleMut.isPending}
                    className={`h-8 rounded-lg px-3 flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      theme.isActive
                        ? 'text-green-400 hover:bg-red-500/10 hover:text-red-400'
                        : 'text-gray-500 hover:bg-green-500/10 hover:text-green-400'
                    }`}
                    title={theme.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {theme.isActive
                      ? <><ToggleRight className="h-4 w-4" /> Active</>
                      : <><ToggleLeft  className="h-4 w-4" /> Inactive</>
                    }
                  </button>
                </div>
              </div>

              {/* ── Inline edit form ──────────────────────────────────────── */}
              {isEditing && (
                <div className="border-t border-gray-800 bg-gray-950/50 p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Theme Name *</label>
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. Luxe Gold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Sort Order</label>
                      <input
                        type="number" min={1}
                        value={editForm.sortOrder}
                        onChange={e => setEditForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 99 }))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                      <input
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Short description shown to resort owners"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Preview Image URL</label>
                      <input
                        value={editForm.previewImage}
                        onChange={e => setEditForm(f => ({ ...f, previewImage: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="https://images.unsplash.com/..."
                        type="url"
                      />
                      {editForm.previewImage && (
                        <div className="mt-2 h-24 w-36 rounded-lg overflow-hidden">
                          <img src={editForm.previewImage} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div
                          onClick={() => setEditForm(f => ({ ...f, isPremium: !f.isPremium }))}
                          className={`w-10 h-5 rounded-full transition-colors relative ${editForm.isPremium ? 'bg-amber-500' : 'bg-gray-700'}`}
                        >
                          <div className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${editForm.isPremium ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm text-gray-300">Premium theme</span>
                        {editForm.isPremium && <Sparkles className="h-3.5 w-3.5 text-amber-400" />}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-5">
                    <button
                      onClick={() => saveMut.mutate({ key: theme.key, form: editForm })}
                      disabled={!editForm.name || saveMut.isPending}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {saveMut.isPending
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                        : <><Check className="h-3.5 w-3.5" /> Save Changes</>
                      }
                    </button>
                    <button
                      onClick={() => setEditKey(null)}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {themes.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl">
          <Palette className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No themes found. Run the DB seed first.</p>
          <code className="text-xs text-gray-600 mt-2 block">pnpm --filter database seed</code>
        </div>
      )}

      {/* ── Add Theme Modal ──────────────────────────────────────────────────── */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <h2 className="font-bold text-white">Add New Theme</h2>
                <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">
                  ⚠️ The theme <strong>key</strong> must match an entry in <code>themes/registry.ts</code> or it will fall back to Luxe.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Key (slug) *</label>
                    <input
                      value={addForm.key}
                      onChange={e => setAddForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. mountain"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Sort Order</label>
                    <input
                      type="number" min={1}
                      value={addForm.sortOrder}
                      onChange={e => setAddForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 99 }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
                  <input
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. Mountain Escape"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                  <input
                    value={addForm.description}
                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Short description for resort owners"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Preview Image URL</label>
                  <input
                    value={addForm.previewImage}
                    onChange={e => setAddForm(f => ({ ...f, previewImage: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="https://..."
                    type="url"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setAddForm(f => ({ ...f, isPremium: !f.isPremium }))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${addForm.isPremium ? 'bg-amber-500' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${addForm.isPremium ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-gray-300">Mark as Premium</span>
                </label>
              </div>

              <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-800">
                <button
                  onClick={() => addMut.mutate(addForm)}
                  disabled={!addForm.key || !addForm.name || addMut.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {addMut.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</>
                    : <><Plus className="h-3.5 w-3.5" /> Add Theme</>
                  }
                </button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
