import { prisma } from '@resort-pro/database';

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
}
