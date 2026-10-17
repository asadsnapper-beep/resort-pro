/**
 * The CRM stops saying it did things it did not do.
 *
 * Several routes ran a `deleteMany` or `updateMany` and never looked at the
 * count, so deleting a tag that was never there, or a template that does not
 * exist, answered with a success message (CRM QA 2026-10-07, finding 017).
 *
 * The one that mattered most: deleting a campaign filters on DRAFT and
 * SCHEDULED — correctly, because a campaign that has gone out is a record of
 * emails real people received. But the filter matched nothing silently and the
 * route still said "Campaign deleted", so a marketer deleted a sent campaign,
 * was told it worked, and watched it stay exactly where it was.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `honest-${Date.now()}`;
const ownerEmail = `owner-${run}@test.com`;
const password = 'TestPass123!';
let tenantId: string;
const auth = { Authorization: '' };

const call = (method: 'DELETE' | 'PUT', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: auth, payload: payload as never });

const missingId = '00000000-0000-4000-8000-000000000000';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Honest Resort', slug: run, firstName: 'Asha', lastName: 'R',
      email: ownerEmail, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  await prisma.tenant.update({
    where: { id: tenantId }, data: { plan: 'STARTER', planStatus: 'active' },
  });
  await applyPlanFlagsToTenant(tenantId, 'STARTER');

  const token = await verifyOwnerAndLogin(app, { tenantId, email: ownerEmail, password, slug: run });
  auth.Authorization = `Bearer ${token}`;
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('deleting something that is not there', () => {
  it.each([
    ['a tag', `/api/crm/tags/${missingId}`],
    ['a template', `/api/crm/templates/${missingId}`],
    ['a campaign', `/api/crm/campaigns/${missingId}`],
  ])('says so rather than reporting success: %s', async (_label, url) => {
    const res = await call('DELETE', url);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('a sequence that does not exist cannot be updated', async () => {
    const res = await call('PUT', `/api/crm/sequences/${missingId}`, { status: 'PAUSED' });
    expect(res.statusCode).toBe(404);
  });
});

describe('deleting a campaign that has gone out', () => {
  it('refuses, and says why — it used to report success and change nothing', async () => {
    const campaign = await prisma.campaign.create({
      data: {
        tenantId, name: `Sent-${run}`, subject: 'Hello',
        html: '<p>Hi</p>', status: 'SENT', sentAt: new Date(),
      },
    });

    const res = await call('DELETE', `/api/crm/campaigns/${campaign.id}`);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/record of emails/);
    // And it is still there, which is the point of refusing.
    expect(await prisma.campaign.count({ where: { id: campaign.id } })).toBe(1);
  });

  it('still deletes a draft', async () => {
    const draft = await prisma.campaign.create({
      data: { tenantId, name: `Draft-${run}`, subject: 'Hello', html: '<p>Hi</p>' },
    });

    expect((await call('DELETE', `/api/crm/campaigns/${draft.id}`)).statusCode).toBe(200);
    expect(await prisma.campaign.count({ where: { id: draft.id } })).toBe(0);
  });
});

describe('things that do exist', () => {
  it('a real tag deletes and reports it once', async () => {
    const tag = await prisma.guestTag.create({ data: { tenantId, name: `T-${run}` } });

    expect((await call('DELETE', `/api/crm/tags/${tag.id}`)).statusCode).toBe(200);
    // The second attempt is now a 404 rather than a second success.
    expect((await call('DELETE', `/api/crm/tags/${tag.id}`)).statusCode).toBe(404);
  });

  it('a real sequence updates', async () => {
    const seq = await prisma.sequence.create({
      data: { tenantId, name: `S-${run}`, trigger: 'MANUAL' },
    });

    expect((await call('PUT', `/api/crm/sequences/${seq.id}`, { status: 'PAUSED' })).statusCode).toBe(200);
    const after = await prisma.sequence.findUniqueOrThrow({ where: { id: seq.id } });
    expect(after.status).toBe('PAUSED');
  });
});

describe("another resort's records", () => {
  it('are not deletable, and read as not found', async () => {
    const other = await prisma.tenant.create({ data: { name: 'Other', slug: `${run}-b` } });
    const theirTag = await prisma.guestTag.create({
      data: { tenantId: other.id, name: `Theirs-${run}` },
    });

    const res = await call('DELETE', `/api/crm/tags/${theirTag.id}`);

    expect(res.statusCode).toBe(404);
    expect(await prisma.guestTag.count({ where: { id: theirTag.id } })).toBe(1);

    await prisma.tenant.delete({ where: { id: other.id } });
  });
});
