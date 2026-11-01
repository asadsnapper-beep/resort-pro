/**
 * Whether the room detail still shows the guest who is actually in the room.
 *
 * `GET /api/rooms/:id` labels its booking "Currently Occupied", but looked it
 * up with `checkOut >= now`. A guest who stays past their scheduled checkout
 * therefore vanished from the room detail while the booking was still
 * `CHECKED_IN` — staff saw an Occupied room with nobody in it, and were
 * invited to force its status while somebody was still upstairs.
 * (Room Management QA 2026-10-28, RM-008.)
 *
 * A guess that turned out to be wrong is worth recording, because it shaped
 * these tests. `checkOut` is `DateTime @db.Date` and `now` is a full
 * timestamp, which looked like it would drop the guest at one minute past
 * midnight on their own checkout day. It does not: Postgres coerces the
 * parameter to `date` and the time is truncated away, so the comparison is
 * date-against-date and departure day is safe. What that truncation leaves
 * behind is a *UTC* day, not the resort's, so east of UTC an overdue guest
 * reappears for the first six hours of each morning and then vanishes again.
 * The rule below uses the resort's own day, as RM-003 and RM-006 do.
 *
 * The clock matters so much here that this file pins it — see FROZEN_AT.
 *
 * The rule now matches what the words mean. A `CHECKED_IN` booking is the
 * current one because somebody is in the room, whatever the calendar says, and
 * no date window is applied to it. The window applies only to arrivals still
 * to come. Overstays are counted and reported rather than hidden.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-overstay-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

/** The timezone a tenant gets by default, and so the one these dates mean. */
const RESORT_TZ = 'Asia/Dhaka';

/**
 * The clock is pinned, because the bug is a clock bug.
 *
 * `checkOut >= now` compares a date stored as midnight UTC against a full
 * timestamp, so whether it holds depends on the hour the suite happens to run
 * at. Written against the unmodified code at 03:00 Dhaka — 21:00 UTC the
 * previous day — the checkout-day cases passed, and would have failed six
 * hours later. A test that changes its mind over breakfast is worse than no
 * test, so the whole file runs at a fixed, ordinary working hour: noon UTC,
 * which is six in the evening where the resort is.
 */
const FROZEN_AT = (() => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESORT_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return new Date(`${today}T12:00:00.000Z`);
})();

const dateStr = (offset: number) => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESORT_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split('T')[0];
};

let n = 0;
const makeRoom = async () => {
  const res = await app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: {
      number: `${600 + n++}`, name: 'Overstay Room', type: 'STANDARD',
      maxOccupancy: 2, basePrice: 2500,
    },
  });
  if (res.statusCode !== 201) throw new Error(`room fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

/** `from`/`to` are day offsets from the resort's today. */
const makeBooking = async (roomId: string, from: number, to: number, last = 'Guest') => {
  const res = await app.inject({
    method: 'POST', url: '/api/bookings', headers: auth(),
    payload: {
      roomId,
      guestFirstName: 'Stay', guestLastName: last,
      // Spelled out because the clock is frozen: left to itself the route
      // synthesises a walk-in address from the current millisecond, and with
      // a fixed clock two fixtures can land on the same one.
      guestEmail: `stay-${n}-${run}@test.com`,
      guestPhone: `016000${String(n++).padStart(5, '0')}`,
      checkIn: dateStr(from), checkOut: dateStr(to),
      adults: 1, children: 0, paymentMethod: 'CASH',
    },
  });
  if (res.statusCode !== 201) throw new Error(`booking fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

const checkIn = async (bookingId: string) => {
  const res = await app.inject({
    method: 'PATCH', url: `/api/bookings/${bookingId}/check-in`, headers: auth(), payload: {},
  });
  if (res.statusCode !== 200) throw new Error(`check-in fixture failed: ${res.body}`);
};

type CurrentBooking = {
  id: string; status: string; checkOut: string;
  overdueNights: number; dueOutToday: boolean;
  guest: { firstName: string; lastName: string };
} | null;

const detail = async (roomId: string) => {
  const res = await app.inject({ method: 'GET', url: `/api/rooms/${roomId}`, headers: auth() });
  expect(res.statusCode).toBe(200);
  return body(res).data as { status: string; currentBooking: CurrentBooking };
};

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(FROZEN_AT);

  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Overstay', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  tenantId = body(reg).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'ENTERPRISE', planStatus: 'active' },
  });
  await applyPlanFlagsToTenant(tenantId, 'ENTERPRISE');
}, 40000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
  vi.useRealTimers();
});

describe('a guest who is still in the room', () => {
  it('is shown even though their checkout was days ago', async () => {
    // The finding. The room reads Occupied and the booking is CHECKED_IN; the
    // only thing that had changed is that a date passed.
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, -5, -2, 'Overdue');
    await checkIn(bookingId);

    const { currentBooking } = await detail(roomId);

    expect(currentBooking).not.toBeNull();
    expect(currentBooking!.id).toBe(bookingId);
    expect(currentBooking!.status).toBe('CHECKED_IN');
  });

  it('is shown on the morning of their own checkout day', async () => {
    // Not overdue — simply leaving today. This one already worked, and is
    // kept as the boundary on the safe side of the rule: the fix must not
    // start hiding a guest a day early in the course of showing one a day
    // late.
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, -2, 0, 'Leaving');
    await checkIn(bookingId);

    const { currentBooking } = await detail(roomId);

    expect(currentBooking).not.toBeNull();
    expect(currentBooking!.id).toBe(bookingId);
  });

  it('is shown mid-stay, as it always was', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, -1, 3, 'Midstay');
    await checkIn(bookingId);

    const { currentBooking } = await detail(roomId);

    expect(currentBooking!.id).toBe(bookingId);
  });

  it('names the guest, which is the whole point of the panel', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, -4, -1, 'Rahman');
    await checkIn(bookingId);

    const { currentBooking } = await detail(roomId);

    expect(currentBooking!.guest.lastName).toBe('Rahman');
  });
});

