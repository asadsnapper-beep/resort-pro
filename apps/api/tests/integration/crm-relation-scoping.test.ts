/**
 * Models that belong to a tenant through a parent.
 *
 * `CampaignStats`, `SequenceStep` and `GuestTagRelation` have no `tenantId`
 * column, and the tenant-scoped client injected one anyway — so the CRM's
 * Analytics tab, adding a step to a sequence, and assigning a tag to a guest
 * each answered HTTP 500 with `Unknown argument tenantId` (CRM QA 2026-10-07,
 * findings 002, 003 and 006: three broken screens, one cause).
 *
 * The obvious fix — stop scoping them — would have traded a loud 500 for a
 * silent cross-tenant read. So half of these tests are about the 500 being
 * gone, and the other half are about isolation still holding, because that is
 * the half a fix like this gets wrong.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, tenantPrisma } from '@resort-pro/database';

const run = `relscope-${Date.now()}`;

let mine: string;
let theirs: string;
let myDb: ReturnType<typeof tenantPrisma>;

const ids = {
  myGuest: '', theirGuest: '',
  myTag: '',
  mySequence: '', theirSequence: '',
  myCampaign: '', theirCampaign: '',
};

beforeAll(async () => {
  mine = (await prisma.tenant.create({ data: { name: 'Mine', slug: `${run}-a` } })).id;
  theirs = (await prisma.tenant.create({ data: { name: 'Theirs', slug: `${run}-b` } })).id;
  myDb = tenantPrisma(mine);

  ids.myGuest = (await prisma.guest.create({
    data: { tenantId: mine, firstName: 'Mine', lastName: 'Guest', email: `g1-${run}@test.com` },
  })).id;
  ids.theirGuest = (await prisma.guest.create({
    data: { tenantId: theirs, firstName: 'Theirs', lastName: 'Guest', email: `g2-${run}@test.com` },
  })).id;

  ids.myTag = (await prisma.guestTag.create({
    data: { tenantId: mine, name: `VIP-${run}`, color: '#1a6b5e' },
  })).id;

  ids.mySequence = (await prisma.sequence.create({
    data: { tenantId: mine, name: `Welcome-${run}`, trigger: 'PRE_ARRIVAL' },
  })).id;
  ids.theirSequence = (await prisma.sequence.create({
    data: { tenantId: theirs, name: `Theirs-${run}`, trigger: 'PRE_ARRIVAL' },
  })).id;

  ids.myCampaign = (await prisma.campaign.create({
    data: { tenantId: mine, name: `Mine-${run}`, subject: 'Hello', html: '<p>Hi</p>' },
  })).id;
  ids.theirCampaign = (await prisma.campaign.create({
    data: { tenantId: theirs, name: `Theirs-${run}`, subject: 'Hello', html: '<p>Hi</p>' },
  })).id;

  await prisma.campaignStats.create({ data: { campaignId: ids.myCampaign, sent: 5 } });
  await prisma.campaignStats.create({ data: { campaignId: ids.theirCampaign, sent: 99 } });
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
});

describe('a step on a sequence', () => {
  it('can be added at all — this was a 500', async () => {
    const step = await myDb.sequenceStep.create({
      data: { sequenceId: ids.mySequence, stepOrder: 1, delayDays: 0, subject: 'Day one', html: '<p>Hello</p>' },
    });
    expect(step.sequenceId).toBe(ids.mySequence);
  });

  it('cannot be attached to another resort\'s sequence', async () => {
    await expect(myDb.sequenceStep.create({
      data: { sequenceId: ids.theirSequence, stepOrder: 1, delayDays: 0, subject: 'Sneaky', html: '<p>Hi</p>' },
    })).rejects.toThrow(/does not belong to this tenant/);
  });

  it('lists only this resort\'s steps', async () => {
    await prisma.sequenceStep.create({
      data: { sequenceId: ids.theirSequence, stepOrder: 1, delayDays: 0, subject: 'Theirs', html: '<p>Hi</p>' },
    });

    const steps = await myDb.sequenceStep.findMany({});
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.sequenceId === ids.mySequence)).toBe(true);
  });
});

describe('a tag on a guest', () => {
  it('can be assigned — this was a 500', async () => {
    const relation = await myDb.guestTagRelation.create({
      data: { guestId: ids.myGuest, tagId: ids.myTag },
    });
    expect(relation.guestId).toBe(ids.myGuest);
  });

  it('cannot be hung on another resort\'s guest', async () => {
    await expect(myDb.guestTagRelation.create({
      data: { guestId: ids.theirGuest, tagId: ids.myTag },
    })).rejects.toThrow(/does not belong to this tenant/);
  });
});

describe('campaign statistics', () => {
  it('can be read — this was the Analytics tab\'s 500', async () => {
    const stats = await myDb.campaignStats.findMany({});
    expect(stats).toHaveLength(1);
    expect(stats[0].sent).toBe(5);
  });

  it('does not count another resort\'s sends', async () => {
    const total = await myDb.campaignStats.aggregate({ _sum: { sent: true } });
    // 5 is ours; 99 is theirs and must not be in this number.
    expect(total._sum.sent).toBe(5);
  });

  it('counts only ours', async () => {
    expect(await myDb.campaignStats.count({})).toBe(1);
  });
});

describe('models that do carry their own tenantId', () => {
  it('are unaffected — the change is scoped to the three without one', async () => {
    const guests = await myDb.guest.findMany({});
    expect(guests.every((g) => g.tenantId === mine)).toBe(true);
    expect(guests.some((g) => g.id === ids.theirGuest)).toBe(false);
  });
});
