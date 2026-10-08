/**
 * The audience an owner is shown is the audience that gets the email.
 *
 * It was not. The contacts list counted a guest with no consent row as
 * subscribed; the campaign sender required a row saying `subscribed: true`. On
 * the demo tenant that was ten contacts shown as "Subscribed", zero consent
 * rows, and a campaign to "all subscribed guests" reaching nobody — with the
 * campaign then reported as sent (CRM QA 2026-10-07, finding 004).
 *
 * Nobody would have caught that by reading either side on its own. Both were
 * self-consistent; they only disagreed with each other. So these tests are
 * written as the comparison: whatever the list counts, the send must reach.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, tenantPrisma } from '@resort-pro/database';
import { SUBSCRIBED_GUEST, UNSUBSCRIBED_GUEST } from '../../src/utils/email-consent';

const run = `consent-${Date.now()}`;
let tenantId: string;
let db: ReturnType<typeof tenantPrisma>;

const guestIds: Record<string, string> = {};

beforeAll(async () => {
  tenantId = (await prisma.tenant.create({
    data: { name: 'Consent probe', slug: run },
  })).id;
  db = tenantPrisma(tenantId);

  // The three states a guest can be in. The first is the one that was invisible
  // to the sender, and it is also the common one: nothing writes a consent row
  // until a guest unsubscribes.
  const make = async (key: string, consent?: boolean) => {
    const guest = await prisma.guest.create({
      data: { tenantId, firstName: key, lastName: 'Probe', email: `${key}-${run}@test.com` },
    });
    if (consent !== undefined) {
      await prisma.emailConsent.create({
        data: { tenantId, guestId: guest.id, subscribed: consent },
      });
    }
    guestIds[key] = guest.id;
  };

  await make('noRow');
  await make('optedIn', true);
  await make('optedOut', false);
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
});

describe('a guest who never said anything', () => {
  it('is subscribed — the row records a decision, and there is none', async () => {
    const reached = await db.guest.findMany({ where: { ...SUBSCRIBED_GUEST }, select: { id: true } });
    expect(reached.map((g) => g.id)).toContain(guestIds.noRow);
  });
});

describe('a guest who opted out', () => {
  it('is not in the audience', async () => {
    const reached = await db.guest.findMany({ where: { ...SUBSCRIBED_GUEST }, select: { id: true } });
    expect(reached.map((g) => g.id)).not.toContain(guestIds.optedOut);
  });
});

describe('what the owner is shown and what is sent', () => {
  it('are the same number', async () => {
    // What the contacts list shows: everyone who has not opted out.
    const total = await db.guest.count({ where: {} });
    const optedOut = await db.guest.count({ where: { ...UNSUBSCRIBED_GUEST } });
    const shownAsSubscribed = total - optedOut;

    // What a campaign would actually reach.
    const wouldReceive = await db.guest.count({ where: { ...SUBSCRIBED_GUEST } });

    expect(shownAsSubscribed).toBe(2);
    expect(wouldReceive).toBe(shownAsSubscribed);
  });

  it('would have disagreed under the old rule', async () => {
    // The filter the sender used before: an explicit row only. Kept here as the
    // thing that must never come back — two shown, one reached.
    const oldRule = await db.guest.count({ where: { consent: { is: { subscribed: true } } } });
    expect(oldRule).toBe(1);
    expect(oldRule).not.toBe(await db.guest.count({ where: { ...SUBSCRIBED_GUEST } }));
  });
});

describe('unsubscribing', () => {
  it('takes a guest out of the audience it was in', async () => {
    const before = await db.guest.count({ where: { ...SUBSCRIBED_GUEST } });

    await prisma.emailConsent.create({
      data: { tenantId, guestId: guestIds.noRow, subscribed: false, unsubscribedAt: new Date() },
    });

    expect(await db.guest.count({ where: { ...SUBSCRIBED_GUEST } })).toBe(before - 1);
  });
});
