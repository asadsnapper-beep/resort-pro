'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { propertyApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { usePropertyStore } from '@/store/property';

interface PropertyRow { id: string; name: string; isActive?: boolean }

/**
 * Chooses which property the dashboard shows.
 *
 * Resort groups could create properties and put rooms in them, and then every
 * page showed all of them mixed together — the plan was sold on an owner view
 * that did not exist. This is the start of it: pick a property here and each
 * page that understands properties narrows to it (the choice travels as the
 * X-Property-Id header, set in lib/api.ts).
 *
 * Hidden unless there are at least two active properties, so a single-property
 * resort — nearly everyone — sees nothing new.
 */
export function PropertySwitcher() {
  const tenantId = useAuthStore((s) => s.tenant?.id);
  const selected = usePropertyStore((s) => (tenantId ? s.byTenant[tenantId] ?? null : null));
  const select = usePropertyStore((s) => s.select);
  const queryClient = useQueryClient();

  // Same key and shape as the Properties page, so the two share one request.
  const { data } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyApi.list({ limit: 50 }).then((r) => r.data),
    retry: false,
    enabled: !!tenantId,
  });
  const properties: PropertyRow[] = ((data?.data ?? []) as PropertyRow[]).filter((p) => p.isActive !== false);
  const known = !selected || properties.some((p) => p.id === selected);

  // A remembered property that was deleted or deactivated would otherwise
  // filter every page down to nothing. Fall back to all properties.
  useEffect(() => {
    if (tenantId && data && !known) select(tenantId, null);
  }, [tenantId, data, known, select]);

  if (!tenantId || properties.length < 2) return null;

  const change = (value: string) => {
    select(tenantId, value || null);
    // Reset rather than invalidate: invalidating keeps the previous property's
    // numbers on screen until the refetch lands, which is exactly the moment an
    // owner would read them as this property's. The property list itself is
    // unaffected by the choice, so it is kept.
    void queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== 'properties' });
  };

  return (
    <label className="mr-1 flex items-center gap-1.5 rounded-rp-ctrl border border-rp-border-md bg-rp-surface px-2 py-1 text-rp-body text-rp-text">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-rp-muted" aria-hidden="true" />
      <span className="sr-only">Property</span>
      <select
        value={known ? selected ?? '' : ''}
        onChange={(e) => change(e.target.value)}
        className="max-w-[10rem] truncate bg-transparent text-rp-body text-rp-text focus:outline-none sm:max-w-[14rem]"
      >
        <option value="">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}
