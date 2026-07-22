import { prisma } from '@resort-pro/database';
import { sendEmail } from '../services/email';

export type AdminNotificationType =
  | 'new_signup'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'trial_expiring'
  | 'account_suspended';

interface CreateNotificationArgs {
  type: AdminNotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  linkPath?: string;
}

/**
 * Create an admin notification. Fire-and-forget — never throws.
 */
export async function createAdminNotification(args: CreateNotificationArgs) {
  try {
    await prisma.adminNotification.create({
      data: {
        type: args.type,
        title: args.title,
        message: args.message,
        metadata: (args.metadata ?? undefined) as any,
        linkPath: args.linkPath,
      },
    });
  } catch {
    // Never let notification failure break the main operation
  }

  notifyAdminByEmail(args).catch(() => {});
}

/**
 * Mirror every admin notification to ADMIN_NOTIFICATION_EMAIL, if set.
 * Falls back to the first address in SUPER_ADMIN_EMAILS. No-op (silently
 * skipped by sendEmail) when Resend isn't configured.
 */
async function notifyAdminByEmail(args: CreateNotificationArgs) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL
    || process.env.SUPER_ADMIN_EMAILS?.split(',')[0]?.trim();
  if (!to) return;

  const webUrl = process.env.WEB_URL || 'https://app.resortpro.site';
  const link = args.linkPath
    ? `<p style="margin:20px 0 0;"><a href="${webUrl}${args.linkPath}" style="color:#1a6b5e;font-weight:600;">View in Admin Panel →</a></p>`
    : '';

  await sendEmail({
    to,
    subject: `[ResortPro Admin] ${args.title}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="display:inline-block;margin:0 0 16px;padding:4px 10px;border-radius:6px;background:#f0ede4;color:#8a6d1f;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${args.type.replace(/_/g, ' ')}</p>
        <h2 style="margin:0 0 12px;color:#1a3b34;font-size:18px;">${args.title}</h2>
        <p style="margin:0;color:#444;font-size:14px;line-height:1.6;">${args.message}</p>
        ${link}
      </div>
    `,
  });
}
