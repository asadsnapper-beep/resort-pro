'use client';

/**
 * "Need a custom design?" — the entry point for the paid design service.
 *
 * See plan/theme-studio-and-design-service.md (Part B). Prices are shown as
 * "starting from"; the real quote comes from admin after they read the brief.
 *
 * Written with design-system tokens only (no raw hex / px), so it doesn't add
 * to the ratchet baseline.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ModalShell } from '@/components/ui/modal-shell';
import { designRequestsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Sparkles, Loader2, Check, Clock } from 'lucide-react';

const TIERS = [
  {
    id: 'branding',
    name: 'Branding polish',
    from: '৳10,000',
    blurb: 'Your colours, logo, fonts and copy tuned into an existing theme.',
  },
  {
    id: 'custom',
    name: 'Custom design',
    from: '৳40,000',
    blurb: 'A completely unique website, designed for your resort alone.',
  },
  {
    id: 'premium',
    name: 'Premium',
    from: '৳80,000',
    blurb: 'Custom animation and bespoke interactions, built in code.',
  },
] as const;

type TierId = typeof TIERS[number]['id'];

/** Statuses where the request is still being worked on. */
const OPEN_STATUSES = ['NEW', 'CONTACTED', 'QUOTED', 'ACCEPTED', 'IN_PROGRESS'];

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Received — we will contact you shortly',
  CONTACTED: 'We have reached out',
  QUOTED: 'Quote sent — check your email',
  ACCEPTED: 'Accepted — starting soon',
  IN_PROGRESS: 'Being designed now',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const inputCls =
  'w-full rounded-rp-sm border border-black/5 bg-rp-surface-3 px-3 py-[9px] text-rp-body text-rp-text placeholder:text-rp-faint focus:outline-none focus:ring-2 focus:ring-rp-brand/30';
const labelCls = 'block text-rp-label font-medium text-rp-subtle mb-1.5';

export function CustomDesignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: existingRes } = useQuery({
    queryKey: ['design-requests'],
    queryFn: () => designRequestsApi.list(),
    enabled: open,
  });
  const requests: { id: string; status: string; tier?: string | null; createdAt: string }[] =
    existingRes?.data?.data ?? [];
  const openRequest = requests.find((r) => OPEN_STATUSES.includes(r.status));

  const [tier, setTier] = useState<TierId>('custom');
  const [form, setForm] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    timeline: '',
    description: '',
    referenceUrls: '',
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      designRequestsApi.create({
        ...form,
        tier,
        referenceUrls: form.referenceUrls
          .split(/[\s,]+/)
          .map((u) => u.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['design-requests'] });
      toast({ title: 'Request sent', description: 'We will contact you shortly.' });
      onClose();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast({
        title: 'Could not send',
        description: e?.response?.data?.error ?? 'Please try again.',
        variant: 'destructive',
      }),
  });

  const canSubmit =
    form.contactName.trim() &&
    form.contactPhone.trim() &&
    form.contactEmail.trim() &&
    form.description.trim().length >= 10;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Get a custom website design"
      description="Tell us what you want. We will send a quote."
      maxWidth="620px"
      footer={
        openRequest ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              className="rounded-rp-ctrl border border-rp-border-md px-4 py-2 text-rp-body font-medium text-rp-subtle transition-colors hover:bg-rp-surface-3"
            >
              Close
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-rp-ctrl border border-rp-border-md px-4 py-2 text-rp-body font-medium text-rp-subtle transition-colors hover:bg-rp-surface-3 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              className="flex items-center gap-2 rounded-rp-ctrl bg-rp-btn-accent px-4 py-2 text-rp-body font-medium text-rp-btn-accent-text transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send request
            </button>
          </div>
        )
      }
    >
      {openRequest ? (
        // Already has one in flight — the API rejects a second, so show status
        // instead of a form they can't submit.
        <div className="space-y-4">
          <div
            className="flex items-start gap-3 rounded-rp-panel border border-rp-border p-4"
            style={{ background: 'var(--rp-teal-bg)' }}
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-rp-brand" />
            <div>
              <p className="text-rp-body font-semibold text-rp-text">
                {STATUS_LABEL[openRequest.status] ?? openRequest.status}
              </p>
              <p className="mt-1 text-rp-meta text-rp-muted">
                Requested on{' '}
                {new Date(openRequest.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                {openRequest.tier ? ` · ${openRequest.tier} tier` : ''}
              </p>
            </div>
          </div>
          <p className="text-rp-meta text-rp-muted">
            We handle one design at a time per resort so nothing gets confused. Reply to our email
            if you want to change the brief.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Tier picker */}
          <div>
            <label className={labelCls}>What are you after?</label>
            <div className="space-y-2">
              {TIERS.map((t) => {
                const active = tier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className="flex w-full items-start gap-3 rounded-rp-panel border-2 p-3 text-left transition-all"
                    style={
                      active
                        ? { borderColor: 'var(--rp-brand)', background: 'var(--rp-teal-soft)' }
                        : { borderColor: 'var(--rp-border-md)' }
                    }
                  >
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                      style={
                        active
                          ? { borderColor: 'var(--rp-brand)', background: 'var(--rp-brand)' }
                          : { borderColor: 'var(--rp-border-md)' }
                      }
                    >
                      {active && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-rp-body font-semibold text-rp-text">{t.name}</span>
                        <span className="shrink-0 text-rp-meta font-semibold text-rp-brand">
                          from {t.from}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-rp-meta text-rp-muted">{t.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-rp-micro text-rp-faint">
              Indicative only — we send a firm quote after reading your brief.
            </p>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Your name *</label>
              <input
                value={form.contactName}
                onChange={(e) => set('contactName', e.target.value)}
                className={inputCls}
                placeholder="Who should we talk to?"
              />
            </div>
            <div>
              <label className={labelCls}>Phone / WhatsApp *</label>
              <input
                value={form.contactPhone}
                onChange={(e) => set('contactPhone', e.target.value)}
                className={inputCls}
                placeholder="01XXXXXXXXX"
              />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => set('contactEmail', e.target.value)}
                className={inputCls}
                placeholder="you@resort.com"
              />
            </div>
            <div>
              <label className={labelCls}>When do you need it?</label>
              <input
                value={form.timeline}
                onChange={(e) => set('timeline', e.target.value)}
                className={inputCls}
                placeholder="e.g. before Eid, no rush"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>What do you want? *</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="The feel you want, what you dislike about the current site, must-have sections…"
            />
            {form.description.trim().length > 0 && form.description.trim().length < 10 && (
              <p className="mt-1 text-rp-micro text-rp-danger">
                Please write a little more so we can quote properly.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Websites you like</label>
            <textarea
              rows={2}
              value={form.referenceUrls}
              onChange={(e) => set('referenceUrls', e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="Paste links, one per line — helps us understand your taste"
            />
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/** The button that opens the modal. */
export function CustomDesignCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-rp-card border p-4 text-left transition-all hover:opacity-90"
      style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-teal-soft)' }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-rp-ctrl"
        style={{ background: 'var(--rp-teal-bg)' }}
      >
        <Sparkles className="h-4 w-4 text-rp-brand" />
      </span>
      <span className="min-w-0">
        <span className="block text-rp-body font-semibold text-rp-text">
          Want something nobody else has?
        </span>
        <span className="mt-0.5 block text-rp-meta text-rp-muted">
          We can design a website just for your resort — from ৳10,000.
        </span>
      </span>
    </button>
  );
}
