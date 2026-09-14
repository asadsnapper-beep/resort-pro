/**
 * The monthly allowance on ResortPro's own SMS and WhatsApp account.
 *
 * Every tenant in platform mode is offered a monthly quota (smsQuotaMonthly,
 * waQuotaMonthly) plus any purchased credits. Two things made that promise
 * untrue:
 *
 *  - Nothing ever reset usage. smsUsedThisMonth only ever increased, so
 *    "100 SMS a month" was in fact 100 SMS for the life of the account.
 *  - Nothing checked it at send time. The marketing page compared remaining
 *    allowance before a campaign; a single message sent any other way was not
 *    checked at all — and guest notifications are about to be exactly that.
 *
 * A message now reserves one unit *before* it is sent, in a single UPDATE that
 * only succeeds while there is allowance left. Two sends racing for the last
 * unit cannot both win, which a read-then-write check allows. A send that then
 * fails gives its unit back.
 *
 * Credits are consumed implicitly: usage runs past the quota and eats into
 * credits, since remaining = quota - used + credits. The monthly reset
 * therefore deducts last month's overage from credits before zeroing usage;
 * zeroing alone would hand spent credits back.
 *
 * Own-account tenants are never counted here. Their provider bills them.
 */
import { Prisma, prisma } from '@resort-pro/database';
import { sendSms, sendWhatsApp, type MessagingTenant, type SendResult } from './messaging';

export type Channel = 'sms' | 'whatsapp';

// Column names come from this fixed map, never from input, so Prisma.raw is safe.
const COLUMNS: Record<Channel, { used: string; quota: string; credits: string }> = {
  sms:      { used: '"smsUsedThisMonth"', quota: '"smsQuotaMonthly"', credits: '"smsCredits"' },
  whatsapp: { used: '"waUsedThisMonth"',  quota: '"waQuotaMonthly"',  credits: '"waCredits"' },
};

/** Takes one unit of this month's allowance. False when none is left. */
export async function reservePlatformMessage(tenantId: string, channel: Channel): Promise<boolean> {
  const c = COLUMNS[channel];
  const updated = await prisma.$executeRaw`
    UPDATE "tenants"
       SET ${Prisma.raw(c.used)} = ${Prisma.raw(c.used)} + 1
     WHERE "id" = ${tenantId}
       AND ${Prisma.raw(c.used)} < ${Prisma.raw(c.quota)} + ${Prisma.raw(c.credits)}`;
  return updated === 1;
}

/** Gives back a unit reserved for a message that did not go. */
export async function releasePlatformMessage(tenantId: string, channel: Channel): Promise<void> {
  const c = COLUMNS[channel];
  await prisma.$executeRaw`
    UPDATE "tenants"
       SET ${Prisma.raw(c.used)} = GREATEST(0, ${Prisma.raw(c.used)} - 1)
     WHERE "id" = ${tenantId}`;
}

/**
 * Send one message, counting it against the allowance when it goes out on the
 * platform account.
 */
export async function sendCountedMessage(
  tenant: MessagingTenant & { id: string },
  channel: Channel,
  phone: string,
  message: string,
): Promise<SendResult> {
  const mode = channel === 'sms' ? tenant.smsMode : tenant.waMode;
  const send = channel === 'sms' ? sendSms : sendWhatsApp;

  if (mode === 'own') return send(tenant, phone, message);

  if (!(await reservePlatformMessage(tenant.id, channel))) {
    return {
      delivered: false,
      reason: 'quota_exhausted',
      via: 'platform',
      detail: channel === 'sms'
        ? "This month's included SMS messages are used up."
        : "This month's included WhatsApp messages are used up.",
    };
  }

  const result = await send(tenant, phone, message);
  if (!result.delivered) await releasePlatformMessage(tenant.id, channel);
  return result;
}

/**
 * Rolls every tenant whose usage has not been reset this calendar month (UTC)
 * over to a fresh month. Safe to run as often as you like: a tenant already
 * reset this month does not match. Running daily rather than on the 1st means
 * a worker that was down on the 1st catches up the next time it starts.
 *
 * Returns the number of tenants rolled over.
 */
export async function resetMonthlyMessagingUsage(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "tenants"
       SET "smsCredits"       = GREATEST(0, "smsCredits" - GREATEST(0, "smsUsedThisMonth" - "smsQuotaMonthly")),
           "smsUsedThisMonth" = 0,
           "waCredits"        = GREATEST(0, "waCredits" - GREATEST(0, "waUsedThisMonth" - "waQuotaMonthly")),
           "waUsedThisMonth"  = 0,
           "messagingUsageResetAt" = NOW()
     WHERE "messagingUsageResetAt" IS NULL
        OR "messagingUsageResetAt" < date_trunc('month', NOW())`;
}
