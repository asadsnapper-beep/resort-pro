/**
 * The day the Front Desk reports belongs to the resort, not to Asia/Dhaka.
 *
 * `GET /api/front-desk/today` resolved its day with `tenantTodayRange()` —
 * called with no argument, so every resort got the `Asia/Dhaka` default
 * regardless of `Tenant.timezone`. A resort in America/New_York was told it was
 * already tomorrow, and that date is not cosmetic: it is the day the arrival
 * and departure lists are built for, it is what the header prints, and it is
 * what the Walk-In modal defaults its check-in to.
 *
 * `safeTimezone` is unit-tested on its own in tests/unit/safe-timezone.test.ts.
 * What this file pins is that the route actually asks the tenant's column —
 * nothing else did, so reverting the route change broke no test.
 *
 * Why these two zones: Pacific/Kiritimati is UTC+14 and Pacific/Niue is UTC-11,
 * 25 hours apart, so at every instant they are on two different calendar dates
 * and Asia/Dhaka (UTC+6) can match at most one of them. Testing both therefore
 * guarantees that at least one case differs from the old default, whatever the
 * wall-clock moment the suite happens to run at.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `resortday-${Date.now()}`;
const password = 'TestPass123!';
let tenantId: string;
let token: string;

/** The calendar date it is right now in `timezone`, as YYYY-MM-DD. */
const dateNowIn = (timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

const setTimezone = (timezone: string) =>
  prisma.tenant.update({ where: { id: tenantId }, data: { timezone } });

const today = async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/front-desk/today',
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body).data as { date: string; timezone: string };
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const email = `rd-${slug}@test.com`;
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Resort Day', slug, firstName: 'R', lastName: 'D', email, password },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email, password, slug });
}, 25000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('GET /api/front-desk/today', () => {
  it('reports the day it is at a resort 14 hours ahead of UTC', async () => {
    await setTimezone('Pacific/Kiritimati');
    const { date, timezone } = await today();
    // Date first on purpose: it is the assertion that catches a route still
    // resolving the day the old way. `timezone` is a new field in this
    // response, so asserting it first would fail on the field being absent
    // and say nothing about the day.
    expect(date).toBe(dateNowIn('Pacific/Kiritimati'));
    expect(timezone).toBe('Pacific/Kiritimati');
  }, 20000);

  it('reports the day it is at a resort 11 hours behind UTC', async () => {
    await setTimezone('Pacific/Niue');
    const { date, timezone } = await today();
    expect(date).toBe(dateNowIn('Pacific/Niue'));
    expect(timezone).toBe('Pacific/Niue');
  }, 20000);

  it('cannot have given both of those the Asia/Dhaka answer', async () => {
    // The guard on the two cases above: 25 hours apart means two different
    // dates always, so if the route were still hardcoded to the default it
    // would have had to fail one of them. This asserts the premise rather
    // than trusting it.
    expect(dateNowIn('Pacific/Kiritimati')).not.toBe(dateNowIn('Pacific/Niue'));
  });

  it('still answers, with the fallback day, when the column holds nonsense', async () => {
    // A free-text column can hold anything. Handing it straight to Intl throws,
    // and a 500 here takes down the one screen a receptionist cannot work
    // without.
    await setTimezone('Not/AZone');
    const { date, timezone } = await today();
    expect(date).toBe(dateNowIn('Asia/Dhaka'));
    expect(timezone).toBe('Asia/Dhaka');
  }, 20000);
});
