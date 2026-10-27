/**
 * What each theme can actually render.
 *
 * The builder used to offer one universal set of section controls to every
 * theme, and the themes disagreed with it without saying so. An owner on
 * Minimal could add photos and guest reviews, reorder them, publish, open the
 * site and find nothing there — Minimal renders neither. Amenities was offered
 * everywhere and rendered only by Coastal. Offers was rendered by Coastal and
 * Tea Garden and offered by nobody, so it could not be hidden or reordered at
 * all. (Website Builder QA 2026-10-28, finding WB-001, the one it called the
 * clearest "UI exists but does not work" issue.)
 *
 * There is one list per theme and it lives in that theme's own file, next to
 * the map of sections it renders. This module only collects them. That is
 * deliberate: a second hand-written list here would be free to drift from the
 * renderer, which is the bug this is meant to end rather than relocate.
 *
 * Adding a section to a theme therefore means adding it to that theme's
 * exported list, and the builder follows automatically.
 */
import { LUXE_SECTIONS } from './luxe';
import { MINIMAL_SECTIONS } from './minimal';
import { COASTAL_SECTIONS } from './coastal';
import { TEA_GARDEN_SECTIONS } from './tea-garden-eco-resort';

/**
 * Every section id the product knows about.
 *
 * Also the allowlist the API validates `sectionOrder` and `hiddenSections`
 * against, so an unknown id cannot be stored and come back as a section that
 * renders twice or not at all.
 */
export const SECTION_IDS = [
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

export type SectionId = (typeof SECTION_IDS)[number];

const KNOWN: ReadonlySet<string> = new Set(SECTION_IDS);

export const THEME_SECTIONS: Record<string, readonly SectionId[]> = {
  luxe: LUXE_SECTIONS,
  minimal: MINIMAL_SECTIONS,
  coastal: COASTAL_SECTIONS,
  'tea-garden-eco-resort': TEA_GARDEN_SECTIONS,
};

/**
 * Sections that a theme renders no matter what the owner does with the
 * section controls. Rooms and Booking are the two a resort website exists for,
 * and every theme draws them outside the hideable map.
 */
export const ALWAYS_RENDERED: readonly SectionId[] = ['rooms', 'booking'];

/**
 * The sections a theme renders.
 *
 * An unknown key — a config or template theme, or a stale id left in the
 * database — gets the full set rather than an empty one. Those themes are
 * rendered by ConfigThemeRenderer and TemplateThemeRenderer, whose capability
 * comes from their own definition and is not known here; hiding every control
 * for them would be a worse lie than showing them all.
 */
export function themeSections(themeKey?: string | null): readonly SectionId[] {
  if (!themeKey) return SECTION_IDS;
  return THEME_SECTIONS[themeKey] ?? SECTION_IDS;
}

/** Whether a theme renders a section at all. */
export function supportsSection(themeKey: string | null | undefined, section: string): boolean {
  return themeSections(themeKey).includes(section as SectionId);
}

/** Whether an id is a section this product has ever heard of. */
export function isKnownSection(section: string): section is SectionId {
  return KNOWN.has(section);
}

/**
 * Clean a stored order into one that can be rendered.
 *
 * Unknown ids go, repeats go — a duplicated known id rendered the section
 * twice and gave React two children with the same key (WB-006) — and anything
 * the theme renders but the stored order forgot is appended, so a theme can
 * gain a section later without every existing site having to be re-saved.
 */
export function canonicalSectionOrder(
  themeKey: string | null | undefined,
  saved?: readonly string[] | null,
): SectionId[] {
  const supported = themeSections(themeKey);
  const out: SectionId[] = [];
  for (const id of saved ?? []) {
    if (isKnownSection(id) && supported.includes(id) && !out.includes(id)) out.push(id);
  }
  for (const id of supported) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
