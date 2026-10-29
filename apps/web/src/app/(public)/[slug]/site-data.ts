/**
 * The one place a resort's public website reads its own content.
 *
 * Publishing writes to the database immediately and the dashboard says so —
 * "live immediately" is the wording on the button. It was not true. This page
 * fetched with `revalidate: 60` and the layout, which carries the metadata and
 * the Google Analytics id, with `revalidate: 3600`, so an owner could publish,
 * open their own website and see no change for a minute, or an hour for
 * analytics. They conclude the publish did not work, and nothing the builder
 * says afterwards is believed. (Website Builder QA 2026-10-28, WB-002.)
 *
 * So the content is not cached. `no-store` is the whole fix: a page view reads
 * what is in the database now.
 *
 * The cost of that is one API call per page view instead of one per minute,
 * which is why the three separate fetches of this same payload became one
 * function. The layout, `generateMetadata` and the page all call it and the
 * API still receives a single request per page view: Next memoises an
 * identical GET for the length of one render pass, `no-store` included. That
 * was measured, not assumed — three calls in, one request out.
 *
 * So there is no `cache()` wrapper here. It would be the belt to that braces,
 * and `react`'s `cache` only exists under the react-server export condition,
 * which puts the module out of reach of a unit test for no behaviour gained.
 */
import type { ResortData } from '@/components/themes/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * A resort's public site data, or null when there is no such resort.
 *
 * Returns null rather than throwing on a network failure, because every caller
 * is a page that has to render something: the page 404s, the layout omits the
 * analytics tag. A 500 would be the wrong answer to the API being briefly
 * unreachable.
 */
export async function getSiteData(slug: string): Promise<ResortData | null> {
  try {
    const res = await fetch(`${API}/site/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * The config of one theme, by its key.
 *
 * Returns null for a key that does not exist — and for an unreleased theme
 * asked for without the signature the API minted, which answers the same way
 * on purpose. Either way the caller falls back to the hardcoded registry,
 * which is the right outcome: a key nobody is allowed to read is a key nobody
 * can preview.
 *
 * `no-store` for the same reason as above, and one more: an admin who uploads
 * a corrected package and presses Preview again is asking what is in the
 * database now.
 */
export async function getThemeConfig(key: string): Promise<ResortData['themeConfig']> {
  try {
    const res = await fetch(`${API}/site/theme/${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()).data?.configJson ?? null;
  } catch {
    return null;
  }
}

/**
 * The config to render `?preview=<key>` with.
 *
 * This is the half of WB-004 that was missing. `?preview=` set the theme *key*
 * and then deliberately threw the config away — `configJson = isPreview ? null
 * : data.themeConfig` — on the reasoning that a preview should show the
 * previewed theme rather than the saved one. But nothing ever looked the
 * previewed theme up, so an UPLOADED or AI_GENERATED key fell through
 * `getTheme()` to the luxe default. An owner who had just paid for a theme
 * pressed Preview and saw a different theme, with nothing to suggest anything
 * had gone wrong: these two URLs returned byte-for-byte identical pages,
 * 95,734 bytes each, for two themes that look nothing alike.
 *
 *     /<slug>?preview=wb004-uploaded   →  luxe
 *     /<slug>?preview=wb004-template   →  luxe
 *
 * The tenant's own theme is answered from the payload already in hand instead
 * of being re-fetched. That saves a request on the common case — an owner
 * editing the site they are looking at — and it is also the only branch that
 * still works for a theme unpublished *after* they chose it: `/site/:slug`
 * returns their theme whatever its status, while `/site/theme/:key` will not.
 *
 * A TEMPLATE key still resolves to null here and still falls back to the
 * registry. That one is not fixed; it needs Handlebars on the client, which is
 * a decision of its own.
 */
export async function resolvePreviewConfig(
  key: string | null | undefined,
  data: ResortData,
): Promise<ResortData['themeConfig']> {
  if (!key) return null;
  if (key === data.website?.templateId) return data.themeConfig ?? null;
  return getThemeConfig(key);
}
