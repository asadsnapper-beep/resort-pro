/**
 * Opening another resort from inside the dashboard.
 *
 * Deliberately not /api/auth/register with the fields filled in. The four
 * differences are the whole point and each is asserted below: no second email
 * verification of an address already verified, no signup promotion for someone
 * who is already a customer, no referral credit for referring yourself, and
 * connected to the group before its first bill so it is priced as one of
 * several.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { PLAN_PRICING } from '@resort-pro/types';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { groupDiscountApplies } from '../../src/utils/group-discount';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-new-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;

let token: string;
let ownerUserId: string;
let homeId: string;

const LIST_PRICE = Number(process.env.BKASH_PRICE_STARTER) || PLAN_PRICING.STARTER.monthlyBdt;

const add = (name: string, slug: string, bearer = token) => app.inject({
  method: 'POST', url: '/api/resort-group/new-resort',
  headers: { Authorization: `Bearer ${bearer}` }, payload: { name, slug },
});

const clearGroups = () => prisma.resortGroup.deleteMany({
  where: { OR: [{ ownerUserId }, { name: { contains: run } }] },
});

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Sea Pearl', slug: run, firstName: 'Asha', lastName: 'Rahman', email: myEmail, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  homeId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId: homeId, email: myEmail, password, slug: run });
  await prisma.tenant.update({
    where: { id: homeId },
    data: { planStatus: 'active', country: 'LK', currency: 'LKR', timezone: 'Asia/Colombo' },
  });
  ownerUserId = (await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } }, select: { id: true },
  })).id;
}, 60000);

beforeEach(async () => {
  await clearGroups();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: `${run}-` } } });
});

afterAll(async () => {
  await clearGroups();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('opening another resort', () => {
  it('creates it, unpaid and ready to pay for', async () => {
    const res = await add('Hill View', `${run}-hill`);
    expect(res.statusCode, res.body).toBe(201);

    const made = await prisma.tenant.findUniqueOrThrow({ where: { slug: `${run}-hill` } });
    expect(made).toMatchObject({ name: 'Hill View', planStatus: 'incomplete' });
  });

  it('inherits where the first resort is, rather than defaulting to Bangladesh', async () => {
    await add('Hill View', `${run}-hill`);
    expect(await prisma.tenant.findUniqueOrThrow({ where: { slug: `${run}-hill` } }))
      .toMatchObject({ country: 'LK', currency: 'LKR', timezone: 'Asia/Colombo' });
  });

  it('uses the same login, already verified', async () => {
    await add('Hill View', `${run}-hill`);
    const made = await prisma.tenant.findUniqueOrThrow({ where: { slug: `${run}-hill` } });
    const owner = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId: made.id, email: myEmail } },
    });

    expect(owner.role).toBe('OWNER');
    // Already proven on the account that asked — asking twice is ceremony.
    expect(owner.emailVerifiedAt).not.toBeNull();
    // And the password they already know opens it directly.
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: myEmail, password, slug: `${run}-hill` },
    });
    expect(login.statusCode, login.body).toBe(200);
  });

  it('is connected before its first bill, so it is priced as one of several', async () => {
    await add('Hill View', `${run}-hill`);
    const made = await prisma.tenant.findUniqueOrThrow({ where: { slug: `${run}-hill` } });

    expect(await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: made.id } }))
      .toMatchObject({ access: 'FULL' });
    expect(await groupDiscountApplies(made.id)).toBe(true);

    const madeToken = await verifyOwnerAndLogin(app, {
      tenantId: made.id, email: myEmail, password, slug: `${run}-hill`,
    });
    const billing = JSON.parse((await app.inject({
      method: 'GET', url: '/api/billing/status', headers: { Authorization: `Bearer ${madeToken}` },
    })).body).data;
    expect(billing.bkashPricesBdt.STARTER).toBe(Math.round(LIST_PRICE * 0.9));
  });

  it('can be reached from the resort menu straight away', async () => {
    const made = JSON.parse((await add('Hill View', `${run}-hill`)).body).data;

    const group = JSON.parse((await app.inject({
      method: 'GET', url: '/api/resort-group', headers: { Authorization: `Bearer ${token}` },
    })).body).data;
    expect(group.resorts.map((r: { slug: string }) => r.slug)).toEqual([run, `${run}-hill`]);

    const switched = await app.inject({
      method: 'POST', url: '/api/auth/switch-resort',
      headers: { Authorization: `Bearer ${token}` }, payload: { tenantId: made.tenantId },
    });
    expect(switched.statusCode, switched.body).toBe(200);
  });

  it('records who opened it', async () => {
    const made = JSON.parse((await add('Hill View', `${run}-hill`)).body).data;
    // Scoped to this resort: the events table outlives a single test run.
    expect(await prisma.resortGroupEvent.findFirstOrThrow({
      where: { action: 'resort_added', tenantId: made.tenantId },
    })).toMatchObject({ actorUserId: ownerUserId });
  });
});

describe('what it does not do', () => {
  it('pays nobody a referral for opening their own resort', async () => {
    await add('Hill View', `${run}-hill`);
    const made = await prisma.tenant.findUniqueOrThrow({ where: { slug: `${run}-hill` } });

    expect(made.referredById).toBeNull();
    expect(await prisma.referral.count({ where: { referredId: made.id } })).toBe(0);
  });

  it('hands out no signup trial', async () => {
    await add('Hill View', `${run}-hill`);
    const made = await prisma.tenant.findUniqueOrThrow({ where: { slug: `${run}-hill` } });
    expect(made.trialEndsAt).toBeNull();
  });

  it('refuses a web address somebody already has', async () => {
    await add('Hill View', `${run}-hill`);
    const again = await add('Another', `${run}-hill`);
    expect(again.statusCode).toBe(409);
    expect(JSON.parse(again.body).code).toBe('SLUG_TAKEN');
  });

  it('is not open to staff', async () => {
    const deskEmail = `desk-${run}@test.com`;
    const me = await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId }, select: { passwordHash: true } });
    await prisma.user.create({
      data: {
        tenantId: homeId, email: deskEmail, passwordHash: me.passwordHash,
        firstName: 'Front', lastName: 'Desk', role: 'RECEPTIONIST', emailVerifiedAt: new Date(),
      },
    });
    const deskToken = await verifyOwnerAndLogin(app, {
      tenantId: homeId, email: deskEmail, password, slug: run,
    });

    expect((await add('Sneaky', `${run}-sneaky`, deskToken)).statusCode).toBe(403);
    expect(await prisma.tenant.count({ where: { slug: `${run}-sneaky` } })).toBe(0);
  });
});
