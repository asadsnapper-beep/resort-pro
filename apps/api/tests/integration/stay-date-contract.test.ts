/**
 * What the four stay-date endpoints do with dates that are not dates.
 *
 * `GET /api/rooms/availability` built `new Date(...)` straight from the query
 * string and checked nothing. A reversed range answered 200 with
 * `success: true`; missing dates answered 200 with `success: false`, which a
 * client reading the status code treats as a successful call.
 * (Room Management QA 2026-10-28, RM-006.)
 *
 * The booking routes were worse than the report found. Their `checkIn` was
 * `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`, which only checks the *shape* —
 * and `new Date("2026-02-31")` is not an error in JavaScript, it is the 3rd of
 * March. So a guest asking for the 31st of February was given a real booking
 * on a different date. A leading space is the same kind of trap: `new Date("
 * 2026-11-01")` parses as local time and lands on 31 October east of UTC.
 *
 * All four now share utils/stay-dates.ts and refuse with 400 and a stable
 * `code`. Past dates are deliberately still accepted — the front desk
 * registers guests who arrived last night, and the walk-in modal is currently
 * capable of sending yesterday's date on its own.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `stay-dates-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let roomId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

const availability = (checkIn: string, checkOut?: string) => {
  const q = new URLSearchParams({ checkIn, ...(checkOut === undefined ? {} : { checkOut }) });
  return app.inject({ method: 'GET', url: `/api/rooms/availability?${q}`, headers: auth() });
};

const publicAvailability = (checkIn: string, checkOut: string) => {
  const q = new URLSearchParams({ checkIn, checkOut });
  return app.inject({ method: 'GET', url: `/site/${run}/availability?${q}` });
};

let phone = 0;
const createBooking = (checkIn: string, checkOut: string) =>
  app.inject({
    method: 'POST', url: '/api/bookings', headers: auth(),
    payload: {
      roomId, guestFirstName: 'Date', guestLastName: 'Tester',
      guestPhone: `0170100${String(phone++).padStart(4, '0')}`,
      checkIn, checkOut, adults: 1, children: 0, paymentMethod: 'CASH',
    },
  });

const publicBook = (checkIn: string, checkOut: string) =>
  app.inject({
    method: 'POST', url: `/site/${run}/book`,
    payload: {
      firstName: 'Public', lastName: 'Guest',
      email: `public-${phone++}-${run}@test.com`,
      roomId, checkIn, checkOut, adults: 1,
    },
  });

const bookingCount = () => prisma.booking.count({ where: { tenantId } });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Stay Date Contract', slug: run,
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

  const room = await app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: { number: '401', name: 'Date Room', type: 'STANDARD', maxOccupancy: 2, basePrice: 2000 },
  });
  if (room.statusCode !== 201) throw new Error(`room fixture failed: ${room.body}`);
  roomId = body(room).data.id;
}, 40000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('availability refuses what it cannot answer', () => {
  it('refuses a missing checkOut with a 4xx, not a 200 saying it failed', async () => {
    const res = await availability('2027-03-01');

    // The old handler returned 200 with `success: false` in the body. A client
    // that checks the status code — every HTTP cache among them — read that as
    // a successful availability answer.
    expect(res.statusCode).toBe(400);
    expect(body(res).success).toBe(false);
    expect(body(res).code).toBe('STAY_DATES_REQUIRED');
  });

  it('refuses a reversed range', async () => {
    const res = await availability('2027-12-10', '2027-12-01');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATES_REVERSED');
  });

  it('refuses a zero-night stay', async () => {
    const res = await availability('2027-12-10', '2027-12-10');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATES_REVERSED');
  });

  it('refuses the 31st of February instead of answering for the 3rd of March', async () => {
    const res = await availability('2026-02-31', '2026-03-05');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATE_INVALID');
  });

  it.each([
    ['a month that does not exist', '2026-13-01'],
    ['free text',                   'garbage'],
    ['a leading space',             ' 2027-03-01'],
    ['a full timestamp',            '2027-03-01T20:00:00Z'],
    ['a slashed date',              '2027/03/01'],
  ])('refuses %s', async (_label, checkIn) => {
    const res = await availability(checkIn, '2027-04-01');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATE_INVALID');
  });

  it('still answers an ordinary range', async () => {
    const res = await availability('2027-03-01', '2027-03-03');

    expect(res.statusCode).toBe(200);
    expect(body(res).success).toBe(true);
  });

  it('still answers for a stay that began in the past', async () => {
    // Deliberate. The desk registers a guest who arrived last night, and the
    // walk-in modal can send yesterday's date by itself.
    const res = await availability('2020-01-01', '2020-01-03');

    expect(res.statusCode).toBe(200);
    expect(body(res).success).toBe(true);
  });
});

describe('the public site refuses the same things', () => {
  it('refuses the 31st of February', async () => {
    const res = await publicAvailability('2026-02-31', '2026-03-05');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATE_INVALID');
  });

  it('refuses a reversed range with the same code as the dashboard', async () => {
    const res = await publicAvailability('2027-12-10', '2027-12-01');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATES_REVERSED');
  });

  it('still answers an ordinary range', async () => {
    const res = await publicAvailability('2027-03-01', '2027-03-03');

    expect(res.statusCode).toBe(200);
    expect(body(res).success).toBe(true);
  });
});

describe('a booking is never written for a date nobody asked for', () => {
  it('refuses to book the 31st of February, and writes nothing', async () => {
    const before = await bookingCount();
    const res = await createBooking('2026-02-31', '2026-03-05');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATE_INVALID');
    // The shape-only regex let this through, and `new Date("2026-02-31")` is
    // the 3rd of March — so the guest was given a booking on a date they did
    // not ask for, at a price for the nights it happened to span.
    expect(await bookingCount()).toBe(before);
  });

  it('refuses a reversed range with a code', async () => {
    const res = await createBooking('2027-12-10', '2027-12-01');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATES_REVERSED');
  });

  it('still books an ordinary range', async () => {
    const res = await createBooking('2027-06-01', '2027-06-03');

    expect(res.statusCode).toBe(201);
    expect(body(res).data.id).toBeTruthy();
  });

  it('refuses the same date on the public booking form', async () => {
    const before = await bookingCount();
    const res = await publicBook('2026-02-31', '2026-03-05');

    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('STAY_DATE_INVALID');
    expect(await bookingCount()).toBe(before);
  });
});
