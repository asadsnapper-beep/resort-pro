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

  it('refuses Available while a between-stay clean is only waiting', async () => {
    /*
      Added by RM-013, because the journey test found this was not true.

      Every case in this file set a task to IN_PROGRESS by hand, so the state a
      real checkout actually produces — a PENDING clean, nobody assigned yet —
      was the one state never exercised, and it did not block. The room went to
      CLEANING and a PATCH straight back to AVAILABLE was accepted: a room with
      the last guest's towels still in it, back on sale.

      A clean nobody has started is not less of a blocker than one half-done.
    */
    const roomId = await makeRoom();
    const taskId = await makeTask(roomId);

    // Deliberately NOT moved to IN_PROGRESS.
    const task = await prisma.housekeepingTask.findUnique({
      where: { id: taskId }, select: { status: true },
    });
    expect(task?.status).toBe('PENDING');

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(409);
    expect(body(res).code).toBe('ROOM_IS_BEING_CLEANED');
  });

  it('does not refuse Available for a clean that was skipped', async () => {
    // The other half of the same rule: SKIPPED is somebody deciding the room
    // did not need cleaning, which is an answer rather than an omission.
    const roomId = await makeRoom();
    const taskId = await makeTask(roomId);
    await setTaskStatus(taskId, 'SKIPPED');

    const res = await setStatus(roomId, 'AVAILABLE');

    expect(res.statusCode, res.body).toBe(200);
    expect(await storedStatus(roomId)).toBe('AVAILABLE');
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

/**
 * Whether the room screens can know what the endpoint will refuse.
 *
 * The rule above is enforced, and the detail sheet could not see it. It read
 * `GET /api/rooms/:id`, which returned the room and its `currentBooking` and
 * nothing about the work open on the room, so it offered every status but the
 * current one. A receptionist looking at an occupied room was handed Cleaning,
 * Maintenance, Reserved and Available, and all four came back 409 — the shape
 * of RM-005, driven by the room's state instead of the user's role.
 *
 * So the read now answers the same question the write asks, from the same
 * `roomBlocker`. These tests pin both halves: the code and message the read
 * reports, and that it is the code the write actually refuses with. A second
 * copy of the rule on either side would drift, and the copy that drifts wide
 * is the one that offers a dead control.
 *
 * Written and run against the unmodified route first: all nine failed, each
 * because `data.blocker` was `undefined` — the field did not exist. The
 * refusals the agreement tests compare against were already correct; what was
 * missing was any way for a caller to find out about them before clicking.
 */
describe('GET /api/rooms/:id reports what is blocking the room', () => {
  const getRoom = (roomId: string) =>
    app.inject({ method: 'GET', url: `/api/rooms/${roomId}`, headers: auth() });

  const blockerOf = async (roomId: string) => {
    const res = await getRoom(roomId);
    expect(res.statusCode).toBe(200);
    return body(res).data.blocker as { code: string; status: string; error: string } | null;
  };

  it('reports nothing for a room with nothing open on it', async () => {
    // Before: `undefined` — the field was absent, so the sheet could not tell
    // "nothing blocks this room" from "this room was never asked about".
    const roomId = await makeRoom();

    expect(await blockerOf(roomId)).toBeNull();
  });

  it('names the guest who is in the room', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, 0);
    await checkInGuest(bookingId);

    const blocker = await blockerOf(roomId);

    expect(blocker?.code).toBe('ROOM_HAS_CHECKED_IN_GUEST');
    expect(blocker?.status).toBe('OCCUPIED');
    // The sheet shows this sentence verbatim, so it has to say who and which
    // booking — "Check them out" is the one action that ends the occupancy.
    expect(blocker?.error).toContain('State Guest');
    expect(blocker?.error).toMatch(/check them out/i);
  });

  it('names the maintenance that is still open', async () => {
    const roomId = await makeRoom();
    await makeTicket(roomId, 'Air conditioner is dead');

    const res = await getRoom(roomId);
    const { number, blocker } = body(res).data;

    expect(blocker?.code).toBe('ROOM_HAS_OPEN_MAINTENANCE');
    expect(blocker?.status).toBe('MAINTENANCE');
    expect(blocker?.error).toContain('Air conditioner is dead');
    // The sheet shows this beside buttons for one room, so a bare "This room"
    // is not enough — `roomBlocker` says that only when nobody passes a
    // number, and this read has the room in hand.
    expect(blocker?.error).toContain(`Room ${number}`);
  });

  it('reports the clean that is in progress', async () => {
    const roomId = await makeRoom();
    const taskId = await makeTask(roomId);
    await setTaskStatus(taskId, 'IN_PROGRESS');

    const blocker = await blockerOf(roomId);

    expect(blocker?.code).toBe('ROOM_IS_BEING_CLEANED');
    expect(blocker?.status).toBe('CLEANING');
  });

  it('reports a booking that holds the room today', async () => {
    const roomId = await makeRoom();
    await makeBooking(roomId, 0);

    const blocker = await blockerOf(roomId);

    expect(blocker?.code).toBe('ROOM_IS_HELD_TODAY');
    expect(blocker?.status).toBe('RESERVED');
  });

  it('does not report a clean done around a guest as a blocker', async () => {
    // The read must draw the same DAILY/TURNDOWN distinction as the write, or
    // the sheet hides Available on a room the endpoint would have accepted.
    const roomId = await makeRoom();
    const created = await app.inject({
      method: 'POST', url: '/api/housekeeping', headers: auth(),
      payload: { roomId, type: 'DAILY', scheduledDate: dateStr(0) },
    });
    await setTaskStatus(body(created).data.id as string, 'IN_PROGRESS');

    expect(await blockerOf(roomId)).toBeNull();
  });

  it('still returns the room and its current booking', async () => {
    // The blocker is added alongside what the sheet already reads, not
    // instead of it.
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, 0);
    await checkInGuest(bookingId);

    const room = body(await getRoom(roomId)).data;

    expect(room.number).toBeTruthy();
    expect(room.currentBooking?.id).toBe(bookingId);
  });
});

