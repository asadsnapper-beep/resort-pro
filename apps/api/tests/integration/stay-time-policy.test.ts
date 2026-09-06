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
import { bill } from '../../src/services/billing';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `stay-time-${Date.now()}`;
const password = 'TestPass123!';
let tenantId: string;
let guestId: string;
let ownerToken: string;
let receptionistToken: string;
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

  ownerToken = token;

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

describe('GET /api/bookings/:id/stay-time', () => {
  const quote = (bookingId: string, params: Record<string, string>, token = ownerToken) => app.inject({
    method: 'GET',
    url: `/api/bookings/${bookingId}/stay-time?${new URLSearchParams(params)}`,
    headers: { Authorization: `Bearer ${token}` },
  });

  beforeAll(async () => {
    await prisma.tenantFeatureFlag.upsert({
      where: { tenantId_flag: { tenantId, flag: 'stay_time_policy' } },
      create: { tenantId, flag: 'stay_time_policy', enabled: true },
      update: { enabled: true },
    });
    await setPolicy({ earlyFreeAfter: '11:00', earlyHalfAfter: '06:00', lateFreeUntil: '14:00', lateHalfUntil: '18:00' });

    const bcrypt = await import('bcryptjs');
    const email = `desk-${slug}@test.com`;
    await prisma.user.create({
      data: {
        tenantId, email, passwordHash: await bcrypt.hash(password, 10),
        firstName: 'Rita', lastName: 'Desk', role: 'RECEPTIONIST', emailVerifiedAt: new Date(),
      },
    });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password, slug } });
    receptionistToken = JSON.parse(login.body).data.token;
  });

  it('quotes an early arrival', async () => {
    const booking = await makeBooking();
    const res = await quote(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });

    expect(res.statusCode).toBe(200);
    const q = JSON.parse(res.body).data;
    expect(q.available).toBe(true);
    expect(q.band).toBe('HALF');
    expect(q.quotedFee).toBe(2000);
  });

  it('is readable by the receptionist who is standing at the desk', async () => {
    const booking = await makeBooking();
    const res = await quote(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() }, receptionistToken);

    expect(res.statusCode).toBe(200);
  });

  it('says a room cannot be given without naming a price for it', async () => {
    const booking = await makeBooking();
    await prisma.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });
    try {
      const res = await quote(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });
      const q = JSON.parse(res.body).data;

      expect(q.available).toBe(false);
      expect(q.band).toBeNull();
      expect(res.body).not.toMatch(/"quotedFee":[1-9]/);
    } finally {
      await prisma.room.update({ where: { id: booking.roomId }, data: { status: 'AVAILABLE' } });
    }
  });

  it('refuses a question with no sensible answer', async () => {
    const arrived = await makeBooking({ status: 'CHECKED_IN' });
    const early = await quote(arrived.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });
    expect(early.statusCode).toBe(400);

    const notArrived = await makeBooking({ status: 'CONFIRMED' });
    const late = await quote(notArrived.id, { kind: 'LATE_CHECKOUT', at: dhaka('2029-03-12', '17:00').toISOString() });
    expect(late.statusCode).toBe(400);
  });

  it('rejects a malformed question rather than guessing', async () => {
    const booking = await makeBooking();
    expect((await quote(booking.id, { kind: 'WHENEVER' })).statusCode).toBe(400);
    expect((await quote(booking.id, { kind: 'EARLY_CHECKIN', at: 'tomorrow morning' })).statusCode).toBe(400);
  });

  it('does not answer for another resort’s booking', async () => {
    const other = await prisma.tenant.create({ data: { name: 'Other', slug: `${slug}-other` } });
    try {
      const room = await prisma.room.create({ data: { tenantId: other.id, number: '1', name: 'R', basePrice: 100 } });
      const guest = await prisma.guest.create({ data: { tenantId: other.id, firstName: 'A', lastName: 'B', email: `x-${slug}@t.com` } });
      const foreign = await prisma.booking.create({
        data: {
          tenantId: other.id, roomId: room.id, guestId: guest.id,
          checkIn: new Date('2029-03-10'), checkOut: new Date('2029-03-12'),
          totalAmount: 100, status: 'CONFIRMED', confirmationNo: `OT-${randomUUID().slice(0, 8)}`,
        },
      });
      const res = await quote(foreign.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });
      expect(res.statusCode).toBe(404);
    } finally {
      await prisma.tenant.delete({ where: { id: other.id } });
    }
  });

  it('is invisible to a resort that has not been given the feature', async () => {
    await prisma.tenantFeatureFlag.update({
      where: { tenantId_flag: { tenantId, flag: 'stay_time_policy' } },
      data: { enabled: false },
    });
    try {
      const booking = await makeBooking();
      const res = await quote(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).code).toBe('PLAN_UPGRADE_REQUIRED');
    } finally {
      await prisma.tenantFeatureFlag.update({
        where: { tenantId_flag: { tenantId, flag: 'stay_time_policy' } },
        data: { enabled: true },
      });
    }
  });
});

