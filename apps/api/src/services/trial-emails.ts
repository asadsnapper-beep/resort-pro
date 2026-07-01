/**
 * Trial lifecycle email automation
 *
 * Runs on a daily cron schedule. Sends:
 *  - 7 days before trial ends  → "trial ending soon" nudge
 *  - 3 days before trial ends  → urgency email with feature recap
 *  - 1 day before trial ends   → last chance email
 *  - Trial day 0 (expired)     → "trial ended, choose a plan" email
 *  - 3 days after expiry       → win-back #1 (gentle reminder)
 *  - 7 days after expiry       → win-back #2 (offer help)
 *  - 30 days after expiry      → win-back #3 (final farewell + data warning)
 */

import { prisma } from '@resort-pro/database';
import { sendEmail } from './email';

const APP_URL = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000';
const SUPPORT_EMAIL = 'support@resortpro.site';

// ── Template helpers ────────────────────────────────────────────────────────

function brandedEmail(content: string): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:#1a6b5e;padding:28px 40px;text-align:center;border-radius:12px 12px 0 0">
      <span style="color:#ffffff;font-size:20px;font-weight:700">ResortPro</span>
    </div>
    <div style="padding:40px">
      ${content}
    </div>
    <div style="padding:20px 40px;background:#f9fafb;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;color:#9ca3af;font-size:12px">
        ResortPro · <a href="${SUPPORT_EMAIL}" style="color:#9ca3af">Support</a>
      </p>
    </div>
  </div>`;
}

function ctaButton(text: string, url: string): string {
  return `<p style="margin:28px 0 0;text-align:center">
    <a href="${url}" style="background:#1a6b5e;color:#ffffff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
      ${text}
    </a>
  </p>`;
}

// ── 7-day warning ──────────────────────────────────────────────────────────

function trialWarning7(ownerName: string, resortName: string, trialEndsAt: Date): string {
  return brandedEmail(`
    <h2 style="margin:0 0 16px;color:#111827">Your trial ends in 7 days ⏳</h2>
    <p style="color:#6b7280;line-height:1.7">Hi ${ownerName},</p>
    <p style="color:#6b7280;line-height:1.7">
      Your free trial for <strong>${resortName}</strong> ends on
      <strong>${trialEndsAt.toLocaleDateString('en-US', { dateStyle: 'long' })}</strong>.
      Choose a plan to keep full access to all features.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:24px 0">
      <p style="margin:0 0 12px;font-weight:700;color:#166534">What you've set up so far:</p>
      <ul style="margin:0;padding-left:20px;color:#15803d;line-height:2">
        <li>✓ Booking management system</li>
        <li>✓ Guest CRM & profiles</li>
        <li>✓ Room configuration</li>
        <li>✓ Resort website</li>
      </ul>
    </div>
    <p style="color:#6b7280;line-height:1.7">All this stays with you when you upgrade — your data is never lost.</p>
    ${ctaButton('Choose a plan →', `${APP_URL}/dashboard/upgrade`)}
  `);
}

// ── 3-day warning ──────────────────────────────────────────────────────────

function trialWarning3(ownerName: string, resortName: string, trialEndsAt: Date): string {
  return brandedEmail(`
    <h2 style="margin:0 0 16px;color:#b45309">⚠️ 3 days left — don't lose your setup</h2>
    <p style="color:#6b7280;line-height:1.7">Hi ${ownerName},</p>
    <p style="color:#6b7280;line-height:1.7">
      Your ResortPro trial for <strong>${resortName}</strong> expires in
      <strong>3 days</strong> on ${trialEndsAt.toLocaleDateString('en-US', { dateStyle: 'long' })}.
    </p>
    <p style="color:#6b7280;line-height:1.7">
      After expiry, your dashboard will be locked (your data stays safe, but you won't be able to accept new bookings).
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
      <p style="margin:0 0 4px;color:#92400e;font-size:28px;font-weight:800">Starting at $49/mo</p>
      <p style="margin:0;color:#b45309;font-size:14px">Cancel anytime • 30-day money-back guarantee</p>
    </div>
    ${ctaButton('Upgrade now — takes 2 minutes', `${APP_URL}/dashboard/upgrade`)}
    <p style="margin-top:24px;text-align:center;color:#9ca3af;font-size:13px">
      Questions? Reply to this email or chat with us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#1a6b5e">${SUPPORT_EMAIL}</a>
    </p>
  `);
}

// ── 1-day warning ──────────────────────────────────────────────────────────

function trialWarning1(ownerName: string, resortName: string): string {
  return brandedEmail(`
    <h2 style="margin:0 0 16px;color:#dc2626">🚨 Last chance — trial ends tomorrow</h2>
    <p style="color:#6b7280;line-height:1.7">Hi ${ownerName},</p>
    <p style="color:#6b7280;line-height:1.7">
      Your ResortPro trial for <strong>${resortName}</strong> ends <strong>tomorrow</strong>.
      Upgrade in the next 24 hours to keep managing your resort without interruption.
    </p>
    <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:20px;margin:24px 0">
      <p style="margin:0;color:#991b1b;font-weight:600;text-align:center;font-size:15px">
        After expiry: dashboard locked, no new bookings, booking calendar paused.
        <br/>
        <span style="font-weight:400;color:#b91c1c">Your data is always preserved and restored instantly on upgrade.</span>
      </p>
    </div>
    ${ctaButton('Upgrade Now →', `${APP_URL}/dashboard/upgrade`)}
  `);
}

// ── Trial expired ──────────────────────────────────────────────────────────

function trialExpired(ownerName: string, resortName: string): string {
  return brandedEmail(`
    <h2 style="margin:0 0 16px;color:#111827">Your ResortPro trial has ended</h2>
    <p style="color:#6b7280;line-height:1.7">Hi ${ownerName},</p>
    <p style="color:#6b7280;line-height:1.7">
      Your 14-day free trial for <strong>${resortName}</strong> has ended.
      Your dashboard is now in read-only mode.
    </p>
    <p style="color:#6b7280;line-height:1.7">
      <strong>Good news:</strong> all your data — rooms, bookings, guests — is safely preserved.
      Upgrade now to get back to business instantly.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
      <p style="margin:0 0 8px;color:#166534;font-size:22px;font-weight:800">Starter Plan: $49/month</p>
      <p style="margin:0;color:#15803d;font-size:13px">30-day money back • Cancel anytime • All data restored</p>
    </div>
    ${ctaButton('Reactivate My Account →', `${APP_URL}/dashboard/upgrade`)}
    <p style="margin-top:24px;text-align:center;color:#9ca3af;font-size:13px">
      Need help choosing a plan? <a href="mailto:${SUPPORT_EMAIL}" style="color:#1a6b5e">Reply to this email</a>.
    </p>
  `);
}

// ── Win-back #1 (3 days after expiry) ─────────────────────────────────────

function winBack3(ownerName: string, resortName: string): string {
  return brandedEmail(`
    <h2 style="margin:0 0 16px;color:#111827">Still thinking it over, ${ownerName}?</h2>
    <p style="color:#6b7280;line-height:1.7">Hi ${ownerName},</p>
    <p style="color:#6b7280;line-height:1.7">
      Your ResortPro account for <strong>${resortName}</strong> has been inactive for 3 days.
      We just wanted to check in — is there anything we can help with?
    </p>
    <p style="color:#6b7280;line-height:1.7">
      Maybe pricing is a concern, or you had questions about features.
      We're here to help you find the right fit for your resort.
    </p>
    ${ctaButton('See plans & pricing →', `${APP_URL}/dashboard/upgrade`)}
    <p style="margin-top:20px;text-align:center;color:#9ca3af;font-size:13px">
      Or just reply to this email — we read every message.
    </p>
  `);
}

// ── Win-back #2 (7 days after expiry) ─────────────────────────────────────

function winBack7(ownerName: string, resortName: string): string {
  return brandedEmail(`
    <h2 style="margin:0 0 16px;color:#111827">We saved your data, ${ownerName} 🔒</h2>
    <p style="color:#6b7280;line-height:1.7">Hi ${ownerName},</p>
    <p style="color:#6b7280;line-height:1.7">
      It's been a week since your trial ended. Your <strong>${resortName}</strong> data —
      all rooms, bookings, and guest records — is still safely stored and waiting for you.
    </p>
    <p style="color:#6b7280;line-height:1.7">
      If you're managing your resort with spreadsheets or another tool,
      we'd love to show you how ResortPro can save you hours every week.
    </p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;margin:24px 0">
      <p style="margin:0;color:#0369a1;font-weight:600;text-align:center">
        💡 Most resort owners save 8+ hours per week with ResortPro
      </p>
    </div>
    ${ctaButton('Reactivate My Resort →', `${APP_URL}/dashboard/upgrade`)}
  `);
}

// ── Win-back #3 (30 days after expiry) ────────────────────────────────────

function winBack30(ownerName: string, resortName: string): string {
  return brandedEmail(`
    <h2 style="margin:0 0 16px;color:#111827">Final notice for ${resortName}</h2>
    <p style="color:#6b7280;line-height:1.7">Hi ${ownerName},</p>
    <p style="color:#6b7280;line-height:1.7">
      Your ResortPro account has been inactive for 30 days.
      <strong>We'll retain your data for 60 more days</strong>, after which it will be permanently deleted.
    </p>
    <p style="color:#6b7280;line-height:1.7">
      If you'd like to export your data or reactivate your account, please do so before then.
    </p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
      <p style="margin:0;color:#c2410c;font-weight:700">Data deletion scheduled in 60 days</p>
    </div>
    ${ctaButton('Reactivate & keep my data →', `${APP_URL}/dashboard/upgrade`)}
    <p style="margin-top:16px;text-align:center;color:#9ca3af;font-size:13px">
      To request a data export, email <a href="mailto:${SUPPORT_EMAIL}" style="color:#1a6b5e">${SUPPORT_EMAIL}</a>
    </p>
  `);
}

// ── Main cron function ─────────────────────────────────────────────────────

export async function runTrialEmailCron(): Promise<void> {
  const now = new Date();
  const log = (msg: string) => console.log(`[trial-cron] ${msg}`);

  log('Starting trial email cron...');

  // Fetch all trialing tenants
  const trialingTenants = await prisma.tenant.findMany({
    where: { planStatus: 'trialing', isActive: true },
    include: {
      users: {
        where: { role: 'OWNER', isActive: true },
        take: 1,
        select: { email: true, firstName: true },
      },
    },
  });

  // Fetch recently expired tenants (0–30 days ago)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const expiredTenants = await prisma.tenant.findMany({
    where: {
      planStatus: 'trialing',
      trialEndsAt: { gte: thirtyDaysAgo, lt: now },
    },
    include: {
      users: {
        where: { role: 'OWNER', isActive: true },
        take: 1,
        select: { email: true, firstName: true },
      },
    },
  });

  let sent = 0;

  // ── Trialing — warning emails ──────────────────────────────────────────
  for (const tenant of trialingTenants) {
    const owner = tenant.users[0];
    if (!owner || !tenant.trialEndsAt) continue;

    const msUntilExpiry = tenant.trialEndsAt.getTime() - now.getTime();
    const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

    // Within ±12 hours of the target day to avoid double-sending
    const around = (target: number) =>
      daysUntilExpiry > target - 0.5 && daysUntilExpiry <= target + 0.5;

    if (around(7)) {
      await sendEmail({
        to: owner.email,
        subject: `Your ResortPro trial ends in 7 days — ${tenant.name}`,
        html: trialWarning7(owner.firstName, tenant.name, tenant.trialEndsAt),
      });
      log(`Sent 7-day warning to ${owner.email} (${tenant.name})`);
      sent++;
    } else if (around(3)) {
      await sendEmail({
        to: owner.email,
        subject: `⚠️ 3 days left in your ResortPro trial`,
        html: trialWarning3(owner.firstName, tenant.name, tenant.trialEndsAt),
      });
      log(`Sent 3-day warning to ${owner.email} (${tenant.name})`);
      sent++;
    } else if (around(1)) {
      await sendEmail({
        to: owner.email,
        subject: `🚨 Last chance — trial ends tomorrow`,
        html: trialWarning1(owner.firstName, tenant.name),
      });
      log(`Sent 1-day warning to ${owner.email} (${tenant.name})`);
      sent++;
    }
  }

  // ── Expired trials — win-back emails ───────────────────────────────────
  for (const tenant of expiredTenants) {
    const owner = tenant.users[0];
    if (!owner || !tenant.trialEndsAt) continue;

    const msSinceExpiry = now.getTime() - tenant.trialEndsAt.getTime();
    const daysSinceExpiry = msSinceExpiry / (1000 * 60 * 60 * 24);

    const around = (target: number) =>
      daysSinceExpiry > target - 0.5 && daysSinceExpiry <= target + 0.5;

    if (daysSinceExpiry < 0.5) {
      // Just expired
      await sendEmail({
        to: owner.email,
        subject: `Your ResortPro trial has ended — ${tenant.name}`,
        html: trialExpired(owner.firstName, tenant.name),
      });
      log(`Sent trial-expired email to ${owner.email} (${tenant.name})`);
      sent++;
    } else if (around(3)) {
      await sendEmail({
        to: owner.email,
        subject: `Still thinking it over? Your data is waiting`,
        html: winBack3(owner.firstName, tenant.name),
      });
      log(`Sent win-back-3 to ${owner.email} (${tenant.name})`);
      sent++;
    } else if (around(7)) {
      await sendEmail({
        to: owner.email,
        subject: `We saved your resort data 🔒`,
        html: winBack7(owner.firstName, tenant.name),
      });
      log(`Sent win-back-7 to ${owner.email} (${tenant.name})`);
      sent++;
    } else if (around(30)) {
      await sendEmail({
        to: owner.email,
        subject: `Final notice: data deletion scheduled for ${tenant.name}`,
        html: winBack30(owner.firstName, tenant.name),
      });
      log(`Sent win-back-30 to ${owner.email} (${tenant.name})`);
      sent++;
    }
  }

  log(`Done — ${sent} email(s) sent`);
}
