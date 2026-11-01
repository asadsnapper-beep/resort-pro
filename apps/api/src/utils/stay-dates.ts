import { z } from 'zod';

/**
 * The date half of a stay, read the same way by everything that takes one.
 *
 * Four endpoints each parsed these by hand, and each got it wrong differently
 * (Room Management QA 2026-10-28, RM-006). `GET /api/rooms/availability`
 * checked nothing at all: a reversed range answered 200 with `success: true`,
 * a missing date answered 200 with `success: false` — which any client reading
 * the status code, caches among them, treats as a successful answer — and text
 * that is not a date at all produced an `Invalid Date`, which reached Prisma
 * and came back a 500.
 *
 * The booking routes were worse, in a way the report did not reach. Their
 * dates were `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`, and a regex only
 * checks the shape. `new Date("2026-02-31")` is not an error in JavaScript, it
 * is the 3rd of March — so a guest who asked for the 31st of February was
 * written a real booking on a date nobody chose, priced for the nights it
 * happened to span. A leading space is the same trap from the other side:
 * `new Date(" 2026-11-01")` parses as *local* time, so east of UTC it is the
 * 31st of October.
 *
 * So: one calendar date in, one calendar date out, or a refusal carrying a
 * code the caller can branch on.
 *
 * What is deliberately **not** refused is a date in the past. The report asked
 * for it, and it would break real work: the front desk registers a guest who
 * turned up last night, and reporting screens ask about stays that are over.
 * Whether a stay may be *sold* for a given day is a different question, and
 * utils/room-saleability.ts answers that one.
 */

/** Exactly `YYYY-MM-DD`. Anything looser lets a timezone decide the day. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type StayDatesCode =
  | 'STAY_DATES_REQUIRED'
  | 'STAY_DATE_INVALID'
  | 'STAY_DATES_REVERSED';

export type StayDatesResult =
  | { ok: true;  checkIn: Date; checkOut: Date }
  | { ok: false; code: StayDatesCode; error: string };

const stayDatesSchema = z.object({
  checkIn:  z.string().min(1),
  checkOut: z.string().min(1),
});

/**
 * Read `checkIn` / `checkOut` off a query or body.
 *
 * On success both are midnight UTC of the named date, which is the shape
 * Postgres hands back for the `@db.Date` columns they are compared against.
 */
export function parseStayDates(input: unknown): StayDatesResult {
  const parsed = stayDatesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'STAY_DATES_REQUIRED',
      error: 'checkIn and checkOut are required, as YYYY-MM-DD dates',
    };
  }

  const checkIn  = calendarDate(parsed.data.checkIn);
  const checkOut = calendarDate(parsed.data.checkOut);
  if (!checkIn || !checkOut) {
    return {
      ok: false,
      code: 'STAY_DATE_INVALID',
      error: 'checkIn and checkOut must be real calendar dates, written as YYYY-MM-DD',
    };
  }

  if (checkOut.getTime() <= checkIn.getTime()) {
    return {
      ok: false,
      code: 'STAY_DATES_REVERSED',
      error: 'checkOut must be a later date than checkIn',
    };
  }

  return { ok: true, checkIn, checkOut };
}

/** `YYYY-MM-DD` as midnight UTC, or null if it is not that day. */
function calendarDate(value: string): Date | null {
  // States the contract, and keeps obvious rubbish away from the `Date`
  // constructor. It is not what makes this correct: the round-trip below
  // rejects everything this would, because a ten-character result cannot
  // equal a longer input. Loosening this regex does not fail a single test.
  if (!CALENDAR_DATE.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  // This is the real guard. `Date` does not refuse a day its month does not
  // have — it rolls over into the next one, which is how the 31st of February
  // became the 3rd of March — so the only way to know it kept the date it was
  // given is to ask for it back.
  return date.toISOString().slice(0, 10) === value ? date : null;
}
