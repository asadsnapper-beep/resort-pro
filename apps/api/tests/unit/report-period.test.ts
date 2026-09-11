import { describe, it, expect } from 'vitest';
import {
  MAX_REPORT_DAYS,
  ReportPeriodError,
  resolveReportPeriod,
  startOfLocalDay,
  weekContaining,
} from '../../src/services/reporting/period';

/**
 * The report's notion of a day belongs to the resort, not to the machine.
 *
 * Every case here is one the old `dayBounds()` in routes/reports.ts got wrong:
 * it built the window with `setHours`, which reads the server's timezone, and
 * closed it at `23:59:59.999`.
 */
const NOW = new Date('2026-09-20T12:00:00Z');

describe('where a resort\'s day begins', () => {
  it('starts the Dhaka day six hours before UTC midnight', () => {
    // UTC+6 with no DST: 12 September in Dhaka begins at 18:00Z on the 11th.
    expect(startOfLocalDay('2026-09-12', 'Asia/Dhaka').toISOString())
      .toBe('2026-09-11T18:00:00.000Z');
  });

  it('starts the UTC day at UTC midnight', () => {
    expect(startOfLocalDay('2026-09-12', 'UTC').toISOString())
      .toBe('2026-09-12T00:00:00.000Z');
  });

  it('starts a day west of UTC after UTC midnight', () => {
    // New York in September is UTC-4.
    expect(startOfLocalDay('2026-09-12', 'America/New_York').toISOString())
      .toBe('2026-09-12T04:00:00.000Z');
  });

  it('gets the day a clock change lands on right', () => {
    // US DST ends 01 November 2026: that local day is 25 hours long and starts
    // at 04:00Z, while the next starts at 05:00Z.
    expect(startOfLocalDay('2026-11-01', 'America/New_York').toISOString())
      .toBe('2026-11-01T04:00:00.000Z');
    expect(startOfLocalDay('2026-11-02', 'America/New_York').toISOString())
      .toBe('2026-11-02T05:00:00.000Z');
  });

  it('gets a far-eastern DST day right, where one pass is not enough', () => {
    // Auckland moves from UTC+12 to UTC+13 on 27 September 2026, so that local
    // day begins at 12:00Z on the 26th. Reading the offset at UTC midnight of
    // the 27th gives +13 — the offset *after* the change — and lands an hour
    // early, at 11:00Z, which in Auckland is still 23:00 on the 26th: the
    // wrong day. New York cannot catch this, because there UTC midnight and
    // local midnight fall on the same side of the transition.
    expect(startOfLocalDay('2026-09-27', 'Pacific/Auckland').toISOString())
      .toBe('2026-09-26T12:00:00.000Z');
  });
});

