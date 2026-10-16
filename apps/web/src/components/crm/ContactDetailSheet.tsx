'use client';

/**
 * What the CRM knows about one guest, and the only place a tag can be put on
 * them.
 *
 * `GET /crm/contacts/:id` returns the score, the consent row, the tags, the
 * last ten stays, the last twenty emails and the sequence enrolments — and no
 * screen called it (CRM QA 2026-10-07, finding 016). `POST
 * /crm/contacts/:id/tags` was unreachable too, which is why the QA recorded
 * tags as "Fail at assignment".
 *
 * Not `GuestDetailSheet`: that one answers the front-desk question — documents,
 * edit, delete — on react-query, and shows none of the score, tier, consent or
 * tag state this is about. Reusing it would have meant a sheet that cannot
 * show the thing it was opened for.
 *
 * Deliberately **not** shown: whether an email was opened. The payload carries
 * `openedAt` and nothing in the API ever writes it, so printing it would put
 * back the same invented number that d56458a took out of the Analytics tab.
 */

import { useCallback, useEffect, useState } from 'react';
import { X, Plus, Loader2, AlertTriangle, RefreshCw, CheckCircle, BellOff } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { api } from '@/lib/api';
import { TAG_COLOURS } from '@/lib/tag-colours';

interface TagRow { id: string; name: string; color: string }

interface ContactDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  nationality?: string | null;
  score?: { score: number; tier: string; totalStays: number; totalSpend: number } | null;
  consent?: { subscribed: boolean; unsubscribedAt?: string | null } | null;
  tags: { tag: TagRow }[];
  bookings: {
    id: string; checkIn: string; checkOut: string; status: string;
    totalAmount: number; room?: { name: string } | null;
  }[];
  emailSends: { id: string; subject: string; status: string; createdAt: string }[];
  enrollments: { id: string; status: string; sequence: { name: string; trigger: string } }[];
}

const TIER_LABEL: Record<string, string> = {
  PLATINUM: 'Platinum', GOLD: 'Gold', SILVER: 'Silver', STANDARD: 'Standard',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-rp-label font-semibold uppercase tracking-[0.08em] text-rp-muted">
        {title}{count !== undefined && ` — ${count}`}
      </h4>
      {children}
    </section>
  );
}

