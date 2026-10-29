/**
 * Which theme `?preview=<key>` renders with.
 *
 * `?preview=` set the theme key and then threw the config away, and nothing
 * ever looked the previewed theme up — so an UPLOADED or AI_GENERATED key fell
 * through to the luxe default. An owner who had just paid ৳3,000 for a theme
 * pressed Preview and got a different theme, with nothing on the page to say
 * so: the two preview URLs were byte-for-byte identical, 95,734 bytes each,
 * for two themes that look nothing alike. (Website Builder QA 2026-10-28,
 * WB-004.)
 *
 * TEMPLATE is not covered here, because it is not fixed: a Tier 2 key still
 * falls back to the registry, and the test that says so is in this file
 * deliberately — so the gap is recorded rather than implied.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getThemeConfig, resolvePreviewConfig } from '@/app/(public)/[slug]/site-data';
import type { ResortData } from '@/components/themes/types';

const brutalist = { key: 'brutalist', name: 'Brutalist', colors: { background: '#fff200' } };
const saved = { key: 'saved-upload', name: 'Saved Upload' };

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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(themeResponse({ themeType: 'UPLOADED', configJson: brutalist }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolvePreviewConfig', () => {
  it('renders the theme that was asked for, which is the whole bug', async () => {
    const config = await resolvePreviewConfig('brutalist', onHardcodedTheme);
    expect(config).toEqual(brutalist);
  });

  it('asks the API for that key', async () => {
    await resolvePreviewConfig('brutalist', onHardcodedTheme);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/site/theme/brutalist');
  });

  it('does not hand back the saved theme when a different one is previewed', async () => {
    // The precise shape of the bug: the owner's own config, served under
    // someone else's key.
    const config = await resolvePreviewConfig('brutalist', onUploadedTheme);
    expect(config).not.toEqual(saved);
    expect(config).toEqual(brutalist);
  });

  it('answers the tenant\'s own theme without a second request', async () => {
    const config = await resolvePreviewConfig('saved-upload', onUploadedTheme);
    expect(config).toEqual(saved);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still resolves a theme that was unpublished after they chose it', async () => {
    // `/site/theme/:key` refuses an unpublished theme, so a fetch here would
    // come back null and drop an owner onto luxe in their own builder. Their
    // site keeps rendering — `/site/:slug` returns their theme whatever its
    // status — so the branch above is the one that has to answer.
    fetchMock.mockResolvedValue(notFound);
    expect(await resolvePreviewConfig('saved-upload', onUploadedTheme)).toEqual(saved);
  });

  it('is null with no key, so the live site is untouched', async () => {
    expect(await resolvePreviewConfig(undefined, onHardcodedTheme)).toBeNull();
    expect(await resolvePreviewConfig('', onHardcodedTheme)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is null for a hardcoded key, which the registry renders instead', async () => {
    fetchMock.mockResolvedValue(themeResponse({ themeType: 'HARDCODED', configJson: null }));
    expect(await resolvePreviewConfig('minimal', onHardcodedTheme)).toBeNull();
  });

  it('is null for a TEMPLATE key — Tier 2 preview is not fixed', async () => {
    // Honest record of where this stops. A TEMPLATE theme has templateHtml,
    // not a config, and compiling it as the owner types needs Handlebars on
    // the client. Until then this falls back to the registry, same as before.
    fetchMock.mockResolvedValue(
      themeResponse({ themeType: 'TEMPLATE', configJson: null, templateHtml: '<h1>{{tenant.name}}</h1>' }),
    );
    expect(await resolvePreviewConfig('tier-two', onHardcodedTheme)).toBeNull();
  });

  it('is null for a key that does not exist', async () => {
    fetchMock.mockResolvedValue(notFound);
    expect(await resolvePreviewConfig('no-such-theme', onHardcodedTheme)).toBeNull();
  });

  it('is null for an unreleased theme asked for without a signature', async () => {
    // The API answers 404 for that, identically to a key that does not exist,
    // so there is nothing to distinguish here — and nothing should be. An
    // owner cannot preview a design that has not been released to them.
    fetchMock.mockResolvedValue(notFound);
    expect(await resolvePreviewConfig('unreleased', onHardcodedTheme)).toBeNull();
  });
});

describe('getThemeConfig', () => {
  it('reads what is in the database now', async () => {
    // An admin who uploads a corrected package and presses Preview again is
    // asking about the new one.
    await getThemeConfig('brutalist');
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });

  it('escapes the key rather than pasting it into the URL', async () => {
    await getThemeConfig('../../admin/themes');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('../');
  });

  it('is null, not a crash, when the API cannot be reached', async () => {
    // A preview that 500s teaches an owner nothing; falling back to the
    // registry at least renders their site.
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await getThemeConfig('brutalist')).toBeNull();
  });

  it('is null when the theme carries no config', async () => {
    fetchMock.mockResolvedValue(themeResponse({ themeType: 'UPLOADED' }));
    expect(await getThemeConfig('brutalist')).toBeNull();
  });
});
