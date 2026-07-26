'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Mail, Megaphone, GitBranch, BarChart3,
  Plus, Search, Send, Trash2, Play, Pause,
  X, ChevronDown, CheckCircle, Crown, Medal, Award,
  TrendingUp, ArrowRight, RefreshCw, Loader2,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
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
  totalContacts: number; subscribed: number;
  tierCounts: { tier: string; _count: { tier: number } }[];
  campaignStats: { campaign: { name: string; sentAt?: string }; sent: number; opened: number; clicked: number }[];
  topGuests: { score: number; tier: string; guest: { firstName: string; lastName: string; email: string } }[];
}

/* ── Config ───────────────────────────────────────────────────────────────── */
const TIER_CONFIG: Record<string, { label: string; text: string; bg: string; border: string; barColor: string; Icon: React.ElementType }> = {
  STANDARD: { label: 'Standard', text: 'var(--rp-text-muted)', bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      barColor: 'var(--rp-text-faint)', Icon: Users  },
  SILVER:   { label: 'Silver',   text: 'var(--rp-text-muted)', bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      barColor: '#9bbdb7', Icon: Award  },
  GOLD:     { label: 'Gold',     text: '#b89040', bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  barColor: '#d4a853', Icon: Medal  },
  PLATINUM: { label: 'Platinum', text: '#dfd9d0', bg: '#1b342f', border: 'rgba(27,52,47,0.5)',    barColor: '#23766a', Icon: Crown  },
};

