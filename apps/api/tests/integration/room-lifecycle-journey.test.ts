/**
 * The one journey the audit's handoff gate asks for, walked end to end.
 *
 * Twelve suites now cover the twelve Room Management findings, and every one of
 * them builds the state it needs and then asserts one rule about it. That is
 * the right shape for a finding, and it leaves a gap: nothing walks the chain.
 * The gate's own last item is
 *
 *   "Retest Room → Booking → Check-in → Early/Normal checkout → Cleaning →
 *    Maintenance → Available across Owner, Manager and Receptionist"
 *
 * — and a chain is not the sum of its links. Every hop here is one endpoint's
 * write becoming the next endpoint's precondition, which is exactly the kind of
 * seam a per-finding fixture skips over: `room-state-blockers` proves that
 * finishing a clean recomputes the room, but it creates the clean itself; it
 * never asks whether *checkout* leaves behind the clean that recompute depends
 * on. Break that one write and all twelve suites still pass.
 * (Room Management QA 2026-10-28, RM-013.)
 *
 * So the rule here is: **nothing in this file writes state with Prisma.** Every
 * step is the request a member of staff would actually make, in the order they
 * would make it, and Prisma is used only to read back what the API stored. The
 * steps in each journey are deliberately order-dependent — the ordering is the
 * subject, not an accident of how it was written.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';

let app: FastifyInstance;
const run = `room-journey-${Date.now()}`;
const password = 'TestPass123!';
let tenantId: string;
const token: Record<string, string> = {};

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
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

// ── The requests, one per thing a member of staff does ──────────────────────

const createRoom = (as: string) =>
  app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(token[as]),
    payload: {
      number: `${900 + n++}`, name: 'Journey Room', type: 'DELUXE',
      maxOccupancy: 2, basePrice: 4500,
    },
  });

const bookRoom = (as: string, roomId: string, from: number, nights = 1) =>
  app.inject({
    method: 'POST', url: '/api/bookings', headers: auth(token[as]),
    payload: {
      roomId,
      guestFirstName: 'Journey', guestLastName: 'Guest',
      guestPhone: `017000${String(n++).padStart(5, '0')}`,
      checkIn: dateStr(from), checkOut: dateStr(from + nights),
      adults: 1, children: 0, paymentMethod: 'CASH',
    },
  });

const checkIn = (as: string, bookingId: string) =>
  app.inject({
    method: 'PATCH', url: `/api/bookings/${bookingId}/check-in`,
    headers: auth(token[as]), payload: {},
  });

const checkOut = (as: string, bookingId: string) =>
  app.inject({
    method: 'PATCH', url: `/api/bookings/${bookingId}/check-out`,
    headers: auth(token[as]), payload: {},
  });

const setStatus = (as: string, roomId: string, status: string) =>
  app.inject({
    method: 'PATCH', url: `/api/rooms/${roomId}/status`,
    headers: auth(token[as]), payload: { status },
  });

const detail = async (as: string, roomId: string) => {
  const res = await app.inject({
    method: 'GET', url: `/api/rooms/${roomId}`, headers: auth(token[as]),
  });
  expect(res.statusCode, res.body).toBe(200);
  return body(res).data as {
    status: string;
    currentBooking: null | {
      id: string; status: string; overdueNights: number; dueOutToday: boolean;
      guest: { firstName: string; lastName: string };
    };
  };
};

/** What the dashboard would offer for a stay of `nights` from `from`. */
const offered = async (as: string, from: number, nights = 1) => {
  const res = await app.inject({
    method: 'GET', headers: auth(token[as]),
    url: `/api/rooms/availability?checkIn=${dateStr(from)}&checkOut=${dateStr(from + nights)}`,
  });
  expect(res.statusCode, res.body).toBe(200);
  return (body(res).data as { id: string }[]).map(r => r.id);
};

/** The same question asked by a guest on the public website. */
const offeredToGuest = async (from: number, nights = 1) => {
  const res = await app.inject({
    method: 'GET',
    url: `/site/${run}/availability?checkIn=${dateStr(from)}&checkOut=${dateStr(from + nights)}`,
  });
  expect(res.statusCode, res.body).toBe(200);
  return (body(res).data as { id: string }[]).map(r => r.id);
};

const openTicket = (as: string, roomId: string) =>
  app.inject({
    method: 'POST', url: '/api/maintenance', headers: auth(token[as]),
    payload: { roomId, issueType: 'AC', description: 'Thermostat reads 40°C', priority: 'HIGH' },
  });

const resolveTicket = (as: string, ticketId: string) =>
  app.inject({
    method: 'PATCH', url: `/api/maintenance/${ticketId}/resolve`,
    headers: auth(token[as]), payload: { notes: 'Thermostat replaced' },
  });

