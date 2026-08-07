import { randomBytes } from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * Generate a unique referral code for a tenant.
 * Format: "SLUG-XXXXXXXXXXXX" where the suffix is a random uppercase hex
 * value.  The longer suffix keeps collisions negligible while still fitting
 * the public referral-code input limit.
 */
export function generateReferralCode(slug: string): string {
  const prefix = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'RESORT';
  const suffix = randomBytes(6).toString('hex').toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * Atomically gives a legacy tenant a code the first time it needs one.
 *
 * New registrations receive a code at creation time. This guard makes the
 * rollout safe for tenants that existed before referral codes were added and
 * avoids two simultaneous dashboard requests assigning different codes.
 */
export async function ensureTenantReferralCode(
  db: Pick<PrismaClient, 'tenant'>,
  tenant: { id: string; slug: string; referralCode: string | null },
): Promise<string> {
  if (tenant.referralCode) return tenant.referralCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateReferralCode(tenant.slug);
    try {
      const claim = await db.tenant.updateMany({
        where: { id: tenant.id, referralCode: null },
        data: { referralCode: candidate },
      });

      if (claim.count === 1) return candidate;

      // Another request assigned the code between our read and write.
      const current = await db.tenant.findUnique({
        where: { id: tenant.id },
        select: { referralCode: true },
      });
      if (current?.referralCode) return current.referralCode;
    } catch (error) {
      // A code collision is safe to retry. Propagate genuine database errors.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }
  }

  throw new Error('Unable to generate a unique referral code');
}

export function referralRegistrationUrl(code: string): string {
  const appUrl = (
    process.env.WEB_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.CORS_ORIGIN?.split(',')[0]
    || 'http://localhost:3000'
  ).trim().replace(/\/$/, '');

  return `${appUrl}/auth/register?ref=${encodeURIComponent(code)}`;
}
