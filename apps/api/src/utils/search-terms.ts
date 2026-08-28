/**
 * Build a Prisma `where` fragment that matches every word of a query, with each
 * word free to match a different field.
 *
 * A single `contains` per field cannot match "Karim Hossain": no one column
 * holds the whole string, so the most natural thing a receptionist types —
 * the guest's full name, with the guest standing in front of them — returns
 * nothing at all.
 *
 * Splitting on whitespace and requiring every term to match somewhere fixes
 * that ("Karim" hits firstName, "Hossain" hits lastName) while leaving
 * single-word queries behaving exactly as they did.
 *
 * Fields may be dotted paths for relations — `guest.firstName` becomes
 * `{ guest: { firstName: { contains: … } } }` — because most of these searches
 * reach through one.
 *
 * Capped at five terms: beyond that the query is not a name, and each extra
 * term is another AND branch across every listed field.
 */

type Condition = Record<string, unknown>;

/** `guest.firstName` → `{ guest: { firstName: <leaf> } }` */
function nest(path: string, leaf: unknown): Condition {
  const parts = path.split('.');
  let out: unknown = leaf;
  for (let i = parts.length - 1; i >= 0; i--) out = { [parts[i]!]: out };
  return out as Condition;
}

export function matchAllTerms(
  search: string | undefined,
  fields: readonly string[],
): { AND: Array<{ OR: Condition[] }> } | undefined {
  const terms = (search ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (terms.length === 0) return undefined;

  return {
    AND: terms.map((term) => ({
      OR: fields.map((field) => nest(field, { contains: term, mode: 'insensitive' as const })),
    })),
  };
}
