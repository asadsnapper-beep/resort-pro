/**
 * Whether a room's status can contradict the work that is actually open on it.
 *
 * `Room.status` was written directly by five different places, none of which
 * looked at what the others knew. So the dashboard could claim a room was
 * ready while nobody had fixed it, or hide a room from sale with no work order
 * anyone could act on. (Room Management QA 2026-10-28, RM-004.)
 *
 * The audit found three of these. Reading the code found two more:
 * `POST /api/maintenance` marked a room MAINTENANCE even with a guest checked
 * into it, walking straight past the guard RM-001 had just put on the room
 * endpoint; and `restoreRoomIfClear` sent a room back to Available without
 * asking whether housekeeping was still in it.
 *
 * The rule now lives in one place, utils/room-state.ts, and every one of those
 * five writes goes through it: the room's status is *derived* from its
 * blockers, in order — a checked-in guest, then an open maintenance ticket,
 * then a clean in progress, then a booking that covers today — and is
 * Available only when none of them hold.
 *
 * These tests were written and run against the unmodified code first, and the
 * before-state each one recorded is named in its own comment.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-state-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

/** The timezone a tenant gets by default, and so the one these dates mean. */
const RESORT_TZ = 'Asia/Dhaka';

/** `offset` days from the resort's own today, as the YYYY-MM-DD the API takes. */
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
      number: `${500 + n++}`, name: 'State Room', type: 'STANDARD',
      maxOccupancy: 2, basePrice: 2500,
    },
  });
  if (res.statusCode !== 201) throw new Error(`room fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

const setStatus = (roomId: string, status: string) =>
  app.inject({
    method: 'PATCH', url: `/api/rooms/${roomId}/status`,
    headers: auth(), payload: { status },
  });

const storedStatus = (roomId: string) =>
  prisma.room.findUnique({ where: { id: roomId }, select: { status: true } })
    .then(r => r?.status ?? null);

const openTickets = (roomId: string) =>
  prisma.maintenanceTicket.findMany({
    where: { tenantId, roomId, status: { not: 'RESOLVED' } },
    select: { id: true, description: true, issueType: true, status: true },
  });

const makeTicket = async (roomId: string, description = 'Air conditioner is dead') => {
  const res = await app.inject({
    method: 'POST', url: '/api/maintenance', headers: auth(),
    payload: { roomId, issueType: 'AC', description, priority: 'NORMAL' },
  });
  if (res.statusCode !== 201) throw new Error(`ticket fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

const resolveTicket = (ticketId: string) =>
  app.inject({
    method: 'PATCH', url: `/api/maintenance/${ticketId}/resolve`,
    headers: auth(), payload: { notes: 'Replaced the compressor' },
  });

/** A between-stay clean — the only kind that touches room status. */
const makeTask = async (roomId: string) => {
  const res = await app.inject({
    method: 'POST', url: '/api/housekeeping', headers: auth(),
    payload: { roomId, type: 'CHECKOUT', scheduledDate: dateStr(0) },
  });
  if (res.statusCode !== 201) throw new Error(`task fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

const setTaskStatus = (taskId: string, status: string) =>
  app.inject({
    method: 'PATCH', url: `/api/housekeeping/${taskId}/status`,
    headers: auth(), payload: { status },
  });

/** A booking on `roomId`. `from`/`nights` are offsets from the resort's today. */
const makeBooking = async (roomId: string, from: number, nights = 2) => {
  const res = await app.inject({
    method: 'POST', url: '/api/bookings', headers: auth(),
    payload: {
      roomId,
      guestFirstName: 'State', guestLastName: 'Guest',
      guestPhone: `018000${String(n++).padStart(5, '0')}`,
      checkIn: dateStr(from), checkOut: dateStr(from + nights),
      adults: 1, children: 0, paymentMethod: 'CASH',
    },
  });
  if (res.statusCode !== 201) throw new Error(`booking fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

const checkInGuest = async (bookingId: string) => {
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
      resortName: 'Room State Blockers', slug: run,
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

describe('blocking a room by hand leaves something to act on', () => {
  it('opens a maintenance ticket for it', async () => {
    // Before: the status was written and nothing else happened — the probe
    // found zero work items, so the room was off sale with no work order.
    const roomId = await makeRoom();

    const res = await setStatus(roomId, 'MAINTENANCE');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('MAINTENANCE');
    const tickets = await openTickets(roomId);
    expect(tickets).toHaveLength(1);
    expect(tickets[0].status).toBe('OPEN');
  });

  it('puts the room back on sale once that ticket is resolved', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'MAINTENANCE');
    const [ticket] = await openTickets(roomId);

    const res = await resolveTicket(ticket.id);

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('AVAILABLE');
  });

  it('does not open a second ticket when one is already open', async () => {
    // Setting MAINTENANCE on a room that is already blocked is a no-op the
    // front desk does by habit; it must not pile up work orders.
    const roomId = await makeRoom();
    await makeTicket(roomId, 'Shower leaks');

    await setStatus(roomId, 'MAINTENANCE');

    expect(await openTickets(roomId)).toHaveLength(1);
  });
});

describe('a room is not declared ready while something still blocks it', () => {
  it('refuses Available while a maintenance ticket is open', async () => {
    // Before: 200, and the room went on sale with the ticket still open —
    // "the dashboard can claim a room is ready while no one fixed it".
    const roomId = await makeRoom();
    await makeTicket(roomId);

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(409);
    expect(body(res).code).toBe('ROOM_HAS_OPEN_MAINTENANCE');
    expect(await storedStatus(roomId)).toBe('MAINTENANCE');
  });

  it('refuses Available while a between-stay clean is in progress', async () => {
    const roomId = await makeRoom();
    const taskId = await makeTask(roomId);
    await setTaskStatus(taskId, 'IN_PROGRESS');

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(409);
    expect(body(res).code).toBe('ROOM_IS_BEING_CLEANED');
    expect(await storedStatus(roomId)).toBe('CLEANING');
  });

  it('does not treat a clean done around a guest as a reason to refuse', async () => {
    // DAILY and TURNDOWN say nothing about whether the room can be handed to
    // somebody else, so they must not block the claim that it is ready.
    // Dropping this distinction from the rule failed no test until this one.
    const roomId = await makeRoom();
    const created = await app.inject({
      method: 'POST', url: '/api/housekeeping', headers: auth(),
      payload: { roomId, type: 'DAILY', scheduledDate: dateStr(0) },
    });
    await setTaskStatus(body(created).data.id as string, 'IN_PROGRESS');

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('AVAILABLE');
  });

  it('still allows Available when nothing blocks the room', async () => {
    const roomId = await makeRoom();
    await setStatus(roomId, 'CLEANING');

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('AVAILABLE');
  });
});

describe('finishing a clean recomputes the room instead of asserting it is ready', () => {
  it('leaves a room with an open ticket in Maintenance', async () => {
    // Before: AVAILABLE. Housekeeping completion "sets a room Available
    // without checking checked-in bookings, open maintenance tickets or
    // another active cleaning task".
    const roomId = await makeRoom();
    await makeTicket(roomId);
    const taskId = await makeTask(roomId);
    await setTaskStatus(taskId, 'IN_PROGRESS');

    const res = await setTaskStatus(taskId, 'COMPLETED');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('MAINTENANCE');
  });

  it('leaves a room with a guest still checked into it Occupied', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, 0);
    await checkInGuest(bookingId);
    const taskId = await makeTask(roomId);

    const res = await setTaskStatus(taskId, 'COMPLETED');

    expect(res.statusCode).toBe(200);
    expect(await storedStatus(roomId)).toBe('OCCUPIED');
  });

  it('does still put an otherwise clear room on sale', async () => {
    const roomId = await makeRoom();
    const taskId = await makeTask(roomId);
    await setTaskStatus(taskId, 'IN_PROGRESS');
    expect(await storedStatus(roomId)).toBe('CLEANING');

    await setTaskStatus(taskId, 'COMPLETED');

    expect(await storedStatus(roomId)).toBe('AVAILABLE');
  });

  it('does not touch the room for a clean that happens around the guest', async () => {
    // DAILY and TURNDOWN are done with the guest still in residence. Finishing
    // one says nothing about whether the room can be handed to anybody else.
    const roomId = await makeRoom();
    await setStatus(roomId, 'CLEANING');
    const res = await app.inject({
      method: 'POST', url: '/api/housekeeping', headers: auth(),
      payload: { roomId, type: 'DAILY', scheduledDate: dateStr(0) },
    });
    const taskId = body(res).data.id as string;

    await setTaskStatus(taskId, 'COMPLETED');

    expect(await storedStatus(roomId)).toBe('CLEANING');
  });
});