describe('the overstay is counted, not hidden', () => {
  it('reports how many nights past checkout the guest is', async () => {
    const roomId = await makeRoom();
    await checkIn(await makeBooking(roomId, -5, -2, 'Three'));

    const { currentBooking } = await detail(roomId);

    expect(currentBooking!.overdueNights).toBe(2);
    expect(currentBooking!.dueOutToday).toBe(false);
  });

  it('calls a guest leaving today due out, not overdue', async () => {
    // Flagging an overstay at breakfast on departure day would cry wolf, and
    // a desk that learns to ignore the warning is worse off than before.
    const roomId = await makeRoom();
    await checkIn(await makeBooking(roomId, -2, 0, 'Today'));

    const { currentBooking } = await detail(roomId);

    expect(currentBooking!.overdueNights).toBe(0);
    expect(currentBooking!.dueOutToday).toBe(true);
  });

  it('flags neither for a guest with nights still to run', async () => {
    const roomId = await makeRoom();
    await checkIn(await makeBooking(roomId, -1, 4, 'Staying'));

    const { currentBooking } = await detail(roomId);

    expect(currentBooking!.overdueNights).toBe(0);
    expect(currentBooking!.dueOutToday).toBe(false);
  });
});

describe('whose day it is', () => {
  it("counts the overstay in the resort's day, not the server's", async () => {
    /**
     * Between midnight and 6am in Dhaka the UTC date is still yesterday. A
     * rule that reads the UTC day would tell the night shift — the people
     * most likely to be looking — that a guest who should have left
     * yesterday is leaving today, every single night for six hours.
     * utils/tenant-day.ts exists for exactly this; see RM-003 and RM-006.
     */
    const roomId = await makeRoom();
    const leavesToday = dateStr(0);
    await checkIn(await makeBooking(roomId, -2, 0, 'NightShift'));

    // 21:00 UTC on that date is 03:00 the next morning where the resort is,
    // so the resort has rolled over to a new day and UTC has not.
    vi.setSystemTime(new Date(`${leavesToday}T21:00:00.000Z`));
    try {
      const { currentBooking } = await detail(roomId);

      expect(currentBooking!.overdueNights).toBe(1);
      expect(currentBooking!.dueOutToday).toBe(false);
    } finally {
      vi.setSystemTime(FROZEN_AT);
    }
  });
});

describe('bookings that are not a guest in the room', () => {
  it('still shows an arrival due within the week', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, 3, 5, 'Arriving');

    const { currentBooking } = await detail(roomId);

    expect(currentBooking!.id).toBe(bookingId);
    expect(currentBooking!.status).toBe('CONFIRMED');
    expect(currentBooking!.overdueNights).toBe(0);
  });

  it('does not show an arrival a month out', async () => {
    const roomId = await makeRoom();
    await makeBooking(roomId, 30, 32, 'Later');

    const { currentBooking } = await detail(roomId);

    expect(currentBooking).toBeNull();
  });

  it('does not show a confirmed no-show whose last day is today', async () => {
    // The boundary of the upcoming window. A stay ending today is over —
    // tonight is sellable — so `checkOut > today`, not `>=`. Nobody ever
    // checked in, so there is no guest to keep showing either.
    const roomId = await makeRoom();
    await makeBooking(roomId, -2, 0, 'EndsToday');

    const { currentBooking } = await detail(roomId);

    expect(currentBooking).toBeNull();
  });

  it('does not show a confirmed booking whose dates have been and gone', async () => {
    // Nobody ever checked in. It is not the current booking; it is a no-show,
    // and the date window is what keeps it out.
    const roomId = await makeRoom();
    await makeBooking(roomId, -10, -8, 'NoShow');

    const { currentBooking } = await detail(roomId);

    expect(currentBooking).toBeNull();
  });

  it('does not show a guest who has checked out', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, -3, -1, 'Gone');
    await checkIn(bookingId);
    const out = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-out`, headers: auth(), payload: {},
    });
    expect(out.statusCode).toBe(200);

    const { currentBooking } = await detail(roomId);

    expect(currentBooking).toBeNull();
  });

  it('prefers the guest in the room over the next arrival', async () => {
    // Both match. The person upstairs is the one the panel is about, and
    // ordering by date alone would hand the panel to whoever happens to have
    // the earlier check-in.
    const roomId = await makeRoom();
    const staying = await makeBooking(roomId, -4, -1, 'Resident');
    await checkIn(staying);
    await makeBooking(roomId, 2, 4, 'Next');

    const { currentBooking } = await detail(roomId);

    expect(currentBooking!.id).toBe(staying);
    expect(currentBooking!.guest.lastName).toBe('Resident');
  });
});
