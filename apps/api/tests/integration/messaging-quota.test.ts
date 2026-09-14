/**
 * The monthly SMS/WhatsApp allowance on ResortPro's own account, against a
 * real database — the reservation is a conditional UPDATE and the rollover is
 * arithmetic in SQL, so neither can be meaningfully checked with mocks.
 *
 * Providers are stubbed at fetch; nothing here sends a message.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@resort-pro/database';
import {
  reservePlatformMessage, releasePlatformMessage, sendCountedMessage, resetMonthlyMessagingUsage,
} from '../../src/services/messaging-quota';

const slug = `messaging-quota-${Date.now()}`;
let tenantId: string;

async function usage() {
  return prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { smsUsedThisMonth: true, smsCredits: true, waUsedThisMonth: true, waCredits: true, messagingUsageResetAt: true },
  });
}
const setUsage = (data: Record<string, unknown>) => prisma.tenant.update({ where: { id: tenantId }, data });

beforeAll(async () => {
  const tenant = await prisma.tenant.create({
    data: { name: 'Messaging Quota', slug, email: `owner-${slug}@test.com` },
    select: { id: true },
  });
  tenantId = tenant.id;
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
});

beforeEach(async () => {
  delete process.env.SSL_WIRELESS_API_KEY;
  await setUsage({
    smsQuotaMonthly: 3, smsUsedThisMonth: 0, smsCredits: 0,
    waQuotaMonthly: 2, waUsedThisMonth: 0, waCredits: 0,
    smsMode: 'platform', waMode: 'platform', messagingUsageResetAt: null,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('reserving a message', () => {
  it('succeeds until the quota is used, then refuses', async () => {
    expect(await reservePlatformMessage(tenantId, 'sms')).toBe(true);
    expect(await reservePlatformMessage(tenantId, 'sms')).toBe(true);
    expect(await reservePlatformMessage(tenantId, 'sms')).toBe(true);
    expect(await reservePlatformMessage(tenantId, 'sms')).toBe(false);
    expect((await usage()).smsUsedThisMonth).toBe(3);
  });

  it('draws on purchased credits once the quota is spent', async () => {
    await setUsage({ smsUsedThisMonth: 3, smsCredits: 1 });
    expect(await reservePlatformMessage(tenantId, 'sms')).toBe(true);
    expect(await reservePlatformMessage(tenantId, 'sms')).toBe(false);
  });

  it('cannot be won twice for the last unit by two sends at once', async () => {
    await setUsage({ smsUsedThisMonth: 2 }); // one unit left
    const results = await Promise.all(Array.from({ length: 8 }, () => reservePlatformMessage(tenantId, 'sms')));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await usage()).smsUsedThisMonth).toBe(3);
  });

  it('keeps SMS and WhatsApp allowances separate', async () => {
    await setUsage({ smsUsedThisMonth: 3 });
    expect(await reservePlatformMessage(tenantId, 'whatsapp')).toBe(true);
  });

  it('releases a unit, and never below zero', async () => {
    await setUsage({ smsUsedThisMonth: 1 });
    await releasePlatformMessage(tenantId, 'sms');
    await releasePlatformMessage(tenantId, 'sms');
    expect((await usage()).smsUsedThisMonth).toBe(0);
  });
});

describe('sending on the platform account', () => {
  it('refuses once the allowance is spent, without calling the provider', async () => {
    process.env.SSL_WIRELESS_API_KEY = 'platform-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await setUsage({ smsUsedThisMonth: 3 });

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const result = await sendCountedMessage(tenant, 'sms', '+8801712345678', 'hi');

    expect(result).toMatchObject({ delivered: false, reason: 'quota_exhausted', via: 'platform' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives the unit back when the message does not go', async () => {
    // No SSL_WIRELESS_API_KEY: the send answers not_configured after reserving.
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const result = await sendCountedMessage(tenant, 'sms', '+8801712345678', 'hi');

    expect(result).toMatchObject({ delivered: false, reason: 'not_configured' });
    expect((await usage()).smsUsedThisMonth).toBe(0);
  });

  it('counts a message that did go', async () => {
    process.env.SSL_WIRELESS_API_KEY = 'platform-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS', status_code: 200 }), { status: 200 }),
    ));
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    expect((await sendCountedMessage(tenant, 'sms', '+8801712345678', 'hi')).delivered).toBe(true);
    expect((await usage()).smsUsedThisMonth).toBe(1);
  });

  it('does not count a resort that uses its own account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS', status_code: 200 }), { status: 200 }),
    ));
    await setUsage({ smsMode: 'own', smsProvider: 'ssl_wireless', smsApiKey: 'resort-key', smsUsedThisMonth: 3 });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    expect((await sendCountedMessage(tenant, 'sms', '+8801712345678', 'hi')).delivered).toBe(true);
    expect((await usage()).smsUsedThisMonth).toBe(3);
  });
});

describe('the monthly rollover', () => {
  it('zeroes usage, and deducts last month\'s overage from credits instead of refunding it', async () => {
    // Quota 3, used 5: two messages came out of credits.
    await setUsage({ smsUsedThisMonth: 5, smsCredits: 10, waUsedThisMonth: 1, waCredits: 4 });

    await resetMonthlyMessagingUsage();

    const u = await usage();
    expect(u.smsUsedThisMonth).toBe(0);
    expect(u.smsCredits).toBe(8);
    expect(u.waUsedThisMonth).toBe(0);
    expect(u.waCredits).toBe(4); // under quota: no credits were spent
    expect(u.messagingUsageResetAt).not.toBeNull();
  });

  it('never takes credits below zero', async () => {
    await setUsage({ smsUsedThisMonth: 50, smsCredits: 2 });
    await resetMonthlyMessagingUsage();
    expect((await usage()).smsCredits).toBe(0);
  });

  it('does nothing to a tenant already rolled over this month', async () => {
    await resetMonthlyMessagingUsage();
    await setUsage({ smsUsedThisMonth: 2 });

    await resetMonthlyMessagingUsage(); // e.g. the worker restarted
    expect((await usage()).smsUsedThisMonth).toBe(2);
  });

  it('catches up a tenant last rolled over in a previous month', async () => {
    const lastMonth = new Date();
    lastMonth.setUTCDate(1);
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
    await setUsage({ smsUsedThisMonth: 2, messagingUsageResetAt: lastMonth });

    await resetMonthlyMessagingUsage();
    expect((await usage()).smsUsedThisMonth).toBe(0);
  });
});