/** The housekeeping task left behind by a checkout, if there is one. */
const pendingClean = (roomId: string) =>
  prisma.housekeepingTask.findFirst({
    where: { tenantId, roomId, type: 'CHECKOUT', status: { not: 'COMPLETED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });

const completeClean = (as: string, taskId: string) =>
  app.inject({
    method: 'PATCH', url: `/api/housekeeping/${taskId}/status`,
    headers: auth(token[as]), payload: { status: 'COMPLETED' },
  });

const storedStatus = (roomId: string) =>
  prisma.room.findUnique({ where: { id: roomId }, select: { status: true } })
    .then(r => r?.status ?? null);

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Journey', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  tenantId = body(reg).data.tenant.id;
  token.OWNER = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });

  // ENTERPRISE so a plan ceiling can never be what refuses a step here.
  await prisma.tenant.update({
    where: { id: tenantId }, data: { plan: 'ENTERPRISE', planStatus: 'active' },
  });
  await applyPlanFlagsToTenant(tenantId, 'ENTERPRISE');

  const bcrypt = await import('bcryptjs');
  for (const role of ['MANAGER', 'RECEPTIONIST'] as const) {
    const email = `${role.toLowerCase()}-${run}@test.com`;
    await prisma.user.create({
      data: {
        tenantId, email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: role, lastName: 'Test',
        role: role as Prisma.UserCreateInput['role'],
        emailVerifiedAt: new Date(),
      },
    });
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login', payload: { email, password, slug: run },
    });
    if (login.statusCode !== 200) throw new Error(`${role} login failed: ${login.body}`);
    token[role] = body(login).data.token;
  }
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

/*
  Journey one. The owner opens a room, sells it, takes the guest in, takes the
  guest out, has it cleaned, finds a fault, has it fixed, and sells it again.
  Each step's state is whatever the step before it left behind.
*/
describe('Room → Booking → Check-in → Checkout → Cleaning → Maintenance → Available', () => {
  let roomId = '';
  let bookingId = '';
  let ticketId = '';

  it('a new room starts Available and is on sale tonight', async () => {
    const res = await createRoom('OWNER');
    expect(res.statusCode, res.body).toBe(201);
    roomId = body(res).data.id;

    expect(body(res).data.status).toBe('AVAILABLE');
    expect(await offered('OWNER', 0)).toContain(roomId);
    expect(await offeredToGuest(0)).toContain(roomId);
  });

  it('is taken off tonight by a booking, without its status being touched', async () => {
    const res = await bookRoom('OWNER', roomId, 0);
    expect(res.statusCode, res.body).toBe(201);
    bookingId = body(res).data.id;

    // The two halves of RM-003's rule, seen from one room at one moment:
    // the dates decide the calendar, so tonight is gone and tomorrow is not.
    expect(await offered('OWNER', 0)).not.toContain(roomId);
    expect(await offered('OWNER', 1)).toContain(roomId);

    // And the status is still what the room *is*, not what it is promised to.
    // A pending arrival is not somebody in the room.
    expect(await storedStatus(roomId)).toBe('AVAILABLE');
  });

  it('becomes Occupied when the guest arrives', async () => {
    const res = await checkIn('OWNER', bookingId);
    expect(res.statusCode, res.body).toBe(200);

    expect(await storedStatus(roomId)).toBe('OCCUPIED');
    const { currentBooking } = await detail('OWNER', roomId);
    expect(currentBooking?.id).toBe(bookingId);
    expect(currentBooking?.status).toBe('CHECKED_IN');
  });

  it('cannot be put back on sale with the guest still in it', async () => {
    const res = await setStatus('OWNER', roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(409);
    // The refusal names who is inside, which is the difference between a
    // usable error and a mystery at the front desk.
    expect(res.body).toContain('Journey');
    expect(await storedStatus(roomId)).toBe('OCCUPIED');
  });

  it('is withheld from a guest asking for tonight', async () => {
    expect(await offered('OWNER', 0)).not.toContain(roomId);
    expect(await offeredToGuest(0)).not.toContain(roomId);
  });

  it('goes to housekeeping at checkout, with a task to act on', async () => {
    const res = await checkOut('OWNER', bookingId);
    expect(res.statusCode, res.body).toBe(200);

    expect(await storedStatus(roomId)).toBe('CLEANING');

    // The seam no per-finding suite crosses. `room-state-blockers` proves a
    // completed clean recomputes the room — but it creates that clean itself.
    // If checkout stops leaving one behind, the room is CLEANING with nothing
    // that can ever clear it, and every one of those suites still passes.
    const task = await pendingClean(roomId);
    expect(task, 'checkout left no housekeeping task behind').not.toBeNull();
    ticketId = ''; // not used yet; keeps the journey's state obvious
  });

  it('is not declared ready while that clean is still open', async () => {
    const res = await setStatus('OWNER', roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(409);
    expect(await storedStatus(roomId)).toBe('CLEANING');
  });

  it('is off sale tonight but on sale tomorrow while it is dirty', async () => {
    // Status decides today; the room will be clean by the morning.
    expect(await offered('OWNER', 0)).not.toContain(roomId);
    expect(await offered('OWNER', 1)).toContain(roomId);
  });

  it('returns to Available when housekeeping finishes', async () => {
    const task = await pendingClean(roomId);
    const res = await completeClean('OWNER', task!.id);
    expect(res.statusCode, res.body).toBe(200);

    // Derived, not asserted: nobody sent AVAILABLE here.
    expect(await storedStatus(roomId)).toBe('AVAILABLE');
    expect(await offered('OWNER', 0)).toContain(roomId);
  });

  it('goes to Maintenance when a fault is reported, with no status call at all', async () => {
    const res = await openTicket('OWNER', roomId);
    expect(res.statusCode, res.body).toBe(201);
    ticketId = body(res).data.id;

    expect(await storedStatus(roomId)).toBe('MAINTENANCE');
  });

  it('is off sale at every date while the fault is open', async () => {
    // Unlike a dirty room, a broken one is not fixed by the morning.
    expect(await offered('OWNER', 0)).not.toContain(roomId);
    expect(await offered('OWNER', 1)).not.toContain(roomId);
    expect(await offered('OWNER', 30)).not.toContain(roomId);
    expect(await offeredToGuest(30)).not.toContain(roomId);
  });

  it('refuses to be declared ready while the fault is open', async () => {
    const res = await setStatus('OWNER', roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(409);
    expect(await storedStatus(roomId)).toBe('MAINTENANCE');
  });

  it('comes back on sale when the fault is resolved', async () => {
    const res = await resolveTicket('OWNER', ticketId);
    expect(res.statusCode, res.body).toBe(200);

    expect(await storedStatus(roomId)).toBe('AVAILABLE');
    expect(await offered('OWNER', 0)).toContain(roomId);
    expect(await offeredToGuest(0)).toContain(roomId);
  });

  it('ends where it began, and the stay is on the record', async () => {
    const { status, currentBooking } = await detail('OWNER', roomId);

    expect(status).toBe('AVAILABLE');
    // The room is empty, so the panel names nobody — but the booking it
    // started from is checked out, not erased.
    expect(currentBooking).toBeNull();
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }, select: { status: true, actualCheckOut: true },
    });
    expect(booking?.status).toBe('CHECKED_OUT');
    expect(booking?.actualCheckOut).not.toBeNull();
  });
});

