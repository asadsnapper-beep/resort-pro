/**
 * The sections a resort website is made of.
 *
 * Shared because both halves of the contract need the same list and a second
 * copy would be free to drift. The web app builds its per-theme capabilities
 * on top of this (components/themes/capabilities.ts); the API validates
 * `sectionOrder` and `hiddenSections` against it, so an id that no theme has
 * ever heard of cannot be stored and come back as a section that renders twice
 * or not at all (Website Builder QA 2026-10-28, WB-006).
 *
 * Which of these a given theme actually draws is a question only the themes
 * can answer, and they answer it in their own files. This is the vocabulary,
 * not the capability.
 */
export const WEBSITE_SECTION_IDS = [
  'about',
  'amenities',
  'rooms',
  'menu',
  'venues',
  'vehicles',
  'gallery',
  'testimonials',
  'availability',
  'offers',
  'booking',
  'contact',
] as const;

export type WebsiteSectionId = (typeof WEBSITE_SECTION_IDS)[number];

const KNOWN: ReadonlySet<string> = new Set(WEBSITE_SECTION_IDS);

export function isWebsiteSectionId(value: string): value is WebsiteSectionId {
  return KNOWN.has(value);
}

/**
 * Keep the known ids, in the order given, without repeats.
 *
 * Used on the way into the database. The owner's chosen order is preserved —
 * it is theirs — but an unknown id is dropped rather than stored, and a
 * repeated one is kept once. Returning a cleaned array instead of refusing the
 * whole save matters: the ids arrive from a form the owner cannot type into,
 * so a bad one is this product's mistake to absorb, not theirs to correct.
 */
export function cleanSectionIds(ids: readonly string[] | undefined | null): WebsiteSectionId[] {
  const out: WebsiteSectionId[] = [];
  for (const id of ids ?? []) {
    if (isWebsiteSectionId(id) && !out.includes(id)) out.push(id);
  }
  return out;
}
