'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  Megaphone, Loader2, Plus, Pencil, Trash2, Send,
  Info, AlertTriangle, Wrench, Sparkles, X,
  CheckCircle2, Clock, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

type AnnType = 'info' | 'warning' | 'maintenance' | 'feature';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnType;
  targetPlans: string[];
  isDismissible: boolean;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<AnnType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  info:        { label: 'Info',        icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  warning:     { label: 'Warning',     icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  maintenance: { label: 'Maintenance', icon: Wrench,        color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  feature:     { label: 'New Feature', icon: Sparkles,      color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
};

const ALL_PLANS = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

function isActive(ann: Announcement) {
  if (!ann.isActive) return false;
  const now = Date.now();
  if (new Date(ann.startsAt).getTime() > now) return false;
  if (ann.endsAt && new Date(ann.endsAt).getTime() < now) return false;
  return true;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Form Modal ─────────────────────────────────────────────────────────────

interface ModalProps {
  ann?: Announcement | null;
  onClose: () => void;
  onSave: () => void;
}

const defaultForm = {
  title: '', body: '', type: 'info' as AnnType,
  targetPlans: [] as string[], isDismissible: true,
  startsAt: new Date().toISOString().slice(0, 16),
  endsAt: '',
};

function AnnouncementModal({ ann, onClose, onSave }: ModalProps) {
  const isEdit = !!ann;
  const [form, setForm] = useState({
    title: ann?.title ?? defaultForm.title,
    body: ann?.body ?? defaultForm.body,
    type: (ann?.type ?? defaultForm.type) as AnnType,
    targetPlans: ann?.targetPlans ?? defaultForm.targetPlans,
    isDismissible: ann?.isDismissible ?? defaultForm.isDismissible,
    startsAt: ann?.startsAt ? new Date(ann.startsAt).toISOString().slice(0, 16) : defaultForm.startsAt,
    endsAt: ann?.endsAt ? new Date(ann.endsAt).toISOString().slice(0, 16) : defaultForm.endsAt,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const togglePlan = (plan: string) =>
    set('targetPlans', form.targetPlans.includes(plan)
      ? form.targetPlans.filter((p) => p !== plan)
      : [...form.targetPlans, plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        endsAt: form.endsAt || undefined,
      };
      if (isEdit) {
        await adminEndpoints.updateAnnouncement(ann!.id, payload);
        toast({ title: 'Announcement updated' });
      } else {
        await adminEndpoints.createAnnouncement(payload);
        toast({ title: 'Announcement created' });
      }
      onSave();
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return createPortal((
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h2 className="text-white font-semibold">{isEdit ? 'Edit Announcement' : 'New Announcement'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TYPE_CONFIG) as AnnType[]).map((t) => {
                const cfg = TYPE_CONFIG[t];
                const Icon = cfg.icon;
                const selected = form.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('type', t)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
                      selected ? cn(cfg.bg, cfg.color) : 'border-gray-700 text-gray-500 hover:border-gray-600'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Title</label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
              placeholder="Scheduled maintenance — Sunday 2am UTC"
              className="w-full h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Message</label>
            <textarea
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              required
              rows={3}
              placeholder="We will be performing scheduled maintenance on Sunday, May 18 from 2:00–4:00 AM UTC. The platform may be briefly unavailable."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Target plans */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Target plans <span className="text-gray-600 font-normal">(empty = all plans)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLANS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlan(p)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    form.targetPlans.includes(p)
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'border-gray-700 text-gray-500 hover:border-gray-600'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Starts at</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
                className="w-full h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Ends at <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
                className="w-full h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Dismissible toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('isDismissible', !form.isDismissible)}
              className={cn(
                'w-9 h-5 rounded-full border transition-colors relative',
                form.isDismissible ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-800 border-gray-700'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                form.isDismissible ? 'left-4' : 'left-0.5'
              )} />
            </div>
            <span className="text-sm text-gray-300">Tenants can dismiss this banner</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ), document.body);
}

// ── Announcement Card ──────────────────────────────────────────────────────

function AnnCard({
  ann,
  onEdit,
  onDelete,
  onBroadcast,
  onToggle,
}: {
  ann: Announcement;
  onEdit: () => void;
  onDelete: () => void;
  onBroadcast: () => void;
  onToggle: () => void;
}) {
  const cfg = TYPE_CONFIG[ann.type] ?? TYPE_CONFIG.info;
  const Icon = cfg.icon;
  const active = isActive(ann);
  const [broadcasting, setBroadcasting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleBroadcast = async () => {
    setBroadcasting(true);
    try {
      const res = await adminEndpoints.broadcastAnnouncement(ann.id);
      const { sent, total } = res.data.data;
      toast({ title: `Email sent to ${sent}/${total} tenants` });
      onBroadcast();
    } catch (err: any) {
      toast({ title: 'Broadcast failed', description: err?.response?.data?.error, variant: 'destructive' });
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${ann.title}"?`)) return;
    setDeleting(true);
    try {
      await adminEndpoints.deleteAnnouncement(ann.id);
      toast({ title: 'Deleted' });
      onDelete();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={cn('bg-gray-900 border rounded-2xl p-5 space-y-3', active ? 'border-gray-700' : 'border-gray-800 opacity-60')}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center shrink-0', cfg.bg)}>
          <Icon className={cn('w-4 h-4', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white text-sm font-semibold">{ann.title}</p>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
            {active
              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">Live</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/50 border border-gray-700 text-gray-500 font-medium">Inactive</span>
            }
          </div>
          <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{ann.body}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(ann.startsAt)}
          {ann.endsAt && <> → {formatDate(ann.endsAt)}</>}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {ann.targetPlans.length === 0 ? 'All plans' : ann.targetPlans.join(', ')}
        </span>
        {ann.isDismissible && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />Dismissible
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
            ann.isActive
              ? 'border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10'
              : 'border-gray-700 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10'
          )}
        >
          {ann.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          onClick={handleBroadcast}
          disabled={broadcasting}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
        >
          {broadcasting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Broadcast Email
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; ann: Announcement | null }>({ open: false, ann: null });

  const load = () => {
    adminEndpoints.getAnnouncements()
      .then((r) => setAnnouncements(r.data.data))
      .catch(() => toast({ title: 'Failed to load announcements', variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (ann: Announcement) => {
    try {
      await adminEndpoints.updateAnnouncement(ann.id, { isActive: !ann.isActive });
      toast({ title: ann.isActive ? 'Announcement deactivated' : 'Announcement activated' });
      load();
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const live = announcements.filter(isActive);
  const inactive = announcements.filter((a) => !isActive(a));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Announcements</h1>
          <p className="text-gray-500 text-sm mt-1">
            Notify tenants via in-app banners and email broadcasts
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, ann: null })}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Announcement
        </button>
      </div>

      {/* How it works */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Megaphone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-indigo-300 font-medium text-sm">How it works</p>
            <p className="text-indigo-400/70 text-xs mt-1 leading-relaxed">
              Active announcements show as banners in the tenant dashboard automatically (no refresh needed).
              Use <strong className="text-indigo-300">Broadcast Email</strong> to also send an email to all matching tenants.
              Target by plan to show only to specific tiers.
            </p>
          </div>
        </div>
      </div>

      {/* Live */}
      {live.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live ({live.length})
          </h2>
          {live.map((ann) => (
            <AnnCard
              key={ann.id}
              ann={ann}
              onEdit={() => setModal({ open: true, ann })}
              onDelete={load}
              onBroadcast={load}
              onToggle={() => handleToggle(ann)}
            />
          ))}
        </div>
      )}

      {/* Inactive / past */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-gray-600 text-sm font-semibold">
            Inactive / Past ({inactive.length})
          </h2>
          {inactive.map((ann) => (
            <AnnCard
              key={ann.id}
              ann={ann}
              onEdit={() => setModal({ open: true, ann })}
              onDelete={load}
              onBroadcast={load}
              onToggle={() => handleToggle(ann)}
            />
          ))}
        </div>
      )}

      {announcements.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-12 h-12 text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">No announcements yet</p>
          <p className="text-gray-600 text-sm mt-1">Create one to show a banner to your tenants</p>
        </div>
      )}

      {modal.open && (
        <AnnouncementModal
          ann={modal.ann}
          onClose={() => setModal({ open: false, ann: null })}
          onSave={load}
        />
      )}
    </div>
  );
}
