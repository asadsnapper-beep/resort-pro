/**
 * Sending one campaign, for whoever asks.
 *
 * This used to live inside the `POST /campaigns/:id/send` handler, reading
 * `request.db` and `request.user` — which is why a scheduled campaign never
 * went anywhere. The API stored `scheduledAt` and the status `SCHEDULED`, and
 * nothing in the worker ever looked for them, because the only code that knew
 * how to send a campaign needed an HTTP request to exist (CRM QA 2026-10-07,
 * finding 009). An owner could schedule a campaign for Friday and find out on
 * Saturday that Friday had not happened.
 *
 * So it lives here, takes a tenant id instead of a request, and the route and
 * the dispatcher both call it. One sender means a scheduled campaign and a
 * "send now" campaign cannot drift apart.
 */
import { tenantPrisma } from '@resort-pro/database';
import { sendEmail, wrapEmail, renderTemplate } from './email';
import { SUBSCRIBED_GUEST } from '../utils/email-consent';
import { unsubscribeUrl } from '../utils/unsubscribe-token';

export type SendOutcome =
  | { ok: true; sent: number; failed: number; total: number; status: 'SENT' | 'PARTIAL' | 'FAILED' }
  | { ok: false; reason: 'not-found' | 'already-sent' | 'partly-sent' | 'no-recipients' };

/** Why a campaign could not be sent, in words a person reads. */
export const SEND_REFUSALS: Record<Exclude<SendOutcome & { ok: false }, never>['reason'], string> = {
  'not-found': 'Campaign not found',
  'already-sent': 'Already sent',
  'partly-sent': 'Partly sent already — re-sending would deliver twice to the guests who received it.',
  'no-recipients': 'This campaign has no recipients — every guest has either opted out or there are none yet.',
};

export async function sendCampaign(tenantId: string, campaignId: string): Promise<SendOutcome> {
  const db = tenantPrisma(tenantId);

  const campaign = await db.campaign.findFirst({ where: { id: campaignId } });
  if (!campaign) return { ok: false, reason: 'not-found' };

  // FAILED is re-sendable: nobody received it, so sending again cannot
  // duplicate anything. PARTIAL is not — some guests already have it, and
  // re-running this loop would send to them a second time. Retrying only the
  // recipients whose EmailSend says FAILED is the right answer there, and is
  // its own piece of work.
  if (campaign.status === 'SENT') return { ok: false, reason: 'already-sent' };
  if (campaign.status === 'PARTIAL') return { ok: false, reason: 'partly-sent' };

  // `any` deliberately: `segment` is free-form JSON a marketer composed, and
  // `tier` has to reach Prisma as its enum rather than a widened string.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seg = (campaign.segment ?? {}) as Record<string, any>;
  const guests = await db.guest.findMany({
    where: {
      ...SUBSCRIBED_GUEST,
      ...(seg.tier ? { score: { tier: seg.tier } } : {}),
      ...(seg.tag ? { tags: { some: { tag: { name: seg.tag } } } } : {}),
    },
    select: { id: true, firstName: true, email: true },
  });

  // Not a failure to deliver — there was nobody to deliver to. The campaign is
  // left as it was, so it is still sendable once the audience exists rather
  // than spent on a terminal state.
  if (guests.length === 0) return { ok: false, reason: 'no-recipients' };

  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const wc = await (db as unknown as {
    websiteContent: { findUnique: (a: unknown) => Promise<{ primaryColor?: string; accentColor?: string } | null> };
  }).websiteContent.findUnique({
    where: { tenantId }, select: { primaryColor: true, accentColor: true },
  });

  await db.campaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', recipientCount: guests.length },
  });
  await db.campaignStats.upsert({
    where: { campaignId }, create: { campaignId, sent: 0 }, update: {},
  });

  let sent = 0;
  for (const guest of guests) {
    const html = wrapEmail({
      body: renderTemplate(campaign.html, { guestName: guest.firstName }),
      tenantName: tenant?.name ?? 'Resort',
      primaryColor: wc?.primaryColor ?? '#1a6b5e',
      accentColor: wc?.accentColor ?? '#d4a853',
      unsubscribeUrl: unsubscribeUrl(guest.id),
    });

    const { id: resendId, error } = await sendEmail({
      to: guest.email, subject: campaign.subject, html,
    });

    await db.emailSend.create({
      data: {
        guestId: guest.id,
        campaignId,
        subject: campaign.subject,
        status: error ? 'FAILED' : 'SENT',
        resendId: resendId ?? undefined,
      },
    });
    if (!error) sent += 1;
  }

  // What actually happened, not what was attempted.
  const failed = guests.length - sent;
  const status = sent === 0 ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'SENT';

  await db.campaign.update({
    where: { id: campaignId },
    // sentAt is when it went out. Nothing went out, so there is no such time.
    data: { status, sentAt: sent > 0 ? new Date() : null },
  });
  await db.campaignStats.update({
    where: { campaignId }, data: { sent, bounced: failed },
  });

  return { ok: true, sent, failed, total: guests.length, status };
}

export function describeSend(outcome: SendOutcome & { ok: true }): string {
  if (outcome.sent === 0) return `Nothing was sent — all ${outcome.failed} deliveries failed.`;
  if (outcome.failed > 0) return `Sent to ${outcome.sent} of ${outcome.total}. ${outcome.failed} failed.`;
  return `Campaign sent to ${outcome.sent}.`;
}
