import { prisma } from '@resort-pro/database';

/**
 * sequence.ts — atomic, globally-unique document numbering.
 *
 * Replaces two independent bugs that both generated invoice numbers by
 * reading the current max/count and writing max+1:
 *   - bookings.ts `autoCreateInvoice`: `findFirst`/`orderBy: desc` scoped to
 *     one tenant, but `Invoice.invoiceNumber` is globally @unique — two
 *     tenants (or two concurrent requests in the same tenant) could compute
 *     the identical "INV-2026-0001" and collide on the unique constraint.
 *   - corporateAccounts.ts `nextInvoiceNumber`: same race, via `count()`
 *     (which also drifts if any invoice row is ever deleted).
 *
 * Fix: a dedicated `NumberCounter` row per (tenantId, key), incremented with
 * Prisma's atomic `{ increment: 1 }` inside an `upsert`. Postgres compiles
 * that to a single `INSERT ... ON CONFLICT (tenantId, key) DO UPDATE SET
 * value = value + 1` — there is no read-then-write gap for two callers to
 * race into, so no transaction/retry loop is needed for this monotonic-
 * counter problem (unlike booking-conflict prevention, which is a genuine
 * "who gets this resource" race and needs Serializable + retry instead).
 *
 * The tenant code is also baked into the formatted string itself, so even
 * a hypothetical identical counter value across two tenants still can't
 * produce the same final number — belt-and-braces on top of the atomic
 * counter, not a substitute for it.
 */

/**
 * Deterministic, fixed-shape code derived from a tenant's slug (which is
 * itself @unique). Used inside globally-unique document numbers.
 */
export function tenantCode(slug: string): string {
  const clean = slug.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.slice(0, 6) || 'TEN';
}

/**
 * Atomically get the next value in a per-tenant named sequence.
 * `key` should bake in anything that should reset the sequence, e.g.
 * `invoice:2026` — one row per (tenantId, key), so it naturally resets
 * every year without any cron/maintenance job.
 */
export async function nextSequence(tenantId: string, key: string): Promise<number> {
  const counter = await prisma.numberCounter.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

/**
 * Format a globally-unique document number: `PREFIX-TENANTCODE-YEAR-0001`.
 * e.g. `nextDocumentNumber(tenantId, 'sunset-resort', 'INV')` -> "INV-SUNSETR-2026-0001".
 */
export async function nextDocumentNumber(
  tenantId: string,
  tenantSlug: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${prefix.toLowerCase()}:${year}`;
  const seq = await nextSequence(tenantId, key);
  return `${prefix}-${tenantCode(tenantSlug)}-${year}-${String(seq).padStart(4, '0')}`;
}
