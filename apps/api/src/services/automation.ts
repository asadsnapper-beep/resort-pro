import cron from 'node-cron';
import { SUBSCRIBED_GUEST, SUBSCRIBED_GUEST_RELATION } from '../utils/email-consent';
import { prisma } from '@resort-pro/database';
import { sendEmail, wrapEmail, SEQUENCE_TEMPLATES } from './email';
import { sendCampaign } from './campaign-sender';

// ─── Send next due sequence steps ────────────────────────────────────────────
async function processSequenceEnrollments() {
  const now = new Date();

  // Find all active enrollments
  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: { status: 'ACTIVE' },
    include: {
      guest:    { include: { consent: true } },
      sequence: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
    },
  });

  for (const enrollment of enrollments) {
    // Skip unsubscribed guests
    if (enrollment.guest.consent && !enrollment.guest.consent.subscribed) {
      await prisma.sequenceEnrollment.update({ where: { id: enrollment.id }, data: { status: 'UNSUBSCRIBED' } });
      continue;
    }

    const steps = enrollment.sequence.steps;
    if (steps.length === 0) continue;

    // Check if there are more steps to send
    const nextStepIdx = enrollment.currentStep;
    if (nextStepIdx >= steps.length) {
      await prisma.sequenceEnrollment.update({ where: { id: enrollment.id }, data: { status: 'COMPLETED', completedAt: now } });
      continue;
    }

    const step = steps[nextStepIdx];
    const meta = (enrollment.triggerMeta ?? {}) as Record<string, any>;

    // Calculate when this step should be sent
    const enrolledAt   = enrollment.enrolledAt;
    const totalDelay   = steps.slice(0, nextStepIdx + 1).reduce((s, st) => s + st.delayDays, 0);
    const scheduledAt  = new Date(enrolledAt.getTime() + totalDelay * 86400000);

    if (scheduledAt > now) continue; // Not time yet

    // Get tenant branding
    const tenant = await prisma.tenant.findUnique({ where: { id: enrollment.tenantId }, select: { name: true, slug: true } });
    const wc     = await prisma.websiteContent.findUnique({ where: { tenantId: enrollment.tenantId }, select: { primaryColor: true, accentColor: true } });
    const primary = wc?.primaryColor ?? '#1a6b5e';
    const accent  = wc?.accentColor  ?? '#d4a853';
    const apiUrl  = process.env.WEB_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const slug    = tenant?.slug ?? '';
    const tenantName = tenant?.name ?? 'Resort';

    // Build email HTML based on sequence trigger
    let body = step.html;
    const guestName = enrollment.guest.firstName;

    try {
      switch (enrollment.sequence.trigger) {
        case 'BOOKING_CONFIRMED':
          body = SEQUENCE_TEMPLATES.BOOKING_CONFIRMED({
            guestName, tenantName, accentColor: accent,
            roomName:       meta.roomName       ?? 'your room',
            checkIn:        meta.checkIn        ?? '',
            checkOut:       meta.checkOut       ?? '',
            confirmationNo: meta.confirmationNo ?? '',
          });
          break;
        case 'PRE_ARRIVAL':
          body = SEQUENCE_TEMPLATES.PRE_ARRIVAL({ guestName, tenantName, primaryColor: primary, slug, apiUrl, checkIn: meta.checkIn ?? '' });
          break;
        case 'POST_STAY':
          body = SEQUENCE_TEMPLATES.POST_STAY({ guestName, tenantName, primaryColor: primary, slug, apiUrl });
          break;
        case 'WIN_BACK':
          body = SEQUENCE_TEMPLATES.WIN_BACK({ guestName, tenantName, primaryColor: primary, accentColor: accent, slug, apiUrl });
          break;
        case 'BIRTHDAY':
          body = SEQUENCE_TEMPLATES.BIRTHDAY({ guestName, tenantName, primaryColor: primary, accentColor: accent, slug, apiUrl });
          break;
      }
    } catch { /* use raw step html */ }

    const html = wrapEmail({
      body,
      tenantName,
      primaryColor: primary,
      accentColor:  accent,
      unsubscribeUrl: `${process.env.API_URL || 'http://localhost:4000'}/crm/unsubscribe/${enrollment.guestId}`,
    });

    const { id: resendId, error } = await sendEmail({
      to:      enrollment.guest.email,
      subject: step.subject,
      html,
    });

    await prisma.emailSend.create({
      data: {
        tenantId:       enrollment.tenantId,
        guestId:        enrollment.guestId,
        sequenceStepId: step.id,
        enrollmentId:   enrollment.id,
        subject:        step.subject,
        status:         error ? 'FAILED' : 'SENT',
        resendId:       resendId ?? undefined,
      },
    });

    // Log activity
    await prisma.guestActivity.create({
      data: { tenantId: enrollment.tenantId, guestId: enrollment.guestId, type: 'EMAIL_SENT', meta: { stepId: step.id, subject: step.subject } },
    });

    // Advance to next step
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data:  { currentStep: nextStepIdx + 1, updatedAt: now },
    });
  }
}

