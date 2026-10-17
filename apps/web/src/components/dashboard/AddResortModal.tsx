'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ModalShell } from '@/components/ui/modal-shell';
import { resortGroupApi } from '@/lib/api';
import { useSwitchResort } from '@/hooks/use-resort-group';

/** "Sea Pearl Retreat" → "sea-pearl-retreat", which is what the API will accept. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Opening another resort.
 *
 * This spends money, so it says so before the button rather than after: a
 * separate account, a separate subscription, and a plan to choose next. The
 * discount is named here too — an owner deciding whether a fourth resort is
 * worth it should be told it costs a tenth less, not discover it on the
 * invoice.
 */
export function AddResortModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('common') as (key: string) => string;
  const say = (key: string, fallback: string) => {
    const value = t(`addResort.${key}`);
    return value.endsWith(`addResort.${key}`) ? fallback : value;
  };

  const { switchTo } = useSwitchResort();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = touchedSlug ? slug : slugify(name);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await resortGroupApi.newResort({ name: name.trim(), slug: effectiveSlug });
      // Straight into the new resort, which is where its plan is chosen.
      await switchTo(data.data.tenantId);
      onClose();
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      setError(code === 'SLUG_TAKEN'
        ? say('slugTaken', 'That web address is already taken. Try another.')
        : say('failed', 'Could not open the resort. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={say('title', 'Open another resort')}
      description={say('subtitle', 'A separate account, with its own rooms, staff and books.')}
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-rp-body text-rp-muted">
            {say('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={busy || name.trim().length < 2 || effectiveSlug.length < 2}
            onClick={() => void submit()}
            className="rounded-rp-btn bg-rp-brand px-4 py-2 text-rp-body font-semibold text-white disabled:opacity-60"
          >
            {say('create', 'Create it')}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="block text-rp-label font-medium text-rp-text">{say('name', 'Resort name')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-rp-ctrl border border-rp-border-md bg-rp-surface px-3 py-2 text-rp-body text-rp-text"
          />
        </label>

        <label className="block">
          <span className="block text-rp-label font-medium text-rp-text">{say('slug', 'Web address')}</span>
          <input
            value={effectiveSlug}
            onChange={(e) => { setTouchedSlug(true); setSlug(slugify(e.target.value)); }}
            className="mt-1 w-full rounded-rp-ctrl border border-rp-border-md bg-rp-surface px-3 py-2 text-rp-body text-rp-text"
          />
        </label>

        <p className="text-rp-meta text-rp-muted">
          {say('cost', 'This is a separate subscription — you will choose its plan next. Every resort after your first costs 10% less.')}
        </p>

        {error && <p role="alert" className="text-rp-meta text-rp-danger">{error}</p>}
      </div>
    </ModalShell>
  );
}
