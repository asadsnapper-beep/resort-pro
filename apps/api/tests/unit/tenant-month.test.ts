/**
 * Where a resort's month begins.
 *
 * Two different answers are needed and mixing them up loses money on the books.
 * `Expense.date` is a calendar date, stored as midnight UTC, so it compares
 * against midnight UTC of the local 1st. `Payment.processedAt` is a real
 * instant, so it compares against the moment local midnight actually happened —
 * six hours earlier in Dhaka. Using the first for the second drops every taka
 * taken on the first evening of the month.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  tenantOffsetMinutes, tenantMonthStartDate, tenantMonthStartInstant,
} from '../../src/utils/tenant-day';

afterEach(() => vi.useRealTimers());

const at = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

describe('how far ahead of UTC a resort is', () => {
  it('reads the offset out of the zone itself', () => {
    const mid = new Date('2026-09-15T00:00:00Z');
    expect(tenantOffsetMinutes(mid, 'Asia/Dhaka')).toBe(360);
    expect(tenantOffsetMinutes(mid, 'UTC')).toBe(0);
    expect(tenantOffsetMinutes(mid, 'Asia/Kathmandu')).toBe(345);
    expect(tenantOffsetMinutes(mid, 'Pacific/Niue')).toBe(-660);
  });

  it('follows a daylight-saving change rather than assuming one offset', () => {
    expect(tenantOffsetMinutes(new Date('2026-07-01T12:00:00Z'), 'Europe/London')).toBe(60);
    expect(tenantOffsetMinutes(new Date('2026-01-01T12:00:00Z'), 'Europe/London')).toBe(0);
  });
});

describe('the first of the month', () => {
  it('is the local date, not the UTC one', () => {
    // 20:00 UTC on 31 August is already 02:00 on 1 September in Dhaka.
    at('2026-08-31T20:00:00Z');
    expect(tenantMonthStartDate('Asia/Dhaka').toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(tenantMonthStartDate('UTC').toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('is still last month for a resort the clock has not reached yet', () => {
    // 02:00 UTC on 1 September is still 22:00 on 31 August in New York.
    at('2026-09-01T02:00:00Z');
    expect(tenantMonthStartDate('America/New_York').toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(tenantMonthStartDate('Asia/Dhaka').toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('the instant the month began', () => {
  it('is local midnight, which is earlier than midnight UTC east of it', () => {
    at('2026-09-10T09:00:00Z');
    // Midnight on 1 September in Dhaka happened at 18:00 UTC on 31 August.
    expect(tenantMonthStartInstant('Asia/Dhaka').toISOString()).toBe('2026-08-31T18:00:00.000Z');
    expect(tenantMonthStartInstant('UTC').toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('is later than midnight UTC west of it', () => {
    at('2026-09-10T09:00:00Z');
    // Midnight on 1 September in New York happened at 04:00 UTC that day.
    expect(tenantMonthStartInstant('America/New_York').toISOString()).toBe('2026-09-01T04:00:00.000Z');
  });

  it('covers a payment taken on the first evening of a Dhaka month', () => {
    at('2026-09-10T09:00:00Z');
    const takenAt = new Date('2026-08-31T19:30:00Z'); // 01:30 on 1 September in Dhaka
    expect(takenAt >= tenantMonthStartInstant('Asia/Dhaka')).toBe(true);
    // And the naive answer, which is the bug this exists to prevent.
    expect(takenAt >= tenantMonthStartDate('Asia/Dhaka')).toBe(false);
  });
});
