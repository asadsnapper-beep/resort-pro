/**
 * The figures behind the 360 dashboard.
 *
 * Three of these tests are the reason the endpoint exists in this shape. A
 * resort shared as figures only must contribute numbers and nothing else — the
 * assertion is on the serialised body, because a guest name leaking through a
 * relation would pass any shape check. Money must not be added across
 * currencies. And occupancy across resorts is not the average of their
 * percentages.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { tenantToday, tenantTodayRange, tenantMonthStartInstant } from '../../src/utils/tenant-day';
import { clearResortOverviewCache } from '../../src/services/resort-overview';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-360-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;
const GUEST_SURNAME = `Chowdhury${Date.now()}`;

let token: string;
let ownerUserId: string;
let passwordHash: string;
let homeId: string;
const tenants: Record<string, string> = {};

const overview = (bearer = token) => app.inject({
  method: 'GET', url: '/api/resort-group/overview',
  headers: { Authorization: `Bearer ${bearer}` },
});

const body = async () => JSON.parse((await overview()).body).data;
const cardFor = async (tenantId: string) =>
  (await body()).resorts.find((r: { tenantId: string }) => r.tenantId === tenantId);

async function makeResort(key: string, over: { currency?: string; timezone?: string } = {}) {
  const tenant = await prisma.tenant.create({
    data: {
      name: key, slug: `${run}-${key}`, planStatus: 'active',
      currency: over.currency ?? 'BDT', timezone: over.timezone ?? 'Asia/Dhaka',
    },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id, email: myEmail, passwordHash, firstName: 'Owner', lastName: key,
      role: 'OWNER', emailVerifiedAt: new Date(),
    },
  });
  tenants[key] = tenant.id;
  return tenant.id;
}

/** A room, a guest and a booking arriving on that resort's own today. */
async function stock(tenantId: string, opts: {
  rooms: number; occupied?: number; arrivesOn?: Date; revenue?: number; expense?: number;
  invoiceTotal?: number; invoicePaid?: number;
}) {
  const made: string[] = [];
  for (let i = 0; i < opts.rooms; i += 1) {
    const room = await prisma.room.create({
      data: {
        tenantId, number: `${tenantId.slice(0, 4)}-${i}`, name: `Room ${i}`, basePrice: 1000,
        status: i < (opts.occupied ?? 0) ? 'OCCUPIED' : 'AVAILABLE',
      },
    });
    made.push(room.id);
  }
  if (opts.arrivesOn && made[0]) {
    const guest = await prisma.guest.create({
      data: { tenantId, firstName: 'Rafiq', lastName: GUEST_SURNAME, email: `g-${tenantId}@test.com` },
    });
    const next = new Date(opts.arrivesOn);
    next.setUTCDate(next.getUTCDate() + 1);
    await prisma.booking.create({
      data: {
        tenantId, roomId: made[0], guestId: guest.id, checkIn: opts.arrivesOn, checkOut: next,
        status: 'CONFIRMED', totalAmount: 5000, confirmationNo: `C-${tenantId.slice(0, 8)}-${Date.now()}`,
      },
    });
  }
  if (opts.revenue) {
    await prisma.payment.create({
      data: { tenantId, amount: opts.revenue, status: 'PAID', processedAt: new Date() },
    });
  }
  if (opts.expense) {
    await prisma.expense.create({
      data: {
        tenantId, date: tenantToday('UTC'), category: 'SUPPLIES',
        description: 'Soap', amount: opts.expense, createdBy: 'test',
      },
    });
  }
  if (opts.invoiceTotal) {
    await prisma.invoice.create({
      data: {
        tenantId, invoiceNumber: `INV-${tenantId.slice(0, 8)}-${Date.now()}`,
        guestName: 'Someone', status: 'SENT',
        total: opts.invoiceTotal, paidAmount: opts.invoicePaid ?? 0,
      },
    });
  }
}