describe('resolving the last ticket recomputes too', () => {
  it('hands the room to housekeeping when a clean is still in progress', async () => {
    // Before: AVAILABLE — `restoreRoomIfClear` asked about tickets and about a
    // checked-in guest, and never about the person still cleaning the room.
    const roomId = await makeRoom();
    const ticketId = await makeTicket(roomId);
    const taskId = await makeTask(roomId);
    await setTaskStatus(taskId, 'IN_PROGRESS');

    await resolveTicket(ticketId);

    expect(await storedStatus(roomId)).toBe('CLEANING');
  });

  it('leaves a room with a guest in it Occupied', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, 0);
    await checkInGuest(bookingId);
    const ticketId = await makeTicket(roomId);

    await resolveTicket(ticketId);

    expect(await storedStatus(roomId)).toBe('OCCUPIED');
  });

  it('keeps the room blocked while a second ticket is still open', async () => {
    const roomId = await makeRoom();
    const first = await makeTicket(roomId, 'Air conditioner is dead');
    await makeTicket(roomId, 'Door lock jams');

    await resolveTicket(first);

    expect(await storedStatus(roomId)).toBe('MAINTENANCE');
  });
});

describe('a ticket on an occupied room does not evict the guest', () => {
  it('records the fault and leaves the room Occupied', async () => {
    // Before: MAINTENANCE. `POST /api/maintenance` wrote the status blind,
    // walking past the guard RM-001 had put on the room endpoint — the room
    // then showed no guest while somebody was asleep in it.
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, 0);
    await checkInGuest(bookingId);

    const ticketId = await makeTicket(roomId, 'Bathroom tap dripping');

    expect(await storedStatus(roomId)).toBe('OCCUPIED');
    expect(await openTickets(roomId)).toHaveLength(1);
    expect(ticketId).toBeTruthy();
  });

  it('blocks the room once that guest has gone and the clean is done', async () => {
    // The fault does not vanish because the guest was in the way: the next
    // recompute after the room empties is the one that takes it off sale.
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, 0);
    await checkInGuest(bookingId);
    await makeTicket(roomId, 'Window will not latch');

    const out = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-out`, headers: auth(), payload: {},
    });
    expect(out.statusCode).toBe(200);

    const taskId = await makeTask(roomId);
    await setTaskStatus(taskId, 'COMPLETED');

    expect(await storedStatus(roomId)).toBe('MAINTENANCE');
  });
});

describe("a booking that covers today keeps its room labelled Reserved", () => {
  it('does not release a held room when its last ticket is resolved', async () => {
    // Recompute must not quietly undo a hold: the room is not for sale today,
    // and the booking rows are what say so.
    const roomId = await makeRoom();
    await makeBooking(roomId, 0);
    const ticketId = await makeTicket(roomId);

    await resolveTicket(ticketId);

    expect(await storedStatus(roomId)).toBe('RESERVED');
  });

  it('does not hold a room whose booking checks out today', async () => {
    // The departure boundary. A guest leaving this morning does not stop the
    // room being sold tonight, so the range is half-open — `checkOut > today`,
    // not `>=`. Loosening it to `>=` passed every other test here.
    const roomId = await makeRoom();
    await makeBooking(roomId, -2, 2);
    const ticketId = await makeTicket(roomId);

    await resolveTicket(ticketId);

    expect(await storedStatus(roomId)).toBe('AVAILABLE');
  });

  it('releases it once the booking no longer covers today', async () => {
    const roomId = await makeRoom();
    await makeBooking(roomId, 30);
    const ticketId = await makeTicket(roomId);

    await resolveTicket(ticketId);

    expect(await storedStatus(roomId)).toBe('AVAILABLE');
  });
});
