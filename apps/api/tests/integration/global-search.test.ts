/**
 * Global search API — Phase A of plan/global-search.md.
 *
 * The acceptance list in §9 drives these: authentication, tenant isolation,
 * per-role categories, the 2-character threshold, identifier precedence, and
 * the result caps.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `gsearch-${Date.now()}`;
const other = `gsearch-other-${Date.now()}`;
const password = 'TestPass123!';

let ownerToken = '';
let receptionistToken = '';
let shareholderToken = '';
let tenantId = '';
let confirmationNo = '';
let invoiceNumber = '';

const search = (q: string, token = ownerToken) =>
  app.inject({
    method: 'GET',
    url: `/api/search?q=${encodeURIComponent(q)}`,
    headers: { Authorization: `Bearer ${token}` },
  });

const resultsOf = async (q: string, token = ownerToken) =>
  JSON.parse((await search(q, token)).body).data.results as Array<{
    type: string; title: string; href: string; id: string;
  }>;

/** Register a tenant and return its id plus the owner's token. */
async function makeTenant(tenantSlug: string, resortName: string) {
  const email = `owner-${tenantSlug}@test.com`;
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName, slug: tenantSlug, firstName: 'O', lastName: 'W', email, password },
  });
  expect(reg.statusCode).toBe(201);
  const id = JSON.parse(reg.body).data.tenant.id;
  const token = await verifyOwnerAndLogin(app, { tenantId: id, email, password, slug: tenantSlug });
  await prisma.tenant.update({ where: { id }, data: { plan: 'ENTERPRISE', planStatus: 'active' } });
  return { id, token };
}

/** Add a staff user of the given role and log in as them. */
async function makeUser(id: string, tenantSlug: string, role: any, email: string) {
  const bcrypt = await import('bcryptjs');
  await prisma.user.create({
    data: {
      tenantId: id, email, passwordHash: await bcrypt.default.hash(password, 12),
      firstName: role, lastName: 'User', role, isActive: true, emailVerifiedAt: new Date(),
    },
  });
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email, password, slug: tenantSlug },
  });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body).data.token as string;
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const main = await makeTenant(slug, 'Search Test Resort');
  tenantId = main.id;
  ownerToken = main.token;
  receptionistToken = await makeUser(tenantId, slug, 'RECEPTIONIST', `recep-${slug}@test.com`);
  shareholderToken = await makeUser(tenantId, slug, 'SHAREHOLDER', `share-${slug}@test.com`);

  const room = await prisma.room.create({
    data: { tenantId, number: '901', name: 'Palm Suite', type: 'SUITE', floor: 9, maxOccupancy: 2, basePrice: 9000 },
  });
  const guest = await prisma.guest.create({
    data: { tenantId, firstName: 'Karim', lastName: 'Hossain', email: 'karim.h@example.com', phone: '+880 1711-002200' },
  });
  const booking = await prisma.booking.create({
    data: {
      tenantId, roomId: room.id, guestId: guest.id,
      confirmationNo: `SRCH-${Date.now().toString().slice(-6)}`,
      checkIn: new Date(Date.now() + 86_400_000), checkOut: new Date(Date.now() + 3 * 86_400_000),
      adults: 2, children: 0, totalAmount: 18000, status: 'CONFIRMED',
    },
  });
  confirmationNo = booking.confirmationNo;

  const invoice = await prisma.invoice.create({
    data: {
      tenantId, invoiceNumber: `INV-SRCH-${Date.now().toString().slice(-6)}`,
      guestName: 'Karim Hossain', total: 18000, paidAmount: 5000, status: 'PARTIAL',
    },
  });
  invoiceNumber = invoice.invoiceNumber;

  // A second tenant holding a same-named guest, to prove isolation. Created
  // directly: /api/auth/register allows one signup per IP per ten minutes, and
  // nothing here needs to log in as this tenant.
  const otherTenant = await prisma.tenant.create({
    data: { name: 'Other Resort', slug: other, plan: 'ENTERPRISE', planStatus: 'active' },
  });
  await prisma.guest.create({
    data: { tenantId: otherTenant.id, firstName: 'Karim', lastName: 'Hossain', email: 'karim.other@example.com' },
  });
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { in: [slug, other] } } });
  await app.close();
});

