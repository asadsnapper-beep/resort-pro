/**
 * Where a paid period ends after a payment.
 *
 * The rule is one line and the reason is money: extend from whichever is
 * later, now or the end of the period already paid for. Starting every renewal
 * at "now" quietly takes back the days a resort had already bought — pay a week
 * early and you lose a week.
 */
export function extendPeriod(currentEnd: Date | null | undefined, days: number, now: Date = new Date()): Date {
  const base = Math.max(now.getTime(), currentEnd?.getTime() ?? 0);
  return new Date(base + days * 24 * 60 * 60 * 1000);
}
