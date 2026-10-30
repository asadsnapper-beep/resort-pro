/**
 * What a custom domain's state actually is, as two separate things.
 *
 * The builder said "Verified & live" the moment DNS resolved, and offered an
 * `https://` link next to it. DNS resolving says only that the name points
 * here. It says nothing about whether a certificate exists, and without one
 * that link fails in the browser — the owner is told their domain is live and
 * then watches it not load. (Website Builder QA 2026-10-28, WB-008.)
 *
 * DNS and HTTPS are therefore reported separately, and "live" is never claimed
 * from DNS alone.
 *
 * `sslStatus` is still only a record of what the platform was last told. What
 * closed the gap this file used to record is `https`: a real TLS handshake,
 * taken by the API (services/https-probe.ts) and passed in here. When it is
 * present it outranks `sslStatus`, because a measurement beats a stored
 * column — a certificate can be revoked, expire, or never have been served at
 * all while the column still reads `active`.
 *
 * It is optional on purpose. The builder page reads a payload that carries no
 * measurement, and it keeps working from `sslStatus` alone; it simply cannot
 * promise as much.
 */
export type SslStatus = 'none' | 'pending' | 'provisioning' | 'active' | 'error';

export type HttpsState = 'waiting' | 'working' | 'active' | 'failed';

/** The result of an actual TLS handshake — see services/https-probe.ts. */
export interface HttpsMeasurement {
  /** The handshake completed AND the certificate chain was trusted. */
  live: boolean;
  /** Something answered on 443, even if its certificate was not trusted. */
  reachable: boolean;
  error: string | null;
}

export interface DomainStatusInput {
  customDomain?: string | null;
  domainVerified?: boolean | null;
  sslStatus?: string | null;
  sslError?: string | null;
  /** Outranks sslStatus when present. Absent is normal, not an error. */
  https?: HttpsMeasurement | null;
}

export interface DomainState {
  /** No domain connected at all — the card shows the setup form only. */
  configured: boolean;
  dns: { done: boolean; label: string };
  https: { state: HttpsState; label: string };
  /**
   * Serves the site over HTTPS as far as the platform knows. Both halves must
   * hold; this is what the old "Verified & live" claimed from DNS alone.
   */
  live: boolean;
  /** Whether it is safe to offer an `https://` link to the owner. */
  canOpen: boolean;
  /** The one thing to do next, or null when there is nothing to do. */
  nextStep: string | null;
}

const NOT_CONFIGURED: DomainState = {
  configured: false,
  dns:   { done: false, label: 'No domain connected' },
  https: { state: 'waiting', label: 'No domain connected' },
  live: false,
  canOpen: false,
  nextStep: null,
};

const HTTPS_LABEL: Record<HttpsState, string> = {
  waiting: 'Certificate not issued yet',
  working: 'Certificate being issued',
  active:  'Certificate active',
  failed:  'Certificate failed',
};

function httpsState(ssl: string | null | undefined): HttpsState {
  switch (ssl) {
    case 'active':       return 'active';
    case 'provisioning': return 'working';
    case 'error':        return 'failed';
    // 'none', 'pending', null, and anything unrecognised. An unknown status is
    // treated as not-yet-issued rather than as working: claiming HTTPS that
    // does not exist is the failure this module exists to prevent.
    default:             return 'waiting';
  }
}

/**
 * Reconcile the stored status with a measurement, when there is one.
 *
 * A handshake that completed and was trusted is the only thing that proves
 * HTTPS, so it wins outright. A host that answered with a certificate we could
 * not trust has a definite problem — that is `failed`, whatever the column
 * says. A host that did not answer at all is the ordinary state during
 * issuance, so the stored status decides, except that it may no longer claim
 * `active`: the column saying active while nothing answers is precisely the
 * lie this module exists to stop.
 */
function reconcile(stored: HttpsState, measured: HttpsMeasurement): HttpsState {
  if (measured.live) return 'active';
  if (measured.reachable) return 'failed';
  return stored === 'active' ? 'waiting' : stored;
}

export function domainState(t: DomainStatusInput | null | undefined): DomainState {
  if (!t?.customDomain) return NOT_CONFIGURED;

  const dnsDone  = t.domainVerified === true;
  const measured = t.https ?? null;
  const https    = measured ? reconcile(httpsState(t.sslStatus), measured) : httpsState(t.sslStatus);
  const live     = dnsDone && https === 'active';

  let nextStep: string | null = null;
  if (!dnsDone) {
    nextStep = 'Add the DNS record below at your domain registrar, then press Verify Domain.';
  } else if (https === 'failed') {
    // The probe's own words when it has them: "Certificate not trusted:
    // ERR_TLS_CERT_ALTNAME_INVALID" tells an owner far more than a generic
    // issuance failure, and it is the case an A record produces.
    const reason = measured?.error ?? t.sslError;
    nextStep = reason
      ? `The certificate could not be issued: ${reason}`
      : 'The certificate could not be issued. Contact support and we will look into it.';
  } else if (https === 'working') {
    nextStep = 'Your certificate is being issued. This usually takes a few minutes.';
  } else if (https === 'waiting') {
    nextStep = 'DNS is pointing here, but your certificate has not been issued yet — '
             + 'until it is, this domain will not load. Contact support to finish the setup.';
  }

  return {
    configured: true,
    dns: {
      done: dnsDone,
      label: dnsDone ? 'Pointing to ResortPro' : 'Not pointing here yet',
    },
    https: { state: https, label: HTTPS_LABEL[https] },
    live,
    // Sending the owner to a URL that cannot load teaches them their site is
    // broken. The free subdomain is always there and always works.
    canOpen: live,
    nextStep,
  };
}
