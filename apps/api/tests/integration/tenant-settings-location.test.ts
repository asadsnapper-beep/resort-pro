/**
 * Saving General Settings has to work, and must not erase the country.
 *
 * Two defects in one form, found one behind the other.
 *
 * `updateTenantSchema` accepted a `city` field. There is no `city` column on
 * Tenant — none anywhere in the datamodel. The page submits every field it
 * holds, so `data` carried `city` into Prisma, Prisma rejected the unknown
 * argument, and General, Contact and Operations returned 500 on every save. The
 * QA report inferred from the code that the save succeeded and erased data; it
 * did not succeed at all.
 *
 * Behind that, `country` — which is a real column, and decides which payment
 * gateways a resort is offered — was writable but not returned by the read. So
 * the form hydrated it blank, and once the 500 was out of the way, saving
 * anything would have written that blank over the stored value.
 *
 * reports/qa/2026-09-09-settings-deep-qa.md (C-01).
 *
 * The rule worth keeping: anything writable has to be readable, and a schema
 * must not accept what the database cannot store.
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

const COUNTRY = 'BD';

async function storedCountry() {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { country: true },
  });
  return row?.country;
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
    data: { planStatus: 'active', plan: 'ENTERPRISE', country: COUNTRY },
  });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('reading Settings', () => {
  it('returns the country it will accept back', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tenant', headers: auth() });
    const data = JSON.parse(res.body).data;

    // Absent before: the form could only ever load this blank.
    expect(data.country).toBe(COUNTRY);
  });

  it('does not offer a city, because there is nowhere to put one', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tenant', headers: auth() });
    expect(JSON.parse(res.body).data.city).toBeUndefined();
  });
});

describe('saving General Settings', () => {
  it('succeeds at all', async () => {
    // The plainest possible save, and it used to be a 500.
    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: { phone: '+8801799999999' },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('survives a stray city from an older client', async () => {
    // z.object strips what it does not declare, so a cached bundle still
    // sending `city` gets a working save rather than a 500.
    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: { phone: '+8801788888888', city: 'Kuta' },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data.city).toBeUndefined();
  });

  it('leaves the stored country alone when saving something else', async () => {
    await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: { phone: '+8801777777777' },
    });
    expect(await storedCountry()).toBe(COUNTRY);
  });

  it('survives the round trip the form actually makes', async () => {
    // Load, then submit every field held — the exact sequence that did the
    // damage once the 500 was gone.
    const read = await app.inject({ method: 'GET', url: '/api/tenant', headers: auth() });
    const loaded = JSON.parse(read.body).data;

    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: {
        name: loaded.name,
        phone: loaded.phone ?? '',
        address: loaded.address ?? '',
        country: loaded.country ?? '',
        checkInTime: loaded.checkInTime,
        checkOutTime: loaded.checkOutTime,
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(await storedCountry()).toBe(COUNTRY);
  });

  it('still lets the owner change the country on purpose', async () => {
    // The guard must not have been built by ignoring the field.
    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: { country: 'LK' },
    });
    expect(res.statusCode).toBe(200);
    expect(await storedCountry()).toBe('LK');

    await prisma.tenant.update({ where: { id: tenantId }, data: { country: COUNTRY } });
  });
});