export function ContactDetailSheet({
  contactId, token, onClose, onChanged,
}: {
  contactId: string | null;
  token: string;
  onClose: () => void;
  /** The list behind this sheet shows tags, so it has to be told they moved. */
  onChanged?: () => void;
}) {
  const [data, setData] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [picking, setPicking] = useState(false);
  const [busyTag, setBusyTag] = useState<string | null>(null);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await api.get(`/crm/contacts/${contactId}`, auth);
      setData(res.data.data);
    } catch {
      setFailed(true);
      setData(null);
    }
    setLoading(false);
    // auth is derived from token; listing it would rebuild this every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, token]);

  useEffect(() => { load(); }, [load]);

  // Only fetched when the picker opens: most visits to this sheet are to read
  // it, and the tag list is only needed to add one.
  const loadTags = useCallback(async () => {
    try {
      const res = await api.get('/crm/tags', auth);
      setAllTags(res.data.data);
    } catch {
      setAllTags([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const setTag = async (tagId: string, action: 'add' | 'remove') => {
    if (!contactId) return;
    setBusyTag(tagId);
    try {
      await api.post(`/crm/contacts/${contactId}/tags`, { tagId, action }, auth);
      await load();
      onChanged?.();
    } catch (err: any) {
      alert(err?.response?.data?.error || `Could not ${action} that tag.`);
    }
    setBusyTag(null);
  };

  const applied = new Set((data?.tags ?? []).map(t => t.tag.id));
  const available = allTags.filter(t => !applied.has(t.id));

  const name = data ? `${data.firstName} ${data.lastName}` : 'Contact';

  return (
    <ModalShell
      open={!!contactId}
      onClose={onClose}
      title={name}
      description={data?.email}
      maxWidth="720px"
    >
      {loading && !data ? (
        <p className="py-12 text-center text-rp-body text-rp-muted">Loading contact…</p>
      ) : failed ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-rp-danger" />
          <p className="text-rp-body font-semibold text-rp-text">Could not load this contact</p>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-rp-btn bg-rp-btn-accent px-4 py-2 text-rp-body font-medium text-rp-btn-accent-text hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* ── Score and consent ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Tier', value: TIER_LABEL[data.score?.tier ?? 'STANDARD'] ?? 'Standard' },
              { label: 'Score', value: data.score ? String(data.score.score) : '—' },
              { label: 'Stays', value: data.score ? String(data.score.totalStays) : String(data.bookings.length) },
              { label: 'Spend', value: data.score ? data.score.totalSpend.toLocaleString() : '—' },
            ].map(s => (
              <div key={s.label} className="rounded-rp-panel border border-rp-border bg-rp-surface-2 px-3 py-2">
                <p className="text-rp-micro uppercase tracking-[0.08em] text-rp-muted">{s.label}</p>
                <p className="text-rp-body font-semibold text-rp-text">{s.value}</p>
              </div>
            ))}
          </div>

          {/* A guest with no consent row counts as subscribed — the same rule
              the campaign audience uses. Saying "not recorded" instead would
              be a different claim from the one the sender acts on. */}
          <div className="flex items-center gap-2 text-rp-meta">
            {data.consent?.subscribed === false ? (
              <>
                <BellOff className="h-4 w-4 text-rp-danger" />
                <span className="text-rp-text">
                  Unsubscribed
                  {data.consent.unsubscribedAt && ` on ${fmtDate(data.consent.unsubscribedAt)}`}
                  {' '}— campaigns and automated email skip this guest.
                </span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-rp-brand" />
                <span className="text-rp-muted">Subscribed — included in campaign audiences.</span>
              </>
            )}
          </div>

          {/* ── Tags ────────────────────────────────────────────────────── */}
          <Section title="Tags" count={data.tags.length}>
            <div className="flex flex-wrap items-center gap-2">
              {data.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded-rp-xs border border-rp-border-md px-2 py-[3px] text-rp-micro font-semibold text-rp-text"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: tag.color }} />
                  {tag.name}
                  <button
                    onClick={() => setTag(tag.id, 'remove')}
                    disabled={busyTag === tag.id}
                    aria-label={`Remove tag ${tag.name}`}
                    className="ml-0.5 text-rp-faint hover:text-rp-danger disabled:opacity-50"
                  >
                    {busyTag === tag.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </button>
                </span>
              ))}

              {!picking ? (
                <button
                  onClick={() => { setPicking(true); loadTags(); }}
                  className="inline-flex items-center gap-1 rounded-rp-xs border border-dashed border-rp-border-md px-2 py-[3px] text-rp-micro font-semibold text-rp-muted hover:text-rp-text"
                >
                  <Plus className="h-3 w-3" /> Add tag
                </button>
              ) : available.length === 0 ? (
                <span className="text-rp-micro text-rp-muted">
                  {allTags.length === 0
                    ? 'No tags exist yet — create one on the Tags tab.'
                    : 'This guest already has every tag.'}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {available.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTag(t.id, 'add')}
                      disabled={busyTag === t.id}
                      className="inline-flex items-center gap-1.5 rounded-rp-xs border border-rp-border-md px-2 py-[3px] text-rp-micro font-semibold text-rp-muted hover:text-rp-text disabled:opacity-50"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: t.color ?? TAG_COLOURS[0] }} />
                      {t.name}
                      {busyTag === t.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── Stays ───────────────────────────────────────────────────── */}
          <Section title="Recent stays" count={data.bookings.length}>
            {data.bookings.length === 0 ? (
              <p className="text-rp-meta text-rp-muted">No bookings recorded.</p>
            ) : (
              <ul className="divide-y divide-rp-border">
                {data.bookings.map(b => (
                  <li key={b.id} className="flex items-center justify-between py-2 text-rp-meta">
                    <span className="text-rp-text">
                      {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                      {b.room?.name && <span className="text-rp-muted"> · {b.room.name}</span>}
                    </span>
                    <span className="text-rp-muted">{b.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ── Email ───────────────────────────────────────────────────── */}
          {/* Subject, outcome and date. No open or click column: the payload
              has openedAt and nothing writes it (see d56458a). */}
          <Section title="Email sent" count={data.emailSends.length}>
            {data.emailSends.length === 0 ? (
              <p className="text-rp-meta text-rp-muted">Nothing has been sent to this guest.</p>
            ) : (
              <ul className="divide-y divide-rp-border">
                {data.emailSends.map(e => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-rp-meta">
                    <span className="min-w-0 flex-1 truncate text-rp-text">{e.subject}</span>
                    <span className={e.status === 'FAILED' ? 'text-rp-danger' : 'text-rp-muted'}>{e.status}</span>
                    <span className="text-rp-faint">{fmtDate(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ── Sequences ───────────────────────────────────────────────── */}
          <Section title="Sequences" count={data.enrollments.length}>
            {data.enrollments.length === 0 ? (
              <p className="text-rp-meta text-rp-muted">Not enrolled in any sequence.</p>
            ) : (
              <ul className="divide-y divide-rp-border">
                {data.enrollments.map(en => (
                  <li key={en.id} className="flex items-center justify-between py-2 text-rp-meta">
                    <span className="text-rp-text">{en.sequence.name}</span>
                    <span className="text-rp-muted">{en.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </ModalShell>
  );
}
