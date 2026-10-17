'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, resortGroupApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export interface GroupResort {
  tenantId: string;
  name: string;
  slug: string;
  access: 'FULL' | 'NUMBERS_ONLY';
  planStatus: string;
  isActive: boolean;
  /** False for a resort whose owner shared figures but not the resort itself. */
  canOpen: boolean;
  isCurrent: boolean;
}

export interface ResortGroup {
  id: string;
  name: string;
  resorts: GroupResort[];
  pendingRequests: {
    id: string;
    tenantName: string;
    tenantSlug: string;
    createdAt: string;
    expiresAt: string;
  }[];
}

export const RESORT_GROUP_KEY = ['resort-group'] as const;

/**
 * The resorts connected to this account, or null.
 *
 * Null is the answer for everyone with a single resort, which is nearly
 * everyone — so nothing that uses this may render anything until it has a group
 * with at least two resorts in it.
 *
 * Kept in the query cache rather than a zustand store, unlike the property
 * choice beside it: the property choice is this browser's preference, while
 * this is server state that another owner can revoke at any moment. Storing it
 * would mean caching a permission.
 */
export function useResortGroup() {
  const tenantId = useAuthStore((s) => s.tenant?.id);

  return useQuery({
    queryKey: RESORT_GROUP_KEY,
    queryFn: () => resortGroupApi.get().then((r) => (r.data?.data ?? null) as ResortGroup | null),
    enabled: !!tenantId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export interface ResortNumbers {
  rooms: number;
  occupied: number;
  occupancyPct: number;
  arrivals: number;
  departures: number;
  revenueMonth: number;
  expensesMonth: number;
  profitMonth: number;
  outstanding: number;
}

export interface ResortCard {
  tenantId: string;
  name: string;
  slug: string;
  access: 'FULL' | 'NUMBERS_ONLY';
  canOpen: boolean;
  planStatus: string;
  isActive: boolean;
  currency: string;
  timezone: string;
  localDate: string;
  numbers: ResortNumbers | null;
  failed: boolean;
}

export interface ResortOverview {
  group: { id: string; name: string };
  resorts: ResortCard[];
  currencies: { currency: string; resorts: number; totals: ResortNumbers }[];
  generatedAt: string;
}

/** Every connected resort's figures — the 360 page. */
export function useResortOverview(enabled: boolean) {
  return useQuery({
    queryKey: ['resort-overview'],
    queryFn: () => resortGroupApi.overview().then((r) => r.data.data as ResortOverview),
    enabled,
    retry: false,
    // The API caches for a minute; asking more often than that only moves work
    // from its cache to the network.
    staleTime: 60 * 1000,
  });
}

/**
 * Move to another resort.
 *
 * Shared by the sidebar dropdown and the 360 page, because the order of the
 * three steps is the part that matters and there must not be two versions of
 * it: take the new session first so every following request carries it, then
 * clear the cache, then navigate.
 */
export function useSwitchResort() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [switching, setSwitching] = useState(false);
  const [failed, setFailed] = useState(false);

  const switchTo = async (tenantId: string) => {
    setSwitching(true);
    setFailed(false);
    try {
      const { data } = await authApi.switchResort(tenantId);
      const { token, user, tenant } = data.data;
      setAuth(user, tenant, token);
      // Reset, not invalidate. Invalidated queries keep the previous resort's
      // figures on screen until each refetch lands, and an owner reading those
      // under the new resort's name is the one outcome this must never have.
      await queryClient.resetQueries();
      router.push('/dashboard');
    } catch {
      setFailed(true);
    } finally {
      setSwitching(false);
    }
  };

  return { switchTo, switching, failed };
}
