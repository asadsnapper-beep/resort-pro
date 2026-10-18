/**
 * One bKash payment for several resorts.
 *
 * bKash has no subscriptions — every payment is a one-off that pushes a
 * resort's period out — so "combined" here means one payment for the sum of
 * what each resort owes, each keeping its own plan and its own discount.
 *
 * The two that carry the money: the total is the sum of the discounted lines
 * and not the list prices, and extending a period never takes back days a
 * resort has already paid for.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { PLAN_PRICING } from '@resort-pro/types';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { keepEnv } from '../helpers/env';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { FastifyInstance } from 'fastify';

keepEnv('BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USERNAME', 'BKASH_PASSWORD');

let app: FastifyInstance;
const run = `rg-bill-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;

let token: string;
let ownerUserId: string;
let passwordHash: string;
let homeId: string;
const tenants: Record<string, string> = {};

const STARTER = Number(process.env.BKASH_PRICE_STARTER) || PLAN_PRICING.STARTER.monthlyBdt;
const PRO = Number(process.env.BKASH_PRICE_PRO) || PLAN_PRICING.PROFESSIONAL.monthlyBdt;

const groupBill = (interval = 'month', bearer = token) => app.inject({
  method: 'GET', url: `/api/billing/group?interval=${interval}`,
  headers: { Authorization: `Bearer ${bearer}` },
});
const payAll = (interval = 'month', bearer = token) => app.inject({
  method: 'POST', url: '/api/billing/checkout/bkash-group',
  headers: { Authorization: `Bearer ${bearer}` }, payload: { interval },
});

async function makeResort(key: string, daysOld: number, plan: string) {
  const tenant = await prisma.tenant.create({
    data: {
      name: key, slug: `${run}-${key}`, planStatus: 'active', plan: plan as never,
      createdAt: new Date(Date.now() - daysOld * 86_400_000),
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

async function connect(key: string) {
  const res = await app.inject({
    method: 'POST', url: '/api/resort-group/links',
    headers: { Authorization: `Bearer ${token}` }, payload: { slug: `${run}-${key}` },
  });
  expect(res.statusCode, res.body).toBe(200);
}

const clearGroups = () => prisma.resortGroup.deleteMany({
  where: { OR: [{ ownerUserId }, { name: { contains: run } }] },
});

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
    where: { id: homeId },
    data: { planStatus: 'active', plan: 'STARTER', createdAt: new Date(Date.now() - 400 * 86_400_000) },
  });

  const me = await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    select: { id: true, passwordHash: true },
  });
  ownerUserId = me.id;
  passwordHash = me.passwordHash;

  await makeResort('hill', 200, 'PROFESSIONAL');
  await makeResort('lagoon', 100, 'STARTER');
}, 60000);

beforeEach(async () => {
  await clearGroups();
  await prisma.tenant.updateMany({
    where: { slug: { startsWith: run } }, data: { isActive: true, planStatus: 'active' },
  });
  // Plans as well: one test moves a resort to ENTERPRISE, and leaving it there
  // makes every later bill refuse to price itself.
  await prisma.tenant.update({ where: { id: homeId }, data: { plan: 'STARTER' } });
  await prisma.tenant.update({ where: { id: tenants.hill }, data: { plan: 'PROFESSIONAL' } });
  await prisma.tenant.update({ where: { id: tenants.lagoon }, data: { plan: 'STARTER' } });
});

afterAll(async () => {
  await clearGroups();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('what one payment would cover', () => {
  it('says nothing to an owner with no group', async () => {
    expect(JSON.parse((await groupBill()).body).data).toBeNull();
  });

  it('will not combine a single resort', async () => {
    await connect('hill');
    await app.inject({
      method: 'DELETE', url: `/api/resort-group/members/${tenants.hill}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    // The group is gone with it, so there is nothing to combine.
    expect(JSON.parse((await groupBill()).body).data).toBeNull();
  });

  it('has nothing to combine when only one resort is left to pay for', async () => {
    await connect('hill');
    await prisma.tenant.update({ where: { id: tenants.hill }, data: { isActive: false } });

    const data = JSON.parse((await groupBill()).body).data;
    expect(data).toMatchObject({ available: false, reason: 'NOTHING_TO_COMBINE' });

    const res = await payAll();
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('NOTHING_TO_COMBINE');
  });

  it('adds up each resort at its own plan, after its own discount', async () => {
    await connect('hill');
    await connect('lagoon');

    const data = JSON.parse((await groupBill()).body).data;
    const byName = Object.fromEntries(data.lines.map((l: { name: string }) => [l.name, l]));

    // Sea Pearl is the oldest, so it alone pays the list price.
    expect(byName['Sea Pearl']).toMatchObject({ plan: 'STARTER', amount: STARTER });
    expect(byName.hill).toMatchObject({ plan: 'PROFESSIONAL', amount: Math.round(PRO * 0.9) });
    expect(byName.lagoon).toMatchObject({ plan: 'STARTER', amount: Math.round(STARTER * 0.9) });
    expect(data.total).toBe(STARTER + Math.round(PRO * 0.9) + Math.round(STARTER * 0.9));
  });

  it('leaves out a resort nobody can open', async () => {
    await connect('hill');
    await connect('lagoon');
    await prisma.tenant.update({ where: { id: tenants.lagoon }, data: { isActive: false } });

    const data = JSON.parse((await groupBill()).body).data;
    expect(data.lines.map((l: { name: string }) => l.name)).not.toContain('lagoon');
    expect(data.total).toBe(STARTER + Math.round(PRO * 0.9));
  });

  it('refuses to put a price on a negotiated plan', async () => {
    await connect('hill');
    await connect('lagoon');
    await prisma.tenant.update({ where: { id: tenants.hill }, data: { plan: 'ENTERPRISE' } });

    const data = JSON.parse((await groupBill()).body).data;
    expect(data).toMatchObject({ available: false, reason: 'ENTERPRISE_IN_GROUP' });

    const res = await payAll();
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('ENTERPRISE_IN_GROUP');
  });

  it('prices a year separately from a month', async () => {
    await connect('hill');
    await connect('lagoon');

    const monthly = JSON.parse((await groupBill('month')).body).data.total;
    const yearly = JSON.parse((await groupBill('year')).body).data.total;
    expect(yearly).toBeGreaterThan(monthly);
  });
});

describe('who may pay it', () => {
  it('refuses an owner with no group', async () => {
    const res = await payAll();
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('NO_RESORT_GROUP');
  });

  it('refuses staff who are not the owner', async () => {
    await connect('hill');
    const deskEmail = `desk-${run}@test.com`;
    await prisma.user.create({
      data: {
        tenantId: homeId, email: deskEmail, passwordHash, firstName: 'Front', lastName: 'Desk',
        role: 'RECEPTIONIST', emailVerifiedAt: new Date(),
      },
    });
    const deskToken = await verifyOwnerAndLogin(app, {
      tenantId: homeId, email: deskEmail, password, slug: run,
    });

    expect((await payAll('month', deskToken)).statusCode).toBe(403);
  });

  it('stops at the gateway when bKash is not configured, having charged nobody', async () => {
    await connect('hill');
    await connect('lagoon');
    const before = await prisma.tenant.findMany({
      where: { slug: { startsWith: run } }, select: { id: true, currentPeriodEnd: true },
    });

    const res = await payAll();
    // No platform bKash credentials in the test environment.
    expect(res.statusCode).toBe(503);
    expect(await prisma.tenant.findMany({
      where: { slug: { startsWith: run } }, select: { id: true, currentPeriodEnd: true },
    })).toEqual(before);
  });
});

describe('the charge and the check agree', () => {
  /**
   * bKash cannot be driven from a test — there are no platform credentials —
   * so the callback is read rather than run, the way secret-fields.test.ts
   * reads the schema.
   *
   * What it guards is the whole payment. The amount is worked out before the
   * customer is sent to bKash and has to be worked out again on the way back:
   * trusting a number carried on the callback URL would let a tampered
   * parameter buy a year of four resorts for the price of one month.
   */
  const source = readFileSync(join(__dirname, '../../src/routes/billing.ts'), 'utf8');
  const callback = source.slice(
    source.indexOf("'/bkash/group-callback'"),
    source.indexOf('// GET /billing/invoices'),
  );

  it('prices the group again on the way back, from the same helper', () => {
    expect(callback).toContain('await groupBill(groupId, interval)');
    expect(callback).toContain('Math.abs(Number(exec.amount) - bill.total)');
  });

  it('takes no amount from the callback URL at all', () => {
    // The querystring carries the group and the interval, and nothing priced.
    expect(callback).not.toMatch(/\bamt\b/);
  });

  it('extends each period through the helper that keeps bought days', () => {
    expect(callback).toContain('extendPeriod(line.currentPeriodEnd');
  });
});