async function connect(key: string) {
  const res = await app.inject({
    method: 'POST', url: '/api/resort-group/links',
    headers: { Authorization: `Bearer ${token}` }, payload: { slug: `${run}-${key}` },
  });
  expect(res.statusCode, res.body).toBe(200);
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Sea Pearl', slug: run, firstName: 'Owner', lastName: 'Test', email: myEmail, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  homeId = JSON.parse(reg.body).data.tenant.id;
  tenants.home = homeId;
  token = await verifyOwnerAndLogin(app, { tenantId: homeId, email: myEmail, password, slug: run });
  await prisma.tenant.update({
    where: { id: homeId }, data: { planStatus: 'active', timezone: 'Pacific/Kiritimati' },
  });

  const me = await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    select: { id: true, passwordHash: true },
  });
  ownerUserId = me.id;
  passwordHash = me.passwordHash;

  // Kiritimati is +14 and Niue is −11: 25 hours apart, so their calendar dates
  // never agree. One fixed timezone for both cannot make both arrival counts
  // right.
  await makeResort('niue', { timezone: 'Pacific/Niue' });
  await makeResort('dollars', { currency: 'USD' });
  await makeResort('empty');

  await stock(homeId, {
    rooms: 100, occupied: 20, arrivesOn: tenantToday('Pacific/Kiritimati'),
    revenue: 60000, expense: 10000, invoiceTotal: 8000, invoicePaid: 3000,
  });
  await stock(tenants.niue, {
    rooms: 2, occupied: 2, arrivesOn: tenantToday('Pacific/Niue'), revenue: 4000,
  });
  await stock(tenants.dollars, { rooms: 10, occupied: 5, revenue: 900 });
  await stock(tenants.empty, { rooms: 0 });

  await connect('niue');
  await connect('dollars');
  await connect('empty');
}, 60000);

