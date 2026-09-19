'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { resortGroupApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useResortGroup, type GroupResort } from '@/hooks/use-resort-group';
import { AddResortModal } from './AddResortModal';

/**
 * Connections, from both sides.
 *
 * One screen rather than two, because a single owner can be on both sides at
 * once: their own group above, and whoever they let into this resort below.
 * Splitting it would mean deciding for them which one they came here for.
 *
 * The lower half is the one that matters for trust. It answers the question an
 * owner should never have to ask support — whose account is attached to my
 * books, at what level, and since when — and lets them change or end it in the
 * same place.
 */

interface Connection {
  groupName: string;
  ownerName: string;
  ownerEmail: string;
  ownerResort: string | null;
  access: 'FULL' | 'NUMBERS_ONLY';
  since: string;
}

interface GroupEvent {
  id: string;
  action: string;
  resortName: string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function ConnectedResortsTab() {
  const t = useTranslations('common') as (key: string) => string;
  const say = (key: string, fallback: string) => {
    const value = t(`connections.${key}`);
    return value.endsWith(`connections.${key}`) ? fallback : value;
  };

  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: group } = useResortGroup();
  const { data: connection } = useQuery({
    queryKey: ['resort-connection'],
    queryFn: () => resortGroupApi.connection().then((r) => (r.data?.data ?? null) as Connection | null),
    retry: false,
  });
  const { data: events } = useQuery({
    queryKey: ['resort-group-events'],
    queryFn: () => resortGroupApi.events().then((r) => (r.data?.data ?? []) as GroupEvent[]),
    retry: false,
  });

  const mine = (group?.resorts ?? []).filter((r) => r.tenantId !== tenantId);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await fn();
      await queryClient.invalidateQueries();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const ACTIONS: Record<string, string> = {
    link_requested: say('evRequested', 'Access requested'),
    link_approved: say('evApproved', 'Connected'),
    link_declined: say('evDeclined', 'Request declined'),
    access_changed: say('evChanged', 'Access level changed'),
    unlinked: say('evUnlinked', 'Disconnected'),
    switched: say('evSwitched', 'Opened from another account'),
    resort_added: say('evAdded', 'Resort added'),
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-rp-card border border-rp-border bg-rp-surface p-4">
        <p className="text-rp-body text-rp-muted">
          {say('addBlurb', 'Run more than one resort? Each is its own account, and every one after the first costs 10% less.')}
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-rp-btn bg-rp-brand px-4 py-2 text-rp-body font-semibold text-white"
        >
          {say('add', 'Open another resort')}
        </button>
      </section>
      <AddResortModal open={adding} onClose={() => setAdding(false)} />

      {mine.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-rp-heading font-semibold text-rp-text">
              {say('mineTitle', 'Resorts you can see')}
            </h2>
            <p className="text-rp-body text-rp-muted">
              {say('mineBody', 'Connected to this account. Disconnecting stops their figures appearing on your overview.')}
            </p>
          </div>
          <ul className="space-y-2">
            {mine.map((r: GroupResort) => (
              <li
                key={r.tenantId}
                className="flex items-center gap-3 rounded-rp-card border border-rp-border bg-rp-surface p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-rp-body font-medium text-rp-text">{r.name}</span>
                  <span className="block text-rp-meta text-rp-muted">
                    {r.access === 'FULL'
                      ? say('levelFull', 'Full access')
                      : say('levelNumbers', 'Figures only')}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => resortGroupApi.disconnect(r.tenantId))}
                  className="shrink-0 text-rp-meta text-rp-danger underline-offset-2 hover:underline disabled:opacity-60"
                >
                  {say('disconnect', 'Disconnect')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {connection && (
        <section className="space-y-3">
          <div>
            <h2 className="text-rp-heading font-semibold text-rp-text">
              {say('theirsTitle', 'Who can see this resort')}
            </h2>
            <p className="text-rp-body text-rp-muted">
              {say('theirsBody', 'You chose this when you approved the request, and you can change it here at any time.')}
            </p>
          </div>

          <div className="space-y-3 rounded-rp-card border border-rp-border bg-rp-surface p-4">
            <p className="text-rp-body text-rp-text">
              <strong>{connection.ownerName}</strong> ({connection.ownerEmail})
              {connection.ownerResort ? ` — ${connection.ownerResort}` : ''}
            </p>
            <p className="text-rp-meta text-rp-muted">
              {connection.access === 'FULL'
                ? say('hasFull', 'Can do everything you can in this resort, including its billing.')
                : say('hasNumbers', 'Sees occupancy and totals only. Cannot open this resort or see a guest.')}
            </p>

            <div className="flex flex-wrap gap-2">
              {connection.access === 'FULL' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => resortGroupApi.setAccess(tenantId!, 'NUMBERS_ONLY'))}
                  className="rounded-rp-btn border border-rp-border-md px-3 py-1.5 text-rp-meta text-rp-text disabled:opacity-60"
                >
                  {say('dropToNumbers', 'Reduce to figures only')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => resortGroupApi.setAccess(tenantId!, 'FULL'))}
                  className="rounded-rp-btn border border-rp-border-md px-3 py-1.5 text-rp-meta text-rp-text disabled:opacity-60"
                >
                  {say('raiseToFull', 'Give full access')}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => resortGroupApi.disconnect(tenantId!))}
                className="rounded-rp-btn border border-rp-border-md px-3 py-1.5 text-rp-meta text-rp-danger disabled:opacity-60"
              >
                {say('revoke', 'End this connection')}
              </button>
            </div>
          </div>
        </section>
      )}

      {failed && (
        <p role="alert" className="text-rp-body text-rp-danger">
          {say('failed', 'That did not go through. Try again.')}
        </p>
      )}

      {!!events?.length && (
        <section className="space-y-3">
          <h2 className="text-rp-heading font-semibold text-rp-text">{say('historyTitle', 'History')}</h2>
          <ul className="space-y-1">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 text-rp-meta text-rp-muted">
                <span className="text-rp-text">{ACTIONS[e.action] ?? e.action}</span>
                {e.resortName && <span>· {e.resortName}</span>}
                {e.actorName && <span>· {e.actorName}</span>}
                <span>· {new Date(e.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
