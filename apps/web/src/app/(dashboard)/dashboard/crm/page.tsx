'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Mail, Megaphone, GitBranch, BarChart3,
  Plus, Search, Send, Trash2, Play, Pause, Eye,
  Star, Tag, X, ChevronDown, CheckCircle, AlertCircle,
  Crown, Medal, Award, TrendingUp, ArrowRight,
  Edit3, RefreshCw, UserPlus,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

/* ── Types ────────────────────────────────────────────────────────────────── */
interface GuestContact {
  id: string; firstName: string; lastName: string; email: string; phone?: string;
  score?: { score: number; tier: string; totalStays: number; totalSpend: number };
  consent?: { subscribed: boolean };
  tags: { tag: { id: string; name: string; color: string } }[];
  _count: { bookings: number };
}

interface Tag { id: string; name: string; color: string; _count: { relations: number }; }

interface EmailTemplate { id: string; name: string; subject: string; html: string; createdAt: string; }

interface Campaign {
  id: string; name: string; subject: string; status: string;
  recipientCount: number; sentAt?: string; scheduledAt?: string;
  stats?: { sent: number; opened: number; clicked: number; bounced: number };
  _count: { sends: number };
}

interface Sequence {
  id: string; name: string; trigger: string; status: string;
  steps: { id: string; subject: string; delayDays: number; stepOrder: number }[];
  _count: { enrollments: number };
}

interface Analytics {
  totalContacts: number;
  subscribed: number;
  tierCounts: { tier: string; _count: { tier: number } }[];
  campaignStats: { campaign: { name: string; sentAt?: string }; sent: number; opened: number; clicked: number }[];
  topGuests: { score: number; tier: string; guest: { firstName: string; lastName: string; email: string } }[];
}

/* ── Tier config ──────────────────────────────────────────────────────────── */
const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  STANDARD:  { label: 'Standard',  color: '#6b7280', bg: '#f3f4f6', Icon: Users },
  SILVER:    { label: 'Silver',    color: '#6b7280', bg: '#f1f5f9', Icon: Award },
  GOLD:      { label: 'Gold',      color: '#d97706', bg: '#fef3c7', Icon: Medal },
  PLATINUM:  { label: 'Platinum',  color: '#7c3aed', bg: '#ede9fe', Icon: Crown },
};

