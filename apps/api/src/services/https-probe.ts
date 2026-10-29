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
 * See docs/custom-domains.md
 */

import * as tls from 'tls';

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
 * Probe a hostname's TLS endpoint. Never throws and never hangs longer than
 * PROBE_TIMEOUT_MS — a slow or hostile domain must not hold up the settings
 * page that called it.
 */
export function probeHttps(hostname: string): Promise<HttpsProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: HttpsProbeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const socket = tls.connect({
      host: hostname,
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
