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
import { WEBSITE_SECTION_IDS, isWebsiteSectionId, type WebsiteSectionId } from '@resort-pro/types';
import { LUXE_SECTIONS } from './luxe';
import { MINIMAL_SECTIONS } from './minimal';
import { COASTAL_SECTIONS } from './coastal';
import { TEA_GARDEN_SECTIONS } from './tea-garden-eco-resort';
import { CONFIG_THEME_SECTIONS } from './config-renderer';

/**
 * Every section id the product knows about.
 *
 * Shared with the API, which validates `sectionOrder` and `hiddenSections`
 * against the same list — one vocabulary, so an id cannot be legal on one side
 * of the wire and meaningless on the other.
 */
export const SECTION_IDS = WEBSITE_SECTION_IDS;

export type SectionId = WebsiteSectionId;

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
 * How a theme is drawn, which is what decides who knows its sections.
 *
 * `HARDCODED` themes each have their own list below. `UPLOADED` and
 * `AI_GENERATED` are all drawn by the single ConfigThemeRenderer, so they
 * share its list. `TEMPLATE` is the one kind nobody here can answer for — see
 * `themeSections`.
 */
export type ThemeKind = 'HARDCODED' | 'UPLOADED' | 'AI_GENERATED' | 'TEMPLATE';

/**
 * Annotated rather than inferred on purpose: an id the config renderer adds
 * that this product has never heard of fails to compile here, instead of
 * reaching the builder as a control for a section the API would reject.
 */
const CONFIG_SECTIONS: readonly SectionId[] = CONFIG_THEME_SECTIONS;

/**
 * The sections a theme renders.
 *
 * `kind` is what makes an uploaded theme answerable: its key is bespoke and
 * means nothing here, but every uploaded and AI-generated theme goes through
 * ConfigThemeRenderer, so the kind alone settles it.
 *
 * `TEMPLATE` still gets the full set. A Tier 2 theme is arbitrary HTML and
 * TemplateThemeRenderer hides or moves whichever `id="<section>"` elements it
 * finds, so the honest answer lives in that theme's markup and not here.
 * Hiding every control for it would be a worse lie than showing them all.
 * The same goes for a key with no kind — a stale id, or a theme whose
 * catalogue entry did not load.
 */
export function themeSections(
  themeKey?: string | null,
  kind?: ThemeKind | null,
): readonly SectionId[] {
  if (kind === 'UPLOADED' || kind === 'AI_GENERATED') return CONFIG_SECTIONS;
  if (!themeKey) return SECTION_IDS;
  return THEME_SECTIONS[themeKey] ?? SECTION_IDS;
}

/** Whether a theme renders a section at all. */
export function supportsSection(
  themeKey: string | null | undefined,
  section: string,
  kind?: ThemeKind | null,
): boolean {
  return themeSections(themeKey, kind).includes(section as SectionId);
}

/** Whether an id is a section this product has ever heard of. */
export function isKnownSection(section: string): section is SectionId {
  return isWebsiteSectionId(section);
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
  kind?: ThemeKind | null,
): SectionId[] {
  const supported = themeSections(themeKey, kind);
  const out: SectionId[] = [];
  for (const id of saved ?? []) {
    if (isKnownSection(id) && supported.includes(id) && !out.includes(id)) out.push(id);
  }
  for (const id of supported) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
