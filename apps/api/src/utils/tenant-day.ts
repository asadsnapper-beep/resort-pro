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
