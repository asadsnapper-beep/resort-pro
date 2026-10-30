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
import { CONFIG_THEME_SECTIONS } from '../../src/components/themes/config-renderer';
import { THEME_REGISTRY } from '../../src/components/themes/registry';

const THEMES_DIR = join(__dirname, '../../src/components/themes');

const SOURCE: Record<string, string> = {
  luxe: 'luxe/index.tsx',
  minimal: 'minimal/index.tsx',
  coastal: 'coastal/index.tsx',
  'tea-garden-eco-resort': 'tea-garden-eco-resort/index.tsx',
};

/** Read a renderer's source and collect the section ids its node map is keyed by. */
function mappedSections(relPath: string): Set<string> {
  const src = readFileSync(join(THEMES_DIR, relPath), 'utf8');
  // The map is written one section per line, `id: <node>,`. Only ids this
  // product knows about count, so a stray object property elsewhere in the
  // file cannot be mistaken for a section.
  const mapped = new Set<string>();
  for (const line of src.split('\n')) {
    const m = /^\s{8,}([a-z]+):\s/.exec(line);
    if (m && isKnownSection(m[1])) mapped.add(m[1]);
  }
  return mapped;
}

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
    // A key alone still says nothing: a bespoke key is not in THEME_SECTIONS
    // whether it is uploaded, AI-generated or Tier 2. Without the kind the
    // cautious answer stands.
    expect(themeSections('an-uploaded-theme')).toEqual(SECTION_IDS);
    expect(themeSections(null)).toEqual(SECTION_IDS);
  });
});

/**
 * The config half of WB-001.
 *
 * WB-001 was closed for the four hardcoded themes and left standing for every
 * uploaded and AI-generated one, because `themeSections` fell back to the full
 * set for any key it did not recognise. There is no `ConfigAmenities` anywhere
 * in the product, so an owner on an uploaded theme was given a switch and two
 * arrows for a section that nothing would ever draw.
 */
describe('an uploaded or AI-generated theme', () => {
  it('is answered by its kind, which its bespoke key could never give', () => {
    expect(themeSections('whatever-the-admin-called-it', 'UPLOADED')).toEqual(CONFIG_THEME_SECTIONS);
    expect(themeSections('some-ai-theme', 'AI_GENERATED')).toEqual(CONFIG_THEME_SECTIONS);
  });

  it('is not offered Amenities, the section the config renderer has no component for', () => {
    expect(supportsSection('an-uploaded-theme', 'amenities', 'UPLOADED')).toBe(false);
    expect(supportsSection('an-ai-theme', 'amenities', 'AI_GENERATED')).toBe(false);
  });

  it('is still offered everything the config renderer does draw', () => {
    // The fix must not overshoot into hiding real controls. Gallery and
    // Testimonials are the two WB-001 found missing on Minimal, and an
    // uploaded theme draws both.
    for (const id of ['about', 'gallery', 'testimonials', 'menu', 'venues', 'vehicles', 'availability', 'offers', 'contact']) {
      expect(supportsSection('an-uploaded-theme', id, 'UPLOADED')).toBe(true);
    }
  });

  it('renders the two a resort site exists for', () => {
    for (const id of ALWAYS_RENDERED) expect(CONFIG_THEME_SECTIONS).toContain(id);
  });

  it('declares only known sections, once each', () => {
    for (const id of CONFIG_THEME_SECTIONS) expect(isKnownSection(id)).toBe(true);
    expect(new Set(CONFIG_THEME_SECTIONS).size).toBe(CONFIG_THEME_SECTIONS.length);
  });

  it('drops Amenities from a stored order that still carries it', () => {
    // Sites saved before this fix have `amenities` in `sectionOrder`. It has to
    // disappear from the controls without taking the rest of the order with it.
    const order = canonicalSectionOrder('an-uploaded-theme', ['contact', 'amenities', 'about'], 'UPLOADED');
    expect(order).not.toContain('amenities');
    expect(order.slice(0, 2)).toEqual(['contact', 'about']);
  });
});

describe('a Tier 2 template theme', () => {
  it('still gets every control, because only its own markup knows', () => {
    // TemplateThemeRenderer hides and moves whichever `id="<section>"`
    // elements it finds in the uploaded HTML. That is not knowable from a key
    // or a kind, so the cautious answer is the honest one here.
    expect(themeSections('a-tier-2-theme', 'TEMPLATE')).toEqual(SECTION_IDS);
    expect(supportsSection('a-tier-2-theme', 'amenities', 'TEMPLATE')).toBe(true);
  });
});

describe('a hardcoded theme', () => {
  it('answers from its own list, kind or no kind', () => {
    expect(themeSections('minimal', 'HARDCODED')).toEqual([...THEME_SECTIONS.minimal]);
    expect(themeSections('minimal')).toEqual([...THEME_SECTIONS.minimal]);
    expect(supportsSection('minimal', 'gallery', 'HARDCODED')).toBe(false);
  });

  it('loses to the kind when the two disagree, because the kind picks the renderer', () => {
    // A row saying UPLOADED while carrying a built-in key is a database that
    // contradicts itself, and the public page resolves it the same way: it
    // sends `themeConfig` whenever `themeType !== 'HARDCODED'`, and then
    // ConfigThemeRenderer draws the site. Answering from minimal's list there
    // would describe a renderer that is not running.
    expect(themeSections('minimal', 'UPLOADED')).toEqual(CONFIG_THEME_SECTIONS);
    expect(supportsSection('minimal', 'gallery', 'UPLOADED')).toBe(true);
    expect(supportsSection('coastal', 'amenities', 'AI_GENERATED')).toBe(false);
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
    const mapped = mappedSections(SOURCE[key]);

    // `rooms` and `booking` are in the map but never gated, and some themes
    // put them there too — either way they must be declared.
    const declared = new Set<string>(THEME_SECTIONS[key]);
    for (const id of ALWAYS_RENDERED) mapped.add(id);

    expect(Array.from(mapped).sort()).toEqual(Array.from(declared).sort());
  });

  it('the config renderer orders by the list it exports, untransformed', () => {
    // Read from source because the alternative is mounting the renderer, and
    // what matters is narrower than that: the default order a brand-new
    // uploaded site renders in has to be the order the builder is shown. A
    // `.reverse()` or a slice added between the two would put Contact first
    // for every uploaded theme in the product, and no assertion about the
    // exported list alone can see it.
    const src = readFileSync(join(THEMES_DIR, 'config-renderer/index.tsx'), 'utf8');
    expect(src).toContain('orderSections(\n          [...CONFIG_THEME_SECTIONS],');
  });

  it('the config renderer, which answers for every uploaded theme at once', () => {
    // The same guard, and it matters more here: one list stands for every
    // uploaded and AI-generated theme in the product, so a section added to
    // this renderer without being declared is a control missing from all of
    // them, and one declared without being drawn is WB-001 again.
    const mapped = mappedSections('config-renderer/index.tsx');
    for (const id of ALWAYS_RENDERED) mapped.add(id);
    expect(Array.from(mapped).sort()).toEqual([...CONFIG_THEME_SECTIONS].sort());
  });
});
