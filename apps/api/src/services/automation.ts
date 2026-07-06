import cron from 'node-cron';
import { prisma } from '@resort-pro/database';
import { sendEmail, wrapEmail, SEQUENCE_TEMPLATES } from './email';

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
        consent:  { subscribed: true },
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

// ─── Auto-enroll guests for BIRTHDAY sequences ───────────────────────────────
async function processBirthdayTrigger() {
  const birthdaySequences = await prisma.sequence.findMany({
    where: { trigger: 'BIRTHDAY', status: 'ACTIVE' },
    select: { id: true, tenantId: true, triggerMeta: true },
  });

  const today   = new Date();
  const target  = new Date(today.getTime() + 3 * 86400000); // 3 days ahead

  for (const seq of birthdaySequences) {
    // Guests whose birthday is in 3 days (if dateOfBirth stored in notes — simplified)
    // In a real implementation you'd have a dob field on Guest
    // Here we check the notes field for "birthday:MM-DD" pattern
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day   = String(target.getDate()).padStart(2, '0');

    const guests = await prisma.guest.findMany({
      where: {
        tenantId: seq.tenantId,
        consent:  { subscribed: true },
        notes:    { contains: `birthday:${month}-${day}` },
        enrollments: { none: { sequenceId: seq.id, status: { in: ['ACTIVE', 'COMPLETED'] }, enrolledAt: { gte: new Date(today.getFullYear(), 0, 1) } } },
      },
      select: { id: true },
    });

    for (const guest of guests) {
      await prisma.sequenceEnrollment.create({
        data: { tenantId: seq.tenantId, sequenceId: seq.id, guestId: guest.id, triggerMeta: { birthdayDate: `${target.getFullYear()}-${month}-${day}` } },
      }).catch(() => {});
    }
  }
}

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
        guest:    { consent: { subscribed: true } },
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
        guest:    { consent: { subscribed: true } },
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

// ─── Main: start all cron jobs ────────────────────────────────────────────────
export function startAutomationEngine() {
  console.log('[Automation] Starting CRM automation engine...');

  // Process sequence emails every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try { await processSequenceEnrollments(); }
    catch (e) { console.error('[Automation] processSequenceEnrollments error:', e); }
  });

  // Trigger checks run daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    try {
      await Promise.all([
        processPreArrivalTrigger(),
        processPostStayTrigger(),
        processBirthdayTrigger(),
        processWinBackTrigger(),
      ]);
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
