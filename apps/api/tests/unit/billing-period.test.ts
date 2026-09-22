/**
 * Where a paid period ends after a payment.
 *
 * One line of arithmetic, and it is about money: a resort that renews a week
 * early must keep that week. Extending from "now" instead of from the end of
 * the period already bought takes it away, and nobody notices until a customer
 * counts the days.
 */
import { describe, it, expect } from 'vitest';
import { extendPeriod } from '../../src/utils/billing-period';

const at = (iso: string) => new Date(iso);
const now = at('2026-09-22T10:00:00Z');

describe('extending a period', () => {
  it('runs from today when nothing has been paid for yet', () => {
    expect(extendPeriod(null, 30, now).toISOString()).toBe('2026-10-22T10:00:00.000Z');
  });

  it('runs from today when the last period has already ended', () => {
    expect(extendPeriod(at('2026-06-01T00:00:00Z'), 30, now).toISOString())
      .toBe('2026-10-22T10:00:00.000Z');
  });

  it('keeps the days a resort renewing early has already bought', () => {
    // Seven days left, plus the thirty just paid for, is thirty-seven.
    expect(extendPeriod(at('2026-09-29T10:00:00Z'), 30, now).toISOString())
      .toBe('2026-10-29T10:00:00.000Z');
  });

  it('counts a year as a year', () => {
    expect(extendPeriod(null, 365, now).toISOString()).toBe('2027-09-22T10:00:00.000Z');
  });
});
