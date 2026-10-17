/**
 * A campaign scheduled for Friday goes out on Friday.
 *
 * It did not. The API accepted `scheduledAt`, stored the status SCHEDULED, and
 * nothing ever came back for those rows — because the only code that knew how
 * to send a campaign lived inside an HTTP handler (CRM QA 2026-10-07, finding
 * 009). The campaign sat there still saying SCHEDULED, which is the most
 * convincing way for software to be wrong about itself.
 *
 * Email is stubbed. What is under test is which rows the dispatcher picks up
 * and what it leaves alone.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@resort-pro/database';
import { dispatchScheduledCampaigns } from '../../src/services/automation';
import * as email from '../../src/services/email';

const run = `sched-${Date.now()}`;
let tenantId: string;
let otherTenantId: string;

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
const minutesAhead = (n: number) => new Date(Date.now() + n * 60_000);

const makeCampaign = async (over: Record<string, unknown> = {}, forTenant = tenantId) =>
  (await prisma.campaign.create({
    data: {
      tenantId: forTenant,
      name: `C-${Math.random().toString(36).slice(2, 8)}`,
      subject: 'Hello',
      html: '<p>Hi {{guestName}}</p>',
      ...over,
    },
  })).id;

const statusOf = async (id: string) =>
  (await prisma.campaign.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

beforeAll(async () => {
  tenantId = (await prisma.tenant.create({ data: { name: 'Sched', slug: run } })).id;
  otherTenantId = (await prisma.tenant.create({ data: { name: 'Other', slug: `${run}-b` } })).id;

  // One subscribed guest in each, so a send has somewhere to go.
  for (const t of [tenantId, otherTenantId]) {
    await prisma.guest.create({
      data: { tenantId: t, firstName: 'Guest', lastName: 'P', email: `g-${t}-${run}@test.com` },
    });
  }
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
});

describe('a campaign whose time has come', () => {
  it('is sent, and stops saying SCHEDULED', async () => {
    const stub = vi.spyOn(email, 'sendEmail').mockResolvedValue({ id: 'ok', error: null });
    const id = await makeCampaign({ status: 'SCHEDULED', scheduledAt: minutesAgo(5) });

    try {
      await dispatchScheduledCampaigns();
      expect(await statusOf(id)).toBe('SENT');
    } finally {
      stub.mockRestore();
    }
  });

  it('is picked up even if the worker was down when it was due', async () => {
    // Due three hours ago. Skipping it because the moment passed would be the
    // same bug with better manners.
    const stub = vi.spyOn(email, 'sendEmail').mockResolvedValue({ id: 'ok', error: null });
    const id = await makeCampaign({ status: 'SCHEDULED', scheduledAt: minutesAgo(180) });
    try {
      await dispatchScheduledCampaigns();
      expect(await statusOf(id)).toBe('SENT');
    } finally {
      stub.mockRestore();
    }
  });

  it('records a failed send as FAILED, not SENT', async () => {
    const stub = vi.spyOn(email, 'sendEmail').mockResolvedValue({ id: null, error: 'refused' });
    const id = await makeCampaign({ status: 'SCHEDULED', scheduledAt: minutesAgo(1) });
    try {
      await dispatchScheduledCampaigns();
      expect(await statusOf(id)).toBe('FAILED');
    } finally {
      stub.mockRestore();
    }
  });
});

describe('a campaign whose time has not come', () => {
  it('is left alone', async () => {
    const stub = vi.spyOn(email, 'sendEmail').mockResolvedValue({ id: 'ok', error: null });
    const id = await makeCampaign({ status: 'SCHEDULED', scheduledAt: minutesAhead(60) });
    try {
      await dispatchScheduledCampaigns();
      expect(await statusOf(id)).toBe('SCHEDULED');
    } finally {
      stub.mockRestore();
    }
  });
});

describe('everything that is not a due scheduled campaign', () => {
  it.each([
    ['a draft', { status: 'DRAFT' as const, scheduledAt: minutesAgo(10) }],
    ['one already sent', { status: 'SENT' as const, scheduledAt: minutesAgo(10) }],
    ['one that was cancelled', { status: 'CANCELLED' as const, scheduledAt: minutesAgo(10) }],
  ])('is not touched: %s', async (_label, over) => {
    const stub = vi.spyOn(email, 'sendEmail').mockResolvedValue({ id: 'ok', error: null });
    const id = await makeCampaign(over);
    try {
      await dispatchScheduledCampaigns();
      expect(await statusOf(id)).toBe(over.status);
    } finally {
      stub.mockRestore();
    }
  });
});

describe('two resorts with campaigns due at once', () => {
  it('each gets its own, sent as itself', async () => {
    const seen: string[] = [];
    const stub = vi.spyOn(email, 'sendEmail').mockImplementation(async ({ to }) => {
      seen.push(to);
      return { id: 'ok', error: null };
    });

    const mine = await makeCampaign({ status: 'SCHEDULED', scheduledAt: minutesAgo(2) });
    const theirs = await makeCampaign({ status: 'SCHEDULED', scheduledAt: minutesAgo(2) }, otherTenantId);

    try {
      await dispatchScheduledCampaigns();

      expect(await statusOf(mine)).toBe('SENT');
      expect(await statusOf(theirs)).toBe('SENT');
      // Each resort's own guest, and nobody else's.
      expect(seen).toContain(`g-${tenantId}-${run}@test.com`);
      expect(seen).toContain(`g-${otherTenantId}-${run}@test.com`);

      const mineSends = await prisma.emailSend.count({ where: { campaignId: mine } });
      expect(mineSends).toBe(1);
    } finally {
      stub.mockRestore();
    }
  });
});