afterAll(async () => {
  await prisma.resortGroup.deleteMany({ where: { OR: [{ ownerUserId }, { name: { contains: run } }] } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('who may ask', () => {
  it('refuses an owner with no connected resorts', async () => {
    const other = await prisma.tenant.create({
      data: { name: 'Alone', slug: `${run}-alone`, planStatus: 'active' },
    });
    await prisma.user.create({
      data: {
        tenantId: other.id, email: `alone-${run}@test.com`, passwordHash,
        firstName: 'A', lastName: 'B', role: 'OWNER', emailVerifiedAt: new Date(),
      },
    });
    const alone = await verifyOwnerAndLogin(app, {
      tenantId: other.id, email: `alone-${run}@test.com`, password, slug: `${run}-alone`,
    });

    const res = await overview(alone);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('NO_RESORT_GROUP');
  });

  it('refuses an unauthenticated caller', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/resort-group/overview' })).statusCode).toBe(401);
  });
});

describe('each resort\'s figures', () => {
  it('counts rooms and occupancy', async () => {
    expect((await cardFor(homeId)).numbers).toMatchObject({ rooms: 100, occupied: 20, occupancyPct: 20 });
  });

  it('answers 0% for a resort with no rooms rather than NaN', async () => {
    const card = await cardFor(tenants.empty);
    expect(card.numbers.occupancyPct).toBe(0);
    expect(Number.isNaN(card.numbers.occupancyPct)).toBe(false);
  });

  it('works out profit, and what is still owed on issued invoices', async () => {
    expect((await cardFor(homeId)).numbers).toMatchObject({
      revenueMonth: 60000, expensesMonth: 10000, profitMonth: 50000, outstanding: 5000,
    });
  });

  it('counts today\'s arrivals in the resort\'s own timezone, not the server\'s', async () => {
    // These two resorts are never on the same calendar date.
    expect((await cardFor(homeId)).numbers.arrivals).toBe(1);
    expect((await cardFor(tenants.niue)).numbers.arrivals).toBe(1);
  });

  it('prints the date it is at that resort right now', async () => {
    const home = await cardFor(homeId);
    expect(home.localDate).toBe(tenantTodayRange('Pacific/Kiritimati').gte.toISOString().slice(0, 10));
    expect((await cardFor(tenants.niue)).localDate).not.toBe(home.localDate);
  });
});

describe('totals', () => {
  it('adds up within a currency', async () => {
    const bdt = (await body()).currencies.find((c: { currency: string }) => c.currency === 'BDT');
    expect(bdt.totals).toMatchObject({ rooms: 102, occupied: 22, revenueMonth: 64000 });
  });

  it('keeps a second currency apart instead of inventing a rate', async () => {
    const data = await body();
    expect(data.currencies.map((c: { currency: string }) => c.currency)).toEqual(['BDT', 'USD']);
    const usd = data.currencies.find((c: { currency: string }) => c.currency === 'USD');
    expect(usd.totals.revenueMonth).toBe(900);
    expect(usd.totals.rooms).toBe(10);
  });

  it('works occupancy out of the rooms, not by averaging percentages', async () => {
    // 100 rooms at 20% beside 2 rooms at 100% is 21.6%, not 60%.
    const bdt = (await body()).currencies.find((c: { currency: string }) => c.currency === 'BDT');
    expect(bdt.totals.occupancyPct).toBe(21.6);
  });
});

describe('a resort shared as figures only', () => {
  beforeAll(async () => {
    await prisma.resortGroupTenant.update({
      where: { tenantId: tenants.niue }, data: { access: 'NUMBERS_ONLY' },
    });
    // Changed underneath the endpoint rather than through it, so the minute of
    // cache from the tests above has to go.
    clearResortOverviewCache();
  });

  it('still contributes its numbers', async () => {
    const card = await cardFor(tenants.niue);
    expect(card).toMatchObject({ access: 'NUMBERS_ONLY', canOpen: false });
    expect(card.numbers.rooms).toBe(2);
  });

  it('leaks no guest anywhere in the answer', async () => {
    // On the body itself, not its shape: a guest reached through a relation
    // would pass any check written against the type.
    const res = await overview();
    expect(res.body).not.toContain(GUEST_SURNAME);
    expect(res.body.toLowerCase()).not.toContain('confirmationno');
  });
});

describe('a resort in trouble', () => {
  it('is still shown, marked, when it has been suspended', async () => {
    await prisma.tenant.update({ where: { id: tenants.dollars }, data: { isActive: false } });
    clearResortOverviewCache();

    const card = await cardFor(tenants.dollars);
    expect(card).toMatchObject({ isActive: false, canOpen: false });
    expect(card.numbers.rooms).toBe(10);

    await prisma.tenant.update({ where: { id: tenants.dollars }, data: { isActive: true } });
    clearResortOverviewCache();
  });
});

describe('when one resort cannot be read', () => {
  it('marks that card and leaves the rest of the page standing', async () => {
    // A timezone Intl does not recognise. Tenant.timezone is free text, so this
    // is reachable from the settings page, and one bad row must not take the
    // whole 360 view down.
    await prisma.tenant.update({ where: { id: tenants.dollars }, data: { timezone: 'Not/AZone' } });
    clearResortOverviewCache();

    const data = await body();
    const broken = data.resorts.find((r: { tenantId: string }) => r.tenantId === tenants.dollars);
    expect(broken).toMatchObject({ failed: true, numbers: null });
    expect(broken.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const home = data.resorts.find((r: { tenantId: string }) => r.tenantId === homeId);
    expect(home.numbers.rooms).toBe(100);

    await prisma.tenant.update({ where: { id: tenants.dollars }, data: { timezone: 'Asia/Dhaka' } });
    clearResortOverviewCache();
  });
});

describe('the one-minute cache', () => {
  it('answers a second ask from the first one', async () => {
    const first = await body();
    expect((await body()).generatedAt).toBe(first.generatedAt);
  });

  it('is dropped as soon as a resort is disconnected', async () => {
    const before = await body();
    const res = await app.inject({
      method: 'DELETE', url: `/api/resort-group/members/${tenants.empty}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode, res.body).toBe(200);

    const after = await body();
    expect(after.generatedAt).not.toBe(before.generatedAt);
    expect(after.resorts.map((r: { tenantId: string }) => r.tenantId)).not.toContain(tenants.empty);
  });
});

describe('when the resort\'s month began', () => {
  // Last, because it moves a figure the tests above assert exactly.
  it('counts money taken on the first evening of a resort ahead of UTC', async () => {
    // Kiritimati is +14, so its month began fourteen hours before midnight UTC
    // on the 1st. A payment inside that window belongs to this month there —
    // comparing against the calendar date instead would silently drop it.
    const tz = 'Pacific/Kiritimati';
    const before = (await cardFor(homeId)).numbers.revenueMonth;
    await prisma.payment.create({
      data: {
        tenantId: homeId, amount: 777, status: 'PAID',
        processedAt: new Date(tenantMonthStartInstant(tz).getTime() + 3_600_000),
      },
    });
    clearResortOverviewCache();

    expect((await cardFor(homeId)).numbers.revenueMonth).toBe(before + 777);
  });
});
