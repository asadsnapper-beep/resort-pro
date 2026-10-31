/**
 * Whether a room with a guest inside it can be made saleable again.
 *
 * `PATCH /api/rooms/:id/status` wrote whatever status it was handed, for
 * Owner, Manager and Receptionist alike, without looking at the bookings. The
 * audit checked a guest in and then set the same room back to Available in one
 * further request: the booking stayed CHECKED_IN and the call returned 200.
 * From there the room is saleable again — front desk can assign it, the
 * website can offer it, and the occupancy counts, housekeeping lists and
 * availability queries all read from the same lie.
 * (Room Management QA 2026-10-28, RM-001.)
 *
 * The guard is deliberately narrow: while a booking on the room is CHECKED_IN,
 * the only accepted status is OCCUPIED. These tests pin both halves of that —
 * that the contradiction is refused and nothing is written, and that ordinary
 * status work on rooms without a guest is untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-status-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let receptionistToken: string;
let tenantId: string;

const auth = (token = ownerToken) => ({ Authorization: `Bearer ${token}` });
const body = (res: { body: string }) => JSON.parse(res.body);

let n = 0;
const makeRoom = async (over: Record<string, unknown> = {}) => {
  const res = await app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: {
      number: `${200 + n++}`, name: 'Guard Room', type: 'STANDARD',
      maxOccupancy: 2, basePrice: 2500, ...over,
    },
  });
  if (res.statusCode !== 201) throw new Error(`room fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

const setStatus = (roomId: string, status: string, token = ownerToken) =>
  app.inject({
    method: 'PATCH', url: `/api/rooms/${roomId}/status`,
    headers: auth(token), payload: { status },
  });

const storedStatus = (roomId: string) =>
  prisma.room.findUnique({ where: { id: roomId }, select: { status: true } })
    .then(r => r?.status ?? null);

const bookingStatus = (bookingId: string) =>
  prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } })
    .then(b => b?.status ?? null);

/** A booking on `roomId` for dates that do not collide with other fixtures. */
let dayOffset = 1;
const makeBooking = async (roomId: string, guest: { first: string; last: string }) => {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + dayOffset);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 2);
  dayOffset += 10;

  const res = await app.inject({
    method: 'POST', url: '/api/bookings', headers: auth(),
    payload: {
      roomId,
      guestFirstName: guest.first,
      guestLastName:  guest.last,
      guestPhone: `017000${String(n).padStart(5, '0')}`,
      checkIn:  checkIn.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0],
      adults: 2, children: 0, paymentMethod: 'CASH',
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

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Status Guard', slug: run,
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

  const bcrypt = await import('bcryptjs');
  await prisma.user.create({
    data: {
      tenantId, email: `reception-${run}@test.com`,
      passwordHash: await bcrypt.hash(password, 10),
      firstName: 'Front', lastName: 'Desk', role: 'RECEPTIONIST',
      emailVerifiedAt: new Date(),
    },
  });
  const login = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: `reception-${run}@test.com`, password, slug: run },
  });
  receptionistToken = body(login).data.token;
}, 40000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('a room with a guest checked into it', () => {
  it('refuses to be marked Available', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, { first: 'Rahim', last: 'Uddin' });
    await checkIn(bookingId);

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(409);
    expect(body(res).success).toBe(false);
    expect(body(res).code).toBe('ROOM_HAS_CHECKED_IN_GUEST');
  });

  it('names the guest and the booking, so the front desk knows who is inside', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, { first: 'Shirin', last: 'Akter' });
    await checkIn(bookingId);
    const confirmationNo = (await prisma.booking.findUnique({
      where: { id: bookingId }, select: { confirmationNo: true },
    }))!.confirmationNo;

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(body(res).error).toContain('Shirin Akter');
    expect(body(res).error).toContain(confirmationNo);
  });

  it('leaves the room Occupied in the database', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, { first: 'Karim', last: 'Hossain' });
    await checkIn(bookingId);

    await setStatus(roomId, 'AVAILABLE');

    expect(await storedStatus(roomId)).toBe('OCCUPIED');
  });

  it('leaves the booking checked in', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, { first: 'Nadia', last: 'Islam' });
    await checkIn(bookingId);

    await setStatus(roomId, 'AVAILABLE');

    expect(await bookingStatus(bookingId)).toBe('CHECKED_IN');
  });

  it.each(['CLEANING', 'MAINTENANCE', 'RESERVED'])(
    'refuses %s too, not only Available',
    async (status) => {
      const roomId = await makeRoom();
      const bookingId = await makeBooking(roomId, { first: 'Guest', last: status });
      await checkIn(bookingId);

      const res = await setStatus(roomId, status);

      expect(res.statusCode).toBe(409);
      expect(await storedStatus(roomId)).toBe('OCCUPIED');
    },
  );

  it('still accepts Occupied, which contradicts nothing', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, { first: 'Tanvir', last: 'Ahmed' });
    await checkIn(bookingId);

    const res = await setStatus(roomId, 'OCCUPIED');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('OCCUPIED');
  });

  it('lets Occupied repair a room whose status drifted away from its guest', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, { first: 'Drift', last: 'Case' });
    await checkIn(bookingId);
    // The state these rooms are already in on live data, written by the very
    // call this guard now refuses. Setting it back has to stay possible.
    await prisma.room.update({ where: { id: roomId }, data: { status: 'AVAILABLE' } });

    const res = await setStatus(roomId, 'OCCUPIED');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('OCCUPIED');
  });

  it('refuses a Receptionist as well — the guard is not about who is asking', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, { first: 'Front', last: 'Desk' });
    await checkIn(bookingId);

    const res = await setStatus(roomId, 'AVAILABLE', receptionistToken);

    expect(res.statusCode).toBe(409);
    expect(body(res).code).toBe('ROOM_HAS_CHECKED_IN_GUEST');
  });
});

