/**
 * Saving one Settings field must not erase another.
 *
 * `city` and `country` were writable but not readable: the update schema
 * accepted them, the GET never returned them. The Settings form loads its state
 * from that GET and submits the whole form, so both fields hydrated as empty
 * strings and the next save of anything — a phone number, a check-in time —
 * wrote those empties over the stored values. A resort's country went blank on
 * its own, and country decides which payment gateways it is offered.
 *
 * reports/qa/2026-09-09-settings-deep-qa.md (C-01), whose required fix asks for
 * exactly this regression test: prove an unrelated save preserves location.
 *
 * The general rule worth keeping: anything writable has to be readable, or a
 * form destroys data simply by loading.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `tenant-location-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

const CITY = 'Cox’s Bazar';
const COUNTRY = 'BD';

async function storedLocation() {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { city: true, country: true },
  });
  return { city: row?.city, country: row?.country };
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Tenant Location', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { planStatus: 'active', plan: 'ENTERPRISE', city: CITY, country: COUNTRY },
  });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('reading Settings', () => {
  it('returns the location it will accept back', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tenant', headers: auth() });
    const data = JSON.parse(res.body).data;

    // This is the whole defect: these two were absent, so the form could only
    // ever load them as blank.
    expect(data.city).toBe(CITY);
    expect(data.country).toBe(COUNTRY);
  });
});

describe('saving an unrelated field', () => {
  it('leaves the stored city and country alone', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: { phone: '+8801799999999' },
    });
    expect(res.statusCode).toBe(200);

    expect(await storedLocation()).toEqual({ city: CITY, country: COUNTRY });
  });

  it('survives the round trip the form actually makes', async () => {
    // What the page does: load, then submit every field it holds. With the GET
    // returning the location, that round trip is harmless; without it, this is
    // the exact sequence that wiped the data.
    const read = await app.inject({ method: 'GET', url: '/api/tenant', headers: auth() });
    const loaded = JSON.parse(read.body).data;

    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: {
        name: loaded.name,
        phone: loaded.phone ?? '',
        address: loaded.address ?? '',
        city: loaded.city ?? '',
        country: loaded.country ?? '',
        checkInTime: loaded.checkInTime,
        checkOutTime: loaded.checkOutTime,
      },
    });
    expect(res.statusCode).toBe(200);

    expect(await storedLocation()).toEqual({ city: CITY, country: COUNTRY });
  });

  it('still lets the owner clear the field on purpose', async () => {
    // The fix must not turn a deliberate change into an ignored one.
    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: { city: 'Sylhet' },
    });
    expect(res.statusCode).toBe(200);
    expect((await storedLocation()).city).toBe('Sylhet');

    await prisma.tenant.update({ where: { id: tenantId }, data: { city: CITY } });
  });
});
