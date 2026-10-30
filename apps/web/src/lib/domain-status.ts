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
 * What this cannot tell you: `sslStatus` is a record of what the platform was
 * last told, not a measurement. Nothing in the codebase moves it past
 * `provisioning` on its own — `POST /tenant/domain/provision-ssl` writes that
 * status and names a webhook (`/api/tenant/domain/ssl-webhook`) that does not
 * exist as a route, so only an admin calling `PATCH /admin/domains/:id/ssl`
 * ever sets `active`. Treat `active` as "an administrator confirmed a
 * certificate", not as a live HTTPS check. The remaining gap is recorded in
 * the QA report rather than papered over with a confident label here.
 */
export type SslStatus = 'none' | 'pending' | 'provisioning' | 'active' | 'error';

export type HttpsState = 'waiting' | 'working' | 'active' | 'failed';

export interface DomainStatusInput {
  customDomain?: string | null;
  domainVerified?: boolean | null;
  sslStatus?: string | null;
  sslError?: string | null;
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

export function domainState(t: DomainStatusInput | null | undefined): DomainState {
  if (!t?.customDomain) return NOT_CONFIGURED;

  const dnsDone = t.domainVerified === true;
  const https   = httpsState(t.sslStatus);
  const live    = dnsDone && https === 'active';

  let nextStep: string | null = null;
  if (!dnsDone) {
    nextStep = 'Add the DNS record below at your domain registrar, then press Verify Domain.';
  } else if (https === 'failed') {
    nextStep = t.sslError
      ? `The certificate could not be issued: ${t.sslError}`
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
