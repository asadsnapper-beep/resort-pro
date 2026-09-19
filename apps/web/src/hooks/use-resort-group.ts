'use client';

import { useQuery } from '@tanstack/react-query';
import { resortGroupApi } from '@/lib/api';
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
