/**
 * Which theme `?preview=<key>` renders with.
 *
 * `?preview=` set the theme key and then threw the config away, and nothing
 * ever looked the previewed theme up — so an UPLOADED, AI_GENERATED or
 * TEMPLATE key fell through to the luxe default. An owner who had just paid
 * ৳3,000 for a theme pressed Preview and got a different theme, with nothing
 * on the page to say so: the two preview URLs were byte-for-byte identical,
 * 95,734 bytes each, for two themes that look nothing alike. (Website Builder
 * QA 2026-10-28, WB-004.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchThemeByKey, resolvePreviewTheme } from '@/app/(public)/[slug]/site-data';
import type { ResortData } from '@/components/themes/types';

const brutalist = { key: 'brutalist', name: 'Brutalist', colors: { background: '#fff200' } };
const saved = { key: 'saved-upload', name: 'Saved Upload' };

const TIER2_HTML = '<section id="hero"><h1>{{tenant.name}}</h1></section>';
const TIER2_CSS = '#hero { background: {{website.primaryColor}}; }';

const themeResponse = (theme: unknown) => ({ ok: true, json: async () => ({ success: true, data: theme }) });
const notFound = { ok: false, status: 404, json: async () => ({ success: false }) };

/** A tenant on an UPLOADED theme of their own, as `/site/:slug` returns one. */
const onUploadedTheme = {
  tenant: { name: 'Palm Paradise', slug: 'palm-paradise-resort' },
  website: { templateId: 'saved-upload', heroTitle: 'Your Paradise Awaits' },
  rooms: [],
  themeType: 'UPLOADED',
  themeConfig: saved,
} as unknown as ResortData;

/** A tenant on a hardcoded theme — the common case. */
const onHardcodedTheme = {
  ...onUploadedTheme,
  website: { templateId: 'luxe' },
  themeType: 'HARDCODED',
  themeConfig: null,
} as unknown as ResortData;

