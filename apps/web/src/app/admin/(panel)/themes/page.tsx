'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminEndpoints } from '@/lib/admin-api';
import {
  Palette, Plus, Pencil, X, Check, ToggleLeft, ToggleRight,
  Sparkles, Users, Loader2, ExternalLink, Star, Crown, Zap,
  Trash2, Shield,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Theme {
  key:          string;
  name:         string;
  description:  string | null;
  previewImage: string | null;
  author:       string;
  version:      string;
  tags:         string[];
  isActive:     boolean;
  isDefault:    boolean;
  isPremium:    boolean;
  requiredPlan: string;
  sortOrder:    number;
  createdAt:    string;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const PLAN_OPTIONS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
const PLAN_ICON: Record<string, React.ReactNode> = {
  STARTER:      <Zap className="h-3 w-3" />,
  PROFESSIONAL: <Crown className="h-3 w-3" />,
  ENTERPRISE:   <Shield className="h-3 w-3" />,
};
const PLAN_COLOR: Record<string, string> = {
  STARTER:      'text-emerald-400 bg-emerald-500/10',
  PROFESSIONAL: 'text-blue-400 bg-blue-500/10',
  ENTERPRISE:   'text-amber-400 bg-amber-500/10',
};

const EMPTY_FORM = {
  name: '', description: '', previewImage: '', author: 'ResortPro Team',
  version: '1.0.0', tags: '', isPremium: false, requiredPlan: 'STARTER', sortOrder: 99,
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminThemesPage() {
  const qc = useQueryClient();
  const [editKey,  setEditKey]  = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [showAdd,  setShowAdd]  = useState(false);
  const [addForm,  setAddForm]  = useState({ key: '', ...EMPTY_FORM });
  const [delKey,   setDelKey]   = useState<string | null>(null);

  /* ── Data ──────────────────────────────────────────────────────────────── */
  const { data, isLoading } = useQuery<Theme[]>({
    queryKey: ['admin-themes'],
    queryFn:  () => adminEndpoints.getThemes().then(r => r.data.data),
  });

  /* ── Mutations ─────────────────────────────────────────────────────────── */
  const saveMut = useMutation({
    mutationFn: ({ key, form }: { key: string; form: typeof EMPTY_FORM }) =>
      adminEndpoints.updateTheme(key, {
        name:         form.name,
        description:  form.description || undefined,
        previewImage: form.previewImage || undefined,
        author:       form.author,
        version:      form.version,
        tags:         form.tags.split(',').map(t => t.trim()).filter(Boolean),
        isPremium:    form.isPremium,
        requiredPlan: form.requiredPlan,
        sortOrder:    Number(form.sortOrder),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-themes'] }); setEditKey(null); toast({ title: '✓ Theme saved' }); },
    onError:   () => toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' }),
  });

  const addMut = useMutation({
    mutationFn: (f: typeof addForm) =>
      adminEndpoints.updateTheme(f.key, {
        name: f.name, description: f.description || undefined,
        previewImage: f.previewImage || undefined, author: f.author,
        version: f.version, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
        isPremium: f.isPremium, requiredPlan: f.requiredPlan,
        sortOrder: Number(f.sortOrder), isActive: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-themes'] });
      setShowAdd(false); setAddForm({ key: '', ...EMPTY_FORM });
      toast({ title: '✓ Theme added' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to add theme', variant: 'destructive' }),
  });

  const toggleMut = useMutation({
    mutationFn: (key: string) => adminEndpoints.toggleTheme(key),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-themes'] }); toast({ title: 'Theme status updated' }); },
    onError:    () => toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' }),
  });

  const setDefaultMut = useMutation({
    mutationFn: (key: string) => adminEndpoints.updateTheme(key, { isDefault: true } as any),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-themes'] }); toast({ title: '✓ Default theme updated' }); },
    onError:    () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (key: string) => adminEndpoints.updateTheme(key, { isActive: false } as any), // soft delete
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-themes'] }); setDelKey(null); toast({ title: 'Theme removed' }); },
    onError:    () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const startEdit = (t: Theme) => {
    setEditKey(t.key);
    setEditForm({
      name: t.name, description: t.description ?? '',
      previewImage: t.previewImage ?? '', author: t.author,
      version: t.version, tags: t.tags.join(', '),
      isPremium: t.isPremium, requiredPlan: t.requiredPlan, sortOrder: t.sortOrder,
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  const themes = data ?? [];

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Palette className="h-6 w-6 text-indigo-400" /> Theme Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Active themes appear in the owner theme picker. Set a default for new registrations.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus className="h-4 w-4" /> Add Theme
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: themes.length },
          { label: 'Active',   value: themes.filter(t => t.isActive).length },
          { label: 'Premium',  value: themes.filter(t => t.isPremium).length },
          { label: 'Free',     value: themes.filter(t => !t.isPremium).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Theme list */}
      <div className="space-y-3">
        {themes.map(theme => {
          const isEditing = editKey === theme.key;
          return (
            <div key={theme.key}
              className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${
                theme.isActive ? 'border-gray-800' : 'border-gray-800/50 opacity-60'
              }`}>

              {/* Row */}
              <div className="flex items-center gap-4 p-4">
                {/* Thumbnail */}
                <div className="h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                  {theme.previewImage
                    ? <img src={theme.previewImage} alt={theme.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No image</div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{theme.name}</span>
                    <code className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-mono">{theme.key}</code>
                    <span className="text-xs text-gray-600">v{theme.version}</span>
                    {theme.isDefault && (
                      <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" /> Default
                      </span>
                    )}
                    {theme.isPremium && (
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Premium
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${PLAN_COLOR[theme.requiredPlan] ?? 'text-gray-400 bg-gray-700'}`}>
                      {PLAN_ICON[theme.requiredPlan]} {theme.requiredPlan}
                    </span>
                    {theme.isActive
                      ? <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Active</span>
                      : <span className="text-xs text-gray-500 bg-gray-700/40 px-2 py-0.5 rounded-full">Inactive</span>
                    }
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5 truncate">{theme.description ?? '—'}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {theme.tags.map(tag => (
                      <span key={tag} className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                    <span className="text-xs text-gray-600 ml-auto">by {theme.author}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Preview */}
                  <a href={`http://localhost:3000/${theme.key}`} target="_blank" rel="noopener noreferrer"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Preview">
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  {/* Set Default */}
                  {!theme.isDefault && theme.isActive && (
                    <button onClick={() => setDefaultMut.mutate(theme.key)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors" title="Set as default">
                      <Star className="h-4 w-4" />
                    </button>
                  )}

                  {/* Edit */}
                  <button onClick={() => isEditing ? setEditKey(null) : startEdit(theme)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors" title="Edit">
                    {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </button>

                  {/* Toggle */}
                  <button onClick={() => toggleMut.mutate(theme.key)} disabled={toggleMut.isPending}
                    className={`h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      theme.isActive ? 'text-green-400 hover:bg-red-500/10 hover:text-red-400' : 'text-gray-500 hover:bg-green-500/10 hover:text-green-400'
                    }`}>
                    {theme.isActive ? <><ToggleRight className="h-4 w-4" /> On</> : <><ToggleLeft className="h-4 w-4" /> Off</>}
                  </button>

                  {/* Delete (only inactive non-default) */}
                  {!theme.isDefault && (
                    <button onClick={() => setDelKey(theme.key)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Edit form */}
              {isEditing && (
                <div className="border-t border-gray-800 bg-gray-950/50 p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Theme Name *', key: 'name', placeholder: 'e.g. Luxe Gold' },
                      { label: 'Author', key: 'author', placeholder: 'ResortPro Team' },
                      { label: 'Version', key: 'version', placeholder: '1.0.0' },
                      { label: 'Sort Order', key: 'sortOrder', placeholder: '1', type: 'number' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">{f.label}</label>
                        <input type={f.type ?? 'text'}
                          value={(editForm as any)[f.key]}
                          onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                    ))}

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                      <input value={editForm.description}
                        onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Short description for resort owners"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Tags (comma separated)</label>
                      <input value={editForm.tags}
                        onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))}
                        placeholder="Luxury, Gold Accents, Full-Screen Hero"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Preview Image URL</label>
                      <input value={editForm.previewImage} type="url"
                        onChange={e => setEditForm(p => ({ ...p, previewImage: e.target.value }))}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      {editForm.previewImage && (
                        <img src={editForm.previewImage} alt="preview" className="mt-2 h-24 w-36 rounded-lg object-cover" />
                      )}
                    </div>

                    {/* Required Plan */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Required Plan</label>
                      <div className="flex gap-2">
                        {PLAN_OPTIONS.map(plan => (
                          <button key={plan} type="button"
                            onClick={() => setEditForm(p => ({ ...p, requiredPlan: plan }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                              editForm.requiredPlan === plan ? PLAN_COLOR[plan] + ' border border-current/30' : 'text-gray-600 bg-gray-800 hover:bg-gray-700'
                            }`}>
                            {PLAN_ICON[plan]} {plan}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Premium toggle */}
                    <div className="flex items-center">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div onClick={() => setEditForm(p => ({ ...p, isPremium: !p.isPremium }))}
                          className={`w-10 h-5 rounded-full transition-colors relative ${editForm.isPremium ? 'bg-amber-500' : 'bg-gray-700'}`}>
                          <div className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${editForm.isPremium ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm text-gray-300">Premium theme</span>
                        {editForm.isPremium && <Sparkles className="h-3.5 w-3.5 text-amber-400" />}
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button onClick={() => saveMut.mutate({ key: editKey!, form: editForm })}
                      disabled={!editForm.name || saveMut.isPending}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                      {saveMut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Check className="h-3.5 w-3.5" /> Save Changes</>}
                    </button>
                    <button onClick={() => setEditKey(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {themes.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl">
          <Palette className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No themes yet.</p>
        </div>
      )}

      {/* Add Theme Modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                <h2 className="font-bold text-white">Add New Theme</h2>
                <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">
                  ⚠️ Theme <strong>key</strong> must match a registered theme in <code>themes/registry.ts</code>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Key (slug) *</label>
                    <input value={addForm.key}
                      onChange={e => setAddForm(p => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      placeholder="e.g. mountain" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Sort Order</label>
                    <input type="number" value={addForm.sortOrder}
                      onChange={e => setAddForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 99 }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
                    <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Mountain Escape" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                    <input value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Short description" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Tags (comma separated)</label>
                    <input value={addForm.tags} onChange={e => setAddForm(p => ({ ...p, tags: e.target.value }))}
                      placeholder="Luxury, Modern" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Preview Image URL</label>
                    <input value={addForm.previewImage} type="url" onChange={e => setAddForm(p => ({ ...p, previewImage: e.target.value }))}
                      placeholder="https://..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-2">Required Plan</label>
                    <div className="flex gap-2">
                      {PLAN_OPTIONS.map(plan => (
                        <button key={plan} type="button"
                          onClick={() => setAddForm(p => ({ ...p, requiredPlan: plan }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                            addForm.requiredPlan === plan ? PLAN_COLOR[plan] + ' border border-current/30' : 'text-gray-600 bg-gray-800 hover:bg-gray-700'
                          }`}>
                          {PLAN_ICON[plan]} {plan}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div onClick={() => setAddForm(p => ({ ...p, isPremium: !p.isPremium }))}
                        className={`w-10 h-5 rounded-full transition-colors relative ${addForm.isPremium ? 'bg-amber-500' : 'bg-gray-700'}`}>
                        <div className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${addForm.isPremium ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-sm text-gray-300">Mark as Premium</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
                <button onClick={() => addMut.mutate(addForm)}
                  disabled={!addForm.key || !addForm.name || addMut.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  {addMut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</> : <><Plus className="h-3.5 w-3.5" /> Add Theme</>}
                </button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirm */}
      {delKey && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setDelKey(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full pointer-events-auto">
              <h3 className="font-bold text-white mb-2">Remove Theme?</h3>
              <p className="text-sm text-gray-400 mb-5">
                Theme <code className="text-indigo-400">{delKey}</code> will be deactivated and hidden from owners.
              </p>
              <div className="flex gap-3">
                <button onClick={() => deleteMut.mutate(delKey!)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors">
                  Remove
                </button>
                <button onClick={() => setDelKey(null)} className="flex-1 py-2 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-800">
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