// ─── Auto-enroll guests in WIN_BACK (90 days no booking) ────────────────────
async function processWinBackTrigger() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const winBackSequences = await prisma.sequence.findMany({
    where: { trigger: 'WIN_BACK', status: 'ACTIVE' },
    select: { id: true, tenantId: true },
  });

  for (const seq of winBackSequences) {
    // Guests with no booking in last 90 days and not already enrolled
    const guests = await prisma.guest.findMany({
      where: {
        tenantId: seq.tenantId,
        ...SUBSCRIBED_GUEST,
        bookings: { none: { createdAt: { gte: ninetyDaysAgo } } },
        enrollments: { none: { sequenceId: seq.id, status: { in: ['ACTIVE', 'COMPLETED'] } } },
      },
      select: { id: true },
      take: 50,
    });

    for (const guest of guests) {
      await prisma.sequenceEnrollment.create({
        data: { tenantId: seq.tenantId, sequenceId: seq.id, guestId: guest.id, triggerMeta: {} },
      }).catch(() => {}); // ignore duplicate key
    }
  }
}

/**
 * Guests with a date coming up, for the two sequences that run off one.
 *
 * Both used to be broken in their own way. BIRTHDAY searched `notes` for the
 * string `birthday:MM-DD`, with a comment saying "in a real implementation
 * you'd have a dob field on Guest" — and `Guest.dateOfBirth` has existed all
 * along, so the sequence enrolled nobody while the daily runner, reading the
 * real column, mailed people (CRM QA finding 011's two incompatible sources).
 * ANNIVERSARY was not offered to the API at all: the UI listed it, the
 * validator rejected it, and the form swallowed the 400 (finding 007).
 *
 * Raw SQL because the match is on the month and day of a date, which Prisma's
 * `where` cannot express. The consent rule is spelled out here rather than
 * imported, for the same reason — it is the SQL form of SUBSCRIBED_GUEST: a
 * guest with no consent row has not opted out.
 */
