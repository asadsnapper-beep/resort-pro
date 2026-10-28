/**
 * How a resort's public website asks for its own content.
 *
 * The thing that matters here is one word: `no-store`. Publishing writes to
 * the database at once and the dashboard says the site is live immediately,
 * but this fetch used `revalidate: 60` and the layout's copy of it 3600, so an
 * owner could publish, open their site and see the old one (Website Builder QA
 * 2026-10-28, WB-002). A test on the cache option is therefore a test on
 * whether the product tells the truth.
 *
 * The other half of the change — the layout, the metadata and the page sharing
 * one call where they used to make three — is Next's own per-render-pass
 * memoisation and cannot be asserted from here. It was measured instead, by
 * loading a published site and counting what the API received: one request.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSiteData } from '@/app/(public)/[slug]/site-data';

const payload = {
  tenant: { name: 'Tea Garden Eco Resort', slug: 'tea-garden' },
  website: { heroTitle: 'Where the hills meet the tea', googleAnalyticsId: 'G-ABC123' },
  rooms: [],
};

const okResponse = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(okResponse(payload));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSiteData', () => {
  it('asks for the content that is in the database now, not a cached copy', async () => {
    await getSiteData('tea-garden');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });

  it('does not ask Next to revalidate on a timer, which is the bug', async () => {
    await getSiteData('tea-garden');
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('next');
  });

  it('asks the API for that slug', async () => {
    await getSiteData('tea-garden');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/site/tea-garden');
  });

  it('unwraps the envelope and hands back the resort', async () => {
    expect(await getSiteData('tea-garden')).toEqual(payload);
  });

  it('carries the analytics id, so the layout needs no second call', async () => {
    const data = await getSiteData('tea-garden');
    expect(data?.website?.googleAnalyticsId).toBe('G-ABC123');
  });

  it('is null for a resort that does not exist', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await getSiteData('no-such-resort')).toBeNull();
  });

  it('is null, not a crash, when the API cannot be reached', async () => {
    // Every caller is a page that still has to render something: the page 404s
    // and the layout omits the analytics tag. A thrown error would turn a
    // momentary blip into a 500 on a resort's website.
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await getSiteData('tea-garden')).toBeNull();
  });

  it('is null when the response carries no resort', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    expect(await getSiteData('tea-garden')).toBeNull();
  });
});
