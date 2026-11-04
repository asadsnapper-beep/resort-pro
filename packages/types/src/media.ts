// ─── What counts as a link to a picture or a video ────────────────────────────
// One copy, read by the API's zod schema and by the form, for the same reason
// `capabilities.ts` exists: a rule stated twice drifts, and the one that drifts
// wide is the one that accepts something the other will refuse.
//
// The room form checked `new URL(value)` and called that validation. It is
// not: `new URL('javascript:alert(1)')` parses perfectly well, and so do
// `data:` and `file:`. The API's `videos` field had the identical check and
// the identical hole, while `images` had no check at all.
// (Room Management QA 2026-10-28, RM-012.)

/** How long a stored media link may be — a column holds a link, not a file. */
export const MAX_MEDIA_URL_LENGTH = 2048;

/**
 * Whether this is a URL *and* one of the two schemes a browser will fetch as
 * media.
 *
 * Named schemes rather than a deny-list: a deny-list is a promise to have
 * thought of every scheme, and `javascript:` is only the famous one.
 */
export function isHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}
