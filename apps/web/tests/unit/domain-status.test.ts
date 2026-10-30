/**
 * DNS and HTTPS are two different things, and "live" needs both.
 *
 * The builder said "Verified & live" as soon as DNS resolved, and put an
 * `https://` link beside it. Without a certificate that link fails, so the
 * owner was told their domain was live and then watched it not load.
 * (Website Builder QA 2026-10-28, WB-008.)
 */
import { describe, it, expect } from 'vitest';
import { domainState } from '@/lib/domain-status';

const DOMAIN = 'www.palmparadise.com';
const at = (over: Record<string, unknown> = {}) =>
  domainState({ customDomain: DOMAIN, domainVerified: true, sslStatus: 'active', ...over });

describe('no domain connected', () => {
  it('is not configured, for null, undefined and a blank domain', () => {
    for (const input of [null, undefined, {}, { customDomain: '' }, { customDomain: null }]) {
      expect(domainState(input).configured).toBe(false);
    }
  });

  it('is never live and offers nothing to do', () => {
    expect(domainState(null).live).toBe(false);
    expect(domainState(null).nextStep).toBeNull();
  });
});

describe('DNS has not resolved yet', () => {
  const s = at({ domainVerified: false, sslStatus: 'none' });

  it('says the domain is not pointing here', () => {
    expect(s.dns.done).toBe(false);
    expect(s.dns.label).toMatch(/not pointing here/i);
  });

  it('is not live', () => {
    expect(s.live).toBe(false);
  });

  it('asks for the DNS record first, not for anything about certificates', () => {
    expect(s.nextStep).toMatch(/DNS record/i);
  });
});

describe('DNS resolves but there is no certificate', () => {
  // This is the exact state the old UI called "Verified & live".
  const s = at({ sslStatus: 'none' });

  it('reports DNS as done', () => {
    expect(s.dns.done).toBe(true);
  });

  it('does NOT call it live', () => {
    expect(s.live).toBe(false);
  });

  it('does not offer a link that cannot load', () => {
    expect(s.canOpen).toBe(false);
  });

  it('says plainly that the domain will not load yet', () => {
    expect(s.nextStep).toMatch(/will not load/i);
  });

  it('treats a pending certificate the same way', () => {
    const pending = at({ sslStatus: 'pending' });
    expect(pending.live).toBe(false);
    expect(pending.https.state).toBe('waiting');
  });
});

describe('a certificate is being issued', () => {
  const s = at({ sslStatus: 'provisioning' });

  it('is still not live', () => {
    expect(s.live).toBe(false);
    expect(s.canOpen).toBe(false);
  });

  it('says to wait rather than asking the owner to do something', () => {
    expect(s.https.state).toBe('working');
    expect(s.nextStep).toMatch(/being issued/i);
  });
});

describe('the certificate failed', () => {
  it('is not live and surfaces the reason the platform recorded', () => {
    const s = at({ sslStatus: 'error', sslError: 'DNS challenge timed out' });
    expect(s.live).toBe(false);
    expect(s.https.state).toBe('failed');
    expect(s.nextStep).toContain('DNS challenge timed out');
  });

  it('still says something useful with no reason recorded', () => {
    const s = at({ sslStatus: 'error', sslError: null });
    expect(s.nextStep).toMatch(/could not be issued/i);
  });
});

describe('DNS and certificate both good', () => {
  const s = at();

  it('is the only state that is live', () => {
    expect(s.live).toBe(true);
    expect(s.canOpen).toBe(true);
  });

  it('has nothing left to ask of the owner', () => {
    expect(s.nextStep).toBeNull();
  });
});

describe('a certificate without DNS', () => {
  it('is not live — both halves are required', () => {
    // Can happen after a domain is re-pointed: the cert record outlives the
    // DNS change.
    const s = at({ domainVerified: false });
    expect(s.https.state).toBe('active');
    expect(s.live).toBe(false);
    expect(s.canOpen).toBe(false);
  });
});

describe('an sslStatus nobody planned for', () => {
  it('is treated as no certificate, not as a working one', () => {
    // Claiming HTTPS that does not exist is the failure this module prevents,
    // so an unknown value must fall to the cautious side.
    for (const ssl of ['revoked', 'EXPIRED', '', 'ACTIVE']) {
      const s = at({ sslStatus: ssl });
      expect(s.https.state).toBe('waiting');
      expect(s.live).toBe(false);
    }
  });

  it('treats a missing sslStatus as no certificate', () => {
    expect(at({ sslStatus: undefined }).live).toBe(false);
    expect(at({ sslStatus: null }).live).toBe(false);
  });
});

