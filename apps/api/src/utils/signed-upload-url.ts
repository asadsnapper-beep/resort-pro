/**
 * Short-lived signed URLs for private uploads.
 *
 * Guest ID and passport scans sat under the same unauthenticated /uploads/
 * static route as room photos: anyone holding the URL could read one, from any
 * tenant, forever. Unguessable filenames are not access control — URLs leak
 * through browser history, Referer headers, screenshots and logs, and anyone
 * ever shown one keeps it.
 *
 * Blanket auth on /uploads/ is not the fix either. Room, menu, website and
 * vehicle images are rendered by the public resort site to visitors who have no
 * account, so locking the whole prefix would black out every customer's
 * website. Only `guest-docs` is private, so only `guest-docs` is signed.
 *
 * Signed URLs rather than an authenticated proxy route because the dashboard
 * renders these in plain <img> and <a> tags, which cannot carry an
 * Authorization header. The API signs each document URL as it hands it out.
 *
 * Keyed on JWT_SECRET: rotating it invalidates outstanding links, which is the
 * behaviour you want from a secret rotation.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Long enough to open and read a document, short enough that a leaked link dies. */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Path segment that marks an upload as private. */
export const PRIVATE_UPLOAD_FOLDER = 'guest-docs';

function secret(): string {
  return process.env.JWT_SECRET || 'dev-secret-change-in-production';
}

function sign(key: string, exp: number): string {
  return createHmac('sha256', secret()).update(`${key}:${exp}`).digest('hex');
}

/** True when this storage key points at something that must not be public. */
export function isPrivateUploadKey(key: string): boolean {
  return key.split('/').includes(PRIVATE_UPLOAD_FOLDER);
}

/**
 * Append `exp` and `sig` to a stored document URL.
 *
 * Non-private keys and anything that is not a URL we serve are returned
 * untouched — an S3/R2-hosted object is signed by that provider, not here.
 */
export function signUploadUrl(url: string, ttlSeconds = SIGNED_URL_TTL_SECONDS): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const marker = '/uploads/';
  const at = parsed.pathname.indexOf(marker);
  if (at === -1) return url;

  const key = decodeURIComponent(parsed.pathname.slice(at + marker.length));
  if (!isPrivateUploadKey(key)) return url;

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  parsed.searchParams.set('exp', String(exp));
  parsed.searchParams.set('sig', sign(key, exp));
  return parsed.toString();
}

/** Verify the pair on an incoming request. Rejects expired and malformed alike. */
export function verifyUploadSignature(key: string, exp?: string, sig?: string): boolean {
  if (!exp || !sig) return false;

  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return false;

  const expected = Buffer.from(sign(key, expiry));
  const given = Buffer.from(sig);
  // timingSafeEqual throws on length mismatch, so check that first.
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
