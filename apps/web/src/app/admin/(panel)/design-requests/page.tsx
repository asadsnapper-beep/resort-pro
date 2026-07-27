'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { toast } from '@/hooks/use-toast';
import {
  Palette, Loader2, Clock, Mail, Phone, ExternalLink,
  Banknote, X, Check, Sparkles,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type Status = 'NEW' | 'CONTACTED' | 'QUOTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';

interface DesignRequest {
  id: string;
  status: Status;
  tier: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  budgetRange: string | null;
  timeline: string | null;
  description: string;
  referenceUrls: string[];
  quotedAmount: number | null;
  currency: string | null;
  quotedAt: string | null;
  adminNotes: string | null;
  deliveredThemeKey: string | null;
  createdAt: string;
  tenant: { id: string; name: string; slug: string; plan: string };
}

const STATUS_TABS: { id: Status | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'NEW', label: 'New' },
  { id: 'CONTACTED', label: 'Contacted' },
  { id: 'QUOTED', label: 'Quoted' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_STYLE: Record<Status, { label: string; color: string; bg: string }> = {
  NEW:         { label: 'New',         color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  CONTACTED:   { label: 'Contacted',   color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  QUOTED:      { label: 'Quoted',      color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  ACCEPTED:    { label: 'Accepted',    color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/20' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  DELIVERED:   { label: 'Delivered',   color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  CANCELLED:   { label: 'Cancelled',   color: 'text-gray-500',   bg: 'bg-gray-500/10 border-gray-500/20' },
};

const TIER_LABEL: Record<string, string> = {
  branding: 'Branding polish',
  custom: 'Custom design',
  premium: 'Premium',
};

/* Every forward move in the pipeline, in order. */
const NEXT_STATUS: Record<Status, Status | null> = {
  NEW: 'CONTACTED',
  CONTACTED: 'QUOTED',
  QUOTED: 'ACCEPTED',
  ACCEPTED: 'IN_PROGRESS',
  IN_PROGRESS: 'DELIVERED',
  DELIVERED: null,
  CANCELLED: null,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

/* ── Detail / quote panel ─────────────────────────────────────────────────── */

function DetailPanel({ req, onClose }: { req: DesignRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const [quotedAmount, setQuotedAmount] = useState(req.quotedAmount ? String(req.quotedAmount) : '');
  const [currency, setCurrency] = useState(req.currency ?? 'BDT');
  const [adminNotes, setAdminNotes] = useState(req.adminNotes ?? '');
  const [deliveredThemeKey, setDeliveredThemeKey] = useState(req.deliveredThemeKey ?? '');

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminApi.patch(`/design-requests/${req.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-design-requests'] });
      toast({ title: '✓ Updated' });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: e?.response?.data?.error, variant: 'destructive' }),
  });

  const next = NEXT_STATUS[req.status];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-gray-950 border-l border-gray-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-gray-500">{req.tenant.slug}</p>
            <h2 className="text-lg font-bold text-white">{req.tenant.name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold mb-5 ${STATUS_STYLE[req.status].bg} ${STATUS_STYLE[req.status].color}`}>
          {STATUS_STYLE[req.status].label}
        </div>

        {/* Contact */}
        <div className="space-y-2 mb-6 text-sm">
          <p className="text-white font-medium">{req.contactName}</p>
          <a href={`mailto:${req.contactEmail}`} className="flex items-center gap-2 text-gray-400 hover:text-indigo-400">
            <Mail className="h-3.5 w-3.5" /> {req.contactEmail}
          </a>
          <a href={`tel:${req.contactPhone}`} className="flex items-center gap-2 text-gray-400 hover:text-indigo-400">
            <Phone className="h-3.5 w-3.5" /> {req.contactPhone}
          </a>
        </div>

        {/* Brief */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="rounded-lg bg-gray-900 border border-gray-800 p-3">
            <p className="text-gray-500 mb-0.5">Tier</p>
            <p className="text-white font-medium">{req.tier ? TIER_LABEL[req.tier] ?? req.tier : '—'}</p>
          </div>
          <div className="rounded-lg bg-gray-900 border border-gray-800 p-3">
            <p className="text-gray-500 mb-0.5">Timeline</p>
            <p className="text-white font-medium">{req.timeline || '—'}</p>
          </div>
        </div>

        <div className="rounded-lg bg-gray-900 border border-gray-800 p-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">Brief</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{req.description}</p>
        </div>

        {req.referenceUrls.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-2">Reference sites</p>
            <div className="space-y-1.5">
              {req.referenceUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 truncate">
                  <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{url}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-800 my-5" />

        {/* Quote */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Quote</label>
            <div className="flex gap-2">
              <input
                value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-20 rounded-lg bg-gray-900 border border-gray-800 px-2 py-2 text-sm text-white"
              />
              <div className="relative flex-1">
                <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
                <input
                  type="number" min="0" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)}
                  placeholder="Amount" className="w-full rounded-lg bg-gray-900 border border-gray-800 pl-8 pr-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            {req.quotedAt && (
              <p className="mt-1 text-xs text-gray-500">Last quoted {timeAgo(req.quotedAt)}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Delivered theme key</label>
            <input
              value={deliveredThemeKey} onChange={(e) => setDeliveredThemeKey(e.target.value)}
              placeholder="e.g. sunset-villa-bespoke"
              className="w-full rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm text-white"
            />
            <p className="mt-1 text-xs text-gray-500">
              After uploading their theme, set <code className="text-gray-400">Theme.exclusiveToTenantId</code>{' '}
              to <code className="text-gray-400">{req.tenant.id}</code> from the Themes tab so it's private to them.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Internal notes</label>
            <textarea
              value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3}
              placeholder="Never shown to the tenant"
              className="w-full resize-none rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            onClick={() => updateMut.mutate({
              quotedAmount: quotedAmount ? Number(quotedAmount) : null,
              currency: currency || null,
              adminNotes: adminNotes || null,
              deliveredThemeKey: deliveredThemeKey || null,
            })}
            disabled={updateMut.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {updateMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>

          <div className="flex gap-2 pt-2">
            {next && (
              <button
                onClick={() => updateMut.mutate({ status: next })}
                disabled={updateMut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Mark {STATUS_STYLE[next].label}
              </button>
            )}
            {req.status !== 'CANCELLED' && req.status !== 'DELIVERED' && (
              <button
                onClick={() => { if (confirm('Cancel this request?')) updateMut.mutate({ status: 'CANCELLED' }); }}
                disabled={updateMut.isPending}
                className="rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 px-4 py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */

export default function AdminDesignRequestsPage() {
  const [tab, setTab] = useState<Status | 'all'>('all');
  const [selected, setSelected] = useState<DesignRequest | null>(null);

  const { data, isLoading } = useQuery<{ requests: DesignRequest[]; counts: Record<string, number> }>({
    queryKey: ['admin-design-requests'],
    queryFn: () => adminApi.get('/design-requests').then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const all = data?.requests ?? [];
  const counts = data?.counts ?? {};
  const filtered = tab === 'all' ? all : all.filter((r) => r.status === tab);
  const openCount = (counts.NEW ?? 0) + (counts.CONTACTED ?? 0) + (counts.QUOTED ?? 0) + (counts.ACCEPTED ?? 0) + (counts.IN_PROGRESS ?? 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Palette className="h-6 w-6 text-indigo-500" />
            Custom Design Requests
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Paid design service leads from the dashboard — plan/theme-studio-and-design-service.md
          </p>
        </div>
        {openCount > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400">
            <Sparkles className="h-3.5 w-3.5" /> {openCount} open
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            {t.label}
            {t.id !== 'all' && counts[t.id] ? <span className="ml-1.5 opacity-70">{counts[t.id]}</span> : null}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/50 py-16 text-center">
          <Palette className="h-8 w-8 text-gray-700" />
          <p className="text-sm text-gray-500">No requests here yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="flex w-full items-center gap-4 bg-gray-900/50 hover:bg-gray-900 px-4 py-4 text-left transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                {r.tenant.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{r.tenant.name}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[r.status].bg} ${STATUS_STYLE[r.status].color}`}>
                    {STATUS_STYLE[r.status].label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{r.description}</p>
              </div>
              <div className="text-right shrink-0 text-xs text-gray-500">
                <p>{r.tier ? TIER_LABEL[r.tier] ?? r.tier : '—'}</p>
                <p className="flex items-center gap-1 mt-0.5 justify-end"><Clock className="h-3 w-3" /> {timeAgo(r.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <DetailPanel req={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
