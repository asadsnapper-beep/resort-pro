/**
 * Concurrent stock movement test
 *
 * The previous implementation read currentStock, subtracted in JavaScript, and
 * wrote the result back as an absolute value alongside the movement row in a
 * Promise.all. Concurrent OUT requests therefore all read the same starting
 * figure and the last write won, so stock could end up higher than the
 * movements on record justify — and could be driven below zero despite the
 * "Insufficient stock" check.
 *
 * These tests pin the invariant that matters to a resort: whatever the API
 * accepted, stock must equal (start − sum of accepted OUTs), and must never go
 * negative.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `inv-race-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

async function makeItem(name: string, stock: number): Promise<string> {
  const res = await app.inject({
    method: 'POST', url: '/api/inventory',
    headers: { Authorization: `Bearer ${ownerToken}` },
    payload: { name, category: 'TOILETRIES', unit: 'pcs', currentStock: stock, minimumStock: 0, unitCost: 50 },
  });
  expect(res.statusCode).toBe(201);
  return JSON.parse(res.body).data.id;
}

const move = (id: string, type: 'IN' | 'OUT' | 'ADJUSTMENT', quantity: number) =>
  app.inject({
    method: 'POST', url: `/api/inventory/${id}/movement`,
    headers: { Authorization: `Bearer ${ownerToken}` },
    payload: { type, quantity },
  });

const stockOf = async (id: string) =>
  Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).currentStock);

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Inventory Race Resort', slug,
      firstName: 'Inv', lastName: 'Owner',
      email: `inv-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `inv-${slug}@test.com`, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE' } });

  // Registration writes a TenantFeatureFlag row for every flag, enabled per the
  // plan chosen at signup, and those per-tenant overrides beat plan defaults.
  // Changing `plan` afterwards therefore does not unlock a module — the flag
  // has to be flipped too, which is what an admin grant does.
  await prisma.tenantFeatureFlag.upsert({
    where:  { tenantId_flag: { tenantId, flag: 'inventory_module' } },
    update: { enabled: true },
    create: { tenantId, flag: 'inventory_module', enabled: true },
  });
}, 20000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('Concurrent inventory movements', () => {
  it('10 simultaneous OUTs of 1 from a stock of 10 all succeed and land on exactly 0', async () => {
    const id = await makeItem('Towels', 10);

    const results = await Promise.all(Array.from({ length: 10 }, () => move(id, 'OUT', 1)));
    const accepted = results.filter(r => r.statusCode === 201).length;

    expect(accepted).toBe(10);
    expect(await stockOf(id)).toBe(0);
  }, 20000);

  it('never oversells: 10 simultaneous OUTs of 2 against a stock of 10 leave stock at 0, not negative', async () => {
    const id = await makeItem('Soap Bars', 10);

    const results = await Promise.all(Array.from({ length: 10 }, () => move(id, 'OUT', 2)));
    const accepted = results.filter(r => r.statusCode === 201).length;
    const rejected = results.filter(r => r.statusCode === 400).length;

    // Only 5 of the 10 requests can be satisfied by 10 units.
    expect(accepted).toBe(5);
    expect(rejected).toBe(5);

    const stock = await stockOf(id);
    expect(stock).toBe(0);
    expect(stock).toBeGreaterThanOrEqual(0);
  }, 20000);

  it('stock always equals start minus the OUTs that were actually accepted', async () => {
    const id = await makeItem('Shampoo', 20);

    // Mixed sizes, more demand than supply.
    const sizes = [3, 5, 2, 7, 4, 6, 1, 8, 3, 5];
    const results = await Promise.all(sizes.map(q => move(id, 'OUT', q)));

    const takenFromApi = sizes.filter((_, i) => results[i]!.statusCode === 201).reduce((s, q) => s + q, 0);
    expect(await stockOf(id)).toBe(20 - takenFromApi);

    // And the movement rows agree with the stock — no accepted movement is
    // missing from the ledger, and none was recorded without moving stock.
    const movements = await prisma.inventoryMovement.findMany({ where: { inventoryItemId: id, type: 'OUT' } });
    // quantity comes back as a Prisma Decimal, so coerce before summing.
    expect(movements.reduce((s, m) => s + Number(m.quantity), 0)).toBe(takenFromApi);
  }, 20000);

  it('concurrent INs are all applied rather than overwriting each other', async () => {
    const id = await makeItem('Coffee Sachets', 0);

    const results = await Promise.all(Array.from({ length: 8 }, () => move(id, 'IN', 5)));
    expect(results.every(r => r.statusCode === 201)).toBe(true);
    expect(await stockOf(id)).toBe(40);
  }, 20000);

  it('rejects an OUT larger than stock and leaves stock untouched', async () => {
    const id = await makeItem('Slippers', 3);

    const res = await move(id, 'OUT', 5);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/insufficient/i);
    expect(await stockOf(id)).toBe(3);

    // A rejected movement must not leave a row behind.
    expect(await prisma.inventoryMovement.count({ where: { inventoryItemId: id } })).toBe(0);
  }, 20000);
});
