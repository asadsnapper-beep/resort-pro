/**
 * The span of time a report covers, resolved in the resort's own timezone.
 *
 * Implements the "Canonical period type" section of
 * plan/report-periods-and-custom-range.md.
 *
 * Three things this exists to get right, each of which the previous
 * `dayBounds()` in routes/reports.ts got wrong:
 *
 * 1. **The resort's day, not the server's.** That helper did
 *    `new Date(dateStr)` then `setHours(0,0,0,0)`, and `setHours` works in the
 *    timezone of whatever machine happens to be running the process. A resort
 *    in Dhaka reported on a UTC server therefore got a "day" running 06:00 to
 *    06:00 local: every arrival between midnight and dawn landed on the
 *    previous day's report, quietly, forever.
 *
 * 2. **Half-open, not `23:59:59.999`.** An end bound of `lte` one millisecond
 *    before midnight drops anything in that final millisecond, and there is no
 *    correct millisecond to pick when a DST change makes the day 23 or 25 hours
 *    long. `[start, end)` has neither problem.
 *
 * 3. **Two kinds of column need two kinds of bound.** `Payment.processedAt`
 *    and `FoodOrder.createdAt` are real timestamps, so they want UTC instants.
 *    `Booking.checkIn` / `checkOut` are `DateTime @db.Date` — a calendar date
 *    with no time, handed back by Postgres as midnight UTC — so they want the
 *    date form. Comparing a `@db.Date` against a local-midnight instant is the
 *    bug that once made every Bangladeshi resort report zero arrivals; see
 *    utils/tenant-day.ts. The old report used one window for both.
 */

export const DEFAULT_REPORT_TIMEZONE = 'Asia/Dhaka';

/** The longest range the API will build in one request. */
export const MAX_REPORT_DAYS = 366;

export type ReportPeriodKind = 'daily' | 'weekly' | 'custom';

export interface ReportPeriod {
  kind: ReportPeriodKind;
  /** Inclusive local calendar date, `YYYY-MM-DD`. */
  from: string;
  /** Inclusive local calendar date, `YYYY-MM-DD`. */
  to: string;
  timezone: string;
  /** Number of calendar days covered, `from` and `to` both counted. */
  dayCount: number;
  /** First instant of the period. Use with timestamp columns. */
  startInstant: Date;
  /** First instant *after* the period — compare with `lt`, never `lte`. */
  endInstantExclusive: Date;
  /** `from` as midnight UTC. Use with `@db.Date` columns. */
  startDate: Date;
  /** The day after `to`, as midnight UTC. Compare with `lt`. */
  endDateExclusive: Date;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Thrown for input a client controls, so the route can answer 400. */
export class ReportPeriodError extends Error {
  constructor(readonly field: 'from' | 'to' | 'range', message: string) {
    super(message);
    this.name = 'ReportPeriodError';
  }
}

/**
 * Minutes that `timezone` is ahead of UTC at `instant`.
 *
 * Derived by asking Intl what the wall clock reads there and subtracting, which
 * is the only way to get it right across DST without a timezone library.
 */
function offsetMinutesAt(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Some ICU versions render midnight as hour 24.
  const wallAsUtc = Date.UTC(
    part('year'), part('month') - 1, part('day'),
    part('hour') % 24, part('minute'), part('second'),
  );
  return Math.round((wallAsUtc - instant.getTime()) / 60000);
}

/**
 * The instant at which `YYYY-MM-DD` begins in `timezone`.
 *
 * Two passes: guess using the offset at UTC midnight, then re-check the offset
 * at the guessed instant. They differ only around a DST transition, and the
 * second answer is the one that belongs to the day being asked about.
 */
export function startOfLocalDay(dateStr: string, timezone: string): Date {
  const utcMidnight = Date.parse(`${dateStr}T00:00:00Z`);
  const firstGuess = new Date(utcMidnight - offsetMinutesAt(new Date(utcMidnight), timezone) * 60000);
  const settled = new Date(utcMidnight - offsetMinutesAt(firstGuess, timezone) * 60000);
  return settled;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function midnightUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  // Rejects 2026-02-30, which the pattern alone lets through.
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The resort's current calendar date as `YYYY-MM-DD`. */
export function localDateToday(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export interface ResolveReportPeriodInput {
  from: string;
  to: string;
  timezone?: string | null;
  kind?: ReportPeriodKind;
  /** Injectable so tests do not depend on the clock. */
  now?: Date;
}

/**
 * Validate a client-supplied range and build the period once, for every query
 * in the report to share.
 *
 * Dates are never silently swapped or clamped: a reversed range is the caller's
 * mistake to see, not something to guess at.
 */
export function resolveReportPeriod(input: ResolveReportPeriodInput): ReportPeriod {
  const timezone = input.timezone || DEFAULT_REPORT_TIMEZONE;
  const { from, to } = input;

  if (!isValidDateString(from)) {
    throw new ReportPeriodError('from', 'Start date must be a real date in YYYY-MM-DD form.');
  }
  if (!isValidDateString(to)) {
    throw new ReportPeriodError('to', 'End date must be a real date in YYYY-MM-DD form.');
  }
  if (to < from) {
    throw new ReportPeriodError('to', 'End date must be the same as or after start date.');
  }

  const todayLocal = localDateToday(timezone, input.now ?? new Date());
  if (from > todayLocal || to > todayLocal) {
    throw new ReportPeriodError('range', 'A report cannot cover a date in the future.');
  }

  const startDate = midnightUtc(from);
  const endDateExclusive = addUtcDays(midnightUtc(to), 1);
  const dayCount = Math.round(
    (endDateExclusive.getTime() - startDate.getTime()) / 86_400_000,
  );

  if (dayCount > MAX_REPORT_DAYS) {
    throw new ReportPeriodError(
      'range',
      `A report may cover at most ${MAX_REPORT_DAYS} days. Choose a smaller range or use export.`,
    );
  }

  // The end instant is the start of the day *after* `to`, so the interval is
  // half-open and a 23- or 25-hour DST day is covered exactly.
  const startInstant = startOfLocalDay(from, timezone);
  const endInstantExclusive = startOfLocalDay(
    addUtcDays(midnightUtc(to), 1).toISOString().slice(0, 10),
    timezone,
  );

  return {
    kind: input.kind ?? (from === to ? 'daily' : 'custom'),
    from, to, timezone, dayCount,
    startInstant, endInstantExclusive,
    startDate, endDateExclusive,
  };
}

/** The Monday–Sunday week that `dateStr` falls in. */
export function weekContaining(dateStr: string): { from: string; to: string } {
  const date = midnightUtc(dateStr);
  // getUTCDay: Sunday is 0, so Monday-based index needs Sunday treated as 6.
  const mondayBasedIndex = (date.getUTCDay() + 6) % 7;
  const monday = addUtcDays(date, -mondayBasedIndex);
  const sunday = addUtcDays(monday, 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}
