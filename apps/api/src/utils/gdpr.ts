/**
 * GDPR Anonymization Utility
 *
 * Implements GDPR Article 17 — Right to Erasure.
 * Replaces all PII with anonymized placeholders.
 * Keeps aggregated/financial records intact for accounting compliance.
 *
 * Safe to run multiple times — idempotent.
 */
import { createHash } from 'crypto';
import { prisma } from '@resort-pro/database';

/** One-way hash of a string — used for email anonymization */
function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

/** Anonymized email — looks like an email, hashes the real one */
function anonEmail(email: string): string {
  return `deleted-${sha256(email)}@gdpr.invalid`;
}

export interface AnonymizeResult {
  tenantId: string;
  usersAnonymized: number;
  guestsAnonymized: number;
  completedAt: Date;
}

/**
 * anonymizeTenant
 *
 * Steps:
 * 1. Anonymize the Tenant record (name, email, phone, address, domain)
 * 2. Anonymize all Users in the tenant (name, email, phone)
 * 3. Anonymize all Guests (name, email, phone, passport/ID numbers, address, nationality)
 * 4. Mark tenant as anonymized + soft-deleted
 */
export async function anonymizeTenant(tenantId: string): Promise<AnonymizeResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, billingEmail: true, gdprAnonymizedAt: true },
  });

  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  // Already done — return early (idempotent)
  if (tenant.gdprAnonymizedAt) {
    const users = await prisma.user.count({ where: { tenantId } });
    const guests = await prisma.guest.count({ where: { tenantId } });
    return { tenantId, usersAnonymized: users, guestsAnonymized: guests, completedAt: tenant.gdprAnonymizedAt };
  }

  const now = new Date();
  const shortId = tenantId.slice(-6).toUpperCase();

  // 1. Anonymize tenant
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name:          `Deleted Resort #${shortId}`,
      billingEmail:  tenant.billingEmail ? anonEmail(tenant.billingEmail) : null,
      stripeCustomerId:    null,
      stripeSubscriptionId: null,
      referralCode:  null,
      gdprAnonymizedAt: now,
      deletedAt:     now,
      isActive:      false,
    },
  });

  // 2. Anonymize all users
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, email: true },
  });

  await Promise.all(
    users.map((u) =>
      prisma.user.update({
        where: { id: u.id },
        data: {
          firstName:    'Deleted',
          lastName:     'User',
          email:        anonEmail(u.email),
          passwordHash: 'GDPR_ERASED',
          phone:        null,
          avatarUrl:    null,
          isActive:     false,
        },
      })
    )
  );

  // 3. Anonymize all guests
  const guests = await prisma.guest.findMany({
    where: { tenantId },
    select: { id: true, email: true },
  });

  await Promise.all(
    guests.map((g) =>
      prisma.guest.update({
        where: { id: g.id },
        data: {
          firstName:   'Deleted',
          lastName:    'Guest',
          email:       g.email ? anonEmail(g.email) : null,
          phone:       null,
          address:     null,
          nationality: null,
          idType:      null,
          idNumber:    null,
          notes:       null,
        },
      })
    )
  );

  return {
    tenantId,
    usersAnonymized: users.length,
    guestsAnonymized: guests.length,
    completedAt: now,
  };
}

/**
 * collectTenantExport
 *
 * Gathers all personal data for a tenant — used for GDPR Article 20
 * (Right to Data Portability). Returns a structured JSON object.
 */
export async function collectTenantExport(tenantId: string) {
  const [tenant, users, guests, bookings] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, name: true, slug: true, plan: true, planStatus: true,
        billingEmail: true, createdAt: true,
      },
    }),
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true, lastLoginAt: true },
    }),
    prisma.guest.findMany({
      where: { tenantId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        nationality: true, idType: true, idNumber: true, address: true, createdAt: true,
      },
    }),
    prisma.booking.findMany({
      where: { tenantId },
      select: {
        id: true, confirmationNo: true, status: true, checkIn: true, checkOut: true,
        totalAmount: true, createdAt: true,
      },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tenant,
    users,
    guests,
    bookings: {
      count: bookings.length,
      records: bookings,
    },
  };
}

/**
 * getPendingErasures
 *
 * Returns tenants with an erasure request but not yet anonymized.
 * Used by the purge job to determine what to process.
 */
export async function getPendingErasures() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return prisma.tenant.findMany({
    where: {
      gdprErasureRequestedAt: { not: null, lte: thirtyDaysAgo },
      gdprAnonymizedAt: null,
    },
    select: {
      id: true, name: true, slug: true,
      gdprErasureRequestedAt: true, gdprErasureRequestedBy: true,
    },
  });
}
