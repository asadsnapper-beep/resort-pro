/**
 * Whether the resort's currency ever reaches the screens that spend it.
 *
 * The audit reported that room cards format the tenant's currency while the
 * Add/Edit price field always prefixes a dollar sign. Measuring it says the
 * finding was **understated in one direction and wrong in the other**: no
 * screen formats the tenant's currency, because `currency` was not in any
 * payload the API hands the client. The dashboard's own
 * `(tenant as any)?.currency ?? 'BDT'` was always taking the fallback, and
 * `formatCurrency`'s default is BDT too — so a resort billing in dollars was
 * shown taka on its cards and a dollar sign in its form, and neither number
 * was the one it had configured. (Room Management QA 2026-10-28, RM-011.)
 *
 * `Tenant.currency` is a real column with a real default and the settings
 * screen writes it. Only the reading end was missing.
 *
 * Every endpoint that returns a tenant is covered, not only login: the client
 * stores whatever the last one gave it, so one of them omitting the field
 * leaves the currency wrong until the next sign-in. That is the shape of bug
 * this is here to stop, and it is why these are five tests rather than one.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `currency-${Date.now()}`;
const password = 'TestPass123!';
const email = `owner-${run}@test.com`;
let tenantId: string;
let ownerToken: string;
/** The register response itself, so the shape can be asserted without
 *  registering twice — a second one is refused 429 by the signup throttle. */
let registerTenant: Record<string, unknown>;
/** A second resort in the same group, billing in a third currency. */
let sisterTenantId: string;

const body = (res: { body: string }) => JSON.parse(res.body);

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Currency Test', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  registerTenant = body(reg).data.tenant;
  tenantId = registerTenant.id as string;

  // Not the default, so a test cannot pass by the default happening to match.
  await prisma.tenant.update({ where: { id: tenantId }, data: { currency: 'USD' } });

  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email, password, slug: run });

  /*
    A second resort the owner can switch into, built with Prisma rather than a
    second `/register` — the signup throttle refuses that with a 429, and a
    throttle is not what this file is about.

    It exists so the switch-resort case asserts something. Without it a
    single-resort owner is refused the switch, the test falls to its 4xx
    branch and passes while touching none of the code it names — which it did
    on the first run, and is the one endpoint where the currency genuinely
    changes between one answer and the next.
  */
  const sister = await prisma.tenant.create({
    data: { name: 'Sister Resort', slug: `${run}-sister`, currency: 'JPY' },
    select: { id: true },
  });
  sisterTenantId = sister.id;
  const sisterOwner = await prisma.user.create({
    data: {
      tenantId: sisterTenantId,
      email: `owner-${run}-sister@test.com`,
      // Never used as a credential: the switch signs a token for this row
      // rather than checking a password.
      passwordHash: 'not-a-usable-hash',
      firstName: 'Sister', lastName: 'Owner',
      role: 'OWNER',
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  const callerId = (await prisma.user.findFirstOrThrow({
    where: { tenantId, email }, select: { id: true },
  })).id;
  const group = await prisma.resortGroup.create({
    data: { ownerUserId: callerId, name: 'Currency Group' },
    select: { id: true },
  });
  await prisma.resortGroupTenant.create({
    data: {
      groupId: group.id, tenantId: sisterTenantId,
      access: 'FULL', linkedUserId: sisterOwner.id,
    },
  });
}, 40000);

afterAll(async () => {
  await prisma.resortGroup.deleteMany({ where: { name: 'Currency Group' } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('the tenant payload carries the currency', () => {
  it('on login, which is where the dashboard gets it', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email, password, slug: run },
    });

    expect(res.statusCode).toBe(200);
    expect(body(res).data.tenant.currency).toBe('USD');
  });

  it('on register, so the first screen after signing up is right too', async () => {
    // The response captured in beforeAll. Registering again here is refused
    // 429 by the signup throttle, and asserting on a throttle is not what
    // this test is for.
    //
    // A new resort has the column's default rather than a chosen value; the
    // point is that the field is *there*, not that it is anything in
    // particular — an absent field is what the client could not tell apart
    // from a tenant that genuinely bills in taka.
    expect(registerTenant).toHaveProperty('currency');
    expect(registerTenant.currency).toBe('BDT');
  });

  it('on switching resort, where it actually changes', async () => {
    // The one endpoint whose answer differs from the one before it. Two
    // resorts in a group may bill in different currencies, so a switch that
    // returns no currency leaves the dashboard showing the previous
    // resort's — the worst of the three failure modes, because the figures
    // on screen are real and the symbol in front of them is not.
    const res = await app.inject({
      method: 'POST', url: '/api/auth/switch-resort',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { tenantId: sisterTenantId },
    });

    expect(res.statusCode, res.body).toBe(200);
    // JPY, not the USD the caller arrived with.
    expect(body(res).data.tenant.currency).toBe('JPY');
  });

  it('on the demo login, which is the only tenant most visitors ever see', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/demo-login',
      payload: { role: 'OWNER', email: 'currency-test@resortpro-tests.invalid' },
    });

    if (res.statusCode === 200) {
      expect(body(res).data.tenant).toHaveProperty('currency');
    } else {
      // The demo tenant is seeded, and a bare test database has none.
      expect([400, 404, 503]).toContain(res.statusCode);
    }
  });

  it('is the value the settings screen stores, not a guess', async () => {
    // Guards the direction the fix could be faked in: reading the column
    // rather than echoing a constant that happens to be right today.
    await prisma.tenant.update({ where: { id: tenantId }, data: { currency: 'EUR' } });

    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email, password, slug: run },
    });

    expect(res.statusCode).toBe(200);
    expect(body(res).data.tenant.currency).toBe('EUR');

    await prisma.tenant.update({ where: { id: tenantId }, data: { currency: 'USD' } });
  });
});
