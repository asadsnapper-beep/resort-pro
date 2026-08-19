/**
 * Guard for URLs that a tenant supplies and the server then fetches.
 *
 * External calendar feeds are owner/manager-configured and fetched server-side,
 * both on save and every 15 minutes by the sync job. That makes them a
 * server-side request forgery primitive: the URL is validated only as
 * well-formed, so `http://169.254.169.254/latest/meta-data/` (cloud instance
 * credentials), `http://postgres:5432`, or `http://localhost:4000/api/admin/...`
 * all reach hosts the tenant cannot otherwise touch. The response body is even
 * partially reflected — "URL does not return a valid iCal feed" versus a
 * timeout distinguishes a live internal host from a dead one.
 *
 * Two checks, because either alone is bypassable:
 *
 *  1. Scheme and literal-address rules on the URL itself.
 *  2. Resolve the hostname and reject private/loopback/link-local answers.
 *     A public name like `evil.test` can resolve to 127.0.0.1, so parsing the
 *     string is not enough.
 *
 * A DNS entry could still change between this check and the fetch (a rebind).
 * Closing that needs pinning the resolved address into the connection itself,
 * which is a bigger change than a pilot warrants — this removes the trivially
 * exploitable path, and the residual is recorded rather than implied away.
 */

import { lookup } from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {}

/** RFC1918, loopback, link-local, CGNAT, and the IPv6 equivalents. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;   // link-local — cloud metadata lives here
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                  // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd')) return true;  // unique local
    if (v.startsWith('fe80')) return true;                       // link-local
    // ::ffff:127.0.0.1 — IPv4 wearing an IPv6 hat
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return false;
  }
  return true; // unparseable — refuse rather than guess
}

/**
 * Throws UnsafeUrlError unless `raw` is an https URL on a public host.
 * Returns the parsed URL so callers can fetch the normalised form.
 */
export async function assertSafeExternalUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Not a valid URL');
  }

  // https only. Plain http would let the feed be tampered with in transit, and
  // it is also the scheme every internal service speaks.
  if (url.protocol !== 'https:') {
    throw new UnsafeUrlError('Calendar URLs must use https');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('Calendar URLs must not contain credentials');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  // A literal IP skips DNS, so check it directly.
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError('Calendar URL points to a private address');
    return url;
  }

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new UnsafeUrlError('Calendar URL points to an internal host');
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError('Calendar URL host could not be resolved');
  }
  if (addresses.length === 0) throw new UnsafeUrlError('Calendar URL host could not be resolved');

  // Every answer must be public: one private record is enough to reach inside.
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new UnsafeUrlError('Calendar URL resolves to a private address');
    }
  }

  return url;
}
