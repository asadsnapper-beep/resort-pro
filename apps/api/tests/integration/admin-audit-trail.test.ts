/**
 * Privileged admin actions leave a record.
 *
 * Three mutations were changing money, access and infrastructure without
 * writing an audit row, and the audit helper itself swallowed every write
 * failure into an empty `catch` — so the moment the audit store was unhealthy
 * was the moment privileged actions stopped being recorded, silently
 * (release-readiness review M-02).
 *
 * The last test is the one that would have caught the fail-open behaviour: the
 * mutation is still allowed to succeed when the audit write fails, because it
 * has already happened by then — but it has to say so.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { signAdmin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `audit-${Date.now()}`;
const adminEmail = `admin-${run}@test.com`;

let adminToken: string;
let tenantId: string;
let referrerId: string;
let referralId: string;

const auditRows = (action: string) => prisma.auditLog.findMany({
  where: { action, adminEmail },
  orderBy: { createdAt: 'desc' },
});

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  tenantId = (await prisma.tenant.create({
    data: { name: 'Audit Target', slug: run, customDomain: `${run}.example.test` },
  })).id;

  referrerId = (await prisma.tenant.create({
    data: { name: 'The Referrer', slug: `${run}-ref` },
  })).id;
  const referred = await prisma.tenant.create({
    data: { name: 'The Referred', slug: `${run}-new` },
  });
  referralId = (await prisma.referral.create({
    data: { referrerId, referredId: referred.id },
  })).id;

  adminToken = (await signAdmin(app, { email: adminEmail })).token;
}, 60000);

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { adminEmail } });
  await prisma.referral.deleteMany({ where: { id: referralId } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  // The admin row the token helper made, and its session with it.
  await prisma.adminUser.deleteMany({ where: { email: adminEmail } });
  await app.close();
});

describe('a referral reward', () => {
  it('records who granted the credit, to whom, and how much', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/referrals/${referralId}/reward`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { type: 'CREDIT', amount: 5000, note: 'pilot thank-you' },
    });
    expect(res.statusCode, res.body).toBe(200);

    const [row] = await auditRows('referral_reward');
    expect(row, 'money moved with no audit row').toBeTruthy();
    expect(row.targetId).toBe(referrerId);
    expect(row.targetName).toBe('The Referrer');
    expect(row.metadata).toMatchObject({ type: 'CREDIT', amount: 5000, referralId });

    // And the credit really was applied, so this is auditing a real change.
    const referrer = await prisma.tenant.findUnique({
      where: { id: referrerId }, select: { accountCredit: true },
    });
    expect(referrer?.accountCredit).toBe(5000);
  });
});

describe('a bulk feature flag change', () => {
  it('records which flags were set, not just how many', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/tenants/${tenantId}/flags`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { flags: { beta_analytics: true, ai_chatbot: false } },
    });
    expect(res.statusCode, res.body).toBe(200);

    const [row] = await auditRows('feature_flags_update');
    expect(row, 'flags changed with no audit row').toBeTruthy();
    expect(row.targetId).toBe(tenantId);
    expect(row.metadata).toMatchObject({ flags: { beta_analytics: true, ai_chatbot: false } });
  });
});

describe('an SSL status change', () => {
  it('records the domain and the state it was moved to', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/domains/${tenantId}/ssl`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { sslStatus: 'active' },
    });
    expect(res.statusCode, res.body).toBe(200);

    const [row] = await auditRows('ssl_status_update');
    expect(row, 'certificate state changed with no audit row').toBeTruthy();
    expect(row.targetId).toBe(tenantId);
    expect(row.targetName).toBe(`${run}.example.test`);
    expect(row.metadata).toMatchObject({ sslStatus: 'active' });
  });
});

describe('when the audit store is unhealthy', () => {
  it('still performs the action, but says the record was lost', async () => {
    const create = vi.spyOn(prisma.auditLog, 'create')
      .mockRejectedValue(new Error('relation "audit_logs" does not exist'));
    const shouted = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/tenants/${tenantId}/flags`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { flags: { revenue_forecast: true } },
      });

      // The mutation has already happened; reporting failure for it would lie.
      expect(res.statusCode, res.body).toBe(200);

      const complaint = shouted.mock.calls.flat().join(' ');
      expect(complaint).toContain('AUDIT WRITE FAILED');
      expect(complaint).toContain('feature_flags_update');
      expect(complaint).toContain(adminEmail);
    } finally {
      create.mockRestore();
      shouted.mockRestore();
    }

    // The flag really was written, which is what makes the lost record matter.
    const flag = await prisma.tenantFeatureFlag.findUnique({
      where: { tenantId_flag: { tenantId, flag: 'revenue_forecast' } },
    });
    expect(flag?.enabled).toBe(true);
  });
});
