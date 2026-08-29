import { prisma } from '@resort-pro/database';

/**
 * Finding the guest who is already standing at the desk.
 *
 * Walk-ins are where returning guests get lost. Phone numbers are stored
 * exactly as they were typed — "+880 1711-002200", "01711002200",
 * "01711-002200" are all the same person — so no `contains` filter reliably
 * reunites them. Comparison has to happen on digits only, and on the *stored*
 * value, which Prisma's string filters cannot express.
 */

/** "+880 1711-002200" → "8801711002200" */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * The comparable tail of a phone number.
 *
 * A Bangladeshi mobile reaches us as 01711002200 (local) or 8801711002200
 * (with country code); the last ten digits are identical in both, and that is
 * the only part that is reliably the same person. Numbers shorter than ten
 * digits are compared whole.
 */
export function phoneKey(phone: string | null | undefined): string {
  const digits = phoneDigits(phone);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Below seven digits a "phone number" is a room number, a house number, or a
 * half-typed field — matching on it would pull up strangers.
 */
const MIN_PHONE_DIGITS = 7;

/** Case- and spacing-insensitive form of a person's name, for comparison only. */
export function nameKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Guests in this tenant whose stored phone ends in the same ten digits.
 * Ordered newest-first so the most recently created record wins a tie.
 *
 * tenantId is bound explicitly: a raw query does not pass through the
 * tenant-scoped Prisma client, so scoping cannot be left implicit here.
 */
export async function findGuestIdsByPhone(
  tenantId: string,
  phone: string | null | undefined,
  limit = 5,
): Promise<string[]> {
  const key = phoneKey(phone);
  if (key.length < MIN_PHONE_DIGITS) return [];

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM guests
    WHERE "tenantId" = ${tenantId}
      AND length(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')) >= ${MIN_PHONE_DIGITS}
      AND right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = ${key}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}

/**
 * The guest to attach a walk-in to when the desk did not pick one explicitly.
 *
 * Deliberately strict: the phone *and* the name must agree. Families share a
 * phone number, and silently filing a stay under a relative's record puts one
 * person's ID document and loyalty balance against another person's booking —
 * far harder to unpick later than the duplicate it would have saved. When the
 * name does not match, we return nothing and a fresh guest is created, exactly
 * as before; the desk can still merge deliberately by sending a guestId.
 */
export async function findReturningGuestId(
  tenantId: string,
  phone: string | null | undefined,
  fullName: string,
): Promise<string | undefined> {
  const ids = await findGuestIdsByPhone(tenantId, phone);
  if (ids.length === 0) return undefined;

  const wanted = nameKey(fullName);
  if (!wanted) return undefined;

  const candidates = await prisma.guest.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true, firstName: true, lastName: true },
  });

  const matches = candidates.filter(
    (g) => nameKey(`${g.firstName} ${g.lastName}`.replace(/ -$/, '')) === wanted,
  );

  // Two stored records with the same name and phone is itself a duplicate we
  // cannot resolve blindly — leave it to the desk rather than guess.
  return matches.length === 1 ? matches[0]!.id : undefined;
}
