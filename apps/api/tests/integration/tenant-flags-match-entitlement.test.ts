/**
 * What a client can read about its flags must match what the gate enforces.
 *
 * Two things reported a tenant's feature flags and they disagreed.
 * `requireFlag()` resolves through resolveTenantEntitlement: the plan's flag
 * list, then per-tenant TenantFeatureFlag overrides. `GET /api/tenant/flags`
 * built its own set from TenantFeatureFlag rows plus registry `defaultOn`
 * entries and never consulted the plan.
 *
 * So a tenant on PROFESSIONAL with no override row for `custom_domain`
 * (defaultOn: false, granted by STARTER/PROFESSIONAL/ENTERPRISE) was let
 * through the gate and left out of the list — the dashboard hid a feature the
 * resort was paying for. Registration happens to write a row for every flag in
 * any plan, which masked this for freshly-signed-up tenants; tenants created by
 * a seed script, or carrying rows that predate a flag joining a plan, have no
 * row and hit it.
 *
 * These tests pin the three cases that distinguish the two readings, and assert
 * the endpoint and the gate agree on the same tenant.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `flagsread-${Date.now()}`;
const password = 'TestPass123!';
let tenantId: string;
let token: string;

/** The flags the API says this tenant has. */
const readFlags = async (): Promise<string[]> => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/tenant/flags',
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body).data as string[];
};

/**
 * Whether requireFlag('custom_domain') lets this tenant past.
 *
 * The payload is a deliberately invalid domain, so the gate and the handler
 * give different answers: blocked is 403 PLAN_UPGRADE_REQUIRED, allowed is a
 * 400 from validation. Nothing is written either way.
 */
const gateAllowsCustomDomain = async (): Promise<boolean> => {
  const res = await app.inject({
    method: 'PUT',
    url: '/api/tenant/domain',
    headers: { Authorization: `Bearer ${token}` },
    payload: { domain: 'not a domain' },
  });
  if (res.statusCode !== 403) return true;
  return JSON.parse(res.body).code !== 'PLAN_UPGRADE_REQUIRED';
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const email = `fr-${slug}@test.com`;
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Flag Read Resort', slug, firstName: 'F', lastName: 'R', email, password },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email, password, slug });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'PROFESSIONAL', planStatus: 'active' },
  });
}, 25000);

beforeEach(async () => {
  // A tenant whose rows a seed script never wrote: plan only, no overrides.
  // Registration writes a row per flag, which is exactly what hides the bug.
  await prisma.tenantFeatureFlag.deleteMany({ where: { tenantId } });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('GET /api/tenant/flags', () => {
  it('reports a flag the plan grants when there is no override row', async () => {
    const flags = await readFlags();
    // PROFESSIONAL grants custom_domain; the registry has it defaultOn: false.
    expect(flags).toContain('custom_domain');
    // And the gate agrees — this is the pair that used to disagree.
    expect(await gateAllowsCustomDomain()).toBe(true);
  }, 20000);

  it('does not report a plan-granted flag that an override disables', async () => {
    await prisma.tenantFeatureFlag.create({
      data: { tenantId, flag: 'custom_domain', enabled: false },
    });

    const flags = await readFlags();
    expect(flags).not.toContain('custom_domain');
    expect(await gateAllowsCustomDomain()).toBe(false);
  }, 20000);

  it('reports a flag the plan does not grant when an override enables it', async () => {
    // dark_mode_toggle is in the registry, defaultOn: false, and in no plan —
    // an override row is the only way a tenant can have it.
    expect(await readFlags()).not.toContain('dark_mode_toggle');

    await prisma.tenantFeatureFlag.create({
      data: { tenantId, flag: 'dark_mode_toggle', enabled: true },
    });

    expect(await readFlags()).toContain('dark_mode_toggle');
  }, 20000);

  it('still reports a registry defaultOn flag that no override touches', async () => {
    // global_search shipped before the flag existed, so it is on for everyone.
    expect(await readFlags()).toContain('global_search');
  }, 20000);
});
