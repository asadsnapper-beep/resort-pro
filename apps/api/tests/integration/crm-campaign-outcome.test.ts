/**
 * A campaign says what actually happened to it.
 *
 * It used to say SENT no matter what. The loop recorded each failure against
 * the recipient and then set the campaign to SENT unconditionally — so a
 * campaign where every delivery failed told the marketer it had gone out, which
 * is the single thing they needed to know was untrue (CRM QA 2026-10-07,
 * finding 005). Read together with finding 004, an owner could send to an
 * audience of nobody and be congratulated for it.
 *
 * Email is stubbed here. What is under test is the bookkeeping — the status,
 * the timestamp and the counts — not Resend.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import * as email from '../../src/services/email';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `outcome-${Date.now()}`;
const ownerEmail = `owner-${run}@test.com`;
const password = 'TestPass123!';
let tenantId: string;
let token: string;

const send = (campaignId: string) => app.inject({
  method: 'POST',
  url: `/api/crm/campaigns/${campaignId}/send`,
  headers: { Authorization: `Bearer ${token}` },
});

const makeCampaign = async () => (await prisma.campaign.create({
  data: { tenantId, name: `C-${Date.now()}`, subject: 'Hello', html: '<p>Hi {{guestName}}</p>' },
})).id;

const makeGuests = async (count: number) => {
  for (let i = 0; i < count; i += 1) {
    await prisma.guest.create({
      data: {
        tenantId, firstName: `G${i}`, lastName: 'Probe',
        email: `g${i}-${Date.now()}-${run}@test.com`,
      },
    });
  }
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Outcome Resort', slug: run, firstName: 'Asha', lastName: 'R',
      email: ownerEmail, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  // CRM is behind the crm_v2 flag, which STARTER and above carry. A FREE
  // tenant gets 403 from every route in this file.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'STARTER', planStatus: 'active' },
  });
  // Naming the plan is not enough: entitlement reads per-tenant flag rows, and
  // those are written by this. The same trap the referral reward path has a
  // comment about.
  await applyPlanFlagsToTenant(tenantId, 'STARTER');
  token = await verifyOwnerAndLogin(app, { tenantId, email: ownerEmail, password, slug: run });
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('when every delivery fails', () => {
  it('is FAILED, not SENT, and has no sent time', async () => {
    const stub = vi.spyOn(email, 'sendEmail')
      .mockResolvedValue({ id: null, error: 'mailbox unavailable' });
    await makeGuests(2);
    const id = await makeCampaign();

    try {
      const res = await send(id);
      expect(res.statusCode, res.body).toBe(200);
      const body = JSON.parse(res.body);

      expect(body.data).toMatchObject({ sent: 0, failed: 2, status: 'FAILED' });
      // The message is what a marketer reads. It used to say "Campaign sent".
      expect(body.message).toMatch(/Nothing was sent/);

      const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id } });
      expect(campaign.status).toBe('FAILED');
      expect(campaign.sentAt).toBeNull();
    } finally {
      stub.mockRestore();
    }
  });

  it('can be sent again, because nobody received it', async () => {
    const stub = vi.spyOn(email, 'sendEmail').mockResolvedValue({ id: null, error: 'down' });
    const id = await makeCampaign();
    try {
      await send(id);
      expect((await send(id)).statusCode).toBe(200);
    } finally {
      stub.mockRestore();
    }
  });
});

describe('when some fail', () => {
  it('is PARTIAL, and says how many', async () => {
    let call = 0;
    const stub = vi.spyOn(email, 'sendEmail').mockImplementation(async () => {
      call += 1;
      return call === 1 ? { id: 'ok-1', error: null } : { id: null, error: 'bounced' };
    });
    const id = await makeCampaign();

    try {
      const body = JSON.parse((await send(id)).body);
      expect(body.data.status).toBe('PARTIAL');
      expect(body.data.sent).toBeGreaterThan(0);
      expect(body.data.failed).toBeGreaterThan(0);
      expect(body.message).toMatch(/failed/);

      const stats = await prisma.campaignStats.findUniqueOrThrow({ where: { campaignId: id } });
      expect(stats.sent).toBe(body.data.sent);
      expect(stats.bounced).toBe(body.data.failed);
    } finally {
      stub.mockRestore();
    }
  });

  it('cannot be sent again — the ones who got it would get it twice', async () => {
    let call = 0;
    const stub = vi.spyOn(email, 'sendEmail').mockImplementation(async () => {
      call += 1;
      return call === 1 ? { id: 'ok', error: null } : { id: null, error: 'bounced' };
    });
    const id = await makeCampaign();
    try {
      await send(id);
      const again = await send(id);
      expect(again.statusCode).toBe(400);
      expect(JSON.parse(again.body).error).toMatch(/twice/);
    } finally {
      stub.mockRestore();
    }
  });
});

describe('when everything works', () => {
  it('is SENT, with a time', async () => {
    const stub = vi.spyOn(email, 'sendEmail').mockResolvedValue({ id: 'ok', error: null });
    const id = await makeCampaign();
    try {
      const body = JSON.parse((await send(id)).body);
      expect(body.data.status).toBe('SENT');
      expect(body.data.failed).toBe(0);

      const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id } });
      expect(campaign.sentAt).not.toBeNull();
    } finally {
      stub.mockRestore();
    }
  });
});

describe('when there is nobody to send to', () => {
  it('refuses, rather than reporting a send to zero people', async () => {
    // Everyone opts out, which is the state CRM-004 could produce invisibly.
    const guests = await prisma.guest.findMany({ where: { tenantId }, select: { id: true } });
    for (const g of guests) {
      await prisma.emailConsent.upsert({
        where: { guestId: g.id },
        create: { tenantId, guestId: g.id, subscribed: false },
        update: { subscribed: false },
      });
    }

    const id = await makeCampaign();
    const res = await send(id);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('NO_RECIPIENTS');

    // And it stays sendable rather than being spent on a terminal state.
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id } });
    expect(campaign.status).toBe('DRAFT');
  });
});
