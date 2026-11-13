/**
 * "Today" for a resort, in the browser.
 *
 * The client had two ways of asking what day it is, and both were wrong for a
 * resort. `new Date().toISOString().split('T')[0]` takes the UTC date, which
 * between midnight and 6am in Asia/Dhaka is still yesterday — the Walk-In
 * modal handed the night shift yesterday's check-in date. `toLocaleDateString`
 * takes the date where the *browser* is, which is the receptionist's laptop,
 * not the resort: a resort in America/New_York administered from Dhaka saw
 * tomorrow's date in its Front Desk header.
 *
 * The day belongs to the resort, so it is resolved in `Tenant.timezone`. This
 * is the client half of `apps/api/src/utils/tenant-day.ts` — the comment at the
 * top of that file is the long version of why. It matters beyond cosmetics:
 * availability now turns on the resort's own day, so a default date a day out
 * asks the API about the wrong day's rooms.
 */

/** The resort's current calendar date, as `YYYY-MM-DD`. */
export function resortToday(timezone?: string | null): string {
  return resortDateOf(new Date(), timezone);
}

/** The calendar date `instant` falls on at the resort, as `YYYY-MM-DD`. */
export function resortDateOf(instant: Date, timezone?: string | null): string {
  try {
    return dateIn(instant, timezone || undefined);
  } catch {
    // `Tenant.timezone` is a free-text column and `Intl` throws on a value it
    // does not recognise; a signed-in session from before the server started
    // sending it has none at all. Either way the browser's own zone is a far
    // better guess than UTC, and the page still renders.
    return dateIn(instant, undefined);
  }
}

/** The day after a `YYYY-MM-DD` date, as `YYYY-MM-DD`. */
export function resortDayAfter(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return date;
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/**
 * A `YYYY-MM-DD` date, written out for a human.
 *
 * Deliberately not `new Date(date).toLocaleDateString()`: a date-only string
 * parses as midnight UTC, so formatting it in the browser's zone prints the
 * previous day everywhere west of UTC. The date is already the resort's — it
 * only has to be spelled out, not converted.
 */
export function formatResortDate(
  date: string,
  locale = 'en-BD',
  options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
): string {
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return date;
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(day);
}

function dateIn(instant: Date, timeZone: string | undefined): string {
  // en-CA renders YYYY-MM-DD, so the parts come out unambiguous.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
