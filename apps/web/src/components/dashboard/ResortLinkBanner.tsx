'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link2 } from 'lucide-react';
import { resortGroupApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { ModalShell } from '@/components/ui/modal-shell';
import { ResortLinkDecision, type LinkRequest } from './ResortLinkDecision';

/**
 * Somebody has asked to connect this resort to their account.
 *
 * This exists so that approving never depends on an email arriving. The email
 * carries a link, but a link can be filtered, forwarded to a colleague or lost;
 * the owner signing in should still find the question waiting for them.
 *
 * Only the owner is asked, and only the owner is told — staff never learn that
 * another account wants in.
 */
export function ResortLinkBanner() {
  const t = useTranslations('common') as (key: string) => string;
  const say = (key: string, fallback: string) => {
    const value = t(`resortLink.${key}`);
    return value.endsWith(`resortLink.${key}`) ? fallback : value;
  };

  const role = useAuthStore((s) => s.user?.role);
  const [open, setOpen] = useState<LinkRequest | null>(null);

  const { data } = useQuery({
    queryKey: ['resort-link-requests'],
    queryFn: () => resortGroupApi.incoming().then((r) => (r.data?.data ?? []) as LinkRequest[]),
    enabled: role === 'OWNER',
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const request = data?.[0];
  if (!request) return null;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-rp-border bg-rp-amber-bg px-4 py-2 text-rp-body text-rp-text">
        <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">
          <strong>{request.askerName}</strong>{' '}
          {say('bannerAsk', 'would like to connect this resort to their account.')}
        </span>
        <button
          type="button"
          onClick={() => setOpen(request)}
          className="shrink-0 font-semibold underline-offset-2 hover:underline"
        >
          {say('review', 'Review')}
        </button>
      </div>

      <ModalShell
        open={!!open}
        onClose={() => setOpen(null)}
        title={say('modalTitle', 'A request about this resort')}
        description={open ? `${say('partOf', 'They run')} ${open.groupName}` : undefined}
      >
        {open && <ResortLinkDecision request={open} onDone={() => setOpen(null)} />}
      </ModalShell>
    </>
  );
}
