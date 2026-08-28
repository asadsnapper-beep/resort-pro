/**
 * Phase D of plan/global-search.md — the flag and the pilot signals.
 *
 * The flag is a kill switch rather than a rollout gate: search shipped to
 * production before it existed, so it is granted on every plan and the point
 * of the switch is being able to turn it OFF for one resort.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { searchMetrics } from '../../src/utils/search-metrics';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `phased-${Date.now()}`;
const password = 'TestPass123!';
let token = '';
let tenantId = '';

const search = (q: string) =>
  app.inject({ method: 'GET', url: `/api/search?q=${encodeURIComponent(q)}`, headers: { Authorization: `Bearer ${token}` } });

const setFlag = (enabled: boolean) =>
  prisma.tenantFeatureFlag.upsert({
    where: { tenantId_flag: { tenantId, flag: 'global_search' } },
    update: { enabled },
    create: { tenantId, flag: 'global_search', enabled },
  });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const email = `pd-${slug}@test.com`;
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Phase D Resort', slug, firstName: 'P', lastName: 'D', email, password },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email, password, slug });

  await prisma.guest.create({
    data: { tenantId, firstName: 'Rumana', lastName: 'Khatun', email: `rk-${slug}@test.com` },
  });

  // A fresh signup has no active subscription, and POSTs from such a tenant are
  // held read-only with a 402. The beacon has to work anyway — it is telemetry,
  // not a business write — so the state is pinned here instead of inherited.
  // CI hit this and the first local run did not.
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'incomplete' } });
}, 40000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('global_search flag', () => {
  it('is on for a brand-new tenant, so nothing that shipped is taken away', async () => {
    expect((await search('Rumana')).statusCode).toBe(200);
  });

  it('switches search off for one resort without a deploy', async () => {
    await setFlag(false);
    const res = await search('Rumana');
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('PLAN_UPGRADE_REQUIRED');
  }, 20000);

  it('switches it back on', async () => {
    await setFlag(true);
    expect((await search('Rumana')).statusCode).toBe(200);
  }, 20000);
});

describe('pilot signals', () => {
  it('counts a query and the results it returned', async () => {
    searchMetrics.reset();
    await search('Rumana');
    const s = searchMetrics.snapshot();
    expect(s.queries).toBe(1);
    expect(s.avgResultsPerQuery).toBeGreaterThan(0);
    expect(s.noResultRatePct).toBe(0);
  }, 20000);

  it('a query that finds nothing raises the no-result rate', async () => {
    searchMetrics.reset();
    await search('zzz-no-such-guest');
    expect(searchMetrics.snapshot().noResultRatePct).toBe(100);
  }, 20000);

  it('a too-short query is not counted at all', async () => {
    // Otherwise search would look worse the more someone types.
    searchMetrics.reset();
    await search('R');
    expect(searchMetrics.snapshot().queries).toBe(0);
  }, 20000);

  it('records a selection, which is the only signal search actually helped', async () => {
    searchMetrics.reset();
    await search('Rumana');
    const res = await app.inject({
      method: 'POST', url: '/api/search/selected',
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'guest' },
    });
    expect(res.statusCode).toBe(204);
    const s = searchMetrics.snapshot();
    expect(s.selections).toBe(1);
    expect(s.selectionRatePct).toBe(100);
    expect(s.selectionsByType.guest).toBe(1);
  }, 20000);

  it('buckets an unrecognised type rather than trusting the client', async () => {
    searchMetrics.reset();
    await app.inject({
      method: 'POST', url: '/api/search/selected',
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: '<script>alert(1)</script>' },
    });
    const s = searchMetrics.snapshot();
    expect(s.selectionsByType.other).toBe(1);
    expect(Object.keys(s.selectionsByType)).toEqual(['other']);
  }, 20000);

  it('the beacon needs authentication', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/search/selected', payload: { type: 'guest' } });
    expect(res.statusCode).toBe(401);
  });

  it('stores no query text anywhere in the snapshot', async () => {
    searchMetrics.reset();
    await search('Rumana Khatun');
    expect(JSON.stringify(searchMetrics.snapshot())).not.toMatch(/Rumana/i);
  }, 20000);
});