async function enrolOnUpcomingDate(
  trigger: 'BIRTHDAY' | 'ANNIVERSARY',
  daysAhead = 3,
) {
  const sequences = await prisma.sequence.findMany({
    where: { trigger, status: 'ACTIVE' },
    select: { id: true, tenantId: true },
  });
  if (sequences.length === 0) return;

  const target = new Date(Date.now() + daysAhead * 86400000);
  const month = target.getUTCMonth() + 1;
  const day = target.getUTCDate();
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  for (const seq of sequences) {
    const guests = trigger === 'BIRTHDAY'
      ? await prisma.$queryRaw<{ id: string }[]>`
          SELECT g.id
          FROM guests g
          LEFT JOIN email_consents c ON c."guestId" = g.id
          WHERE g."tenantId" = ${seq.tenantId}
            AND g."dateOfBirth" IS NOT NULL
            AND EXTRACT(MONTH FROM g."dateOfBirth") = ${month}
            AND EXTRACT(DAY   FROM g."dateOfBirth") = ${day}
            AND (c."subscribed" IS NULL OR c."subscribed" = true)
        `
      // The anniversary of a guest's first stay, which is what the daily
      // runner has always meant by the word.
      : await prisma.$queryRaw<{ id: string }[]>`
          SELECT g.id
          FROM guests g
          LEFT JOIN email_consents c ON c."guestId" = g.id
          JOIN (
            SELECT b."guestId", MIN(b."checkOut") AS first_stay
            FROM bookings b
            WHERE b.status = 'CHECKED_OUT'
            GROUP BY b."guestId"
          ) f ON f."guestId" = g.id
          WHERE g."tenantId" = ${seq.tenantId}
            AND EXTRACT(MONTH FROM f.first_stay) = ${month}
            AND EXTRACT(DAY   FROM f.first_stay) = ${day}
            AND f.first_stay < ${target}
            AND (c."subscribed" IS NULL OR c."subscribed" = true)
        `;

    for (const guest of guests) {
      // Once a year, not once a run: the sequence fires on a date that comes
      // round annually, so the window is the calendar year.
      const already = await prisma.sequenceEnrollment.count({
        where: {
          sequenceId: seq.id,
          guestId: guest.id,
          enrolledAt: { gte: yearStart },
          status: { in: ['ACTIVE', 'COMPLETED'] },
        },
      });
      if (already > 0) continue;

      await prisma.sequenceEnrollment.create({
        data: {
          tenantId: seq.tenantId,
          sequenceId: seq.id,
          guestId: guest.id,
          triggerMeta: { on: target.toISOString().slice(0, 10) },
        },
      }).catch(() => {});
    }
  }
}

const processBirthdayTrigger = () => enrolOnUpcomingDate('BIRTHDAY');
const processAnniversaryTrigger = () => enrolOnUpcomingDate('ANNIVERSARY');

// ─── Auto-enroll for PRE_ARRIVAL (3 days before check-in) ───────────────────
async function processPreArrivalTrigger() {
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const dateStr = threeDaysLater.toISOString().split('T')[0];

  const preArrivalSequences = await prisma.sequence.findMany({
    where: { trigger: 'PRE_ARRIVAL', status: 'ACTIVE' },
    select: { id: true, tenantId: true },
  });

  for (const seq of preArrivalSequences) {
    const bookings = await prisma.booking.findMany({
      where: {
        tenantId: seq.tenantId,
        status:   { in: ['CONFIRMED'] },
        checkIn:  { equals: new Date(dateStr) },
        guest:    SUBSCRIBED_GUEST_RELATION,
      },
      include: { guest: { select: { id: true } }, room: { select: { name: true } } },
    });

    for (const booking of bookings) {
      await prisma.sequenceEnrollment.upsert({
        where:  { sequenceId_guestId: { sequenceId: seq.id, guestId: booking.guestId } },
        create: {
          tenantId: seq.tenantId, sequenceId: seq.id, guestId: booking.guestId,
          triggerMeta: { checkIn: booking.checkIn.toISOString().split('T')[0], roomName: booking.room.name },
        },
        update: {},
      });
    }
  }
}

// ─── Auto-enroll for POST_STAY (day after check-out) ────────────────────────
async function processPostStayTrigger() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const postStaySequences = await prisma.sequence.findMany({
    where: { trigger: 'POST_STAY', status: 'ACTIVE' },
    select: { id: true, tenantId: true },
  });

  for (const seq of postStaySequences) {
    const bookings = await prisma.booking.findMany({
      where: {
        tenantId: seq.tenantId,
        status:   'CHECKED_OUT',
        checkOut: { equals: new Date(dateStr) },
        guest:    SUBSCRIBED_GUEST_RELATION,
      },
      include: { guest: { select: { id: true } } },
    });

    for (const booking of bookings) {
      await prisma.sequenceEnrollment.upsert({
        where:  { sequenceId_guestId: { sequenceId: seq.id, guestId: booking.guestId } },
        create: { tenantId: seq.tenantId, sequenceId: seq.id, guestId: booking.guestId, triggerMeta: { checkOut: dateStr } },
        update: {},
      });
    }
  }
}

