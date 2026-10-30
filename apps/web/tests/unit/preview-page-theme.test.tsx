/**
 * What the public page hands the preview renderer.
 *
 * The companion to preview-theme.test.ts, and not a duplicate of it: the bug
 * was not in a helper that returned the wrong config, it was one line in the
 * page that never asked for a config at all —
 *
 *     const configJson = isPreview ? null : data.themeConfig;
 *
 * A test on the helper alone passes with that line still in place, so it would
 * not have caught WB-004 and would not catch it coming back. This calls the
 * server component the way Next does and reads what it passes down.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import ResortWebsitePage from '@/app/(public)/[slug]/page';
import { PreviewPage } from '@/app/(public)/[slug]/PreviewPage';
import { TemplateThemeRenderer } from '@/components/themes/template-renderer';

const brutalist = { key: 'brutalist', name: 'Brutalist', colors: { background: '#fff200' } };
const savedUpload = { key: 'saved-upload', name: 'Saved Upload' };

const TIER2_HTML = '<section id="hero"><h1>{{tenant.name}}</h1></section>';
const TIER2_CSS = '#hero { --resort: "{{tenant.name}}"; }';
const tier2 = { themeType: 'TEMPLATE', configJson: null, templateHtml: TIER2_HTML, templateCss: TIER2_CSS };

const site = (over: Record<string, unknown> = {}) => ({
  tenant: { name: 'Palm Paradise', slug: 'palm-paradise-resort' },
  website: { templateId: 'luxe', heroTitle: 'Your Paradise Awaits' },
  rooms: [],
  themeType: 'HARDCODED',
  themeConfig: null,
  ...over,
});

const envelope = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

/** Answers both calls the page can make, by URL. */
function routeFetch(siteData: unknown, themeByKey: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const path = String(url);
    const key = path.match(/\/site\/theme\/(.+)$/)?.[1];
    if (key) {
      const theme = themeByKey[decodeURIComponent(key)];
      return theme ? envelope(theme) : { ok: false, status: 404, json: async () => ({}) };
    }
    return envelope(siteData);
  });
}

const render = (searchParams: { preview?: string }) =>
  ResortWebsitePage({ params: { slug: 'palm-paradise-resort' }, searchParams });

let fetchMock: ReturnType<typeof vi.fn>;

const stub = (siteData: unknown, themes: Record<string, unknown> = {}) => {
  fetchMock = routeFetch(siteData, themes);
  vi.stubGlobal('fetch', fetchMock);
};

