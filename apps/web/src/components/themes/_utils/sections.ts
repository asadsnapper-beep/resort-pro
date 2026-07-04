/**
 * Resolve the section render order for a theme.
 *
 * `saved` is the owner's custom order from WebsiteContent.sectionOrder.
 * Unknown ids are dropped, and any theme sections missing from the saved
 * order are appended in their default position — so themes can add new
 * sections later without breaking existing customised sites.
 */
export function orderSections(defaultOrder: readonly string[], saved?: string[] | null): string[] {
  if (!saved || saved.length === 0) return [...defaultOrder];
  const known = new Set(defaultOrder);
  const ordered = saved.filter((id) => known.has(id));
  for (const id of defaultOrder) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}