/*
  Journey two. The same chain, worked by the role that actually works a night
  shift. `room-capabilities` pins which buttons the rooms API allows a
  Receptionist; this asks the operational question instead — can that person
  complete a stay from arrival to the room being back on sale?
*/
describe('the same chain worked by a Receptionist', () => {
  let roomId = '';
  let bookingId = '';
  let ticketId = '';

  it('cannot open the room — that part is still the owner\'s', async () => {
    const res = await createRoom('RECEPTIONIST');
    expect(res.statusCode).toBe(403);

    const owned = await createRoom('OWNER');
    expect(owned.statusCode, owned.body).toBe(201);
    roomId = body(owned).data.id;
  });

  it('can sell it, take the guest in, and take the guest out', async () => {
    const booked = await bookRoom('RECEPTIONIST', roomId, 0);
    expect(booked.statusCode, booked.body).toBe(201);
    bookingId = body(booked).data.id;

    const arrived = await checkIn('RECEPTIONIST', bookingId);
    expect(arrived.statusCode, arrived.body).toBe(200);
    expect(await storedStatus(roomId)).toBe('OCCUPIED');

    const left = await checkOut('RECEPTIONIST', bookingId);
    expect(left.statusCode, left.body).toBe(200);
    expect(await storedStatus(roomId)).toBe('CLEANING');
  });

  it('is refused the same shortcut an owner is refused', async () => {
    // The guard is about the room's state, not about who is asking.
    const res = await setStatus('RECEPTIONIST', roomId, 'AVAILABLE');

    expect(res.statusCode).toBe(409);
    expect(await storedStatus(roomId)).toBe('CLEANING');
  });

  it('can finish the clean and put the room back on sale', async () => {
    const task = await pendingClean(roomId);
    const res = await completeClean('RECEPTIONIST', task!.id);
    expect(res.statusCode, res.body).toBe(200);

    expect(await storedStatus(roomId)).toBe('AVAILABLE');
    expect(await offered('RECEPTIONIST', 0)).toContain(roomId);
  });

  it('can take a room out of service but not put it back', async () => {
    /*
      Not a defect — `/api/maintenance/:id/resolve` is owner/manager by
      design, and signing off a repair is a different thing from reporting
      one. It is pinned here because the *chain* has a consequence the role
      table alone does not show: a shift with no owner or manager on it can
      lose a room to a fault and has no way to return it to sale. If that is
      ever judged wrong, this test should fail and be changed deliberately.
    */
    const opened = await openTicket('RECEPTIONIST', roomId);
    expect(opened.statusCode, opened.body).toBe(201);
    ticketId = body(opened).data.id;
    expect(await storedStatus(roomId)).toBe('MAINTENANCE');

    const refused = await resolveTicket('RECEPTIONIST', ticketId);
    expect(refused.statusCode).toBe(403);
    expect(await storedStatus(roomId)).toBe('MAINTENANCE');
  });

  it('and a Manager finishes what the Receptionist started', async () => {
    const res = await resolveTicket('MANAGER', ticketId);
    expect(res.statusCode, res.body).toBe(200);

    expect(await storedStatus(roomId)).toBe('AVAILABLE');
    expect(await offered('MANAGER', 0)).toContain(roomId);
  });
});
