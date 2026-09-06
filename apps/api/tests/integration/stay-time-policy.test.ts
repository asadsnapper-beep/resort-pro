/**
 * quoteStayTime() — what the desk may offer for an early arrival or a late
 * departure.
 *
 * The rule these tests exist to pin: availability is decided before price, and
 * when the room cannot be given there is no price at all. A quote that says
 * "৳3,187" about a room being cleaned is how a guest gets promised a room the
 * resort cannot hand over.
 *
 * Times below are wall-clock in Asia/Dhaka (UTC+6), which is the whole point —
 * "free after 11:00" means 11:00 where the resort is.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { quoteStayTime } from '../../src/services/stay-time-policy';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `stay-time-${Date.now()}`;
const password = 'TestPass123!';
let tenantId: string;
let guestId: string;
let roomSeq = 0;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** An instant expressed as Dhaka wall-clock on the stay's arrival date. */
const dhaka = (day: string, time: string) => new Date(`${day}T${time}:00+06:00`);

/**
 * Each stay gets its own room unless one is named. Sharing a room across the
 * fixtures would make every earlier booking block every later one — which is
 * the availability rule working, but not what most of these tests are about.
 */
async function makeRoom() {
  roomSeq += 1;
  return prisma.room.create({
    data: { tenantId, number: `3${String(roomSeq).padStart(2, '0')}`, name: `Hillside ${roomSeq}`, basePrice: 10000 },
  });
}

async function makeBooking(opts: { total?: number; status?: string; checkIn?: string; checkOut?: string; roomId?: string } = {}) {
  const roomId = opts.roomId ?? (await makeRoom()).id;
  return prisma.booking.create({
    data: {
      tenantId, roomId, guestId,
      checkIn: new Date(opts.checkIn ?? '2029-03-10'),
      checkOut: new Date(opts.checkOut ?? '2029-03-12'),
      totalAmount: opts.total ?? 8000,
      status: (opts.status ?? 'CONFIRMED') as never,
      confirmationNo: `ST-${randomUUID().slice(0, 8).toUpperCase()}`,
    },
  });
}

async function setPolicy(data: Record<string, unknown>) {
  return prisma.stayTimePolicy.upsert({
    where: { tenantId },
    create: { tenantId, enabled: true, ...data },
    update: { enabled: true, ...data },
  });
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Stay Time Test', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  const token = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { planStatus: 'active', plan: 'ENTERPRISE', taxRate: 0, timezone: 'Asia/Dhaka', checkInTime: '14:00', checkOutTime: '11:00' },
  });

  void token;

  guestId = (await prisma.guest.create({
    data: { tenantId, firstName: 'Early', lastName: 'Bird', email: `guest-${slug}@test.com` },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('early check-in — banding', () => {
  beforeAll(() => setPolicy({ earlyFreeAfter: '11:00', earlyHalfAfter: '06:00', halfRatePercent: 50 }));

  it('charges nothing for an arrival inside the free window', async () => {
    const booking = await makeBooking();               // 8000 over 2 nights → 4000/night
    const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '12:00') });

    expect(q.available).toBe(true);
    expect(q.band).toBe('FREE');
    expect(q.quotedFee).toBe(0);
  });

  it('charges half a night at 08:30', async () => {
    const booking = await makeBooking();
    const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30') });

    expect(q.band).toBe('HALF');
    expect(q.quotedFee).toBe(2000);
  });

  it('charges a full night at 04:00, because that is the night before', async () => {
    const booking = await makeBooking();
    const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '04:00') });

    expect(q.band).toBe('FULL');
    expect(q.quotedFee).toBe(4000);
  });

  it('has nothing to grant once normal check-in time arrives', async () => {
    const booking = await makeBooking();
    const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '15:00') });

    expect(q.withinNormalHours).toBe(true);
    expect(q.quotedFee).toBe(0);
  });

  it('reads the clock in the resort’s timezone, not the server’s', async () => {
    const booking = await makeBooking();
    // 01:00 UTC is 07:00 in Dhaka — inside the half band, not the full one.
    const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: new Date('2029-03-10T01:00:00Z') });

    expect(q.band).toBe('HALF');
  });
});

describe('early check-in — the room has to be givable first', () => {
  beforeAll(() => setPolicy({ earlyFreeAfter: '11:00', earlyHalfAfter: '06:00' }));

  it('refuses a room that is being cleaned, and quotes no price for it', async () => {
    const booking = await makeBooking();
    await prisma.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });
    try {
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30') });

      expect(q.available).toBe(false);
      expect(q.blockers[0]!.kind).toBe('ROOM_BEING_CLEANED');
      expect(q.band).toBeNull();
      expect(q.quotedFee).toBe(0);
      expect(q.requiresOverride).toBe(true);
    } finally {
      await prisma.room.update({ where: { id: booking.roomId }, data: { status: 'AVAILABLE' } });
    }
  });

  it('refuses when another stay still holds the room', async () => {
    const booking = await makeBooking();
    const blocker = await makeBooking({ roomId: booking.roomId, checkIn: '2029-03-09', checkOut: '2029-03-11', status: 'CONFIRMED' });
    try {
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30') });

      expect(q.available).toBe(false);
      expect(q.blockers.map(b => b.kind)).toContain('OVERLAPPING_BOOKING');
    } finally {
      await prisma.booking.delete({ where: { id: blocker.id } });
    }
  });

  it('refuses while the departing guest is still in the room', async () => {
    const booking = await makeBooking();
    // Their stay ends today, so it does not overlap by dates — but they are here.
    const departing = await makeBooking({ roomId: booking.roomId, checkIn: '2029-03-08', checkOut: '2029-03-10', status: 'CHECKED_IN' });
    try {
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30') });

      expect(q.available).toBe(false);
      expect(q.blockers.map(b => b.kind)).toContain('PREVIOUS_GUEST_PRESENT');
    } finally {
      await prisma.booking.delete({ where: { id: departing.id } });
    }
  });

  it('refuses while a cleaning task is still open on the room', async () => {
    const booking = await makeBooking();
    const task = await prisma.housekeepingTask.create({
      data: { tenantId, roomId: booking.roomId, type: 'CHECKOUT', status: 'PENDING', scheduledDate: new Date('2029-03-10') },
    });
    try {
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30') });

      expect(q.available).toBe(false);
      expect(q.blockers.map(b => b.kind)).toContain('HOUSEKEEPING_OPEN');
    } finally {
      await prisma.housekeepingTask.delete({ where: { id: task.id } });
    }
  });
});

