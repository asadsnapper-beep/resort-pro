/**
 * Telling the admin when something happens to their account.
 *
 * Two-factor makes the account harder to take, revocable sessions and
 * re-authentication limit what a taken one can do — and none of them tell
 * anyone it happened (release-readiness review M-03). An account nobody is
 * watching can be used for eight hours before the first sign of trouble.
 *
 * The judgement being held down here is *when not to send*. An alert on every
 * sign-in is noise, and an alert people learn to ignore is worse than none: it
 * still costs attention and no longer buys anything. So the second sign-in from
 * the same address is silent, and that has its own test.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import bcrypt from 'bcryptjs';
import * as alerts from '../../src/services/admin-alerts';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `alert-${Date.now()}`;
const email = `admin-${run}@test.com`;
const password = 'a-long-enough-admin-password';
let adminId: string;

let ipCounter = 0;
const nextIp = () => `10.3.${Math.floor(ipCounter / 254) % 254}.${(ipCounter++ % 254) + 1}`;

const loginFrom = (ip: string) => app.inject({
  method: 'POST', url: '/api/admin/login', remoteAddress: ip,
  headers: { 'user-agent': 'ResortPro test runner' },
  payload: { email, password },
});

/** Alerts are sent without being awaited, so give the promise a turn to land. */
const settle = () => new Promise((r) => setTimeout(r, 120));

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  adminId = (await prisma.adminUser.create({
    data: {
      email, passwordHash: await bcrypt.hash(password, 10),
      role: 'SUPER_ADMIN', firstName: 'Alert', lastName: 'Probe',
    },
  })).id;
}, 60000);

afterAll(async () => {
  await prisma.adminUser.deleteMany({ where: { email } });
  await app.close();
});

describe('a sign-in from somewhere new', () => {
  it('is reported, with where and what from', async () => {
    const spy = vi.spyOn(alerts, 'alertNewSignInLocation').mockResolvedValue();
    const ip = nextIp();

    try {
      expect((await loginFrom(ip)).statusCode).toBe(200);
      await settle();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatchObject({
        email,
        ipAddress: ip,
        userAgent: 'ResortPro test runner',
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('says nothing the second time from the same address', async () => {
    const spy = vi.spyOn(alerts, 'alertNewSignInLocation').mockResolvedValue();
    const ip = nextIp();

    try {
      await loginFrom(ip);
      await settle();
      spy.mockClear();

      await loginFrom(ip);
      await settle();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('reports the next address that is genuinely new', async () => {
    const spy = vi.spyOn(alerts, 'alertNewSignInLocation').mockResolvedValue();
    const known = nextIp();

    try {
      await loginFrom(known);
      await settle();
      spy.mockClear();

      await loginFrom(nextIp());
      await settle();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('isNewLocation', () => {
  it('ignores a request with no address rather than guessing', async () => {
    expect(await alerts.isNewLocation(adminId, null, 'whatever')).toBe(false);
  });

  it('does not count the session that was just created', async () => {
    const ip = nextIp();
    const session = await prisma.adminSession.create({
      data: { adminUserId: adminId, ipAddress: ip, expiresAt: new Date(Date.now() + 3600_000) },
    });
    // Only this session has that address, and it is the one being excluded.
    expect(await alerts.isNewLocation(adminId, ip, session.id)).toBe(true);
  });

  it('keeps one admin\'s history out of another\'s', async () => {
    const ip = nextIp();
    await prisma.adminSession.create({
      data: { adminUserId: adminId, ipAddress: ip, expiresAt: new Date(Date.now() + 3600_000) },
    });

    const other = await prisma.adminUser.create({
      data: {
        email: `other-${run}@test.com`, passwordHash: 'x', role: 'VIEWER',
        firstName: 'Other', lastName: 'Admin',
      },
    });
    try {
      // The address is known — but not to this account.
      expect(await alerts.isNewLocation(other.id, ip, 'none')).toBe(true);
    } finally {
      await prisma.adminUser.delete({ where: { id: other.id } });
    }
  });
});

describe('a failed sign-in', () => {
  it('reports nothing — there is no session and no sign-in to report', async () => {
    const spy = vi.spyOn(alerts, 'alertNewSignInLocation').mockResolvedValue();
    try {
      const res = await app.inject({
        method: 'POST', url: '/api/admin/login', remoteAddress: nextIp(),
        payload: { email, password: 'not-the-password' },
      });
      expect(res.statusCode).toBe(401);
      await settle();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
