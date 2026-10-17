/**
 * "Today" for a resort, in the form a `@db.Date` column can actually be
 * compared against.
 *
 * `Booking.checkIn` / `checkOut` are `DateTime @db.Date` — Postgres stores a
 * calendar date with no time. Comparing one against a local-midnight timestamp
 * silently goes wrong east of UTC: in Asia/Dhaka (UTC+6) local midnight is
 * 18:00 UTC the previous day, so a range of `[local midnight, local midnight
 * tomorrow)` excludes today's own date and the count comes back zero. That is
 * exactly why the dashboard reported 0 arrivals and 0 departures every day for
 * every Bangladeshi resort while the bookings sat there in the table.
 *
 * Taking the UTC calendar date instead is not a fix either: between 00:00 and
 * 06:00 Dhaka time the UTC date is still yesterday, so the night shift — the
 * people most likely to be looking — would be handed yesterday's arrivals.
 *
 * So the day is resolved in the resort's own timezone, then expressed as
 * midnight UTC of that date, which is how Postgres hands back a `date`.
 */

/** The resort's current calendar date, as midnight UTC of that date. */
export function tenantToday(timezone = 'Asia/Dhaka'): Date {
  return startOfTenantDay(new Date(), timezone);
}

/** The calendar date `instant` falls on in `timezone`, as midnight UTC. */
export function startOfTenantDay(instant: Date, timezone = 'Asia/Dhaka'): Date {
  // en-CA formats as YYYY-MM-DD, so the parts come out unambiguous.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

/** `offset` days from the resort's today, as midnight UTC. Negative looks back. */
export function tenantDayOffset(offset: number, timezone = 'Asia/Dhaka'): Date {
  const day = tenantToday(timezone);
  day.setUTCDate(day.getUTCDate() + offset);
  return day;
}

/**
 * Half-open range covering the resort's current day: `{ gte: start, lt: end }`.
 * Half-open rather than `lte` so a booking on the following date can never be
 * counted twice at the boundary.
 */
export function tenantTodayRange(timezone = 'Asia/Dhaka'): { gte: Date; lt: Date } {
  return { gte: tenantToday(timezone), lt: tenantDayOffset(1, timezone) };
}

/**
 * The wall-clock time of `instant` in `timezone`, as minutes past midnight.
 *
 * Policy windows are wall-clock strings — a resort says "free after 11:00",
 * meaning 11:00 where the resort is. Comparing those against server-local time
 * would price a guest by the hour in Virginia.
 */
export function tenantWallMinutes(instant: Date, timezone = 'Asia/Dhaka'): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // en-GB renders midnight as 24:00 in some ICU versions; normalise it to 0.
  return (part('hour') % 24) * 60 + part('minute');
}

/**
 * Minutes `timezone` is ahead of UTC at `instant`. Dhaka is +360.
 *
 * Derived from how the zone renders that instant rather than from a table, so
 * it is right across a DST change without pulling in a timezone database.
 */
export function tenantOffsetMinutes(instant: Date, timezone = 'Asia/Dhaka'): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Some ICU versions render midnight as hour 24 of the previous day.
  const hour = part('hour') % 24;
  const asUtc = Date.UTC(part('year'), part('month') - 1, part('day'), hour, part('minute'));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The first of the resort's current month, as midnight UTC of that date.
 *
 * For `@db.Date` columns — `Expense.date` stores a calendar date with no time,
 * and Postgres hands it back as midnight UTC, so this is what it compares
 * against.
 */
export function tenantMonthStartDate(timezone = 'Asia/Dhaka'): Date {
  const today = tenantToday(timezone);
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
}

/**
 * The instant the resort's current month began — local midnight on the 1st.
 *
 * For timestamp columns. `Payment.processedAt` is a real point in time, and
 * midnight UTC on the 1st is six hours late in Dhaka: every taka taken on the
 * first evening of the month would fall outside "this month".
 */
export function tenantMonthStartInstant(timezone = 'Asia/Dhaka'): Date {
  const first = tenantMonthStartDate(timezone);
  return new Date(first.getTime() - tenantOffsetMinutes(first, timezone) * 60_000);
}