const STATUS_META: Record<string, { bg: string; border: string; text: string }> = {
  DRAFT:     { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
  SCHEDULED: { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  SENDING:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  SENT:      { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  PAUSED:    { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  CANCELLED: { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  ACTIVE:    { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  ARCHIVED:  { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-faint)' },
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

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.DRAFT;
  return (
    <span className="rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
      style={{ background: m.bg, borderColor: m.border, color: m.text }}>{status}</span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function CRMPage() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<'contacts' | 'campaigns' | 'sequences' | 'templates' | 'analytics'>('contacts');

  const tabs = [
    { id: 'contacts',  label: 'Contacts',  Icon: Users     },
    { id: 'campaigns', label: 'Campaigns', Icon: Megaphone },
    { id: 'sequences', label: 'Sequences', Icon: GitBranch },
    { id: 'templates', label: 'Templates', Icon: Mail      },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  ] as const;

  return (
    <PageShell gap={6}>
      <PageHeader
        title="CRM & Email Marketing"
        subtitle="Manage guest relationships, campaigns and automated sequences"
      />

      {/* Tabs */}
      <div className="flex gap-0 border-b" style={{ borderColor: 'var(--rp-border)' }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px"
            style={tab === id
              ? { borderColor: '#23766a', color: '#23766a' }
              : { borderColor: 'transparent', color: 'var(--rp-text-muted)' }}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'contacts'  && <ContactsTab  token={token!} />}
      {tab === 'campaigns' && <CampaignsTab token={token!} />}
      {tab === 'sequences' && <SequencesTab token={token!} />}
      {tab === 'templates' && <TemplatesTab token={token!} />}
      {tab === 'analytics' && <AnalyticsTab token={token!} />}
    </PageShell>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONTACTS TAB
══════════════════════════════════════════════════════════════════════════════ */
function ContactsTab({ token }: { token: string }) {
  const [guests, setGuests]   = useState<GuestContact[]>([]);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState('');
  const [tierFilter, setTier] = useState('');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  const recalcScore = async (id: string) => {
    await api.post(`/crm/contacts/${id}/recalc-score`, {}, { headers: { Authorization: `Bearer ${token}` } });
    fetchGuests();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9bbdb7' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…" className={inputCls + ' pl-9'} />
        </div>
        <select value={tierFilter} onChange={e => setTier(e.target.value)} className={inputCls + ' max-w-[160px] cursor-pointer'}>
          <option value="">All Tiers</option>
          {Object.entries(TIER_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetchGuests}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Search className="h-4 w-4" /> Search
        </button>
      </div>

      <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
        <span className="font-semibold text-[#18231f] dark:text-[#dfd9d0]">{total}</span> total contacts
      </p>

      <div className="rounded-[14px] border bg-white overflow-hidden"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div className="py-16 text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Loading contacts…</div>
        ) : guests.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No contacts found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {['Guest', 'Tier', 'Score', 'Stays', 'Tags', 'Email', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guests.map(g => {
                  const tier = TIER_CONFIG[g.score?.tier ?? 'STANDARD'];
                  const TierIcon = tier.Icon;
                  const subscribed = g.consent?.subscribed !== false;
                  return (
                    <tr key={g.id} className="transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                            style={{ background: 'var(--rp-teal-bg)', color: '#23766a' }}>
                            {g.firstName[0]}{g.lastName[0]}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{g.firstName} {g.lastName}</p>
                            <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{g.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
                          style={{ background: tier.bg, borderColor: tier.border, color: tier.text }}>
                          <TierIcon className="h-3 w-3" /> {tier.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: '#e8e5e0' }}>
                            <div className="h-full rounded-full" style={{ width: `${g.score?.score ?? 0}%`, background: '#23766a' }} />
                          </div>
                          <span className="text-[12px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{g.score?.score ?? 0}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[#4a6e66] dark:text-[#6d9990]">{g._count.bookings}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {g.tags.slice(0, 3).map(tr => (
                            <span key={tr.tag.id} className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                              style={{ backgroundColor: tr.tag.color }}>
                              {tr.tag.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {subscribed
                          ? <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: '#23766a' }}><CheckCircle className="h-3 w-3" /> Subscribed</span>
                          : <span className="inline-flex items-center gap-1 text-[12px] text-[#c5bdb4] dark:text-[#6e8580]"><X className="h-3 w-3" /> Unsubscribed</span>}
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => recalcScore(g.id)} title="Recalculate score"
                          className="transition-colors hover:opacity-70 text-[#c5bdb4] dark:text-[#6e8580]">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CAMPAIGNS TAB
══════════════════════════════════════════════════════════════════════════════ */
function CampaignsTab({ token }: { token: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [sending, setSending]     = useState<string | null>(null);
  const [form, setForm]   = useState({ name: '', subject: '', html: '' });
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
      setShowNew(false); setForm({ name: '', subject: '', html: '' }); fetch();
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
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {showNew && (
        <div className="rounded-[14px] border bg-white p-6 space-y-4"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">New Campaign</h3>
            <button onClick={() => setShowNew(false)}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full hover:bg-[#f4f1eb] text-[#8aa29a] dark:text-[#94b8b0]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Campaign Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Summer Promo 2026" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email Subject</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Special offer just for you 🌴" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email Body (HTML or plain text — use {'{{guestName}}'} for personalisation)</label>
            <textarea value={form.html} onChange={e => setForm(p => ({ ...p, html: e.target.value }))}
              rows={6} placeholder="<h2>Hi {{guestName}},</h2><p>We have a special offer...</p>"
              className={inputCls + ' font-mono resize-none'} />
          </div>
          {error && <p className="text-[12px]" style={{ color: '#c43c3c' }}>{error}</p>}
          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={createCampaign} disabled={saving}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-60 hover:opacity-90"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Plus className="h-4 w-4" /> Save as Draft</>}
            </button>
            <button onClick={() => setShowNew(false)}
              className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center rounded-[14px] border bg-white"
            style={{ borderColor: 'var(--rp-border)' }}>
            <Megaphone className="h-10 w-10 mx-auto mb-3 text-[#c5bdb4] dark:text-[#6e8580]" />
            <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No campaigns yet. Create your first one!</p>
          </div>
        ) : (
          campaigns.map(c => (
            <div key={c.id} className="rounded-[14px] border bg-white p-5"
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[13.5px] font-semibold truncate text-[#18231f] dark:text-[#dfd9d0]">{c.name}</h3>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">Subject: {c.subject}</p>
                  {c.sentAt && <p className="text-[12px] mt-1 text-[#c5bdb4] dark:text-[#6e8580]">Sent {new Date(c.sentAt).toLocaleDateString()}</p>}
                </div>
                {c.stats && (
                  <div className="flex gap-5 text-center shrink-0">
                    {[
                      { label: 'Sent',    val: c.stats.sent },
                      { label: 'Opened',  val: c.stats.opened,  rate: c.stats.sent ? Math.round(c.stats.opened / c.stats.sent * 100) : 0 },
                      { label: 'Clicked', val: c.stats.clicked, rate: c.stats.sent ? Math.round(c.stats.clicked / c.stats.sent * 100) : 0 },
                    ].map(s => (
                      <div key={s.label}>
                        <p className="text-[17px] font-bold text-[#18231f] dark:text-[#dfd9d0]">{s.val}</p>
                        <p className="text-[11px] text-[#8aa29a] dark:text-[#94b8b0]">{s.label}</p>
                        {'rate' in s && s.rate > 0 && <p className="text-[11px] font-medium" style={{ color: '#23766a' }}>{s.rate}%</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                    <button onClick={() => sendCampaign(c.id)} disabled={sending === c.id}
                      className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium hover:opacity-90 disabled:opacity-60"
                      style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                      {sending === c.id ? 'Sending…' : <><Send className="h-3 w-3" /> Send Now</>}
                    </button>
                  )}
                  {['DRAFT', 'SCHEDULED'].includes(c.status) && (
                    <button onClick={() => deleteCampaign(c.id)}
                      className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#fef2f2] text-[#c5bdb4] dark:text-[#6e8580]">
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
function SequencesTab({ token }: { token: string }) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [showSteps, setShowSteps] = useState<string | null>(null);
  const [form, setForm]     = useState({ name: '', trigger: 'BOOKING_CONFIRMED' });
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
      setShowNew(false); setForm({ name: '', trigger: 'BOOKING_CONFIRMED' }); fetch();
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
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> New Sequence
        </button>
      </div>

      {showNew && (
        <div className="rounded-[14px] border bg-white p-5 space-y-4"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">New Automation Sequence</h3>
            <button onClick={() => setShowNew(false)}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full hover:bg-[#f4f1eb] text-[#8aa29a] dark:text-[#94b8b0]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sequence Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Welcome Series" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trigger</label>
              <select value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))}
                className={inputCls + ' cursor-pointer'}>
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={createSequence} disabled={saving}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-60 hover:opacity-90"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</> : 'Create Sequence'}
            </button>
            <button onClick={() => setShowNew(false)}
              className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Loading sequences…</div>
        ) : sequences.length === 0 ? (
          <div className="py-16 text-center rounded-[14px] border bg-white" style={{ borderColor: 'var(--rp-border)' }}>
            <GitBranch className="h-10 w-10 mx-auto mb-3 text-[#c5bdb4] dark:text-[#6e8580]" />
            <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No sequences yet. Automate your guest communication!</p>
          </div>
        ) : (
          sequences.map(seq => (
            <div key={seq.id} className="rounded-[14px] border bg-white overflow-hidden"
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px]"
                    style={{ background: 'var(--rp-teal-bg)' }}>
                    <GitBranch className="h-5 w-5" style={{ color: '#23766a' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">{seq.name}</h3>
                      <StatusPill status={seq.status} />
                    </div>
                    <p className="text-[12.5px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">{TRIGGER_LABELS[seq.trigger]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <p className="text-[16px] font-bold text-[#18231f] dark:text-[#dfd9d0]">{seq.steps.length}</p>
                    <p className="text-[11px] text-[#8aa29a] dark:text-[#94b8b0]">steps</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[16px] font-bold text-[#18231f] dark:text-[#dfd9d0]">{seq._count.enrollments}</p>
                    <p className="text-[11px] text-[#8aa29a] dark:text-[#94b8b0]">enrolled</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleStatus(seq)}
                      className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#f4f1eb]"
                      style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                      {seq.status === 'ACTIVE' ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Resume</>}
                    </button>
                    <button onClick={() => setShowSteps(showSteps === seq.id ? null : seq.id)}
                      className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium hover:opacity-90"
                      style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                      <ChevronDown className={`h-3 w-3 transition-transform ${showSteps === seq.id ? 'rotate-180' : ''}`} />
                      Steps
                    </button>
                  </div>
                </div>
              </div>

              {showSteps === seq.id && (
                <div className="p-5 space-y-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: 'var(--rp-surface-2)' }}>
                  {seq.steps.length > 0 && (
                    <div className="space-y-2">
                      {seq.steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-3 rounded-[10px] p-3 bg-white dark:bg-white/5" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold"
                            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{step.subject}</p>
                            <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                              Send {step.delayDays === 0 ? 'immediately' : `after ${step.delayDays} day${step.delayDays !== 1 ? 's' : ''}`}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-[#c5bdb4] dark:text-[#6e8580]" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-[10px] border-2 border-dashed p-4 space-y-3"
                    style={{ borderColor: 'rgba(35,118,106,0.25)' }}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">Add Step</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <input value={stepForm.subject} onChange={e => setStepForm(p => ({ ...p, subject: e.target.value }))}
                          placeholder="Email subject" className={inputCls} />
                      </div>
                      <input type="number" value={stepForm.delayDays}
                        onChange={e => setStepForm(p => ({ ...p, delayDays: parseInt(e.target.value) || 0 }))}
                        placeholder="Delay (days)" className={inputCls} />
                    </div>
                    <textarea value={stepForm.html} onChange={e => setStepForm(p => ({ ...p, html: e.target.value }))}
                      rows={3} placeholder="Email body (HTML or text, use {{guestName}})"
                      className={inputCls + ' font-mono resize-none'} />
                    <button onClick={() => addStep(seq.id)}
                      className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[12.5px] font-medium hover:opacity-90"
                      style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
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
function TemplatesTab({ token }: { token: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [form, setForm]   = useState({ name: '', subject: '', html: '', preheader: '' });
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
      setShowNew(false); setForm({ name: '', subject: '', html: '', preheader: '' }); fetch();
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
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {showNew && (
        <div className="rounded-[14px] border bg-white p-6 space-y-4"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">New Email Template</h3>
            <button onClick={() => setShowNew(false)}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full hover:bg-[#f4f1eb] text-[#8aa29a] dark:text-[#94b8b0]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Template Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Welcome Email" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Subject Line</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Welcome to {{tenantName}}!" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Preheader (preview text)</label>
            <input value={form.preheader} onChange={e => setForm(p => ({ ...p, preheader: e.target.value }))}
              placeholder="Short text shown in email clients after subject…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>HTML Body — variables: {'{{guestName}}'}, {'{{tenantName}}'}</label>
            <textarea value={form.html} onChange={e => setForm(p => ({ ...p, html: e.target.value }))}
              rows={8} placeholder="<h2>Hi {{guestName}},</h2>"
              className={inputCls + ' font-mono resize-none'} />
          </div>
          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button onClick={createTemplate} disabled={saving}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-60 hover:opacity-90"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : 'Save Template'}
            </button>
            <button onClick={() => setShowNew(false)}
              className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="col-span-3 py-16 text-center rounded-[14px] border bg-white" style={{ borderColor: 'var(--rp-border)' }}>
            <Mail className="h-10 w-10 mx-auto mb-3 text-[#c5bdb4] dark:text-[#6e8580]" />
            <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No templates yet</p>
          </div>
        ) : (
          templates.map(t => (
            <div key={t.id} className="rounded-[14px] border bg-white p-5 flex flex-col"
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: 'var(--rp-teal-bg)' }}>
                  <Mail className="h-5 w-5" style={{ color: '#23766a' }} />
                </div>
                <button onClick={() => deleteTemplate(t.id)}
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#fef2f2] text-[#c5bdb4] dark:text-[#6e8580]">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <h3 className="text-[13.5px] font-semibold mb-1 text-[#18231f] dark:text-[#dfd9d0]">{t.name}</h3>
              <p className="text-[12.5px] mb-3 flex-1 line-clamp-2 text-[#8aa29a] dark:text-[#94b8b0]">{t.subject}</p>
              <p className="text-[11.5px] text-[#c5bdb4] dark:text-[#6e8580]">{new Date(t.createdAt).toLocaleDateString()}</p>
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
function AnalyticsTab({ token }: { token: string }) {
  const [data, setData]             = useState<Analytics | null>(null);
  const [loading, setLoading]       = useState(true);
  const [automating, setAutomating] = useState(false);
  const [autoResult, setAutoResult] = useState<{ birthday: { found: number; sent: number }; anniversary: { found: number; sent: number } } | null>(null);

  useEffect(() => {
    api.get('/crm/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { setData(res.data.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const runAutomation = async () => {
    setAutomating(true); setAutoResult(null);
    try {
      const res = await api.post('/crm/automation/run-daily', {}, { headers: { Authorization: `Bearer ${token}` } });
      setAutoResult(res.data.data);
    } catch { alert('Failed to run automation. Check server logs.'); }
    setAutomating(false);
  };

  if (loading) return <div className="py-16 text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Loading analytics…</div>;
  if (!data)   return <div className="py-16 text-center text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Failed to load analytics</div>;

  const totalSent = data.campaignStats.reduce((s, c) => s + c.sent, 0);
  const openRate  = data.campaignStats.reduce((s, c) => s + c.opened, 0);
  const clickRate = data.campaignStats.reduce((s, c) => s + c.clicked, 0);

  return (
    <div className="space-y-6">
      {/* Automation runner */}
      <div className="flex items-start justify-between gap-4 rounded-[14px] border p-5"
        style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
        <div>
          <p className="text-[13.5px] font-semibold flex items-center gap-2" style={{ color: '#1b342f' }}>
            🤖 Daily Automation
          </p>
          <p className="text-[12.5px] mt-0.5 text-[#4a6e66] dark:text-[#6d9990]">
            Sends birthday greetings (🎂) and resort anniversary emails (🏖️) to qualifying guests.
            Run daily via cron, or manually here for testing.
          </p>
          {autoResult && (
            <div className="mt-3 flex gap-4 text-[12.5px]">
              <span className="font-medium" style={{ color: '#1b342f' }}>🎂 Birthday: {autoResult.birthday.sent}/{autoResult.birthday.found} sent</span>
              <span className="font-medium" style={{ color: '#23766a' }}>🏖️ Anniversary: {autoResult.anniversary.sent}/{autoResult.anniversary.found} sent</span>
            </div>
          )}
        </div>
        <button onClick={runAutomation} disabled={automating}
          className="flex shrink-0 items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-semibold hover:opacity-90 disabled:opacity-60"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          {automating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : '▶ Run Now'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts', val: data.totalContacts, Icon: Users,       iconBg: 'var(--rp-teal-bg)', iconColor: '#23766a' },
          { label: 'Subscribed',     val: data.subscribed,    Icon: CheckCircle, iconBg: 'var(--rp-teal-bg)', iconColor: '#23766a' },
          { label: 'Open Rate',      val: totalSent > 0 ? `${Math.round(openRate / totalSent * 100)}%` : '—', Icon: Mail, iconBg: 'var(--rp-amber-bg)', iconColor: '#b89040' },
          { label: 'Click Rate',     val: totalSent > 0 ? `${Math.round(clickRate / totalSent * 100)}%` : '—', Icon: TrendingUp, iconBg: 'var(--rp-surface-3)', iconColor: 'var(--rp-text-subtle)' },
        ].map(({ label, val, Icon, iconBg, iconColor }) => (
          <div key={label} className="rounded-[14px] border bg-white p-5"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
              <div className="flex h-[32px] w-[32px] items-center justify-center rounded-[9px]"
                style={{ background: iconBg }}>
                <Icon className="h-4 w-4" style={{ color: iconColor }} />
              </div>
            </div>
            <p className="text-[24px] font-bold text-[#18231f] dark:text-[#dfd9d0]">{val}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tier breakdown */}
        <div className="rounded-[14px] border bg-white p-5"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <h3 className="text-[14px] font-semibold mb-4 text-[#18231f] dark:text-[#dfd9d0]">Guest Tier Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(TIER_CONFIG).map(([tier, cfg]) => {
              const count = data.tierCounts.find(t => t.tier === tier)?._count.tier ?? 0;
              const pct   = data.totalContacts > 0 ? Math.round(count / data.totalContacts * 100) : 0;
              return (
                <div key={tier} className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 w-28 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold shrink-0"
                    style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
                    <cfg.Icon className="h-3 w-3" /> {cfg.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e8e5e0' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.barColor }} />
                  </div>
                  <span className="text-[13px] font-semibold w-8 text-right text-[#18231f] dark:text-[#dfd9d0]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top guests */}
        <div className="rounded-[14px] border bg-white p-5"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <h3 className="text-[14px] font-semibold mb-4 text-[#18231f] dark:text-[#dfd9d0]">Top Guests by Score</h3>
          <div className="space-y-3">
            {data.topGuests.length === 0 ? (
              <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">No scored guests yet. Run "Recalc Score" on contacts.</p>
            ) : (
              data.topGuests.map((g, i) => {
                const tier = TIER_CONFIG[g.tier ?? 'STANDARD'];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[12px] font-bold w-4 shrink-0 text-[#c5bdb4] dark:text-[#6e8580]">{i + 1}</span>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{ background: 'var(--rp-teal-bg)', color: '#23766a' }}>
                      {g.guest.firstName[0]}{g.guest.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{g.guest.firstName} {g.guest.lastName}</p>
                      <p className="text-[11.5px] truncate text-[#8aa29a] dark:text-[#94b8b0]">{g.guest.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold" style={{ color: '#23766a' }}>{g.score}</span>
                      <span className="inline-flex items-center gap-1 rounded-[6px] border px-[7px] py-[2px] text-[10.5px] font-semibold"
                        style={{ background: tier.bg, borderColor: tier.border, color: tier.text }}>
                        <tier.Icon className="h-3 w-3" />
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
        <div className="rounded-[14px] border bg-white p-5"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <h3 className="text-[14px] font-semibold mb-4 text-[#18231f] dark:text-[#dfd9d0]">Recent Campaign Performance</h3>
          <div className="space-y-3">
            {data.campaignStats.map((cs, i) => (
              <div key={i} className="flex items-center gap-4 py-2.5"
                style={{ borderBottom: i < data.campaignStats.length - 1 ? '1px solid rgba(0,0,0,0.05)' : undefined }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{cs.campaign.name}</p>
                  {cs.campaign.sentAt && <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{new Date(cs.campaign.sentAt).toLocaleDateString()}</p>}
                </div>
                {[
                  { label: 'Sent',    val: cs.sent,    color: 'var(--rp-text-muted)' },
                  { label: 'Opened',  val: cs.opened,  color: '#23766a' },
                  { label: 'Clicked', val: cs.clicked, color: '#b89040' },
                ].map(s => (
                  <div key={s.label} className="text-center w-16">
                    <p className="text-[15px] font-bold" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-[11px] text-[#c5bdb4] dark:text-[#6e8580]">{s.label}</p>
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