describe('GET /api/search — access', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=Karim' });
    expect(res.statusCode).toBe(401);
  });

  it('never returns another tenant\'s records', async () => {
    const rows = await resultsOf('Karim');
    const guestIds = rows.filter((r) => r.type === 'guest').map((r) => r.id);
    const leaked = await prisma.guest.findMany({
      where: { id: { in: guestIds }, tenantId: { not: tenantId } }, select: { id: true },
    });
    expect(leaked).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('gives a shareholder no operational results', async () => {
    expect(await resultsOf('Karim', shareholderToken)).toEqual([]);
    expect(await resultsOf(confirmationNo, shareholderToken)).toEqual([]);
  });

  it('withholds invoices from a receptionist but not bookings or guests', async () => {
    const rows = await resultsOf('Karim', receptionistToken);
    expect(rows.some((r) => r.type === 'invoice')).toBe(false);
    expect(rows.some((r) => r.type === 'guest')).toBe(true);

    const owner = await resultsOf('Karim');
    expect(owner.some((r) => r.type === 'invoice')).toBe(true);
  });

  it('does not leak an invoice to a receptionist even by exact number', async () => {
    expect(await resultsOf(invoiceNumber, receptionistToken)).toEqual([]);
  });
});

describe('GET /api/search — matching', () => {
  it('matches a full name, which per-field contains could not', async () => {
    const rows = await resultsOf('Karim Hossain');
    expect(rows.some((r) => r.type === 'guest')).toBe(true);
    expect(rows.some((r) => r.type === 'booking')).toBe(true);
  });

  it('matches either name alone, and ignores case', async () => {
    for (const q of ['Karim', 'hossain', 'KARIM']) {
      expect((await resultsOf(q)).length).toBeGreaterThan(0);
    }
  });

  it('matches a phone number typed in a different format', async () => {
    // Stored as "+880 1711-002200".
    const rows = await resultsOf('01711002200');
    expect(rows.some((r) => r.type === 'guest')).toBe(true);
  });

  it('ranks an exact confirmation number first', async () => {
    const rows = await resultsOf(confirmationNo);
    expect(rows[0]!.type).toBe('booking');
    expect(rows[0]!.subtitle ?? rows[0]!.title).toBeTruthy();
  });

  it('ranks an exact invoice number first', async () => {
    const rows = await resultsOf(invoiceNumber);
    expect(rows[0]!.type).toBe('invoice');
    expect(rows[0]!.title).toBe(invoiceNumber);
  });

  it('finds a room by number and by name', async () => {
    expect((await resultsOf('901')).some((r) => r.type === 'room')).toBe(true);
    expect((await resultsOf('Palm Suite')).some((r) => r.type === 'room')).toBe(true);
  });

  it('returns nothing for a query below two characters, without matching broadly', async () => {
    expect(await resultsOf('K')).toEqual([]);
    expect(await resultsOf(' ')).toEqual([]);
    expect(await resultsOf('')).toEqual([]);
  });

  it('returns an empty list, not an error, for no matches', async () => {
    const res = await search('zzzz-no-such-record');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.results).toEqual([]);
  });
});

describe('GET /api/search — caps and shape', () => {
  it('never exceeds 3 per type or 12 total', async () => {
    for (let i = 0; i < 6; i++) {
      await prisma.guest.create({
        data: { tenantId, firstName: 'Capcheck', lastName: `Guest${i}`, email: `cap${i}-${slug}@test.com` },
      });
    }
    const rows = await resultsOf('Capcheck');
    expect(rows.length).toBeLessThanOrEqual(12);
    expect(rows.filter((r) => r.type === 'guest').length).toBeLessThanOrEqual(3);
  }, 30000);

  it('every result carries a destination the caller can open', async () => {
    for (const r of await resultsOf('Karim')) {
      expect(r.href.startsWith('/dashboard/')).toBe(true);
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
    }
  });

  it('does not expose sensitive guest fields in a result', async () => {
    const body = (await search('Karim')).body;
    expect(body).not.toMatch(/passwordHash|idNumber|passportNo|documentUrl/i);
  });
});