describe('late checkout', () => {
  beforeAll(() => setPolicy({ lateFreeUntil: '14:00', lateHalfUntil: '18:00', halfRatePercent: 50 }));

  it('charges half for leaving at 17:00', async () => {
    const booking = await makeBooking({ status: 'CHECKED_IN' });
    const q = await quoteStayTime(tenantId, booking.id, { kind: 'LATE_CHECKOUT', at: dhaka('2029-03-12', '17:00') });

    expect(q.band).toBe('HALF');
    expect(q.quotedFee).toBe(2000);
  });

  it('charges a full night for leaving at 19:00', async () => {
    const booking = await makeBooking({ status: 'CHECKED_IN' });
    const q = await quoteStayTime(tenantId, booking.id, { kind: 'LATE_CHECKOUT', at: dhaka('2029-03-12', '19:00') });

    expect(q.band).toBe('FULL');
    expect(q.quotedFee).toBe(4000);
  });

  it('refuses when the room is wanted by an arrival that day', async () => {
    const booking = await makeBooking({ status: 'CHECKED_IN' });
    const arrival = await makeBooking({ roomId: booking.roomId, checkIn: '2029-03-12', checkOut: '2029-03-14', status: 'CONFIRMED' });
    try {
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'LATE_CHECKOUT', at: dhaka('2029-03-12', '17:00') });

      expect(q.available).toBe(false);
      expect(q.blockers.map(b => b.kind)).toContain('ARRIVAL_TODAY');
      expect(q.quotedFee).toBe(0);
    } finally {
      await prisma.booking.delete({ where: { id: arrival.id } });
    }
  });

  it('allows leaving before the next guest may claim the room', async () => {
    const booking = await makeBooking({ status: 'CHECKED_IN' });
    const arrival = await makeBooking({ roomId: booking.roomId, checkIn: '2029-03-12', checkOut: '2029-03-14', status: 'CONFIRMED' });
    try {
      // Noon on a day with a 14:00 arrival takes nothing from anyone.
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'LATE_CHECKOUT', at: dhaka('2029-03-12', '12:00') });

      expect(q.available).toBe(true);
      expect(q.band).toBe('FREE');
    } finally {
      await prisma.booking.delete({ where: { id: arrival.id } });
    }
  });
});

describe('what the fee is derived from', () => {
  it('uses the guest’s own nightly rate, not the rack rate', async () => {
    await setPolicy({ chargeBasis: 'EFFECTIVE', earlyHalfAfter: '06:00', earlyFreeAfter: '11:00' });
    // A promotional stay: 5000 for two nights against a 10000 rack rate.
    const booking = await makeBooking({ total: 5000 });
    const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30') });

    expect(q.nightlyRate).toBe(2500);
    expect(q.quotedFee).toBe(1250);
  });

  it('uses the room’s rack rate when the resort prices it as a service', async () => {
    await setPolicy({ chargeBasis: 'BASE', earlyHalfAfter: '06:00', earlyFreeAfter: '11:00' });
    try {
      const booking = await makeBooking({ total: 5000 });
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30') });

      expect(q.nightlyRate).toBe(10000);
      expect(q.quotedFee).toBe(5000);
    } finally {
      await setPolicy({ chargeBasis: 'EFFECTIVE' });
    }
  });
});

describe('a resort that has not turned the policy on', () => {
  it('is told the timing and offered no fee', async () => {
    await prisma.stayTimePolicy.upsert({
      where: { tenantId }, create: { tenantId, enabled: false }, update: { enabled: false },
    });
    try {
      const booking = await makeBooking();
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '04:00') });

      expect(q.policyEnabled).toBe(false);
      expect(q.available).toBe(true);       // the room is still givable
      expect(q.band).toBeNull();            // but nothing is proposed
      expect(q.quotedFee).toBe(0);
    } finally {
      await setPolicy({});
    }
  });

  it('gets the same answer when no policy row exists at all', async () => {
    await prisma.stayTimePolicy.deleteMany({ where: { tenantId } });
    try {
      const booking = await makeBooking();
      const q = await quoteStayTime(tenantId, booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '04:00') });

      expect(q.policyEnabled).toBe(false);
      expect(q.band).toBeNull();
    } finally {
      await setPolicy({});
    }
  });
});
