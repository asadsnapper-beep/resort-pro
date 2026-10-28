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
