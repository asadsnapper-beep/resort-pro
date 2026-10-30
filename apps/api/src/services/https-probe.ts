/**
 * HTTPS probe — does this domain actually answer over TLS?
 *
 * Why this exists: Tenant.sslStatus is a stored value. It says what we last
 * heard from Cloudflare, not what a visitor's browser would experience right
 * now. Telling an owner their site is "live" on the strength of a database
 * column is how you end up with a resort handing out a URL that shows a
 * certificate warning.
 *
 * This opens a real TLS connection to the hostname and reports what came back.
 * It is the only thing in the codebase entitled to use the word "live".
 *
 * The hostname is tenant-supplied, so this is also a server-side request
 * forgery primitive and is guarded like one. `domainVerified` is not that
 * guard: it is a stored boolean, proved once against DNS that the owner can
 * change afterwards. Point a verified domain at 169.254.169.254 or 10.0.0.5
 * and the result below — reachable, the certificate's subject and expiry, the
 * exact authorization error — becomes an internal reachability oracle driven
 * from the settings page. So the resolved addresses are checked before
 * connecting, with the same `isPrivateAddress` the calendar-feed guard uses
 * (utils/safe-url.ts); one guard, one definition of "private".
 *
 * The residual is the same one recorded there: DNS can change between the
 * check and the connection. Closing that needs the resolved address pinned
 * into the socket, which this does — it connects to the address it checked and
 * carries the hostname in SNI, so there is nothing left to rebind.
 *
 * See docs/custom-domains.md
 */

import * as tls from 'tls';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { isPrivateAddress } from '../utils/safe-url';

export interface HttpsProbeResult {
  /** TLS handshake completed AND the certificate chain was trusted. */
  live: boolean;
  /** The handshake completed, even if the certificate was not trusted. */
  reachable: boolean;
  /** Certificate expiry, when one was presented. */
  expiresAt: Date | null;
  /** Days until expiry — negative once expired. */
  daysUntilExpiry: number | null;
  /** Why it is not live, in words an owner can act on. */
  error: string | null;
}

const PROBE_TIMEOUT_MS = 4_000;

function notLive(error: string, reachable = false): HttpsProbeResult {
  return { live: false, reachable, expiresAt: null, daysUntilExpiry: null, error };
}

/**
 * Resolve a tenant-supplied hostname to one public address, or explain why it
 * will not be probed. Returning the address rather than a yes/no is the point:
 * the caller connects to the address that was checked, so no DNS answer can
 * change underneath it.
 */
async function resolvePublicAddress(
  hostname: string,
): Promise<{ address: string } | { refusal: string }> {
  const host = hostname.replace(/^\[|\]$/g, '');

  // A literal address never goes to DNS, so check it on its own.
  if (net.isIP(host)) {
    return isPrivateAddress(host)
      ? { refusal: 'That address is not reachable from the internet' }
      : { address: host };
  }

  // These never resolve publicly, and some resolvers answer them from the
  // container's own search domains.
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return { refusal: 'That is an internal hostname, not a public domain' };
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return { refusal: 'DNS does not resolve for this domain' };
  }
  if (addresses.length === 0) return { refusal: 'DNS does not resolve for this domain' };

  // One private answer is enough to reach inside, so every answer must be
  // public — not merely the first one we would have connected to.
  if (addresses.some(a => isPrivateAddress(a.address))) {
    return { refusal: 'This domain resolves to an address that is not reachable from the internet' };
  }

  return { address: addresses[0]!.address };
}

/**
 * Probe a hostname's TLS endpoint. Never throws and never hangs longer than
 * PROBE_TIMEOUT_MS — a slow or hostile domain must not hold up the settings
 * page that called it.
 */
export async function probeHttps(hostname: string): Promise<HttpsProbeResult> {
  const resolved = await resolvePublicAddress(hostname);
  if ('refusal' in resolved) return notLive(resolved.refusal);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: HttpsProbeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const socket = tls.connect({
      host: resolved.address,     // the address that was checked, not the name
      port: 443,
      servername: hostname,       // SNI — without this a shared host answers wrongly
      rejectUnauthorized: false,  // inspect the cert ourselves rather than throwing
      timeout: PROBE_TIMEOUT_MS,
    });

    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      const authorized = socket.authorized;

      if (!cert || Object.keys(cert).length === 0) {
        return finish(notLive('The server answered but presented no certificate', true));
      }

      const expiresAt = cert.valid_to ? new Date(cert.valid_to) : null;
      const daysUntilExpiry = expiresAt
        ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
        : null;

      if (!authorized) {
        // authorizationError names the cause: wrong hostname, self-signed,
        // expired. Passing it through is more useful than a generic failure.
        return finish({
          live: false,
          reachable: true,
          expiresAt,
          daysUntilExpiry,
          error: `Certificate not trusted: ${socket.authorizationError ?? 'unknown reason'}`,
        });
      }

      finish({ live: true, reachable: true, expiresAt, daysUntilExpiry, error: null });
    });

    socket.once('timeout', () => finish(notLive('The domain did not respond within 4 seconds')));

    socket.once('error', (err: NodeJS.ErrnoException) => {
      const reason =
        err.code === 'ENOTFOUND'    ? 'DNS does not resolve for this domain'
      : err.code === 'ECONNREFUSED' ? 'Nothing is listening on port 443'
      : err.code === 'ETIMEDOUT'    ? 'The domain did not respond'
      : err.message;
      finish(notLive(reason));
    });
  });
}