beforeEach(() => {
  stub(site(), { brutalist: { themeType: 'UPLOADED', configJson: brutalist } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('?preview=<key>', () => {
  it('hands the preview the config of the theme in the URL', async () => {
    const el = await render({ preview: 'brutalist' });
    expect(el.type).toBe(PreviewPage);
    expect(el.props.configJson).toEqual(brutalist);
  });

  it('names the previewed theme, not the saved one', async () => {
    const el = await render({ preview: 'brutalist' });
    expect(el.props.themeKey).toBe('brutalist');
  });

  it('does not pass the saved theme under another key', async () => {
    // What the owner actually saw: their own theme, or the luxe default,
    // whichever the registry reached first — never the one they picked.
    stub(site({ themeType: 'UPLOADED', themeConfig: savedUpload, website: { templateId: 'saved-upload' } }),
      { brutalist: { themeType: 'UPLOADED', configJson: brutalist } });
    const el = await render({ preview: 'brutalist' });
    expect(el.props.configJson).toEqual(brutalist);
    expect(el.props.configJson).not.toEqual(savedUpload);
  });

  it('gives two different keys two different configs', async () => {
    // The symptom in one assertion. Both URLs used to return the same 95,734
    // bytes, so a screenshot could not tell them apart either.
    stub(site(), {
      brutalist: { themeType: 'UPLOADED', configJson: brutalist },
      'other-upload': { themeType: 'AI_GENERATED', configJson: { key: 'other-upload' } },
    });
    const a = await render({ preview: 'brutalist' });
    const b = await render({ preview: 'other-upload' });
    expect(a.props.configJson).not.toEqual(b.props.configJson);
  });

  it('passes no config for a hardcoded key, so the registry renders it', async () => {
    stub(site(), { minimal: { themeType: 'HARDCODED', configJson: null } });
    const el = await render({ preview: 'minimal' });
    expect(el.props.configJson).toBeNull();
    expect(el.props.themeKey).toBe('minimal');
  });

  it('shows a resort with no website content at all', async () => {
    // Preview is how an owner sees a theme before writing any copy, so this
    // path must survive a null website.
    stub(site({ website: null }), { brutalist: { themeType: 'UPLOADED', configJson: brutalist } });
    const el = await render({ preview: 'brutalist' });
    expect(el.props.configJson).toEqual(brutalist);
    expect(el.props.initialData.website.heroTitle).toContain('Palm Paradise');
  });
});

describe('the live site', () => {
  it('still renders from the saved theme, not from a key in the URL', async () => {
    stub(site({ themeType: 'UPLOADED', themeConfig: savedUpload, website: { templateId: 'saved-upload' } }));
    const el = await render({});
    expect(el.type).not.toBe(PreviewPage);
  });

  it('asks the API once, with no theme lookup added to it', async () => {
    // The preview lookup is a second request. It must not land on the public
    // site, which serves real visitors.
    await render({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/site/palm-paradise-resort');
  });

  it('404s a resort that does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    await expect(render({})).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('404s a resort with no website content, where preview would still render', async () => {
    stub(site({ website: null }));
    await expect(render({})).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('previewing the theme already saved', () => {
  it('needs no second request', async () => {
    stub(site({ themeType: 'UPLOADED', themeConfig: savedUpload, website: { templateId: 'saved-upload' } }));
    const el = await render({ preview: 'saved-upload' });
    expect(el.props.configJson).toEqual(savedUpload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('?preview=<key> for a Tier 2 template', () => {
  it('compiles the previewed template instead of falling through to luxe', async () => {
    stub(site(), { 'tier-two': tier2 });
    const el = await render({ preview: 'tier-two' });
    expect(el.type).toBe(PreviewPage);
    expect(el.props.template.html).toContain('Palm Paradise');
  });

  it('leaves no uncompiled Handlebars in what it hands down', async () => {
    // A raw `{{ }}` reaching the browser is the visible form of this failing:
    // the owner reads their own markup instead of their resort's name.
    stub(site(), { 'tier-two': tier2 });
    const el = await render({ preview: 'tier-two' });
    expect(el.props.template.html).not.toContain('{{');
  });

  it('compiles the stylesheet with the same pass', async () => {
    // CSS can reference the same tokens, and a raw `{{ }}` left in it is
    // invalid CSS — the rule it sits in is dropped by the browser.
    stub(site(), { 'tier-two': tier2 });
    const el = await render({ preview: 'tier-two' });
    expect(el.props.template.css).toContain('Palm Paradise');
  });

  it('passes no config alongside it', async () => {
    // The client picks the renderer off `template` first, so a config arriving
    // with it would mean two renderers disagreeing about which theme this is.
    stub(site(), { 'tier-two': tier2 });
    const el = await render({ preview: 'tier-two' });
    expect(el.props.configJson).toBeNull();
  });

  it('previews a Tier 2 theme the resort already uses', async () => {
    stub(site({ ...tier2, website: { templateId: 'saved-tier2' } }));
    const el = await render({ preview: 'saved-tier2' });
    expect(el.props.template.html).toContain('Palm Paradise');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the registry for a template theme with no HTML stored', async () => {
    stub(site(), { 'tier-two': { themeType: 'TEMPLATE', templateHtml: null } });
    const el = await render({ preview: 'tier-two' });
    expect(el.props.template).toBeNull();
    expect(el.props.configJson).toBeNull();
  });
});

describe('the live site, Tier 2', () => {
  it('still renders the saved template server-side', async () => {
    // compileTier2 is shared with the preview path now; the live site must
    // keep rendering through TemplateThemeRenderer, not PreviewPage.
    stub(site({ ...tier2, website: { templateId: 'saved-tier2', heroTitle: 'Your Paradise Awaits' } }));
    const el = await render({});
    expect(el.type).toBe(TemplateThemeRenderer);
    expect(el.props.html).toContain('Palm Paradise');
    expect(el.props.css).toContain('Palm Paradise');
  });
});
