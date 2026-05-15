import { randomBytes } from 'crypto';

/**
 * Generate a unique referral code for a tenant.
 * Format: "SLUG-XXXX" where XXXX is 4 random uppercase alphanumeric chars.
 * e.g. "SUNSET-A3K9", "GRAND-B7QX"
 */
export function generateReferralCode(slug: string): string {
  const prefix = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const suffix = randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${prefix}-${suffix}`;
}