describe('POST /api/bookings/:id/stay-time — granting it', () => {
  const grant = (bookingId: string, body: Record<string, unknown>, token = ownerToken) => app.inject({
    method: 'POST', url: `/api/bookings/${bookingId}/stay-time`,
    headers: { Authorization: `Bearer ${token}` }, payload: body,
  });

  beforeAll(async () => {
    await prisma.tenantFeatureFlag.upsert({
      where: { tenantId_flag: { tenantId, flag: 'stay_time_policy' } },
      create: { tenantId, flag: 'stay_time_policy', enabled: true },
      update: { enabled: true },
    });
    await setPolicy({ earlyFreeAfter: '11:00', earlyHalfAfter: '06:00', halfRatePercent: 50, waiverRequiresManager: false });
  });

  it('puts the fee on the bill through an extra, not a total of its own', async () => {
    const booking = await makeBooking();
    const res = await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });

    expect(res.statusCode).toBe(201);
    const { grant: g } = JSON.parse(res.body).data;
    expect(g.policyBand).toBe('HALF');
    expect(g.quotedFee).toBe(2000);
    expect(g.chargedFee).toBe(2000);

    const extras = await prisma.invoiceExtra.findMany({ where: { bookingId: booking.id } });
    expect(extras).toHaveLength(1);
    expect(extras[0]!.amount).toBe(2000);
    expect(extras[0]!.description).toContain('08:30');   // the resort's clock
    expect(g.invoiceExtraId).toBe(extras[0]!.id);
  });

  it('reaches the guest’s bill exactly once', async () => {
    const booking = await makeBooking({ status: 'CONFIRMED' });
    await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });

    const billed = await bill(tenantId, booking.id);
    const lines = billed.lines.filter(l => l.description.includes('Early check-in'));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.total).toBe(2000);
    expect(billed.grandTotal).toBe(8000 + 2000);
  });

  it('records nothing to collect when the arrival is free', async () => {
    const booking = await makeBooking();
    const res = await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '12:00').toISOString() });

    expect(res.statusCode).toBe(201);
    const { grant: g } = JSON.parse(res.body).data;
    expect(g.policyBand).toBe('FREE');
    expect(g.chargedFee).toBe(0);
    expect(await prisma.invoiceExtra.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it('refuses a repeat of the same grant instead of charging twice', async () => {
    const booking = await makeBooking();
    const at = dhaka('2029-03-10', '08:30').toISOString();

    const first = await grant(booking.id, { kind: 'EARLY_CHECKIN', at });
    const again = await grant(booking.id, { kind: 'EARLY_CHECKIN', at });

    expect([first.statusCode, again.statusCode]).toEqual([201, 409]);
    expect(await prisma.invoiceExtra.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it('holds even when both requests arrive at once', async () => {
    const booking = await makeBooking();
    const at = dhaka('2029-03-10', '08:30').toISOString();

    const [a, b] = await Promise.all([
      grant(booking.id, { kind: 'EARLY_CHECKIN', at }),
      grant(booking.id, { kind: 'EARLY_CHECKIN', at }),
    ]);

    expect([a.statusCode, b.statusCode].filter(c => c === 201)).toHaveLength(1);
    expect(await prisma.stayTimeGrant.count({ where: { bookingId: booking.id } })).toBe(1);
    expect(await prisma.invoiceExtra.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it('waives the fee with a reason, and says so in the audit trail', async () => {
    const booking = await makeBooking();
    const res = await grant(booking.id, {
      kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString(),
      waive: true, reason: 'Regular guest, flight landed at dawn',
    });

    expect(res.statusCode).toBe(201);
    const { grant: g } = JSON.parse(res.body).data;
    expect(g.quotedFee).toBe(2000);     // what it would have cost
    expect(g.waivedAmount).toBe(2000);  // what was given away
    expect(g.chargedFee).toBe(0);
    expect(await prisma.invoiceExtra.count({ where: { bookingId: booking.id } })).toBe(0);

    const audit = await prisma.billingAudit.findFirstOrThrow({ where: { bookingId: booking.id, action: 'WAIVE' } });
    expect(audit.amount).toBe(-2000);
    expect(audit.reason).toBe('Regular guest, flight landed at dawn');
    expect(audit.actorId).toBeTruthy();
  });

  it('will not waive silently', async () => {
    const booking = await makeBooking();
    const res = await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString(), waive: true });

    expect(res.statusCode).toBe(400);
    expect(await prisma.stayTimeGrant.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it('keeps the waiver from the desk when the resort says a manager decides', async () => {
    await setPolicy({ waiverRequiresManager: true });
    try {
      const booking = await makeBooking();
      const res = await grant(booking.id, {
        kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString(),
        waive: true, reason: 'Goodwill',
      }, receptionistToken);

      expect(res.statusCode).toBe(403);
      expect(await prisma.stayTimeGrant.count({ where: { bookingId: booking.id } })).toBe(0);
    } finally {
      await setPolicy({ waiverRequiresManager: false });
    }
  });

  it('lets the desk waive when the resort says it may', async () => {
    const booking = await makeBooking();
    const res = await grant(booking.id, {
      kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString(),
      waive: true, reason: 'Goodwill',
    }, receptionistToken);

    expect(res.statusCode).toBe(201);
  });

  it('needs a manager and a reason to hand over a room that is not ready', async () => {
    const booking = await makeBooking();
    await prisma.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });
    try {
      const at = dhaka('2029-03-10', '08:30').toISOString();

      const desk = await grant(booking.id, { kind: 'EARLY_CHECKIN', at, reason: 'Guest waiting' }, receptionistToken);
      expect(desk.statusCode).toBe(403);

      const silent = await grant(booking.id, { kind: 'EARLY_CHECKIN', at });
      expect(silent.statusCode).toBe(400);

      const withReason = await grant(booking.id, { kind: 'EARLY_CHECKIN', at, reason: 'Room ready early, status stale' });
      expect(withReason.statusCode).toBe(201);
      expect(JSON.parse(withReason.body).data.grant.overrideReason).toBe('Room ready early, status stale');
      // Overridden, so the room was given — but no fee was invented for it.
      expect(JSON.parse(withReason.body).data.grant.chargedFee).toBe(0);
    } finally {
      await prisma.room.update({ where: { id: booking.roomId }, data: { status: 'AVAILABLE' } });
    }
  });

  it('records no grant while the policy is off', async () => {
    await prisma.stayTimePolicy.update({ where: { tenantId }, data: { enabled: false } });
    try {
      const booking = await makeBooking();
      const res = await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });

      expect(res.statusCode).toBe(400);
      expect(await prisma.stayTimeGrant.count({ where: { bookingId: booking.id } })).toBe(0);
    } finally {
      await setPolicy({});
    }
  });
});

describe('replacing a grant, and the cleaning queue', () => {
  const grant = (bookingId: string, body: Record<string, unknown>) => app.inject({
    method: 'POST', url: `/api/bookings/${bookingId}/stay-time`,
    headers: { Authorization: `Bearer ${ownerToken}` }, payload: body,
  });

  beforeAll(() => setPolicy({
    earlyFreeAfter: '11:00', earlyHalfAfter: '06:00',
    lateFreeUntil: '14:00', lateHalfUntil: '18:00', halfRatePercent: 50,
  }));

  it('voids the earlier grant instead of overwriting it', async () => {
    const booking = await makeBooking();
    await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });

    const res = await grant(booking.id, {
      kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '04:00').toISOString(),
      supersede: true, reason: 'Guest arrived earlier than they said',
    });
    expect(res.statusCode).toBe(201);

    const grants = await prisma.stayTimeGrant.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'asc' } });
    expect(grants).toHaveLength(2);
    // The first is still readable — its band, its quote, who approved it.
    expect(grants[0]!.voidedAt).not.toBeNull();
    expect(grants[0]!.policyBand).toBe('HALF');
    expect(grants[0]!.activeKey).toBe(grants[0]!.id);
    expect(grants[1]!.voidedAt).toBeNull();
    expect(grants[1]!.policyBand).toBe('FULL');
  });

  it('leaves the guest with one fee, not two', async () => {
    const booking = await makeBooking();
    await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });
    await grant(booking.id, {
      kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '04:00').toISOString(),
      supersede: true, reason: 'Arrived earlier',
    });

    const extras = await prisma.invoiceExtra.findMany({ where: { bookingId: booking.id } });
    expect(extras).toHaveLength(1);
    expect(extras[0]!.amount).toBe(4000);          // the full night, not 2000 + 4000
    expect((await bill(tenantId, booking.id)).grandTotal).toBe(8000 + 4000);
  });

  it('records who dropped the earlier charge and why', async () => {
    const booking = await makeBooking();
    await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });
    await grant(booking.id, {
      kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '12:00').toISOString(),
      supersede: true, reason: 'Quoted the wrong hour',
    });

    const audit = await prisma.billingAudit.findFirstOrThrow({ where: { bookingId: booking.id, action: 'VOID' } });
    expect(audit.amount).toBe(-2000);
    expect(audit.reason).toBe('Quoted the wrong hour');
  });

  it('will not replace a grant silently', async () => {
    const booking = await makeBooking();
    const at = dhaka('2029-03-10', '08:30').toISOString();
    await grant(booking.id, { kind: 'EARLY_CHECKIN', at });

    const noReason = await grant(booking.id, { kind: 'EARLY_CHECKIN', at, supersede: true });
    expect(noReason.statusCode).toBe(400);

    const noFlag = await grant(booking.id, { kind: 'EARLY_CHECKIN', at });
    expect(noFlag.statusCode).toBe(409);

    expect(await prisma.stayTimeGrant.count({ where: { bookingId: booking.id, voidedAt: null } })).toBe(1);
  });

  it('refuses to rewrite a stay that has already been billed', async () => {
    const booking = await makeBooking();
    await grant(booking.id, { kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '08:30').toISOString() });
    await prisma.invoice.create({
      data: {
        tenantId, bookingId: booking.id, guestName: 'Early Bird',
        invoiceNumber: `INV-ST-${randomUUID().slice(0, 8)}`, finalizedAt: new Date(),
      },
    });

    const res = await grant(booking.id, {
      kind: 'EARLY_CHECKIN', at: dhaka('2029-03-10', '04:00').toISOString(),
      supersede: true, reason: 'Too late to change this',
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toMatch(/adjustment/i);
    // The charge the guest was billed is untouched.
    expect(await prisma.invoiceExtra.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it('moves the room’s cleaning to the hour it is actually released', async () => {
    const booking = await makeBooking({ status: 'CHECKED_IN' });
    const task = await prisma.housekeepingTask.create({
      data: {
        tenantId, roomId: booking.roomId, type: 'CHECKOUT', status: 'PENDING',
        scheduledDate: new Date('2029-03-12T05:00:00Z'),   // 11:00 Dhaka, normal checkout
      },
    });

    const releaseAt = dhaka('2029-03-12', '17:00');
    const res = await grant(booking.id, { kind: 'LATE_CHECKOUT', at: releaseAt.toISOString() });
    expect(res.statusCode).toBe(201);

    const moved = await prisma.housekeepingTask.findUniqueOrThrow({ where: { id: task.id } });
    // scheduledDate is a calendar date, so the hour lives in notBefore — the
    // board can say "released at 17:00" instead of showing an 11:00 arrear.
    expect(moved.notBefore?.toISOString()).toBe(releaseAt.toISOString());
    expect(moved.scheduledDate.toISOString()).toBe('2029-03-12T00:00:00.000Z');
  });

  it('does not disturb cleaning already finished, or other rooms', async () => {
    const booking = await makeBooking({ status: 'CHECKED_IN' });
    const done = await prisma.housekeepingTask.create({
      data: {
        tenantId, roomId: booking.roomId, type: 'CHECKOUT', status: 'COMPLETED',
        scheduledDate: new Date('2029-03-12T05:00:00Z'),
      },
    });
    const elsewhere = await prisma.housekeepingTask.create({
      data: {
        tenantId, roomId: (await makeRoom()).id, type: 'CHECKOUT', status: 'PENDING',
        scheduledDate: new Date('2029-03-12T05:00:00Z'),
      },
    });

    await grant(booking.id, { kind: 'LATE_CHECKOUT', at: dhaka('2029-03-12', '17:00').toISOString() });

    expect((await prisma.housekeepingTask.findUniqueOrThrow({ where: { id: done.id } })).notBefore).toBeNull();
    expect((await prisma.housekeepingTask.findUniqueOrThrow({ where: { id: elsewhere.id } })).notBefore).toBeNull();
  });
});
