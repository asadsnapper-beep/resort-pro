'use client';

import { useAuthStore } from '@/store/auth';
import { currencySymbol } from '@/lib/utils';

/**
 * The resort's own currency, for the screens that show or collect money.
 *
 * `Tenant.currency` has always been a real column with a real default, and the
 * settings screen has always written it. What was missing was the reading end:
 * the API's auth payloads did not include it, so `tenant.currency` was
 * undefined on the client and every page's
 * `(tenant as any)?.currency ?? 'BDT'` took the fallback. A resort billing in
 * dollars saw taka on its room cards — and a dollar sign in the Add Room
 * price field, because that one was hardcoded. The two disagreed, and both
 * were wrong. (Room Management QA 2026-10-28, RM-011.)
 *
 * The 'BDT' default stays as the last resort for the tick before the store has
 * rehydrated. It matches `formatCurrency`'s own default, so a value and its
 * symbol cannot come from two different assumptions.
 */
export function useCurrency(): { currency: string; symbol: string } {
  const { tenant } = useAuthStore();
  const currency = tenant?.currency ?? 'BDT';
  return { currency, symbol: currencySymbol(currency) };
}
