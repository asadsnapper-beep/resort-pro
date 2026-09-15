import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The property the dashboard is looking at, per tenant.
 *
 * Kept per tenant id rather than as one value: an admin moving between tenants
 * — impersonation, or an owner with two accounts — must not carry a property id
 * from one resort into another, where it would match nothing and quietly empty
 * every list.
 *
 * null means "All properties", which is what every page showed before this
 * existed.
 */
interface PropertyState {
  byTenant: Record<string, string | null>;
  select: (tenantId: string, propertyId: string | null) => void;
}

export const PROPERTY_STORE_KEY = 'resortpro-property';

export const usePropertyStore = create<PropertyState>()(
  persist(
    (set) => ({
      byTenant: {},
      select: (tenantId, propertyId) =>
        set((s) => ({ byTenant: { ...s.byTenant, [tenantId]: propertyId } })),
    }),
    { name: PROPERTY_STORE_KEY },
  ),
);

/** Read outside React — the API client needs it on every request. */
export function selectedPropertyFor(tenantId: string | null | undefined): string | null {
  if (!tenantId) return null;
  return usePropertyStore.getState().byTenant[tenantId] ?? null;
}
