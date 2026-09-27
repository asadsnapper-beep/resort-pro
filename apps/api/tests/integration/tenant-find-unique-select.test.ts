/**
 * A narrow `select` on a tenant-scoped `findUnique`.
 *
 * tenantId cannot be added to a unique lookup, so the scoped client fetches the
 * row and then checks `result.tenantId`. A caller whose `select` did not ask
 * for tenantId therefore had `undefined` compared against it — and got `null`
 * for a row sitting in the table.
 *
 * It failed safe, which is why nobody noticed, and that made it worse to find:
 * a rate plan, a loyalty account, a training session, a purchase order and a
 * resort's saved payment credentials all read as "not found". In the payments
 * case it silently broke the merge that keeps a secret the owner did not
 * retype, so saving the settings page could wipe a gateway password.
 *
 * Both halves are asserted here: the row is found, and another tenant's row
 * still is not.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, tenantPrisma } from '@resort-pro/database';

const run = `fu-select-${Date.now()}`;
let mineId: string;
let theirsId: string;
let myPlanId: string;
let theirPlanId: string;
let myRoomId: string;

beforeAll(async () => {
  const mine = await prisma.tenant.create({ data: { name: 'Mine', slug: `${run}-mine` } });
  const theirs = await prisma.tenant.create({ data: { name: 'Theirs', slug: `${run}-theirs` } });
  mineId = mine.id;
  theirsId = theirs.id;

  const room = await prisma.room.create({
    data: { tenantId: mineId, number: '101', name: 'Mine 101', basePrice: 1000 },
  });
  myRoomId = room.id;
  myPlanId = (await prisma.ratePlan.create({
    data: { tenantId: mineId, roomId: room.id, name: 'Mine plan', price: 1200 },
  })).id;

  const theirRoom = await prisma.room.create({
    data: { tenantId: theirsId, number: '201', name: 'Theirs 201', basePrice: 900 },
  });
  theirPlanId = (await prisma.ratePlan.create({
    data: { tenantId: theirsId, roomId: theirRoom.id, name: 'Their plan', price: 1500 },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
});

describe('my own row, asked for narrowly', () => {
  it('is found when the select leaves tenantId out', async () => {
    const db = tenantPrisma(mineId);
    const found = await db.ratePlan.findUnique({
      where: { id: myPlanId },
      select: { id: true, name: true },
    });

    expect(found, 'a row that exists read back as null').not.toBeNull();
    expect(found).toMatchObject({ id: myPlanId, name: 'Mine plan' });
  });

  it('comes back with exactly the fields asked for, and no others', async () => {
    const db = tenantPrisma(mineId);
    const found = await db.ratePlan.findUnique({
      where: { id: myPlanId },
      select: { id: true },
    });

    // tenantId is borrowed for the check and must not be handed back — a
    // caller that selected one field should receive one field.
    expect(Object.keys(found ?? {})).toEqual(['id']);
  });

  it('is found by findUniqueOrThrow too, rather than throwing', async () => {
    const db = tenantPrisma(mineId);
    const found = await db.ratePlan.findUniqueOrThrow({
      where: { id: myPlanId },
      select: { name: true },
    });

    expect(found).toEqual({ name: 'Mine plan' });
  });

  it('still works when tenantId was asked for explicitly', async () => {
    const db = tenantPrisma(mineId);
    const found = await db.ratePlan.findUnique({
      where: { id: myPlanId },
      select: { id: true, tenantId: true },
    });

    // Asked for, so kept.
    expect(found).toMatchObject({ id: myPlanId, tenantId: mineId });
  });

  it('still works with no select at all', async () => {
    const db = tenantPrisma(mineId);
    expect(await db.room.findUnique({ where: { id: myRoomId } })).toMatchObject({ number: '101' });
  });
});

describe('somebody else\'s row', () => {
  it('is still refused with a narrow select', async () => {
    const db = tenantPrisma(mineId);
    expect(await db.ratePlan.findUnique({
      where: { id: theirPlanId },
      select: { id: true, name: true },
    })).toBeNull();
  });

  it('is still refused with no select', async () => {
    const db = tenantPrisma(mineId);
    expect(await db.ratePlan.findUnique({ where: { id: theirPlanId } })).toBeNull();
  });

  it('still throws from findUniqueOrThrow', async () => {
    const db = tenantPrisma(mineId);
    await expect(db.ratePlan.findUniqueOrThrow({
      where: { id: theirPlanId },
      select: { id: true },
    })).rejects.toThrow(/not found/i);
  });
});

describe('a row that is not there at all', () => {
  it('is null, not an error', async () => {
    const db = tenantPrisma(mineId);
    expect(await db.ratePlan.findUnique({
      where: { id: '00000000-0000-0000-0000-000000000000' },
      select: { id: true },
    })).toBeNull();
  });
});
