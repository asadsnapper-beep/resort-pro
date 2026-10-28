/**
 * Short-lived signed links for previewing a theme that is not published yet.
 *
 * `GET /site/theme/:key` had no filter on `themeStatus` or `isActive`, so the
 * full `configJson` of an unreleased design — or the whole `templateHtml` and
 * `templateCss` of a Tier 2 theme — came back to anyone who knew the key, with
 * no login at all. Confirmed against a row left exactly as the admin upload
 * path leaves one (`PREVIEW`, `isActive: false`): 200, config and all. The
 * schema says `DRAFT` means "saved, not visible to tenants" and `PREVIEW`
 * means "previewable by admin only"; the endpoint said otherwise. (Website
 * Builder QA 2026-10-28, found while reproducing WB-004.)
 *
 * Refusing every unpublished theme would have been one line, and it would have
 * broken the one thing an admin does after uploading: the themes page offers a
 * Preview link straight after an upload or an AI generation, and those are
 * exactly the themes sitting at `PREVIEW`. That link is how an admin finds out
 * whether the upload rendered at all, so taking it away to close a leak trades
 * one real problem for another.
 *
 * Signed links instead, the same shape and for the same reason as
 * signed-upload-url.ts: the preview is opened as a plain page in a new tab,
 * which cannot carry an Authorization header, so the API signs the link as it
 * hands it out. Keyed on JWT_SECRET, which both deployments already have —
 * nothing new has to be set anywhere for this to work.
 *
 * The signature is domain-separated with a `theme-preview` prefix so that a
 * signature minted for anything else — an upload key of the same name, say —
 * cannot be replayed here.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Two hours.
 *
 * Longer than the 15 minutes a private document gets, because the risk is not
 * the same — this is an unreleased design, not somebody's passport — and
 * because the link is minted when the admin's themes page loads, not when they
 * click. Fifteen minutes would expire the button under a tab left open over
 * lunch, and an admin who sees a dead Preview link concludes the upload
 * failed.
 */
export const THEME_PREVIEW_TTL_SECONDS = 2 * 60 * 60;

function secret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-in-production';
}

function sign(key: string, exp: number): string {
  return createHmac('sha256', secret()).update(`theme-preview:${key}:${exp}`).digest('hex');
}

/** True for a theme whose contents only an admin with a link should see. */
export function isUnpublishedTheme(theme: { themeStatus?: string | null }): boolean {
  return theme.themeStatus !== 'PUBLISHED';
}

/**
 * The preview path for a theme, signed when the theme is not published.
 *
 * A published theme needs no signature: its config is already served to every
 * visitor of every site using it, so signing it would only add a link that
 * expires for no reason.
 */
export function themePreviewPath(
  theme: { key: string; themeStatus?: string | null },
  ttlSeconds = THEME_PREVIEW_TTL_SECONDS,
): string {
  if (!isUnpublishedTheme(theme)) return `/theme-preview/${theme.key}`;

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const params = new URLSearchParams({ exp: String(exp), sig: sign(theme.key, exp) });
  return `/theme-preview/${theme.key}?${params.toString()}`;
}

/** Verify the pair on an incoming request. Rejects expired and malformed alike. */
export function verifyThemePreviewSignature(key: string, exp?: string, sig?: string): boolean {
  if (!exp || !sig) return false;

  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return false;

  const expected = Buffer.from(sign(key, expiry));
  const given = Buffer.from(sig);
  // timingSafeEqual throws on a length mismatch, so check that first.
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
