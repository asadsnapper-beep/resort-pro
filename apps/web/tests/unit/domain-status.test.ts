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
