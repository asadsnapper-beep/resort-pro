/**
 * Churn Risk Calculator
 *
 * Risk levels:
 *   HIGH   — owner not seen in 30+ days OR 0 bookings this month (and was active before)
 *   MEDIUM — owner not seen in 14–29 days OR bookings dropped 50%+
 *   LOW    — owner active within 7 days AND stable/growing bookings
 *   NONE   — brand new tenant (<14 days old) — not enough data yet
 */

export type ChurnRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface ChurnRiskResult {
  level: ChurnRiskLevel;
  score: number;         // 0 (safe) → 100 (about to churn)
  reasons: string[];
  daysSinceLogin: number | null;
  bookingsLast30: number;
  bookingsPrev30: number;
}

interface ChurnInput {
  ownerLastLoginAt: Date | null;
  bookingsLast30Days: number;
  bookingsPrev30Days: number;
  tenantCreatedAt: Date;
  isActive: boolean;
}

export function computeChurnRisk(input: ChurnInput): ChurnRiskResult {
  const { ownerLastLoginAt, bookingsLast30Days, bookingsPrev30Days, tenantCreatedAt, isActive } = input;

  // Suspended tenants — no risk level (they already churned)
  if (!isActive) {
    return {
      level: 'NONE',
      score: 0,
      reasons: ['Account suspended'],
      daysSinceLogin: null,
      bookingsLast30: bookingsLast30Days,
      bookingsPrev30: bookingsPrev30Days,
    };
  }

  const now = Date.now();
  const tenantAgeDays = Math.floor((now - tenantCreatedAt.getTime()) / 86_400_000);

  // Too new — not enough data
  if (tenantAgeDays < 14) {
    return {
      level: 'NONE',
      score: 0,
      reasons: ['New tenant — not enough data yet'],
      daysSinceLogin: ownerLastLoginAt
        ? Math.floor((now - ownerLastLoginAt.getTime()) / 86_400_000)
        : null,
      bookingsLast30: bookingsLast30Days,
      bookingsPrev30: bookingsPrev30Days,
    };
  }

  const daysSinceLogin = ownerLastLoginAt
    ? Math.floor((now - ownerLastLoginAt.getTime()) / 86_400_000)
    : null;

  let score = 0;
  const reasons: string[] = [];

  // ── Login inactivity ──────────────────────────────────────────────────────
  if (daysSinceLogin === null) {
    // Never logged in (unlikely but handle it)
    score += 40;
    reasons.push('Owner has never logged in');
  } else if (daysSinceLogin >= 30) {
    score += 50;
    reasons.push(`No login in ${daysSinceLogin} days`);
  } else if (daysSinceLogin >= 14) {
    score += 25;
    reasons.push(`Inactive for ${daysSinceLogin} days`);
  } else if (daysSinceLogin >= 7) {
    score += 10;
    reasons.push(`Last login ${daysSinceLogin} days ago`);
  }

  // ── Booking activity ──────────────────────────────────────────────────────
  if (bookingsLast30Days === 0 && bookingsPrev30Days > 0) {
    // Had bookings before, now zero — strong signal
    score += 40;
    reasons.push('Zero bookings this month (had bookings previously)');
  } else if (bookingsLast30Days === 0 && bookingsPrev30Days === 0 && tenantAgeDays >= 30) {
    score += 20;
    reasons.push('No bookings in 60 days');
  } else if (bookingsPrev30Days > 0) {
    const dropPct = ((bookingsPrev30Days - bookingsLast30Days) / bookingsPrev30Days) * 100;
    if (dropPct >= 70) {
      score += 30;
      reasons.push(`Bookings dropped ${Math.round(dropPct)}%`);
    } else if (dropPct >= 50) {
      score += 15;
      reasons.push(`Bookings dropped ${Math.round(dropPct)}%`);
    }
  }

  // ── Determine level ───────────────────────────────────────────────────────
  let level: ChurnRiskLevel;
  if (score >= 60) level = 'HIGH';
  else if (score >= 25) level = 'MEDIUM';
  else level = 'LOW';

  return {
    level,
    score: Math.min(100, score),
    reasons,
    daysSinceLogin,
    bookingsLast30: bookingsLast30Days,
    bookingsPrev30: bookingsPrev30Days,
  };
}