describe('a room with no guest inside it', () => {
  it.each(['AVAILABLE', 'CLEANING', 'MAINTENANCE', 'RESERVED', 'OCCUPIED'])(
    'can still be set to %s',
    async (status) => {
      const roomId = await makeRoom();

      const res = await setStatus(roomId, status);

      expect(res.statusCode).toBe(200);
      expect(await storedStatus(roomId)).toBe(status);
    },
  );

  it('can be changed while holding a confirmed booking that has not arrived', async () => {
    const roomId = await makeRoom();
    await makeBooking(roomId, { first: 'Future', last: 'Arrival' });

    const res = await setStatus(roomId, 'CLEANING');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('CLEANING');
  });

  it('can be changed once the guest has checked out', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, { first: 'Departed', last: 'Guest' });
    await checkIn(bookingId);
    const out = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-out`, headers: auth(), payload: {},
    });
    expect(out.statusCode).toBe(200);

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('AVAILABLE');
  });

  it('is unaffected by another room having a guest in it', async () => {
    const occupied = await makeRoom();
    const bookingId = await makeBooking(occupied, { first: 'Other', last: 'Room' });
    await checkIn(bookingId);
    const free = await makeRoom();

    const res = await setStatus(free, 'AVAILABLE');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(free)).toBe('AVAILABLE');
  });
});

describe('the endpoint contract around the guard', () => {
  it('still answers 404 for a room this tenant does not have', async () => {
    const stranger = await prisma.tenant.create({ data: { name: 'Stranger', slug: `${run}-other` } });
    const theirRoom = await prisma.room.create({
      data: {
        tenantId: stranger.id, number: '901', name: 'Not Yours',
        type: 'STANDARD', maxOccupancy: 2, basePrice: 1000,
      },
    });

    const res = await setStatus(theirRoom.id, 'CLEANING');

    expect(res.statusCode).toBe(404);
    expect(await storedStatus(theirRoom.id)).toBe('AVAILABLE');
  });

  it('still rejects a status that is not one of the five', async () => {
    const roomId = await makeRoom();

    const res = await setStatus(roomId, 'SOLD');

    expect(res.statusCode).toBe(400);
  });
});

describe('a check-in racing a status change', () => {
  /**
   * The sequential hole is the one the audit reproduced, but the same lie can
   * be written by interleaving: the guard reads "no guest", a check-in commits,
   * and the stale write lands afterwards.
   *
   * Two arrival paths have to be ordered against the guard, so each gets its
   * own test: checking in a booking that already exists, and creating a
   * booking that is checked in on arrival. What is asserted is the invariant,
   * not an ordering — whichever request wins, a CHECKED_IN booking must never
   * be left in a room that is not occupied.
   *
   * Be clear about what these two prove. They reproduced, and now hold, the
   * wide window that check-in's unordered `Promise.all` left open: they failed
   * against it and pass against the transaction that replaced it. They do not
   * discriminate the remaining defences — the `FOR UPDATE` on this room's live
   * bookings, and the serializable isolation that covers arrival-time check-in
   * where there is no booking row to lock yet. Both were still there when the
   * race was failing, and removing either leaves these tests green, because
   * two `app.inject` calls in one process cannot reliably land inside a window
   * that is now a few statements wide. Those two are reasoned, not measured.
   */
  it('never leaves a checked-in booking in an available room', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const roomId = await makeRoom();
      const bookingId = await makeBooking(roomId, { first: 'Race', last: `Case${attempt}` });

      const [, statusRes] = await Promise.all([
        app.inject({
          method: 'PATCH', url: `/api/bookings/${bookingId}/check-in`,
          headers: auth(), payload: {},
        }),
        setStatus(roomId, 'AVAILABLE'),
      ]);

      const [room, booking] = await Promise.all([storedStatus(roomId), bookingStatus(bookingId)]);
      if (booking === 'CHECKED_IN') {
        expect(room).toBe('OCCUPIED');
      } else {
        // The status change won; it was legitimate at the time it ran.
        expect(statusRes.statusCode).toBe(200);
      }
    }
  }, 40000);

  it('never leaves a walk-in checked in on arrival in an available room', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const roomId = await makeRoom();
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + dayOffset);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);
      dayOffset += 10;

      const [createRes] = await Promise.all([
        app.inject({
          method: 'POST', url: '/api/bookings', headers: auth(),
          payload: {
            roomId,
            guestFirstName: 'Walk', guestLastName: `In${attempt}`,
            guestPhone: `018000${String(attempt).padStart(5, '0')}`,
            checkIn:  checkInDate.toISOString().split('T')[0],
            checkOut: checkOutDate.toISOString().split('T')[0],
            adults: 1, children: 0, paymentMethod: 'CASH',
            autoCheckIn: true,
          },
        }),
        setStatus(roomId, 'AVAILABLE'),
      ]);

      // The booking may have lost the race outright, in which case there is no
      // occupancy to contradict and nothing to assert.
      if (createRes.statusCode !== 201) continue;

      const bookingId = body(createRes).data.id as string;
      const [room, booking] = await Promise.all([storedStatus(roomId), bookingStatus(bookingId)]);
      if (booking === 'CHECKED_IN') expect(room).toBe('OCCUPIED');
    }
  }, 40000);
});
