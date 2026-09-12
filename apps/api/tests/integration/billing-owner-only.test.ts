/**
 * Who may touch the resort's subscription.
 *
 * Found by the 2026-09-09 sidebar QA: the Billing routes used only an
 * authentication check, so any role in the tenant could read the billing page
 * and — worse — call POST /billing/portal, which opens Stripe's own billing
 * portal where a subscription can be cancelled and payment methods changed.
 * The sidebar hid the link from non-owners, and hidden navigation is not
 * authorization.
 *
 * Every 403 below is asserted on its `code`, not just its status. Billing's
 * auth helper also rejects unverified email with a 403, so a test that only
 * checked the status would pass just as happily against no role check at all.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `billing-owner-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
const staffTokens: Record<string, string> = {};

const NON_OWNER_ROLES = ['MANAGER', 'RECEPTIONIST', 'CHEF', 'SHAREHOLDER'] as const;

/** Everything that can spend money or expose billing history. */
const OWNER_ONLY: { method: 'GET' | 'POST'; url: string; payload?: object }[] = [
  { method: 'GET', url: '/api/billing/invoices' },
  { method: 'POST', url: '/api/billing/portal' },
  { method: 'POST', url: '/api/billing/checkout', payload: { planKey: 'STARTER' } },
  { method: 'POST', url: '/api/billing/checkout/bkash', payload: { planKey: 'STARTER' } },
];

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Billing Owner Only', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { planStatus: 'active', plan: 'PROFESSIONAL' },
  });

  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 10);

  for (const role of NON_OWNER_ROLES) {
    const email = `${role.toLowerCase()}-${slug}@test.com`;
    await prisma.user.create({
      data: {
        tenantId, email, passwordHash, firstName: role, lastName: 'Test', role,
        // Verified on purpose. Without this the helper's email check would
        // answer first and the role check would never be exercised.
        emailVerifiedAt: new Date(),
      },
    });
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login', payload: { email, password, slug },
    });
    expect(login.statusCode, `login failed for ${role}`).toBe(200);
    staffTokens[role] = JSON.parse(login.body).data.token;
  }
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('billing routes that spend money or expose history', () => {
  for (const role of NON_OWNER_ROLES) {
    for (const route of OWNER_ONLY) {
      it(`refuses ${role} on ${route.method} ${route.url}`, async () => {
        const res = await app.inject({
          method: route.method, url: route.url,
          headers: { Authorization: `Bearer ${staffTokens[role]}` },
          ...(route.payload ? { payload: route.payload } : {}),
        });

        expect(res.statusCode).toBe(403);
        // The specific reason matters: EMAIL_VERIFICATION_REQUIRED here would
        // mean the role check is still absent and the test is lying.
        expect(JSON.parse(res.body).code).toBe('OWNER_ONLY');
      });
    }
  }

  it('still lets the owner through', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/billing/invoices',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('billing status', () => {
  // Left open deliberately. The dashboard layout calls it on mount for the
  // suspension and trial-expiry gate, and lets the user through when it fails —
  // so locking it would quietly mean staff of a suspended resort carry on
  // working.
  for (const role of NON_OWNER_ROLES) {
    it(`stays readable by ${role}, because the suspension gate depends on it`, async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/billing/status',
        headers: { Authorization: `Bearer ${staffTokens[role]}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.planStatus).toBeDefined();
    });
  }

  it('carries plan state and limits, and no payment detail', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/billing/status',
      headers: { Authorization: `Bearer ${staffTokens.RECEPTIONIST}` },
    });
    const body = res.body;

    expect(JSON.parse(body).data.entitlement.roomLimit).toBeDefined();
    // Nothing that could identify or charge a card.
    for (const leak of ['stripeCustomerId', 'stripeSubscriptionId', 'cardLast4', 'paymentMethod']) {
      expect(body).not.toContain(leak);
    }
  });
});
