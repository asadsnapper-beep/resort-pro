/**
 * The embed widget runs on a resort's own website, so the API has to answer it
 * from there — on the public routes, without credentials, and nowhere else.
 *
 * See src/utils/cors-policy.ts for why credentials are the line that matters.
 */
import { describe, it, expect } from 'vitest';
import { corsDecision } from '../../src/utils/cors-policy';

const ENV = ['http://localhost:3000'];
const RESORT_SITE = 'https://www.palmresort.com';

describe('a resort\'s own website, where the widget is pasted', () => {
  it.each([
    '/site/palm/availability?checkIn=2026-10-01&checkOut=2026-10-03',
    '/site/palm/availability/calendar?year=2026&month=10',
    '/site/palm/menu',
    '/site/palm/book',
    '/embed/config/palm',
    '/embed/palm/orders',
  ])('may call %s', (url) => {
    expect(corsDecision(RESORT_SITE, url, ENV)).toEqual({ origin: true, credentials: false });
  });

  it('never gets credentials, so it cannot ride a signed-in session', () => {
    expect(corsDecision(RESORT_SITE, '/site/palm/book', ENV).credentials).toBe(false);
  });

  it.each([
    '/api/bookings',
    '/api/tenant',
    '/api/billing/portal',
    '/api/auth/login',
  ])('is refused on %s', (url) => {
    expect(corsDecision(RESORT_SITE, url, ENV)).toEqual({ origin: false });
  });

  it('is not fooled by a path that merely contains a public segment', () => {
    // The public prefix has to be the start of the path.
    expect(corsDecision(RESORT_SITE, '/api/site/palm', ENV)).toEqual({ origin: false });
    expect(corsDecision(RESORT_SITE, '/api/embed/x', ENV)).toEqual({ origin: false });
  });
});

describe('first-party origins keep exactly what they had', () => {
  it.each([
    'https://resortpro.site',
    'https://app.resortpro.site',
    'https://palm.resortpro.site',
    'http://localhost:3000',
  ])('%s gets credentials everywhere', (origin) => {
    expect(corsDecision(origin, '/api/bookings', ENV)).toEqual({ origin: true, credentials: true });
    expect(corsDecision(origin, '/site/palm/book', ENV)).toEqual({ origin: true, credentials: true });
  });

  it('does not treat a look-alike domain as first-party', () => {
    expect(corsDecision('https://resortpro.site.evil.com', '/api/bookings', ENV)).toEqual({ origin: false });
    expect(corsDecision('https://evilresortpro.site', '/api/bookings', ENV)).toEqual({ origin: false });
  });
});

describe('no Origin header', () => {
  it('is allowed as before — same-origin, curl, health checks', () => {
    expect(corsDecision(undefined, '/api/bookings', ENV)).toEqual({ origin: true, credentials: true });
  });
});
