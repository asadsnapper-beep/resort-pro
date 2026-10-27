/**
 * The builder and the themes have to agree about what each theme renders.
 *
 * They did not. Minimal renders neither Gallery nor Testimonials, and the
 * builder offered both: an owner could add photos and reviews, reorder them,
 * publish, open the site and find nothing. Amenities was offered for every
 * theme and rendered only by Coastal. Offers was rendered by Coastal and Tea
 * Garden and offered by nobody, so it could not be hidden or moved at all.
 * (Website Builder QA 2026-10-28, WB-001.)
 *
 * capabilities.ts now collects one list per theme, and each list lives in the
 * theme's own file beside the sections it renders. These tests are what keeps
 * that honest: the last block reads each renderer's source and compares the
 * keys of its section map against the list it exports, so adding a section to
 * a theme without declaring it — or declaring one it does not render — fails
 * here rather than silently in front of a customer.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SECTION_IDS,
  THEME_SECTIONS,
  ALWAYS_RENDERED,
  themeSections,
  supportsSection,
  isKnownSection,
  canonicalSectionOrder,
} from '../../src/components/themes/capabilities';
import { THEME_REGISTRY } from '../../src/components/themes/registry';

const THEMES_DIR = join(__dirname, '../../src/components/themes');

const SOURCE: Record<string, string> = {
  luxe: 'luxe/index.tsx',
  minimal: 'minimal/index.tsx',
  coastal: 'coastal/index.tsx',
  'tea-garden-eco-resort': 'tea-garden-eco-resort/index.tsx',
};

describe('every registered theme declares what it renders', () => {
  it('covers the registry exactly — a new theme cannot arrive undeclared', () => {
    expect(Object.keys(THEME_SECTIONS).sort()).toEqual(Object.keys(THEME_REGISTRY).sort());
  });

  it.each(Object.keys(THEME_SECTIONS))('%s declares only known sections, once each', (key) => {
    const sections = THEME_SECTIONS[key];
    for (const id of sections) expect(isKnownSection(id)).toBe(true);
    expect(new Set(sections).size).toBe(sections.length);
  });

  it.each(Object.keys(THEME_SECTIONS))('%s renders the two a resort site exists for', (key) => {
    for (const id of ALWAYS_RENDERED) expect(THEME_SECTIONS[key]).toContain(id);
  });
});

describe('the findings themselves, stated as facts that can fail', () => {
  it('Minimal does not accept Gallery or Testimonials', () => {
    expect(supportsSection('minimal', 'gallery')).toBe(false);
    expect(supportsSection('minimal', 'testimonials')).toBe(false);
  });

  it('Amenities belongs to Coastal and nowhere else', () => {
    const withAmenities = Object.keys(THEME_SECTIONS).filter((k) => supportsSection(k, 'amenities'));
    expect(withAmenities).toEqual(['coastal']);
  });

  it('Offers is a real section, and the two themes that render it can control it', () => {
    expect(SECTION_IDS).toContain('offers');
    expect(supportsSection('coastal', 'offers')).toBe(true);
    expect(supportsSection('tea-garden-eco-resort', 'offers')).toBe(true);
  });
});

describe('a theme nobody here knows', () => {
  it('gets every section rather than none', () => {
    // Config and template themes are rendered elsewhere and carry their own
    // capability. Hiding every control for them would be a worse lie than
    // showing them all.
    expect(themeSections('an-uploaded-theme')).toEqual(SECTION_IDS);
    expect(themeSections(null)).toEqual(SECTION_IDS);
  });
});

describe('cleaning a stored order', () => {
  it('drops ids the theme does not render', () => {
    expect(canonicalSectionOrder('minimal', ['gallery', 'about'])).not.toContain('gallery');
  });

  it('drops a repeat, which used to render the section twice under one React key', () => {
    const order = canonicalSectionOrder('coastal', ['about', 'about', 'rooms']);
    expect(order.filter((id) => id === 'about')).toHaveLength(1);
  });

  it('keeps the order that was asked for', () => {
    const order = canonicalSectionOrder('coastal', ['contact', 'about']);
    expect(order.slice(0, 2)).toEqual(['contact', 'about']);
  });

  it('appends what the stored order never mentioned, so a new section is not lost', () => {
    expect(canonicalSectionOrder('coastal', ['about'])).toContain('amenities');
  });

  it('is the theme list when nothing was stored', () => {
    expect(canonicalSectionOrder('minimal', null)).toEqual([...THEME_SECTIONS.minimal]);
  });
});

/**
 * The part that cannot be satisfied by editing a list.
 *
 * Each renderer builds an object whose keys are the sections it draws. If that
 * object and the exported list disagree, one of the two is lying to the
 * builder, which is the whole of WB-001.
 */
describe('each renderer draws exactly what its theme declares', () => {
  it.each(Object.keys(SOURCE))('%s', (key) => {
    const src = readFileSync(join(THEMES_DIR, SOURCE[key]), 'utf8');

    // The map is written one section per line, `id: <node>,`. Only ids this
    // product knows about count, so a stray object property elsewhere in the
    // file cannot be mistaken for a section.
    const mapped = new Set<string>();
    for (const line of src.split('\n')) {
      const m = /^\s{8,}([a-z]+):\s/.exec(line);
      if (m && isKnownSection(m[1])) mapped.add(m[1]);
    }

    // `rooms` and `booking` are in the map but never gated, and some themes
    // put them there too — either way they must be declared.
    const declared = new Set<string>(THEME_SECTIONS[key]);
    for (const id of ALWAYS_RENDERED) mapped.add(id);

    expect(Array.from(mapped).sort()).toEqual(Array.from(declared).sort());
  });
});