const TRIGGER_LABELS: Record<string, string> = {
  BOOKING_CONFIRMED: '✅ Booking Confirmed',
  PRE_ARRIVAL:       '✈️ Pre-Arrival (3 days)',
  CHECK_IN:          '🏨 Check-In Day',
  POST_STAY:         '⭐ Post-Stay',
  WIN_BACK:          '💌 Win-Back (90 days)',
  BIRTHDAY:          '🎂 Birthday',
  ANNIVERSARY:       '🏖️ Resort Anniversary (1 year)',
  MANUAL:            '🔧 Manual',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      'bg-gray-100 text-gray-600',
  SCHEDULED:  'bg-blue-100 text-blue-700',
  SENDING:    'bg-yellow-100 text-yellow-700',
  SENT:       'bg-green-100 text-green-700',
  PAUSED:     'bg-orange-100 text-orange-700',
  CANCELLED:  'bg-red-100 text-red-700',
  ACTIVE:     'bg-green-100 text-green-700',
  ARCHIVED:   'bg-gray-100 text-gray-500',
};

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function CRMPage() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<'contacts' | 'campaigns' | 'sequences' | 'templates' | 'analytics'>('contacts');
  const primary = '#1a6b5e';
  const accent  = '#d4a853';

  const tabs = [
    { id: 'contacts',  label: 'Contacts',  Icon: Users },
    { id: 'campaigns', label: 'Campaigns', Icon: Megaphone },
    { id: 'sequences', label: 'Sequences', Icon: GitBranch },
    { id: 'templates', label: 'Templates', Icon: Mail },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM & Email Marketing</h1>
          <p className="mt-1 text-sm text-gray-500">Manage guest relationships, campaigns and automated sequences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              borderColor: tab === id ? primary : 'transparent',
              color: tab === id ? primary : '#6b7280',
            }}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'contacts'  && <ContactsTab token={token!} primary={primary} />}
      {tab === 'campaigns' && <CampaignsTab token={token!} primary={primary} accent={accent} />}
      {tab === 'sequences' && <SequencesTab token={token!} primary={primary} />}
      {tab === 'templates' && <TemplatesTab token={token!} primary={primary} />}
      {tab === 'analytics' && <AnalyticsTab token={token!} primary={primary} accent={accent} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONTACTS TAB
══════════════════════════════════════════════════════════════════════════════ */
function ContactsTab({ token, primary }: { token: string; primary: string }) {
  const [guests, setGuests]   = useState<GuestContact[]>([]);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState('');
  const [tierFilter, setTier] = useState('');
  const [loading, setLoading] = useState(true);
  const [tags, setTags]       = useState<Tag[]>([]);

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (search) params.set('search', search);
      if (tierFilter) params.set('tier', tierFilter);
      const res = await api.get(`/crm/contacts?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      setGuests(res.data.data.guests);
      setTotal(res.data.data.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, search, tierFilter]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.get('/crm/tags', { headers: { Authorization: `Bearer ${token}` } });
      setTags(res.data.data);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchGuests(); fetchTags(); }, [fetchGuests, fetchTags]);

  const recalcScore = async (id: string) => {
    await api.post(`/crm/contacts/${id}/recalc-score`, {}, { headers: { Authorization: `Bearer ${token}` } });
    fetchGuests();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500" />
        </div>
        <select value={tierFilter} onChange={e => setTier(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none">
          <option value="">All Tiers</option>
          {Object.entries(TIER_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetchGuests}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: primary }}>
          <Search className="h-4 w-4" /> Search
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="font-medium text-gray-900">{total}</span> total contacts
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading contacts…</div>
        ) : guests.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No contacts found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Guest</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tier</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stays</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tags</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {guests.map(g => {
                const tier = TIER_CONFIG[g.score?.tier ?? 'STANDARD'];
                const TierIcon = tier.Icon;
                return (
                  <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: primary }}>
                          {g.firstName[0]}{g.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{g.firstName} {g.lastName}</p>
                          <p className="text-xs text-gray-400">{g.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: tier.bg, color: tier.color }}>
                        <TierIcon className="h-3 w-3" />
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${g.score?.score ?? 0}%`, backgroundColor: primary }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{g.score?.score ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{g._count.bookings}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {g.tags.slice(0, 3).map(tr => (
                          <span key={tr.tag.id} className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: tr.tag.color }}>
                            {tr.tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {g.consent?.subscribed !== false
                        ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3 w-3" /> Subscribed</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-red-400"><X className="h-3 w-3" /> Unsubscribed</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => recalcScore(g.id)} title="Recalculate score"
                        className="text-gray-400 hover:text-gray-600 transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CAMPAIGNS TAB
══════════════════════════════════════════════════════════════════════════════ */
function CampaignsTab({ token, primary, accent }: { token: string; primary: string; accent: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [sending, setSending]     = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', html: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/crm/campaigns', { headers: { Authorization: `Bearer ${token}` } });
      setCampaigns(res.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetch(); }, [fetch]);

  const createCampaign = async () => {
    if (!form.name || !form.subject || !form.html) { setError('All fields required'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/crm/campaigns', form, { headers: { Authorization: `Bearer ${token}` } });
      setShowNew(false); setForm({ name: '', subject: '', html: '' });
      fetch();
    } catch { setError('Failed to create campaign'); }
    setSaving(false);
  };

  const sendCampaign = async (id: string) => {
    if (!confirm('Send this campaign to all subscribed guests?')) return;
    setSending(id);
    try {
      const res = await api.post(`/crm/campaigns/${id}/send`, {}, { headers: { Authorization: `Bearer ${token}` } });
      alert(`✅ Sent to ${res.data.data.sent} guests`);
      fetch();
    } catch { alert('Failed to send campaign'); }
    setSending(null);
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign?')) return;
    await api.delete(`/crm/campaigns/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: primary }}>
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {/* New Campaign Form */}
      {showNew && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">New Campaign</h3>
            <button onClick={() => setShowNew(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Campaign Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Summer Promo 2026"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email Subject</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Special offer just for you 🌴"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Email Body (HTML or plain text — use {'{{guestName}}'} for personalisation)
            </label>
            <textarea value={form.html} onChange={e => setForm(p => ({ ...p, html: e.target.value }))}
              rows={6} placeholder="<h2>Hi {{guestName}},</h2><p>We have a special offer...</p>"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 font-mono resize-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button onClick={createCampaign} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: primary }}>
              {saving ? 'Saving…' : <><Plus className="h-4 w-4" /> Save as Draft</>}
            </button>
            <button onClick={() => setShowNew(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Campaigns list */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>No campaigns yet. Create your first one!</p>
          </div>
        ) : (
          campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Subject: {c.subject}</p>
                  {c.sentAt && <p className="text-xs text-gray-400 mt-1">Sent {new Date(c.sentAt).toLocaleDateString()}</p>}
                </div>

                {/* Stats */}
                {c.stats && (
                  <div className="flex gap-5 text-center flex-shrink-0">
                    {[
                      { label: 'Sent',    val: c.stats.sent },
                      { label: 'Opened',  val: c.stats.opened,  rate: c.stats.sent ? Math.round(c.stats.opened / c.stats.sent * 100) : 0 },
                      { label: 'Clicked', val: c.stats.clicked, rate: c.stats.sent ? Math.round(c.stats.clicked / c.stats.sent * 100) : 0 },
                    ].map(s => (
                      <div key={s.label}>
                        <p className="text-lg font-bold text-gray-900">{s.val}</p>
                        <p className="text-xs text-gray-400">{s.label}</p>
                        {'rate' in s && s.rate > 0 && <p className="text-xs font-medium" style={{ color: primary }}>{s.rate}%</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                    <button onClick={() => sendCampaign(c.id)} disabled={sending === c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: primary }}>
                      {sending === c.id ? 'Sending…' : <><Send className="h-3 w-3" /> Send Now</>}
                    </button>
                  )}
                  {['DRAFT', 'SCHEDULED'].includes(c.status) && (
                    <button onClick={() => deleteCampaign(c.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   SEQUENCES TAB
══════════════════════════════════════════════════════════════════════════════ */
function SequencesTab({ token, primary }: { token: string; primary: string }) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [showSteps, setShowSteps] = useState<string | null>(null);
  const [form, setForm]  = useState({ name: '', trigger: 'BOOKING_CONFIRMED' });
  const [stepForm, setStepForm] = useState({ subject: '', html: '', delayDays: 0 });
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/crm/sequences', { headers: { Authorization: `Bearer ${token}` } });
      setSequences(res.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetch(); }, [fetch]);

  const createSequence = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await api.post('/crm/sequences', form, { headers: { Authorization: `Bearer ${token}` } });
      setShowNew(false); setForm({ name: '', trigger: 'BOOKING_CONFIRMED' });
      fetch();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const toggleStatus = async (seq: Sequence) => {
    const status = seq.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await api.put(`/crm/sequences/${seq.id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
    fetch();
  };

  const addStep = async (seqId: string) => {
    if (!stepForm.subject || !stepForm.html) return;
    await api.post(`/crm/sequences/${seqId}/steps`, stepForm, { headers: { Authorization: `Bearer ${token}` } });
    setStepForm({ subject: '', html: '', delayDays: 0 });
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90"
          style={{ backgroundColor: primary }}>
          <Plus className="h-4 w-4" /> New Sequence
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">New Automation Sequence</h3>
            <button onClick={() => setShowNew(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Sequence Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Welcome Series"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Trigger</label>
              <select value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none">
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createSequence} disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: primary }}>
              {saving ? 'Creating…' : 'Create Sequence'}
            </button>
            <button onClick={() => setShowNew(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading sequences…</div>
        ) : sequences.length === 0 ? (
          <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
            <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>No sequences yet. Automate your guest communication!</p>
          </div>
        ) : (
          sequences.map(seq => (
            <div key={seq.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${primary}10` }}>
                    <GitBranch className="h-5 w-5" style={{ color: primary }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{seq.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[seq.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {seq.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{TRIGGER_LABELS[seq.trigger]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{seq.steps.length}</p>
                    <p className="text-xs text-gray-400">steps</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{seq._count.enrollments}</p>
                    <p className="text-xs text-gray-400">enrolled</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleStatus(seq)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-gray-50">
                      {seq.status === 'ACTIVE' ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Resume</>}
                    </button>
                    <button onClick={() => setShowSteps(showSteps === seq.id ? null : seq.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
                      style={{ backgroundColor: primary }}>
                      <ChevronDown className={`h-3 w-3 transition-transform ${showSteps === seq.id ? 'rotate-180' : ''}`} />
                      Steps
                    </button>
                  </div>
                </div>
              </div>

              {showSteps === seq.id && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  {/* Existing steps */}
                  {seq.steps.length > 0 && (
                    <div className="space-y-2">
                      {seq.steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <span className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: primary }}>{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{step.subject}</p>
                            <p className="text-xs text-gray-400">Send {step.delayDays === 0 ? 'immediately' : `after ${step.delayDays} day${step.delayDays !== 1 ? 's' : ''}`}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-300" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add step form */}
                  <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Step</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <input value={stepForm.subject} onChange={e => setStepForm(p => ({ ...p, subject: e.target.value }))}
                          placeholder="Email subject"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                      </div>
                      <div>
                        <input type="number" value={stepForm.delayDays} onChange={e => setStepForm(p => ({ ...p, delayDays: parseInt(e.target.value) || 0 }))}
                          placeholder="Delay (days)"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                      </div>
                    </div>
                    <textarea value={stepForm.html} onChange={e => setStepForm(p => ({ ...p, html: e.target.value }))}
                      rows={3} placeholder="Email body (HTML or text, use {{guestName}})"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 font-mono resize-none" />
                    <button onClick={() => addStep(seq.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90"
                      style={{ backgroundColor: primary }}>
                      <Plus className="h-3.5 w-3.5" /> Add Step
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TEMPLATES TAB
══════════════════════════════════════════════════════════════════════════════ */
function TemplatesTab({ token, primary }: { token: string; primary: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', html: '', preheader: '' });
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/crm/templates', { headers: { Authorization: `Bearer ${token}` } });
      setTemplates(res.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetch(); }, [fetch]);

  const createTemplate = async () => {
    if (!form.name || !form.subject || !form.html) return;
    setSaving(true);
    try {
      await api.post('/crm/templates', form, { headers: { Authorization: `Bearer ${token}` } });
      setShowNew(false); setForm({ name: '', subject: '', html: '', preheader: '' });
      fetch();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await api.delete(`/crm/templates/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90"
          style={{ backgroundColor: primary }}>
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">New Email Template</h3>
            <button onClick={() => setShowNew(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Template Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Welcome Email"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Subject Line</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Welcome to {{tenantName}}!"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Preheader (preview text)</label>
            <input value={form.preheader} onChange={e => setForm(p => ({ ...p, preheader: e.target.value }))}
              placeholder="Short text shown in email clients after subject…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              HTML Body — variables: {'{{guestName}}'}, {'{{tenantName}}'}
            </label>
            <textarea value={form.html} onChange={e => setForm(p => ({ ...p, html: e.target.value }))}
              rows={8} placeholder="<h2>Hi {{guestName}},</h2>"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={createTemplate} disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: primary }}>
              {saving ? 'Saving…' : 'Save Template'}
            </button>
            <button onClick={() => setShowNew(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-gray-400">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>No templates yet</p>
          </div>
        ) : (
          templates.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${primary}10` }}>
                  <Mail className="h-5 w-5" style={{ color: primary }} />
                </div>
                <button onClick={() => deleteTemplate(t.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
              <p className="text-sm text-gray-500 mb-3 flex-1 line-clamp-2">{t.subject}</p>
              <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ANALYTICS TAB
══════════════════════════════════════════════════════════════════════════════ */
function AnalyticsTab({ token, primary, accent }: { token: string; primary: string; accent: string }) {
  const [data, setData]           = useState<Analytics | null>(null);
  const [loading, setLoading]     = useState(true);
  const [automating, setAutomating] = useState(false);
  const [autoResult, setAutoResult] = useState<{ birthday: { found: number; sent: number }; anniversary: { found: number; sent: number } } | null>(null);

  useEffect(() => {
    api.get('/crm/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { setData(res.data.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const runAutomation = async () => {
    setAutomating(true);
    setAutoResult(null);
    try {
      const res = await api.post('/crm/automation/run-daily', {}, { headers: { Authorization: `Bearer ${token}` } });
      setAutoResult(res.data.data);
    } catch {
      alert('Failed to run automation. Check server logs.');
    }
    setAutomating(false);
  };

  if (loading) return <div className="py-16 text-center text-gray-400">Loading analytics…</div>;
  if (!data)   return <div className="py-16 text-center text-gray-400">Failed to load analytics</div>;

  const openRate  = data.campaignStats.reduce((s, c) => s + c.opened, 0);
  const clickRate = data.campaignStats.reduce((s, c) => s + c.clicked, 0);
  const totalSent = data.campaignStats.reduce((s, c) => s + c.sent, 0);

  return (
    <div className="space-y-6">
      {/* Automation runner */}
      <div className="rounded-2xl border border-dashed border-resort-300 bg-resort-50/50 p-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <span>🤖</span> Daily Automation
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Sends birthday greetings (🎂) and resort anniversary emails (🏖️) to qualifying guests.
            Run daily via cron, or manually here for testing.
          </p>
          {autoResult && (
            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-purple-700 font-medium">🎂 Birthday: {autoResult.birthday.sent}/{autoResult.birthday.found} sent</span>
              <span className="text-resort-700 font-medium">🏖️ Anniversary: {autoResult.anniversary.sent}/{autoResult.anniversary.found} sent</span>
            </div>
          )}
        </div>
        <button
          onClick={runAutomation}
          disabled={automating}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: primary }}>
          {automating ? 'Running…' : '▶ Run Now'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts', val: data.totalContacts, icon: Users, color: primary },
          { label: 'Subscribed',     val: data.subscribed,    icon: CheckCircle, color: '#22c55e' },
          { label: 'Emails Opened',  val: totalSent > 0 ? `${Math.round(openRate / totalSent * 100)}%` : '—', icon: Mail, color: accent },
          { label: 'Click Rate',     val: totalSent > 0 ? `${Math.round(clickRate / totalSent * 100)}%` : '—', icon: TrendingUp, color: '#8b5cf6' },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                <Icon className="h-4.5 w-4.5" style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{val}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tier breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Guest Tier Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(TIER_CONFIG).map(([tier, cfg]) => {
              const count = data.tierCounts.find(t => t.tier === tier)?._count.tier ?? 0;
              const pct   = data.totalContacts > 0 ? Math.round(count / data.totalContacts * 100) : 0;
              const TierIcon = cfg.Icon;
              return (
                <div key={tier} className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 w-28 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    <TierIcon className="h-3 w-3" /> {cfg.label}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top guests */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top Guests by Score</h3>
          <div className="space-y-3">
            {data.topGuests.length === 0 ? (
              <p className="text-sm text-gray-400">No scored guests yet. Run "Recalc Score" on contacts.</p>
            ) : (
              data.topGuests.map((g, i) => {
                const tier = TIER_CONFIG[g.tier ?? 'STANDARD'];
                const TierIcon = tier.Icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: primary }}>
                      {g.guest.firstName[0]}{g.guest.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{g.guest.firstName} {g.guest.lastName}</p>
                      <p className="text-xs text-gray-400 truncate">{g.guest.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: primary }}>{g.score}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: tier.bg, color: tier.color }}>
                        <TierIcon className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent campaigns */}
      {data.campaignStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Campaign Performance</h3>
          <div className="space-y-3">
            {data.campaignStats.map((cs, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{cs.campaign.name}</p>
                  {cs.campaign.sentAt && <p className="text-xs text-gray-400">{new Date(cs.campaign.sentAt).toLocaleDateString()}</p>}
                </div>
                {[
                  { label: 'Sent',    val: cs.sent,    color: '#6b7280' },
                  { label: 'Opened',  val: cs.opened,  color: primary },
                  { label: 'Clicked', val: cs.clicked, color: accent },
                ].map(s => (
                  <div key={s.label} className="text-center w-16">
                    <p className="text-base font-bold" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
