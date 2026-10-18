/**
 * The group price: 10% off every resort after the first.
 *
 * An owner with four resorts buys four subscriptions. The plan the founder
 * settled on (plan/multi-resort.md §9) is one sentence:
 *
 *   Every resort in a group pays 10% less, except the one that was created
 *   first among the group's current members.
 *
 * Two things follow from it and both matter.
 *
 * It is **recomputed every time**, never stored as a price. A resort that
 * leaves a group simply stops being discounted at its next renewal, and if the
 * oldest resort leaves, the next-oldest starts paying full — at its own next
 * renewal, so nobody's bill goes up in the middle of a period they already paid
 * for.
 *
 * And it is computed **server side, in one place**. The amount the dashboard
 * shows, the amount bKash is asked for, and the amount the callback verifies
 * against all come through here, because the day they disagree is the day an
 * owner pays and is told the payment was wrong.
 */
import { prisma } from '@resort-pro/database';

export const GROUP_DISCOUNT_RATE = 0.10;

/** Whether this resort is priced as one of several in a group. */
export async function groupDiscountApplies(tenantId: string): Promise<boolean> {
  const membership = await prisma.resortGroupTenant.findUnique({
    where: { tenantId },
    select: { groupId: true },
  });
  if (!membership) return false;

  // Oldest by when the *resort* was created, not when it joined: an owner who
  // connects their newest resort first has not thereby made it the original.
  const oldest = await prisma.resortGroupTenant.findFirst({
    where: { groupId: membership.groupId },
    orderBy: { tenant: { createdAt: 'asc' } },
    select: { tenantId: true },
  });
  return !!oldest && oldest.tenantId !== tenantId;
}

/**
 * The payable amount, in whole taka.
 *
 * Rounded once, here, so the price on the screen and the price bKash is handed
 * are the same number rather than two roundings of the same idea.
 */
export function discounted(amount: number, applies: boolean): number {
  return applies ? Math.round(amount * (1 - GROUP_DISCOUNT_RATE)) : amount;
}

/**
 * The same discount on a price carried in dollars.
 *
 * Kept apart from `discounted` because the rounding has to differ: bKash is
 * charged a whole number of taka, while Stripe applies a percentage coupon and
 * will take $17.10 for a $19 plan. Rounding that to $17 on the page would be
 * the same lie in the other direction.
 */
export function discountedUsd(amount: number, applies: boolean): number {
  return applies ? Math.round(amount * (1 - GROUP_DISCOUNT_RATE) * 100) / 100 : amount;
}

/** Every plan's price for this resort, discount included. */
export function discountedPrices<T extends Record<string, number>>(prices: T, applies: boolean): T {
  if (!applies) return prices;
  return Object.fromEntries(
    Object.entries(prices).map(([key, value]) => [key, discounted(value, true)]),
  ) as T;
}
