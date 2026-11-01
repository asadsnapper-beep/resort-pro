/**
 * That the table the screens read is the table the API enforces.
 *
 * The rooms page and detail sheet offered Add Room, Edit Room and Delete to
 * everybody who could reach them, while the API required Owner or Manager to
 * create or edit and Owner to delete. So a Receptionist filled in the whole
 * Add Room form and was handed a 403 at the end of it.
 * (Room Management QA 2026-10-28, RM-005.)
 *
 * The screens are fixed in apps/web — but hiding a button is only half of it,
 * because a client-side copy of a permission drifts away from the server's,
 * and the copy that drifts *wide* is the one that offers a dead control again.
 * So there is no copy: `ROOM_CAPABILITIES` in @resort-pro/types is handed
 * straight to `requireRole`, and the screens ask the same object.
 *
 * This file pins the server half — what each role is actually allowed —
 * against the table itself, so widening one of those arrays by accident is a
 * failing test rather than a quiet hole. The matching browser-side assertions
 * are in apps/web/tests/unit/room-controls-by-role.test.tsx.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma, type Prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import { ROOM_CAPABILITIES, type UserRole } from '@resort-pro/types';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-caps-${Date.now()}`;
const password = 'TestPass123!';
let tenantId: string;

const body = (res: { body: string }) => JSON.parse(res.body);
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Every role that can reach the rooms screens at all. */
const ROLES = ['OWNER', 'MANAGER', 'RECEPTIONIST'] as const;
const token: Record<string, string> = {};

let n = 0;
const makeRoom = async () => {
  const res = await app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(token.OWNER),
    payload: {
      number: `${700 + n++}`, name: 'Caps Room', type: 'STANDARD',
      maxOccupancy: 2, basePrice: 2500,
    },
  });
  if (res.statusCode !== 201) throw new Error(`room fixture failed: ${res.body}`);
  return body(res).data.id as string;
};

/** The four things the rooms API lets somebody *do*, one request each. */
const attempt = {
  create: (role: string) =>
    app.inject({
      method: 'POST', url: '/api/rooms', headers: auth(token[role]),
      payload: {
        number: `${800 + n++}`, name: 'Attempt', type: 'STANDARD',
        maxOccupancy: 2, basePrice: 2500,
      },
    }),
  update: async (role: string) =>
    app.inject({
      method: 'PATCH', url: `/api/rooms/${await makeRoom()}`,
      headers: auth(token[role]), payload: { name: 'Renamed' },
    }),
  delete: async (role: string) =>
    app.inject({
      method: 'DELETE', url: `/api/rooms/${await makeRoom()}`, headers: auth(token[role]),
    }),
  changeStatus: async (role: string) =>
    app.inject({
      method: 'PATCH', url: `/api/rooms/${await makeRoom()}/status`,
      headers: auth(token[role]), payload: { status: 'CLEANING' },
    }),
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Capabilities', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  tenantId = body(reg).data.tenant.id;
  token.OWNER = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'ENTERPRISE', planStatus: 'active' },
  });
  await applyPlanFlagsToTenant(tenantId, 'ENTERPRISE');

  const bcrypt = await import('bcryptjs');
  for (const role of ['MANAGER', 'RECEPTIONIST'] as const) {
    const email = `${role.toLowerCase()}-${run}@test.com`;
    await prisma.user.create({
      data: {
        tenantId, email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: role, lastName: 'Test',
        role: role as Prisma.UserCreateInput['role'],
        emailVerifiedAt: new Date(),
      },
    });
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login', payload: { email, password, slug: run },
    });
    if (login.statusCode !== 200) throw new Error(`${role} login failed: ${login.body}`);
    token[role] = body(login).data.token;
  }
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('the API enforces exactly what the table says', () => {
  // Generated from the table rather than retyped from it. Widening one of
  // those arrays and forgetting the server is no longer possible: the case
  // for the newly-allowed role appears here by itself and has to pass.
  for (const capability of Object.keys(ROOM_CAPABILITIES) as (keyof typeof ROOM_CAPABILITIES)[]) {
    for (const role of ROLES) {
      const allowed = (ROOM_CAPABILITIES[capability] as readonly UserRole[]).includes(role);

      it(`${allowed ? 'lets' : 'refuses'} a ${role} ${capability} a room`, async () => {
        const res = await attempt[capability](role);

        if (allowed) {
          expect(res.statusCode, res.body).toBeLessThan(300);
        } else {
          expect(res.statusCode, res.body).toBe(403);
        }
      }, 20000);
    }
  }
});

describe('the specific journey the audit walked', () => {
  it('refuses a receptionist Add Room with a 403, as it always did', async () => {
    // Unchanged on purpose. The API was never the defect — offering the button
    // was. This is here so that "hide the control" can never be mistaken for
    // permission to relax the check behind it.
    const res = await attempt.create('RECEPTIONIST');

    expect(res.statusCode).toBe(403);
  });

  it('still lets that receptionist change a room status', async () => {
    const res = await attempt.changeStatus('RECEPTIONIST');

    expect(res.statusCode).toBe(200);
  });
});
