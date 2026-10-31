/**
 * Whether availability offers rooms the resort cannot actually hand over.
 *
 * Both availability queries — the dashboard's and the public website's —
 * excluded `MAINTENANCE` and nothing else. They never required the room to be
 * `AVAILABLE`. The audit marked a room `CLEANING`, asked for immediate
 * availability, and got that room back in a 200, so walk-in, the booking modal
 * and a guest on the website could all be offered an unclean, held or
 * manually-occupied room. (Room Management QA 2026-10-28, RM-003.)
 *
 * The rule now lives in one place, utils/room-saleability.ts: **status decides
 * today, bookings decide the calendar.** `MAINTENANCE` is out of order with no
 * end date and is never offered; `CLEANING` / `OCCUPIED` / `RESERVED` describe
 * this moment, so they block a stay starting today and nothing further out.
 *
 * That second half is not a detail, and half of these tests are about it. A
 * room dirty this afternoon is clean tomorrow, and `RESERVED` is stamped on a
 * room by a group booking that already wrote real booking rows for its dates
 * — so a blanket "must be AVAILABLE" would have taken rooms off sale for
 * weeks of dates nothing was holding. These tests pin the refusals and the
 * nights that must stay sellable, on both channels.
 *
 * One guard here is reasoned rather than measured. The rule reads `checkIn`'s
 * *UTC* date parts, not the server's local ones, so the day it lands on does
 * not depend on where the server is. A test once covered that by sending a
 * late-evening timestamp, but utils/stay-dates.ts now refuses anything that is
 * not a bare `YYYY-MM-DD` (RM-006), so every date that reaches the rule is
 * already midnight UTC and the two readings agree — except on a server west of
 * UTC, which this suite cannot create. The refusal itself is covered by
 * stay-date-contract.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-sale-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

/** The timezone a tenant gets by default, and so the one these dates mean. */
const RESORT_TZ = 'Asia/Dhaka';

/**
 * `offset` days from the resort's own today, as the YYYY-MM-DD the endpoints
 * take.
 *
 * Deliberately not UTC. The rule under test turns on where the resort's day
 * ends (utils/tenant-day.ts), and for the first six hours of a Dhaka day the
 * UTC date is still yesterday — so a UTC-dated "today" lands a day *before*
 * the boundary instead of on it, and the suite stops testing the boundary at
 * all between midnight and 6am. Found exactly that way: moving the comparison
 * off `<=` by one day left all thirteen tests green.
 */
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
      number: `${300 + n++}`, name: 'Saleability Room', type: 'STANDARD',
      maxOccupancy: 2, basePrice: 3000,
    },
  });
  if (res.statusCode !== 201) throw new Error(`room fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

const setStatus = async (roomId: string, status: string) => {
  const res = await app.inject({
    method: 'PATCH', url: `/api/rooms/${roomId}/status`,
    headers: auth(), payload: { status },
  });
  if (res.statusCode !== 200) throw new Error(`status fixture failed: ${res.body}`);
};

/** Room ids the dashboard would offer for a stay of `nights` from `from`. */
const offered = async (from: number, nights = 2) => {
  const res = await app.inject({
    method: 'GET', headers: auth(),
    url: `/api/rooms/availability?checkIn=${dateStr(from)}&checkOut=${dateStr(from + nights)}`,
  });
  expect(res.statusCode).toBe(200);
  return (body(res).data as { id: string }[]).map(r => r.id);
};

/** The same question asked by a guest on the public website. */
const offeredToGuest = async (from: number, nights = 2) => {
  const res = await app.inject({
    method: 'GET',
    url: `/site/${run}/availability?checkIn=${dateStr(from)}&checkOut=${dateStr(from + nights)}`,
  });
  expect(res.statusCode).toBe(200);
  return (body(res).data as { id: string }[]).map(r => r.id);
};

const makeBooking = async (roomId: string, from: number, nights = 2) => {
  const res = await app.inject({
    method: 'POST', url: '/api/bookings', headers: auth(),
    payload: {
      roomId,
      guestFirstName: 'Booked', guestLastName: 'Guest',
      guestPhone: `019000${String(n++).padStart(5, '0')}`,
      checkIn: dateStr(from), checkOut: dateStr(from + nights),
      adults: 1, children: 0, paymentMethod: 'CASH',
    },
  });
  if (res.statusCode !== 201) throw new Error(`booking fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Saleability', slug: run,
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
});

