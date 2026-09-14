/**
 * Nothing may report a send that did not happen.
 *
 * Four endpoints used to answer `{ sent: true }` regardless: the email test,
 * the daily-report email, and the SMS and WhatsApp tests. The dashboard turned
 * each into "sent", so on a server with no providers — which is every
 * environment here, including CI — an owner was told their guests would be
 * notified.
 *
 * Found by reports/qa/2026-09-08-full-project-qa.md and the 2026-09-09 Settings
 * and Overview audits. The rule itself is unit-tested in
 * tests/unit/delivery.test.ts; this pins the routes to it.
 *
 * These assertions depend on email being disabled, which is the case whenever
 * RESEND_API_KEY is unset. If someone configures a key for the test run, the
 * email cases below should be read as no longer meaningful rather than as
 * passing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `no-false-success-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'No False Success', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { planStatus: 'active', plan: 'ENTERPRISE', timezone: 'UTC' },
  });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('email that cannot be sent', () => {
  it('refuses to claim a test email was sent', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/tenant/email-settings/test', headers: auth(),
      payload: { toEmail: 'owner@example.com' },
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('DELIVERY_NOT_CONFIGURED');
    // The old response was 200 with { sent: true }.
    expect(body.sent).toBeUndefined();
  });

  it('refuses to claim the daily report was emailed', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/reports/daily/email', headers: auth(),
      payload: { toEmail: 'owner@example.com' },
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('DELIVERY_NOT_CONFIGURED');
    expect(body.error).toContain('nothing was sent');
  });
});

describe('SMS and WhatsApp tests on a server with no platform account', () => {
  // These used to answer 501 because nothing was wired up. They send for real
  // now (services/messaging.ts). CI has no SSL_WIRELESS_API_KEY or META_WA_*,
  // and a new tenant defaults to platform mode, so the honest answer here is
  // "not configured" — and never { sent: true }.
  for (const [what, url] of [
    ['SMS', '/api/tenant/sms-settings/test-sms'],
    ['WhatsApp', '/api/tenant/sms-settings/test-whatsapp'],
  ] as const) {
    it(`answers 503 for a ${what} test instead of pretending`, async () => {
      const res = await app.inject({
        method: 'POST', url, headers: auth(), payload: { to: '+8801712345678' },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('DELIVERY_NOT_CONFIGURED');
      expect(body.via).toBe('platform');
      expect(body.error).toContain('Nothing was sent');
      expect(body.data?.sent).toBeUndefined();
    });
  }
});

describe('an SMS provider offered in Settings but not built', () => {
  it('says so, rather than quietly using ResortPro\'s own account', async () => {
    // Alpha.Net is in the provider list with no implementation. It used to
    // fall through to the platform account, uncounted against any quota.
    const tenantId = (await prisma.tenant.findFirst({ where: { slug }, select: { id: true } }))!.id;
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { smsMode: 'own', smsProvider: 'alpha_net', smsApiKey: 'alpha-key' },
    });
    try {
      const res = await app.inject({
        method: 'POST', url: '/api/tenant/sms-settings/test-sms', headers: auth(), payload: { to: '+8801712345678' },
      });
      expect(res.statusCode).toBe(501);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('NOT_IMPLEMENTED');
      expect(body.via).toBe('own');
    } finally {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { smsMode: 'platform', smsProvider: null, smsApiKey: null },
      });
    }
  });
});

describe('input validation', () => {
  it('still validates its input before saying anything about delivery', async () => {
    // A missing number is the caller's mistake and must not be reported as a
    // delivery problem.
    const res = await app.inject({
      method: 'POST', url: '/api/tenant/sms-settings/test-sms', headers: auth(), payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
