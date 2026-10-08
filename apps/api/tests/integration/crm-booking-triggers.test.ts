/**
 * The two sequences that fire on something a person did.
 *
 * `enrollOnBookingConfirmed` existed and had no caller anywhere in the
 * codebase. `CHECK_IN` was offered by the UI, accepted by the API, and had no
 * processor at all (CRM QA 2026-10-07, finding 010). So an owner could build a
 * welcome sequence on either, see it listed as ACTIVE, and watch it enrol
 * nobody — the same shape as the Anniversary trigger, one screen along.
 *
 * These go through the real routes rather than calling the helper, because
 * "the helper works" was already true. What was missing was anybody calling it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `bktrig-${Date.now()}`;
const ownerEmail = `owner-${run}@test.com`;
const password = 'TestPass123!';

let tenantId: string;
let token: string;
let roomId: string;
let guestId: string;

const auth = { Authorization: '' };

const makeSequence = async (trigger: 'BOOKING_CONFIRMED' | 'CHECK_IN', status = 'ACTIVE') =>
  (await prisma.sequence.create({
    data: { tenantId, name: `${trigger}-${Math.random().toString(36).slice(2, 7)}`, trigger, status: status as 'ACTIVE' },
  })).id;

const enrolledIn = async (sequenceId: string) =>
  (await prisma.sequenceEnrollment.findMany({ where: { sequenceId }, select: { guestId: true } }))
    .map((e) => e.guestId);

// Each booking gets its own week. One room cannot be booked twice for the same
// nights, and the first version of this file reused one date range — so every
// test after the first got a 409 and failed for a reason that had nothing to
// do with what it was testing.
let week = 0;
const createBooking = (over: Record<string, unknown> = {}) => {
  week += 1;
  return app.inject({
    method: 'POST', url: '/api/bookings', headers: auth,
    payload: {
      roomId, guestId,
      checkIn: new Date(Date.now() + (week * 7) * 86400000).toISOString().slice(0, 10),
      checkOut: new Date(Date.now() + (week * 7 + 2) * 86400000).toISOString().slice(0, 10),
      adults: 2, children: 0,
      ...over,
    },
  });
};

/** The enrolment is fire-and-forget, so give its promise a turn to land. */
const settle = () => new Promise((r) => setTimeout(r, 250));

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Trigger Resort', slug: run, firstName: 'Asha', lastName: 'R',
      email: ownerEmail, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active' } });
  token = await verifyOwnerAndLogin(app, { tenantId, email: ownerEmail, password, slug: run });
  auth.Authorization = `Bearer ${token}`;

  roomId = (await prisma.room.create({
    data: { tenantId, number: `R-${run}`.slice(0, 12), name: 'Sea View', basePrice: 2000 },
  })).id;
  guestId = (await prisma.guest.create({
    data: { tenantId, firstName: 'Rafiq', lastName: 'Probe', email: `g-${run}@test.com` },
  })).id;
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('confirming a booking', () => {
  it('enrols the guest in a sequence waiting on it', async () => {
    const seq = await makeSequence('BOOKING_CONFIRMED');

    const res = await createBooking();
    expect(res.statusCode, res.body).toBe(201);
    await settle();

    expect(await enrolledIn(seq)).toContain(guestId);
  });

  it('records what the email needs — the confirmation number and the room', async () => {
    const seq = await makeSequence('BOOKING_CONFIRMED');
    await createBooking();
    await settle();

    const enrolment = await prisma.sequenceEnrollment.findFirstOrThrow({
      where: { sequenceId: seq },
    });
    expect(enrolment.triggerMeta).toMatchObject({ roomName: 'Sea View' });
    expect((enrolment.triggerMeta as { confirmationNo: string }).confirmationNo).toBeTruthy();
  });

  it('leaves a paused sequence alone', async () => {
    const seq = await makeSequence('BOOKING_CONFIRMED', 'PAUSED');
    await createBooking();
    await settle();

    expect(await enrolledIn(seq)).toHaveLength(0);
  });

  it('does not enrol a guest who has opted out', async () => {
    const quiet = await prisma.guest.create({
      data: { tenantId, firstName: 'Quiet', lastName: 'P', email: `quiet-${run}@test.com` },
    });
    await prisma.emailConsent.create({ data: { tenantId, guestId: quiet.id, subscribed: false } });

    const seq = await makeSequence('BOOKING_CONFIRMED');
    await createBooking({ guestId: quiet.id });
    await settle();

    expect(await enrolledIn(seq)).not.toContain(quiet.id);
  });
});

describe('checking a guest in', () => {
  it('enrols them in a CHECK_IN sequence', async () => {
    const seq = await makeSequence('CHECK_IN');

    const created = await createBooking();
    const bookingId = JSON.parse(created.body).data.id;

    const res = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-in`, headers: auth, payload: {},
    });
    expect(res.statusCode, res.body).toBe(200);
    await settle();

    expect(await enrolledIn(seq)).toContain(guestId);
  });

  it('fires for a walk-in, which arrives already checked in', async () => {
    const seq = await makeSequence('CHECK_IN');
    const walkIn = await prisma.guest.create({
      data: { tenantId, firstName: 'Walk', lastName: 'In', email: `walk-${run}@test.com` },
    });

    const res = await createBooking({
      guestId: walkIn.id,
      autoCheckIn: true,
      checkIn: new Date().toISOString().slice(0, 10),
      checkOut: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    });
    expect(res.statusCode, res.body).toBe(201);
    await settle();

    expect(await enrolledIn(seq)).toContain(walkIn.id);
  });
});

describe('a resort with no sequences', () => {
  it('books and checks in exactly as before', async () => {
    // Nothing is waiting, so nothing should be looked up or written.
    const before = await prisma.sequenceEnrollment.count({ where: { tenantId } });
    const res = await createBooking();
    await settle();

    expect(res.statusCode).toBe(201);
    expect(await prisma.sequenceEnrollment.count({ where: { tenantId } }))
      .toBeGreaterThanOrEqual(before);
  });
});