/**
 * Campaigns whose scheduled time has arrived.
 *
 * The API has accepted `scheduledAt` and stored the status SCHEDULED for a
 * long time, and nothing ever came back for those rows (CRM QA finding 009).
 * An owner could schedule a campaign for Friday and discover on Saturday that
 * Friday had not happened — with the campaign still sitting there saying
 * SCHEDULED, which is the most convincing way to be wrong.
 *
 * Due means `scheduledAt <= now`, so a worker that was down for an hour sends
 * the hour's campaigns when it comes back rather than skipping them. One at a
 * time, and a campaign that throws does not stop the ones behind it.
 */
export async function dispatchScheduledCampaigns(): Promise<void> {
  const due = await prisma.campaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    select: { id: true, tenantId: true, name: true },
    orderBy: { scheduledAt: 'asc' },
    take: 25,
  });

  for (const campaign of due) {
    try {
      const outcome = await sendCampaign(campaign.tenantId, campaign.id);
      if (outcome.ok) {
        console.log(`[Automation] "${campaign.name}" → ${outcome.status} (${outcome.sent}/${outcome.total})`);
      } else {
        // The campaign keeps its SCHEDULED status when there is nobody to send
        // to, so it goes out if the audience appears before someone cancels it.
        // Every other refusal is terminal and says so in the log.
        console.warn(`[Automation] "${campaign.name}" not sent: ${outcome.reason}`);
      }
    } catch (err) {
      console.error(`[Automation] "${campaign.name}" failed:`, err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Every trigger that fires once a day, in one callable place.
 *
 * It used to live inside the cron callback, which meant the only way to
 * exercise it was to wait until 08:00 — so a trigger that enrolled nobody
 * looked exactly like a quiet night.
 */
export async function runDailyTriggers(): Promise<void> {
  await Promise.all([
    processPreArrivalTrigger(),
    processPostStayTrigger(),
    processBirthdayTrigger(),
    processAnniversaryTrigger(),
    processWinBackTrigger(),
  ]);
}

// ─── Main: start all cron jobs ────────────────────────────────────────────────
export function startAutomationEngine() {
  console.log('[Automation] Starting CRM automation engine...');

  // Process sequence emails every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try { await processSequenceEnrollments(); }
    catch (e) { console.error('[Automation] processSequenceEnrollments error:', e); }
  });

  // Scheduled campaigns on the same cadence. Daily would mean a campaign set
  // for 09:00 going out at 08:00 the next morning, which is not scheduling.
  cron.schedule('*/15 * * * *', async () => {
    try { await dispatchScheduledCampaigns(); }
    catch (e) { console.error('[Automation] dispatchScheduledCampaigns error:', e); }
  });

  // Trigger checks run daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    try {
      await runDailyTriggers();
      console.log('[Automation] Daily triggers processed');
    } catch (e) { console.error('[Automation] Daily trigger error:', e); }
  });

  console.log('[Automation] Cron jobs registered ✓');
}

// ─── On-demand: enroll on booking confirmed ───────────────────────────────────
export async function enrollOnBookingConfirmed(tenantId: string, guestId: string, meta: {
  confirmationNo: string; roomName: string; checkIn: string; checkOut: string;
}) {
  const sequences = await prisma.sequence.findMany({
    where: { tenantId, trigger: 'BOOKING_CONFIRMED', status: 'ACTIVE' },
    select: { id: true },
  });

  for (const seq of sequences) {
    await prisma.sequenceEnrollment.upsert({
      where:  { sequenceId_guestId: { sequenceId: seq.id, guestId } },
      create: { tenantId, sequenceId: seq.id, guestId, triggerMeta: meta },
      update: { status: 'ACTIVE', currentStep: 0, completedAt: null, triggerMeta: meta },
    }).catch(() => {});
  }

  // Ensure consent record exists (opted in by booking)
  await prisma.emailConsent.upsert({
    where:  { guestId },
    create: { tenantId, guestId, subscribed: true },
    update: {},
  });
}
