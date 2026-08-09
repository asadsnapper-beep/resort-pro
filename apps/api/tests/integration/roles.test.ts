/**
 * Role-based API permission tests
 * Verifies that each role can only access what they're allowed to.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `role-test-${Date.now()}`;
const password = 'TestPass123!';

// Tokens per role
const tokens: Record<string, string> = {};
let tenantId: string;

// ── Setup: register a tenant + create users for each role ──────────────────
beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // 1. Register as OWNER
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Role Test Resort', slug, firstName: 'Owner', lastName: 'Test', email: `owner-${slug}@test.com`, password },
  });
  expect(reg.statusCode).toBe(201);
  const regBody = JSON.parse(reg.body);
  tenantId = regBody.data.tenant.id;
  tokens.OWNER = await verifyOwnerAndLogin(app, {
    tenantId,
    email: `owner-${slug}@test.com`,
    password,
    slug,
  });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE' } });
  await applyPlanFlagsToTenant(tenantId, 'ENTERPRISE');

  // 2. Create users for each role directly in DB (faster than invite flow)
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(password, 10);

  const roles = ['MANAGER', 'SHAREHOLDER', 'RECEPTIONIST', 'STAFF', 'CHEF'] as const;
  for (const role of roles) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: `${role.toLowerCase()}-${slug}@test.com` } },
      update: {},
      create: { tenantId, email: `${role.toLowerCase()}-${slug}@test.com`, passwordHash: hash, firstName: role, lastName: 'Test', role },
    });

    const login = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: `${role.toLowerCase()}-${slug}@test.com`, password, slug },
    });
    expect(login.statusCode, `Login failed for ${role}`).toBe(200);
    tokens[role] = JSON.parse(login.body).data.token;
  }
}, 30000);

afterAll(async () => {
  // Clean up test tenant
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

// ── Helper ────────────────────────────────────────────────────────────────────
const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, role: string, payload?: object) =>
  app.inject({ method, url, headers: { Authorization: `Bearer ${tokens[role]}` }, payload });

// ── F&B Orders ────────────────────────────────────────────────────────────────
describe('F&B Orders — role permissions', () => {
  it('CHEF can GET /api/food-orders', async () => {
    const res = await req('GET', '/api/food-orders', 'CHEF');
    expect(res.statusCode).toBe(200);
  });

  it('CHEF can GET /api/food-orders/stats', async () => {
    const res = await req('GET', '/api/food-orders/stats', 'CHEF');
    expect(res.statusCode).toBe(200);
  });

  it('CHEF cannot POST /api/food-orders (create order)', async () => {
    const res = await req('POST', '/api/food-orders', 'CHEF', {
      items: [{ menuItemId: '00000000-0000-0000-0000-000000000001', quantity: 1 }],
    });
    expect(res.statusCode).toBe(403);
  });

  it('STAFF cannot GET /api/food-orders', async () => {
    const res = await req('GET', '/api/food-orders', 'STAFF');
    expect(res.statusCode).toBe(403);
  });

  it('SHAREHOLDER cannot GET /api/food-orders', async () => {
    const res = await req('GET', '/api/food-orders', 'SHAREHOLDER');
    expect(res.statusCode).toBe(403);
  });

  it('RECEPTIONIST can GET /api/food-orders', async () => {
    const res = await req('GET', '/api/food-orders', 'RECEPTIONIST');
    expect(res.statusCode).toBe(200);
  });

  it('MANAGER can POST /api/food-orders', async () => {
    // Will get 400 (no valid menu item) — NOT 403. That means permission passed.
    const res = await req('POST', '/api/food-orders', 'MANAGER', {
      items: [{ menuItemId: '00000000-0000-0000-0000-000000000001', quantity: 1 }],
    });
    expect(res.statusCode).not.toBe(403);
  });
});

// ── Housekeeping ──────────────────────────────────────────────────────────────
describe('Housekeeping — role permissions', () => {
  it('STAFF can GET /api/housekeeping', async () => {
    const res = await req('GET', '/api/housekeeping', 'STAFF');
    expect(res.statusCode).toBe(200);
  });

  it('STAFF cannot POST /api/housekeeping (create task)', async () => {
    const res = await req('POST', '/api/housekeeping', 'STAFF', {
      roomId: '00000000-0000-0000-0000-000000000001',
      type: 'DAILY',
      scheduledDate: new Date().toISOString(),
    });
    expect(res.statusCode).toBe(403);
  });

  it('CHEF cannot GET /api/housekeeping', async () => {
    const res = await req('GET', '/api/housekeeping', 'CHEF');
    expect(res.statusCode).toBe(403);
  });

  it('RECEPTIONIST can POST /api/housekeeping', async () => {
    const res = await req('POST', '/api/housekeeping', 'RECEPTIONIST', {
      roomId: '00000000-0000-0000-0000-000000000001',
      type: 'DAILY',
      scheduledDate: new Date().toISOString(),
    });
    // 400/404 (no real room) but NOT 403
    expect(res.statusCode).not.toBe(403);
  });

  it('OWNER can POST /api/housekeeping', async () => {
    const res = await req('POST', '/api/housekeeping', 'OWNER', {
      roomId: '00000000-0000-0000-0000-000000000001',
      type: 'DAILY',
      scheduledDate: new Date().toISOString(),
    });
    expect(res.statusCode).not.toBe(403);
  });
});

// ── Inventory ─────────────────────────────────────────────────────────────────
describe('Inventory — role permissions', () => {
  it('OWNER can GET /api/inventory', async () => {
    const res = await req('GET', '/api/inventory', 'OWNER');
    expect(res.statusCode).toBe(200);
  });

  it('MANAGER can GET /api/inventory', async () => {
    const res = await req('GET', '/api/inventory', 'MANAGER');
    expect(res.statusCode).toBe(200);
  });

  it('CHEF cannot GET /api/inventory', async () => {
    const res = await req('GET', '/api/inventory', 'CHEF');
    expect(res.statusCode).toBe(403);
  });

  it('SHAREHOLDER cannot GET /api/inventory', async () => {
    const res = await req('GET', '/api/inventory', 'SHAREHOLDER');
    expect(res.statusCode).toBe(403);
  });
});

// ── Team management ───────────────────────────────────────────────────────────
describe('Team management — role permissions', () => {
  it('OWNER can GET /api/tenant/team', async () => {
    const res = await req('GET', '/api/tenant/team', 'OWNER');
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.members).toBeDefined();
    expect(body.data.pendingInvites).toBeDefined();
  });

  it('MANAGER can GET /api/tenant/team', async () => {
    const res = await req('GET', '/api/tenant/team', 'MANAGER');
    expect(res.statusCode).toBe(200);
  });

  it('CHEF cannot GET /api/tenant/team', async () => {
    const res = await req('GET', '/api/tenant/team', 'CHEF');
    expect(res.statusCode).toBe(403);
  });

  it('STAFF cannot GET /api/tenant/team', async () => {
    const res = await req('GET', '/api/tenant/team', 'STAFF');
    expect(res.statusCode).toBe(403);
  });

  it('OWNER can POST /api/tenant/team/invite', async () => {
    const res = await req('POST', '/api/tenant/team/invite', 'OWNER', {
      email: `invite-test-${Date.now()}@test.com`,
      role: 'RECEPTIONIST',
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.inviteLink).toContain('/auth/invite?token=');
  });

  it('RECEPTIONIST cannot POST /api/tenant/team/invite', async () => {
    const res = await req('POST', '/api/tenant/team/invite', 'RECEPTIONIST', {
      email: `nope-${Date.now()}@test.com`,
      role: 'STAFF',
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── Reports ───────────────────────────────────────────────────────────────────
describe('Reports — role permissions', () => {
  it('OWNER can GET /api/reports/daily', async () => {
    const res = await req('GET', '/api/reports/daily', 'OWNER');
    expect(res.statusCode).toBe(200);
  });

  it('SHAREHOLDER cannot GET /api/reports/daily', async () => {
    const res = await req('GET', '/api/reports/daily', 'SHAREHOLDER');
    expect(res.statusCode).toBe(403);
  });

  it('CHEF cannot GET /api/reports/daily', async () => {
    const res = await req('GET', '/api/reports/daily', 'CHEF');
    expect(res.statusCode).toBe(403);
  });
});
