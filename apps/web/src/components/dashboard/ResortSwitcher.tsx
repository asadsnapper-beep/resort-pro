'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useResortGroup } from '@/hooks/use-resort-group';

/**
 * Which resort you are looking at.
 *
 * An owner with four resorts has four separate ResortPro accounts. This moves
 * between them without a second login: the API hands back a session for a real
 * user of that resort, and everything on screen is replaced with that resort's
 * own data.
 *
 * Hidden unless at least two resorts are connected, so for everyone with one
 * resort — nearly everyone — the dashboard is exactly what it was.
 *
 * A resort shared as figures only appears here but cannot be chosen: its owner
 * agreed to show numbers on the 360 page, not to hand over the resort.
 */
export function ResortSwitcher({ className = '' }: { className?: string }) {
  const t = useTranslations('common') as (key: string) => string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { data: group } = useResortGroup();
  const [switching, setSwitching] = useState(false);
  const [failed, setFailed] = useState(false);

  const say = (key: string, fallback: string) => {
    const value = t(`resortSwitcher.${key}`);
    return value.endsWith(`resortSwitcher.${key}`) ? fallback : value;
  };

  if (!group || group.resorts.length < 2) return null;

  const current = group.resorts.find((r) => r.isCurrent);

  const change = async (tenantId: string) => {
    if (!tenantId || tenantId === current?.tenantId) return;
    setSwitching(true);
    setFailed(false);
    try {
      const { data } = await authApi.switchResort(tenantId);
      const { token, user, tenant } = data.data;
      // The store first: every request after this one — including the reset
      // refetches below — has to carry the new resort's token.
      setAuth(user, tenant, token);
      // Reset, not invalidate. Invalidating leaves the previous resort's
      // figures on screen until each refetch lands, and an owner reading them
      // under the new resort's name is the one outcome this must never have.
      await queryClient.resetQueries();
      router.push('/dashboard');
    } catch {
      setFailed(true);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className={className}>
      <label className="block">
        <span className="sr-only">{say('label', 'Resort')}</span>
        <select
          value={current?.tenantId ?? ''}
          disabled={switching}
          onChange={(e) => void change(e.target.value)}
          className="w-full truncate bg-transparent font-display text-[14px] font-medium text-[#ece7df] focus:outline-none focus:ring-1 focus:ring-gold-500/40 disabled:opacity-60"
        >
          {group.resorts.map((r) => (
            <option key={r.tenantId} value={r.tenantId} disabled={!r.canOpen} className="text-[#183153]">
              {r.canOpen ? r.name : `${r.name} — ${say('figuresOnly', 'figures only')}`}
            </option>
          ))}
        </select>
      </label>
      {switching && (
        <p className="text-[10.5px] text-[#698599]">{say('switching', 'Switching…')}</p>
      )}
      {failed && (
        <p role="alert" className="text-[10.5px] text-red-300">
          {say('failed', 'Could not switch resort. Try again.')}
        </p>
      )}
    </div>
  );
}
