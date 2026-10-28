/**
 * Resolve the section render order for a theme.
 *
 * `saved` is the owner's custom order from WebsiteContent.sectionOrder.
 * Unknown ids are dropped, and any theme sections missing from the saved
 * order are appended in their default position — so themes can add new
 * sections later without breaking existing customised sites.
 */
export function orderSections(defaultOrder: readonly string[], saved?: readonly string[] | null): string[] {
  if (!saved || saved.length === 0) return [...defaultOrder];
  const known = new Set(defaultOrder);
  // Repeats are dropped as well as unknowns. The API accepted an order with
  // the same known id twice, and this function passed it through: the section
  // rendered twice, and the two copies were handed to React with the same key
  // (Website Builder QA 2026-10-28, finding WB-006). The API now refuses to
  // store that, and this stays as the second line of defence for the orders
  // already in the database.
  const ordered: string[] = [];
  for (const id of saved) {
    if (known.has(id) && !ordered.includes(id)) ordered.push(id);
  }
  for (const id of defaultOrder) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}