describe('once the money has moved', () => {
  /**
   * bKash cannot be driven from a test, so the callback is read rather than
   * run — the same approach as the pricing guard above.
   *
   * What it holds in place is a single rule: after `bkashExecutePayment`
   * captures, no path may tell the payer their payment failed. They would go
   * looking for a refund of something the screen says never happened. Every
   * branch after capture must either give them the service or say, honestly,
   * that we have their money and are looking into it.
   */
  const source = readFileSync(join(__dirname, '../../src/routes/billing.ts'), 'utf8');
  const callback = source.slice(
    source.indexOf("'/bkash/group-callback'"),
    source.indexOf('// GET /billing/invoices'),
  );
  const afterCapture = callback.slice(callback.indexOf('The money is ours now'));

  it('captures before it decides anything, and never calls that a cancellation', () => {
    expect(callback).toContain('The money is ours now');
    // `fail()` redirects to ?canceled=1 — it may only be used before capture.
    expect(afterCapture).not.toMatch(/\bfail\(/);
  });

  it('holds a payment it cannot price, instead of keeping it quietly', () => {
    expect(afterCapture).toContain("held('the group could no longer be priced')");
    expect(afterCapture).toContain('the amount paid no longer matches the group');
  });

  it('holds a payment whose resorts could not be extended', () => {
    expect(afterCapture).toContain("held('the resorts could not be extended')");
  });

  it('lets bookkeeping fail without turning a paid subscription into an error', () => {
    const bookkeeping = afterCapture.slice(afterCapture.indexOf('Bookkeeping'));
    expect(bookkeeping).toContain('applyPlanFlagsToTenant');
    expect(bookkeeping).toContain('bookkeeping failed');
    // It ends in success regardless.
    expect(bookkeeping).toContain('success=1&method=bkash');
  });

  it('tells support in a way that names the transaction', () => {
    expect(source).toContain('bKash payment received but NOT applied');
    expect(source).toContain('Apply it by hand or refund it');
  });

  it('extends a single resort through the same helper, keeping days it bought', () => {
    const single = source.slice(
      source.indexOf("'/bkash/callback'"),
      source.indexOf("'/bkash/group-callback'"),
    );
    expect(single).toContain('extendPeriod(before?.currentPeriodEnd, days)');
    expect(single).not.toContain('new Date(Date.now() + days *');
  });
});