describe('live implies both halves, for every combination', () => {
  it('holds', () => {
    const statuses = ['none', 'pending', 'provisioning', 'active', 'error', 'nonsense', null];
    for (const sslStatus of statuses) {
      for (const domainVerified of [true, false]) {
        const s = domainState({ customDomain: DOMAIN, domainVerified, sslStatus });
        expect(s.live).toBe(domainVerified && sslStatus === 'active');
        // An owner is only ever sent to a URL that the platform believes works.
        expect(s.canOpen).toBe(s.live);
      }
    }
  });
});

/**
 * The measurement, added once the API began taking a real TLS handshake.
 *
 * Until then this module could only read `sslStatus`, and said so in its own
 * doc comment: a record of what the platform was last told, not a measurement.
 * `https` is that measurement, and where the two disagree it wins — a stored
 * column cannot notice a certificate being revoked, expiring, or never having
 * been served.
 */
describe('a real TLS handshake outranks the stored status', () => {
  const connected = { customDomain: 'theirresort.com', domainVerified: true };

  it('is live when the handshake was trusted, whatever the column says', () => {
    const d = domainState({
      ...connected,
      sslStatus: 'provisioning',
      https: { live: true, reachable: true, error: null },
    });
    expect(d.live).toBe(true);
    expect(d.https.state).toBe('active');
    expect(d.canOpen).toBe(true);
    expect(d.nextStep).toBeNull();
  });

  it('is not live when the column says active and nothing answers', () => {
    // The exact lie this module exists to stop, now also catchable when an
    // administrator marked it active by hand.
    const d = domainState({
      ...connected,
      sslStatus: 'active',
      https: { live: false, reachable: false, error: 'The domain did not respond' },
    });
    expect(d.live).toBe(false);
    expect(d.canOpen).toBe(false);
    expect(d.https.state).not.toBe('active');
  });

  it('calls an untrusted certificate a failure, not a work in progress', () => {
    // A host answering on 443 with the wrong certificate has a definite
    // problem — this is what an A record produces.
    const d = domainState({
      ...connected,
      sslStatus: 'provisioning',
      https: { live: false, reachable: true, error: 'Certificate not trusted: ERR_TLS_CERT_ALTNAME_INVALID' },
    });
    expect(d.https.state).toBe('failed');
    expect(d.live).toBe(false);
  });

  it('passes the probe\'s own words through to the owner', () => {
    const d = domainState({
      ...connected,
      sslStatus: 'provisioning',
      https: { live: false, reachable: true, error: 'Certificate not trusted: CERT_HAS_EXPIRED' },
    });
    expect(d.nextStep).toContain('CERT_HAS_EXPIRED');
  });

  it('prefers the probe\'s reason over the stored sslError', () => {
    const d = domainState({
      ...connected,
      sslStatus: 'error',
      sslError: 'Cloudflare: 1414 something older',
      https: { live: false, reachable: true, error: 'Certificate not trusted: self signed certificate' },
    });
    expect(d.nextStep).toContain('self signed');
    expect(d.nextStep).not.toContain('1414');
  });

  it('leaves issuance alone while nothing answers yet', () => {
    // Not reachable during issuance is ordinary, not a failure. The stored
    // status is the better guide here and must not be overridden.
    const d = domainState({
      ...connected,
      sslStatus: 'provisioning',
      https: { live: false, reachable: false, error: 'Nothing is listening on port 443' },
    });
    expect(d.https.state).toBe('working');
    expect(d.nextStep).toMatch(/being issued/i);
  });

  it('still needs DNS, however good the handshake was', () => {
    // A domain can answer over HTTPS and not be pointed at us at all.
    const d = domainState({
      customDomain: 'theirresort.com',
      domainVerified: false,
      sslStatus: 'active',
      https: { live: true, reachable: true, error: null },
    });
    expect(d.live).toBe(false);
    expect(d.nextStep).toMatch(/Verify Domain/);
  });

  it('works exactly as before when no measurement is passed', () => {
    // The builder page reads a payload with no `https` field. It must keep
    // behaving, just promising less.
    const withOut = domainState({ ...connected, sslStatus: 'active' });
    const withNull = domainState({ ...connected, sslStatus: 'active', https: null });
    expect(withOut.live).toBe(true);
    expect(withNull).toEqual(withOut);
  });
});
