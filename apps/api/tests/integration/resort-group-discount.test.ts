/**
 * The group price: 10% off every resort after the first.
 *
 * Every number here has to come from one place. The price the dashboard shows,
 * the amount bKash is asked for, and the amount the callback verifies against
 * are three separate code paths, and the day they disagree is the day an owner
 * pays and is told the payment was wrong. So the tests check all three, and the
 * regression that matters most is the last one: a resort connected to nothing
 * must be charged exactly what it was charged before any of this existed.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { PLAN_PRICING } from '@resort-pro/types';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { readFileSync } from 'fs';
import { join } from 'path';
import { groupDiscountApplies, discounted } from '../../src/utils/group-discount';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-disc-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;

let token: string;
let ownerUserId: string;
let passwordHash: string;
let homeId: string;
const tenants: Record<string, string> = {};

const LIST_PRICE = Number(process.env.BKASH_PRICE_STARTER) || PLAN_PRICING.STARTER.monthlyBdt;

const status = (bearer = token) => app.inject({
  method: 'GET', url: '/api/billing/status', headers: { Authorization: `Bearer ${bearer}` },
});

/** A resort created `daysOld` days ago, so "oldest" is unambiguous. */
async function makeResort(key: string, daysOld: number) {
  const tenant = await prisma.tenant.create({
    data: {
      name: key, slug: `${run}-${key}`, planStatus: 'active',
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
  // The oldest of the group, so this one is the full-price resort.
  await prisma.tenant.update({
    where: { id: homeId },
    data: { planStatus: 'active', createdAt: new Date(Date.now() - 400 * 86_400_000) },
  });

  const me = await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    select: { id: true, passwordHash: true },
  });
  ownerUserId = me.id;
  passwordHash = me.passwordHash;

  await makeResort('hill', 200);
  await makeResort('lagoon', 100);
  // Older than the resort the group is built from, and connected last.
  await makeResort('ancient', 500);
}, 60000);

beforeEach(clearGroups);

afterAll(async () => {
  await clearGroups();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('who pays what', () => {
  it('charges a resort connected to nothing exactly what it always paid', async () => {
    const data = JSON.parse((await status()).body).data;
    expect(data.groupDiscount).toMatchObject({ applies: false });
    expect(data.bkashPricesBdt.STARTER).toBe(LIST_PRICE);
  });

  it('leaves the oldest resort of a group at full price', async () => {
    await connect('hill');
    expect(await groupDiscountApplies(homeId)).toBe(false);
    expect(JSON.parse((await status()).body).data.bkashPricesBdt.STARTER).toBe(LIST_PRICE);
  });

  it('takes a tenth off every resort after it', async () => {
    await connect('hill');
    await connect('lagoon');

    expect(await groupDiscountApplies(tenants.hill)).toBe(true);
    expect(await groupDiscountApplies(tenants.lagoon)).toBe(true);
    expect(discounted(LIST_PRICE, true)).toBe(Math.round(LIST_PRICE * 0.9));
  });

  it('shows the second resort its own price, not the first one\'s', async () => {
    await connect('hill');
    const hillToken = await verifyOwnerAndLogin(app, {
      tenantId: tenants.hill, email: myEmail, password, slug: `${run}-hill`,
    });

    const data = JSON.parse((await status(hillToken)).body).data;
    expect(data.groupDiscount).toMatchObject({ applies: true, rate: 0.1 });
    expect(data.bkashPricesBdt.STARTER).toBe(Math.round(LIST_PRICE * 0.9));
  });
});

describe('when the group changes', () => {
  it('moves full price to the next-oldest once the original leaves', async () => {
    await connect('hill');
    await connect('lagoon');
    expect(await groupDiscountApplies(tenants.hill)).toBe(true);

    await app.inject({
      method: 'DELETE', url: `/api/resort-group/members/${homeId}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    // Hill is now the oldest resort still in the group.
    expect(await groupDiscountApplies(tenants.hill)).toBe(false);
    expect(await groupDiscountApplies(tenants.lagoon)).toBe(true);
  });

  it('stops discounting a resort that has left', async () => {
    await connect('hill');
    await connect('lagoon');
    await app.inject({
      method: 'DELETE', url: `/api/resort-group/members/${tenants.lagoon}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(await groupDiscountApplies(tenants.lagoon)).toBe(false);
  });

  it('orders by when the resort was created, not when it joined', async () => {
    // The group is built from Sea Pearl, so its membership row is the first
    // one — but Ancient is the older resort, and it is Ancient that pays full.
    // Ordering by the membership row instead would get this backwards.
    await connect('ancient');

    expect(await groupDiscountApplies(tenants.ancient)).toBe(false);
    expect(await groupDiscountApplies(homeId)).toBe(true);
  });
});

describe('the arithmetic', () => {
  it('rounds to whole taka once, so every screen says the same number', () => {
    expect(discounted(1999, true)).toBe(1799);
    expect(discounted(1000, true)).toBe(900);
    expect(discounted(1999, false)).toBe(1999);
  });
});

describe('the charge and the check agree', () => {
  /**
   * bKash cannot be driven from a test — there are no platform credentials —
   * so this reads the source instead, the way secret-fields.test.ts does.
   *
   * What it guards is worth the oddity. The amount is worked out in one place
   * and verified in another, and if the verification ever compares against the
   * list price again, every group resort's payment is rejected *after* their
   * money has moved: they have paid, and the screen tells them the amount was
   * wrong.
   */
  const source = readFileSync(join(__dirname, '../../src/routes/billing.ts'), 'utf8');
  const between = (from: string, to: string) =>
    source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

  it('works the charge out through the discount helper', () => {
    const checkout = between("'/checkout/bkash'", "'/bkash/callback'");
    expect(checkout).toContain('discounted(');
    expect(checkout).toContain('groupDiscountApplies(');
  });

  it('verifies the callback against that same number, not the list price', () => {
    const callback = between("'/bkash/callback'", "// GET /billing/invoices");
    expect(callback).toContain('const expected = discounted(');
    expect(callback).toContain('groupDiscountApplies(');
  });
});
