'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { resortGroupApi } from '@/lib/api';

export interface LinkRequest {
  id: string;
  groupName: string;
  askerName: string;
  askerEmail: string | null;
  askerResort: string | null;
  resortName?: string;
}

/**
 * Deciding what a connection gives somebody.
 *
 * Shared by the page an emailed link opens and the banner inside the dashboard,
 * because the two must not drift. What they must agree on above all is the
 * sentence about billing: full access really is everything this owner can do,
 * and somebody handing that over deserves to read it before they click, not
 * after.
 */
export function ResortLinkDecision({
  request,
  onDone,
}: {
  request: LinkRequest;
  onDone?: (outcome: 'FULL' | 'NUMBERS_ONLY' | 'declined') => void;
}) {
  const t = useTranslations('common') as (key: string) => string;
  const say = (key: string, fallback: string) => {
    const value = t(`resortLink.${key}`);
    return value.endsWith(`resortLink.${key}`) ? fallback : value;
  };

  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<'FULL' | 'NUMBERS_ONLY' | 'declined' | null>(null);

  const answer = async (choice: 'FULL' | 'NUMBERS_ONLY' | 'declined') => {
    setBusy(true);
    setFailed(false);
    try {
      if (choice === 'declined') await resortGroupApi.decline(request.id);
      else await resortGroupApi.approve(request.id, choice);
      setDone(choice);
      await queryClient.invalidateQueries({ queryKey: ['resort-link-requests'] });
      onDone?.(choice);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="text-rp-body text-rp-text">
        {done === 'declined'
          ? say('declined', 'Declined. Nothing was shared.')
          : done === 'FULL'
            ? say('gaveFull', 'Done — they can now open this resort.')
            : say('gaveNumbers', 'Done — they can see this resort’s figures only.')}
      </p>
    );
  }

  const who = request.askerEmail ? `${request.askerName} (${request.askerEmail})` : request.askerName;

  return (
    <div className="space-y-4">
      <p className="text-rp-body text-rp-text">
        <strong>{who}</strong>
        {request.askerResort ? ` ${say('runs', 'runs')} ${request.askerResort}, ` : ' '}
        {say('wants', 'would like to see this resort alongside their own.')}
      </p>

      <div className="space-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer('FULL')}
          className="w-full rounded-rp-btn border border-rp-border-md bg-rp-surface px-4 py-3 text-left disabled:opacity-60"
        >
          <span className="block text-rp-body font-semibold text-rp-text">
            {say('fullTitle', 'Give full access')}
          </span>
          <span className="block text-rp-meta text-rp-muted">
            {say('fullBody', 'They will be able to do everything you can in this resort, including its billing.')}
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void answer('NUMBERS_ONLY')}
          className="w-full rounded-rp-btn border border-rp-border-md bg-rp-surface px-4 py-3 text-left disabled:opacity-60"
        >
          <span className="block text-rp-body font-semibold text-rp-text">
            {say('numbersTitle', 'Share the figures only')}
          </span>
          <span className="block text-rp-meta text-rp-muted">
            {say('numbersBody', 'Occupancy and totals appear on their overview. They cannot open this resort or see a single guest.')}
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer('declined')}
          className="text-rp-meta text-rp-muted underline-offset-2 hover:underline disabled:opacity-60"
        >
          {say('decline', 'Decline')}
        </button>
        <span className="text-rp-micro text-rp-muted">
          {say('changeable', 'You can change or undo this at any time.')}
        </span>
      </div>

      {failed && (
        <p role="alert" className="text-rp-meta text-rp-danger">
          {say('failed', 'That did not go through. Try again.')}
        </p>
      )}
    </div>
  );
}