/** A tenant already on a Tier 2 theme, which `/site/:slug` returns in full. */
const onTemplateTheme = {
  ...onUploadedTheme,
  website: { templateId: 'saved-tier2' },
  themeType: 'TEMPLATE',
  themeConfig: null,
  templateHtml: TIER2_HTML,
  templateCss: TIER2_CSS,
} as unknown as ResortData;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(themeResponse({ themeType: 'UPLOADED', configJson: brutalist }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolvePreviewTheme', () => {
  it('renders the theme that was asked for, which is the whole bug', async () => {
    const { config } = await resolvePreviewTheme('brutalist', onHardcodedTheme);
    expect(config).toEqual(brutalist);
  });

  it('asks the API for that key', async () => {
    await resolvePreviewTheme('brutalist', onHardcodedTheme);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/site/theme/brutalist');
  });

  it('does not hand back the saved theme when a different one is previewed', async () => {
    // The precise shape of the bug: the owner's own config, served under
    // someone else's key.
    const { config } = await resolvePreviewTheme('brutalist', onUploadedTheme);
    expect(config).not.toEqual(saved);
    expect(config).toEqual(brutalist);
  });

  it('answers the tenant\'s own theme without a second request', async () => {
    const { config } = await resolvePreviewTheme('saved-upload', onUploadedTheme);
    expect(config).toEqual(saved);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still resolves a theme that was unpublished after they chose it', async () => {
    // `/site/theme/:key` refuses an unpublished theme, so a fetch here would
    // come back null and drop an owner onto luxe in their own builder. Their
    // site keeps rendering — `/site/:slug` returns their theme whatever its
    // status — so the branch above is the one that has to answer.
    fetchMock.mockResolvedValue(notFound);
    expect((await resolvePreviewTheme('saved-upload', onUploadedTheme)).config).toEqual(saved);
  });

  it('is empty with no key, so the live site is untouched', async () => {
    expect(await resolvePreviewTheme(undefined, onHardcodedTheme)).toEqual({ config: null, template: null });
    expect(await resolvePreviewTheme('', onHardcodedTheme)).toEqual({ config: null, template: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is empty for a hardcoded key, which the registry renders instead', async () => {
    fetchMock.mockResolvedValue(themeResponse({ themeType: 'HARDCODED', configJson: null }));
    expect(await resolvePreviewTheme('minimal', onHardcodedTheme)).toEqual({ config: null, template: null });
  });

  it('is empty for a key that does not exist', async () => {
    fetchMock.mockResolvedValue(notFound);
    expect(await resolvePreviewTheme('no-such-theme', onHardcodedTheme)).toEqual({ config: null, template: null });
  });

  it('is empty for an unreleased theme asked for without a signature', async () => {
    // The API answers 404 for that, identically to a key that does not exist,
    // so there is nothing to distinguish here — and nothing should be. An
    // owner cannot preview a design that has not been released to them.
    fetchMock.mockResolvedValue(notFound);
    expect(await resolvePreviewTheme('unreleased', onHardcodedTheme)).toEqual({ config: null, template: null });
  });

  it('never returns a config and a template at once', async () => {
    // The page picks the renderer by looking at `template` first, so a theme
    // that somehow carried both would silently render as Tier 2.
    const uploaded = await resolvePreviewTheme('brutalist', onHardcodedTheme);
    expect(uploaded.template).toBeNull();
    fetchMock.mockResolvedValue(
      themeResponse({ themeType: 'TEMPLATE', configJson: brutalist, templateHtml: TIER2_HTML }),
    );
    const tier2 = await resolvePreviewTheme('tier-two', onHardcodedTheme);
    expect(tier2.config).toBeNull();
  });
});

describe('resolvePreviewTheme, Tier 2', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(
      themeResponse({
        themeType: 'TEMPLATE',
        configJson: null,
        templateHtml: TIER2_HTML,
        templateCss: TIER2_CSS,
      }),
    );
  });

  it('returns the previewed template, which used to fall through to luxe', async () => {
    const { template } = await resolvePreviewTheme('tier-two', onHardcodedTheme);
    expect(template?.html).toBe(TIER2_HTML);
  });

  it('returns the stylesheet with it', async () => {
    // Tier 2 CSS lives in its own column because <style> is stripped out at
    // upload. Dropping it here would render the template unstyled, which looks
    // more like a broken theme than like a missing stylesheet.
    const { template } = await resolvePreviewTheme('tier-two', onHardcodedTheme);
    expect(template?.css).toBe(TIER2_CSS);
  });

  it('hands back the raw Handlebars source, not something already compiled', async () => {
    // The caller compiles, because only the caller has the resort's data.
    const { template } = await resolvePreviewTheme('tier-two', onHardcodedTheme);
    expect(template?.html).toContain('{{tenant.name}}');
  });

  it('tolerates a template theme with no HTML stored', async () => {
    // A half-finished upload should fall back to the registry rather than
    // rendering an empty page.
    fetchMock.mockResolvedValue(themeResponse({ themeType: 'TEMPLATE', templateHtml: null }));
    expect(await resolvePreviewTheme('tier-two', onHardcodedTheme)).toEqual({ config: null, template: null });
  });

  it('is null-safe about a template theme with no CSS', async () => {
    fetchMock.mockResolvedValue(themeResponse({ themeType: 'TEMPLATE', templateHtml: TIER2_HTML }));
    const { template } = await resolvePreviewTheme('tier-two', onHardcodedTheme);
    expect(template).toEqual({ html: TIER2_HTML, css: null });
  });

  it('previews the tenant\'s own Tier 2 theme from the payload in hand', async () => {
    const { template } = await resolvePreviewTheme('saved-tier2', onTemplateTheme);
    expect(template).toEqual({ html: TIER2_HTML, css: TIER2_CSS });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchThemeByKey', () => {
  it('reads what is in the database now', async () => {
    // An admin who uploads a corrected package and presses Preview again is
    // asking about the new one.
    await fetchThemeByKey('brutalist');
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });

  it('escapes the key rather than pasting it into the URL', async () => {
    await fetchThemeByKey('../../admin/themes');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('../');
  });

  it('is null, not a crash, when the API cannot be reached', async () => {
    // A preview that 500s teaches an owner nothing; falling back to the
    // registry at least renders their site.
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await fetchThemeByKey('brutalist')).toBeNull();
  });

  it('is null for a theme the API will not serve', async () => {
    fetchMock.mockResolvedValue(notFound);
    expect(await fetchThemeByKey('brutalist')).toBeNull();
  });
});