describe('a single day', () => {
  const period = resolveReportPeriod({
    from: '2026-09-12', to: '2026-09-12', timezone: 'Asia/Dhaka', now: NOW,
  });

  it('counts as one day and calls itself daily', () => {
    expect(period.dayCount).toBe(1);
    expect(period.kind).toBe('daily');
  });

  it('covers exactly 24 hours, ending where the next day starts', () => {
    expect(period.startInstant.toISOString()).toBe('2026-09-11T18:00:00.000Z');
    expect(period.endInstantExclusive.toISOString()).toBe('2026-09-12T18:00:00.000Z');
  });

  it('keeps the date bounds separate from the instant bounds', () => {
    // Booking.checkIn is `@db.Date`, which Postgres returns as midnight UTC.
    // Comparing it against 18:00Z the previous day is the bug that once made
    // every Dhaka resort report zero arrivals.
    expect(period.startDate.toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(period.endDateExclusive.toISOString()).toBe('2026-09-13T00:00:00.000Z');
  });
});

describe('a custom range', () => {
  it('includes both ends: 20 to 25 is six days', () => {
    const period = resolveReportPeriod({
      from: '2026-09-20', to: '2026-09-25', timezone: 'Asia/Dhaka', now: new Date('2026-09-26T12:00:00Z'),
    });
    expect(period.dayCount).toBe(6);
    expect(period.kind).toBe('custom');
    expect(period.startInstant.toISOString()).toBe('2026-09-19T18:00:00.000Z');
    expect(period.endInstantExclusive.toISOString()).toBe('2026-09-25T18:00:00.000Z');
  });

  it('measures a range spanning a clock change by its real length', () => {
    // 31 Oct to 01 Nov 2026 in New York is 49 hours, not 48.
    const period = resolveReportPeriod({
      from: '2026-10-31', to: '2026-11-01', timezone: 'America/New_York', now: new Date('2026-11-02T12:00:00Z'),
    });
    const hours = (period.endInstantExclusive.getTime() - period.startInstant.getTime()) / 3_600_000;
    expect(period.dayCount).toBe(2);
    expect(hours).toBe(49);
  });

  it('accepts a range of exactly the maximum length', () => {
    // 2025-09-20 to 2026-09-20 inclusive is 366 days.
    const period = resolveReportPeriod({
      from: '2025-09-20', to: '2026-09-20', timezone: 'UTC', now: NOW,
    });
    expect(period.dayCount).toBe(MAX_REPORT_DAYS);
  });
});

describe('input a client controls', () => {
  const reject = (input: Parameters<typeof resolveReportPeriod>[0]) => {
    try {
      resolveReportPeriod(input);
    } catch (error) {
      return error as ReportPeriodError;
    }
    throw new Error('expected this range to be rejected');
  };

  it('refuses a reversed range rather than swapping the dates', () => {
    const error = reject({ from: '2026-09-25', to: '2026-09-20', timezone: 'UTC', now: NOW });
    expect(error.field).toBe('to');
    expect(error.message).toBe('End date must be the same as or after start date.');
  });

  it('refuses a date that does not exist', () => {
    expect(reject({ from: '2026-02-30', to: '2026-02-30', timezone: 'UTC', now: NOW }).field).toBe('from');
  });

  it('refuses anything that is not YYYY-MM-DD', () => {
    expect(reject({ from: '20-09-2026', to: '2026-09-20', timezone: 'UTC', now: NOW }).field).toBe('from');
    expect(reject({ from: '2026-9-2', to: '2026-09-20', timezone: 'UTC', now: NOW }).field).toBe('from');
  });

  it('refuses the future, judged by the resort\'s clock and not the server\'s', () => {
    // 21:00Z on the 20th is already the 21st in Dhaka, so that date is allowed
    // there while still being tomorrow in UTC.
    const late = new Date('2026-09-20T21:00:00Z');
    expect(
      resolveReportPeriod({ from: '2026-09-21', to: '2026-09-21', timezone: 'Asia/Dhaka', now: late }).dayCount,
    ).toBe(1);
    expect(reject({ from: '2026-09-21', to: '2026-09-21', timezone: 'UTC', now: late }).field).toBe('range');
  });

  it('refuses a range one day over the cap', () => {
    // One day earlier than the accepted 366, so this pins the boundary rather
    // than merely rejecting something obviously huge.
    const error = reject({ from: '2025-09-19', to: '2026-09-20', timezone: 'UTC', now: NOW });
    expect(error.field).toBe('range');
    expect(error.message).toContain(String(MAX_REPORT_DAYS));
  });

  it('falls back to the product default when a resort has no timezone set', () => {
    const period = resolveReportPeriod({ from: '2026-09-12', to: '2026-09-12', timezone: null, now: NOW });
    expect(period.timezone).toBe('Asia/Dhaka');
    expect(period.startInstant.toISOString()).toBe('2026-09-11T18:00:00.000Z');
  });
});

describe('the week a date falls in', () => {
  it('runs Monday to Sunday', () => {
    // 2026-09-16 is a Wednesday.
    expect(weekContaining('2026-09-16')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
  });

  it('puts Sunday at the end of its week, not the start of the next', () => {
    expect(weekContaining('2026-09-20')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
  });

  it('keeps Monday as its own week\'s first day', () => {
    expect(weekContaining('2026-09-14')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
  });
});
