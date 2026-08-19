/**
 * A tenant must get exactly the modules its current plan includes.
 *
 * Entitlement is per-tenant TenantFeatureFlag rows, and registration writes one
 * for every flag based on the plan chosen at signup. Those rows beat plan
 * defaults, so changing `tenant.plan` alone changes nothing a customer can see
 * — applyPlanFlagsToTenant has to run as well.
 *
 * The upgrade paths (bKash, Stripe checkout, admin) already called it. Two did
 * not: Stripe's customer.subscription.deleted, which left a tenant who stopped
 * paying with every paid module still on, and the referral FREE_PLAN reward,
 * which changed the plan name while leaving the modules locked.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `flagsync-${Date.now()}`;
const password = 'TestPass123!';
let tenantId: string;
let token: string;

/** Ask the API, not the database — this is what the customer experiences. */
const inventoryStatus = async () =>
  (await app.inject({ method: 'GET', url: '/api/inventory', headers: { Authorization: `Bearer ${token}` } })).statusCode;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const email = `fs-${slug}@test.com`;
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Flag Sync Resort', slug, firstName: 'F', lastName: 'S', email, password },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email, password, slug });
}, 25000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('Plan changes and module access', () => {
  it('a FREE signup cannot reach a paid module', async () => {
    expect(await inventoryStatus()).toBe(403);
  });

  it('an upgrade that syncs flags unlocks the module', async () => {
    await prisma.tenant.update({ where: { id: tenantId }, data: { plan: 'ENTERPRISE', planStatus: 'active' } });
    await applyPlanFlagsToTenant(tenantId, 'ENTERPRISE');
    expect(await inventoryStatus()).toBe(200);
  }, 20000);

  it('changing the plan WITHOUT syncing leaves access unchanged — why the sync call is load-bearing', async () => {
    // Back to FREE by row update only, the way the cancellation handler used to.
    await prisma.tenant.update({ where: { id: tenantId }, data: { plan: 'FREE', planStatus: 'canceled' } });
    expect(await inventoryStatus()).toBe(200); // still open: the flag row still says true
  }, 20000);

  it('cancelling with the sync revokes the paid module', async () => {
    await applyPlanFlagsToTenant(tenantId, 'FREE');
    expect(await inventoryStatus()).toBe(403);

    const row = await prisma.tenantFeatureFlag.findUnique({
      where: { tenantId_flag: { tenantId, flag: 'inventory_module' } },
      select: { enabled: true },
    });
    expect(row?.enabled).toBe(false);
  }, 20000);
});