describe('the blocker the read reports is the one the write refuses with', () => {
  const blockerOf = async (roomId: string) => {
    const res = await app.inject({
      method: 'GET', url: `/api/rooms/${roomId}`, headers: auth(),
    });
    return body(res).data.blocker as { code: string } | null;
  };

  it('agrees about a guest, who refuses every status but Occupied', async () => {
    const roomId = await makeRoom();
    const bookingId = await makeBooking(roomId, 0);
    await checkInGuest(bookingId);
    const reported = await blockerOf(roomId);

    for (const status of ['AVAILABLE', 'CLEANING', 'MAINTENANCE', 'RESERVED']) {
      const res = await setStatus(roomId, status);
      expect(res.statusCode, `${status} should be refused`).toBe(409);
      expect(body(res).code).toBe(reported?.code);
    }

    // And the one it does allow is the one the blocker names.
    expect((await setStatus(roomId, 'OCCUPIED')).statusCode).toBe(200);
  });

  it('agrees about maintenance, which refuses only Available', async () => {
    const roomId = await makeRoom();
    await makeTicket(roomId);
    const reported = await blockerOf(roomId);

    const refused = await setStatus(roomId, 'AVAILABLE');
    expect(refused.statusCode).toBe(409);
    expect(body(refused).code).toBe(reported?.code);

    // Marking a blocked room as Cleaning is honest work and stays allowed, so
    // the sheet must keep offering it.
    expect((await setStatus(roomId, 'CLEANING')).statusCode).toBe(200);
  });

  it('agrees about a hold, which refuses only Available', async () => {
    const roomId = await makeRoom();
    await makeBooking(roomId, 0);
    const reported = await blockerOf(roomId);

    const refused = await setStatus(roomId, 'AVAILABLE');
    expect(refused.statusCode).toBe(409);
    expect(body(refused).code).toBe(reported?.code);

    expect((await setStatus(roomId, 'CLEANING')).statusCode).toBe(200);
  });
});
