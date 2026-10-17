/**
 * cors-policy.test.ts proves the decision. This proves @fastify/cors actually
 * turns it into headers — including the preflight a browser sends before the
 * widget's JSON POST, which is where a cross-origin booking would really fail.
 *
 * It registers the plugin the same way app.ts does on a bare Fastify instance,
 * so it needs no database and runs with the unit suite.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { corsDecision } from '../../src/utils/cors-policy';

let app: FastifyInstance;
const ENV = ['http://localhost:3000'];
const RESORT_SITE = 'https://www.palmresort.com';

beforeAll(async () => {
  app = Fastify();
  await app.register(cors, {
    delegator: (req, cb) => { cb(null, corsDecision(req.headers.origin, req.url, ENV)); },
  });
  app.post('/site/:slug/book', async () => ({ ok: true }));
  app.get('/api/bookings', async () => ({ ok: true }));
  await app.ready();
});

afterAll(() => app.close());

describe('the widget booking from a resort\'s own website', () => {
  it('passes the preflight the browser sends before a JSON POST', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/site/palm/book',
      headers: {
        origin: RESORT_SITE,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBe(RESORT_SITE);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('gets the allow-origin header on the POST itself', async () => {
    const res = await app.inject({
      method: 'POST', url: '/site/palm/book',
      headers: { origin: RESORT_SITE, 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.headers['access-control-allow-origin']).toBe(RESORT_SITE);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('the same website reaching for a private route', () => {
  it('gets no allow-origin header, so the browser withholds the response', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/bookings', headers: { origin: RESORT_SITE },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('the dashboard', () => {
  it('may send the X-Property-Id header the property switcher adds', async () => {
    // The dashboard and the API are different origins, so a custom header
    // triggers a preflight. Refused, every request would fail once a property
    // is chosen.
    const res = await app.inject({
      method: 'OPTIONS', url: '/api/bookings',
      headers: {
        origin: 'https://app.resortpro.site',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization,x-property-id',
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('x-property-id');
  });

  it('still gets credentials on private routes', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/bookings', headers: { origin: 'https://app.resortpro.site' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('https://app.resortpro.site');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