describe('a stay starting today', () => {
  it('is not offered a room that is being cleaned', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'CLEANING');

    expect(await offered(0)).not.toContain(roomId);
  });

  it('is not offered a room someone marked Occupied by hand', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'OCCUPIED');

    expect(await offered(0)).not.toContain(roomId);
  });

  it('is not offered a room that is Reserved', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'RESERVED');

    expect(await offered(0)).not.toContain(roomId);
  });

  it('is still not offered a room in Maintenance', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'MAINTENANCE');

    expect(await offered(0)).not.toContain(roomId);
  });

  it('is offered a room that is Available', async () => {
    const roomId = await makeRoom();

    expect(await offered(0)).toContain(roomId);
  });
});

describe('a stay starting later', () => {
  it('is offered a room that is only dirty today', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'CLEANING');

    // Housekeeping will have been round long before this stay begins, and
    // holding the night back would cost the resort a room it can sell.
    expect(await offered(0)).not.toContain(roomId);
    expect(await offered(14)).toContain(roomId);
  });

  it('is offered that dirty room from tomorrow onwards, not a day later', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'CLEANING');

    // The boundary itself, at a distance of one day either side of it: today's
    // night is withheld and tomorrow's is not. Stated separately because a
    // fourteen-day gap says nothing about where the line actually falls.
    expect(await offered(0, 1)).not.toContain(roomId);
    expect(await offered(1, 1)).toContain(roomId);
  });

  it('is offered a Reserved room for the dates the group is not holding', async () => {
    const roomId = await makeRoom();
    const res = await app.inject({
      method: 'POST', url: '/api/group-bookings', headers: auth(),
      payload: {
        name: 'Saleability Group', contactName: 'Group Lead',
        contactEmail: `group-${run}@test.com`, eventType: 'CORPORATE',
        checkIn: dateStr(60), checkOut: dateStr(62),
        // guestEmail, not just a name — the route skips a room whose guest it
        // cannot resolve, and would create the group with no bookings at all.
        bookings: [{
          roomId, guestFirstName: 'Group', guestLastName: 'Guest',
          guestEmail: `group-guest-${run}@test.com`, adults: 1,
        }],
      },
    });
    expect(res.statusCode).toBe(201);

    // The group booking stamps the room RESERVED *and* writes a CONFIRMED
    // booking for its own dates. The booking is what holds those nights; the
    // label must not reach past them.
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { status: true } });
    expect(room?.status).toBe('RESERVED');

    expect(await offered(60)).not.toContain(roomId);
    expect(await offered(80)).toContain(roomId);
  }, 20000);

  it('is never offered a room in Maintenance, however far out', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'MAINTENANCE');

    expect(await offered(14)).not.toContain(roomId);
    expect(await offered(120)).not.toContain(roomId);
  });
});

describe('the dates still decide', () => {
  it('is not offered an Available room whose nights are taken', async () => {
    const roomId = await makeRoom();
    await makeBooking(roomId, 30);

    expect(await offered(30)).not.toContain(roomId);
  });

  it('is offered that same room once the booking has ended', async () => {
    const roomId = await makeRoom();
    await makeBooking(roomId, 40);

    expect(await offered(40)).not.toContain(roomId);
    expect(await offered(45)).toContain(roomId);
  });
});

describe('the public website answers the same way', () => {
  it('does not offer a guest tonight a room that is being cleaned', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'CLEANING');

    expect(await offeredToGuest(0)).not.toContain(roomId);
  });

  it('offers that room to a guest for a stay next month', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'CLEANING');

    expect(await offeredToGuest(35)).toContain(roomId);
  });

  it("counts a room being cleaned as taken on today's calendar cell", async () => {
    const roomId = await makeRoom();
    const month = dateStr(0).slice(0, 7);
    const today = dateStr(0);

    const read = async () => {
      const res = await app.inject({ method: 'GET', url: `/site/${run}/availability/calendar?month=${month}` });
      expect(res.statusCode).toBe(200);
      return body(res).data.days[today] as { available: number; total: number };
    };

    const before = await read();
    await setStatus(roomId, 'CLEANING');
    const after = await read();

    // One fewer room on offer today, out of the same inventory — otherwise the
    // calendar promises a night that the availability endpoint beside it
    // refuses to show.
    expect(after.available).toBe(before.available - 1);
    expect(after.total).toBe(before.total);
  });
});
