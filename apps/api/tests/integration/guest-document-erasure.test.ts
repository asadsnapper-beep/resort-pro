/**
 * A guest's passport actually leaving the disk.
 *
 * `GuestDocument` cascades from `Guest` and from `Tenant`, so every path that
 * removed either took the rows and left the photographs behind. Staging was
 * holding four orphaned ID scans against zero rows — nothing in the database
 * knew they existed, and nothing would ever delete them.
 *
 * The worst of the paths was GDPR erasure: a resort asks to be erased, every
 * name becomes "Deleted Resort #ABC123", and its guests' passports stay
 * readable in full. That is a change of label, not anonymisation.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const deleteFromStorage = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../src/services/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/storage')>()),
  deleteFromStorage,
}));

import { prisma } from '@resort-pro/database';
import { anonymizeTenant } from '../../src/utils/gdpr';
import { purgeGuestDocumentFiles } from '../../src/utils/guest-documents';

const run = `doc-erase-${Date.now()}`;
let tenantId: string;

async function guestWithPassport(key: string) {
  const guest = await prisma.guest.create({
    data: { tenantId, firstName: 'Karim', lastName: 'Hossain', email: `g-${randomUUID()}@test.com` },
  });
  await prisma.guestDocument.create({
    data: {
      tenantId, guestId: guest.id, docType: 'PASSPORT',
      imageUrl: `/uploads/${tenantId}/guest-docs/${key}.jpg`,
    },
  });
  return guest.id;
}

beforeAll(async () => {
  const t = await prisma.tenant.create({ data: { name: 'Erasure', slug: run, planStatus: 'active' } });
  tenantId = t.id;
}, 30000);

beforeEach(async () => {
  deleteFromStorage.mockClear();
  await prisma.guestDocument.deleteMany({ where: { tenantId } });
  await prisma.guest.deleteMany({ where: { tenantId } });
  await prisma.tenant.update({ where: { id: tenantId }, data: { gdprAnonymizedAt: null, deletedAt: null } });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
});

describe('purging the files behind guest documents', () => {
  it('deletes every scan a resort holds', async () => {
    await guestWithPassport('one');
    await guestWithPassport('two');

    const result = await purgeGuestDocumentFiles({ tenantId });

    expect(result).toMatchObject({ removed: 2, failed: 0 });
    expect(deleteFromStorage).toHaveBeenCalledTimes(2);
    expect(deleteFromStorage.mock.calls.map((c) => c[0]).sort())
      .toEqual([`${tenantId}/guest-docs/one.jpg`, `${tenantId}/guest-docs/two.jpg`]);
  });

  it('narrows to one guest when asked for one guest', async () => {
    const mine = await guestWithPassport('mine');
    await guestWithPassport('someone-else');

    await purgeGuestDocumentFiles({ guestId: mine });

    expect(deleteFromStorage).toHaveBeenCalledTimes(1);
    expect(deleteFromStorage.mock.calls[0][0]).toContain('mine.jpg');
  });

  it('counts a file it could not delete instead of pretending', async () => {
    await guestWithPassport('stubborn');
    deleteFromStorage.mockRejectedValueOnce(new Error('bucket unreachable'));

    expect(await purgeGuestDocumentFiles({ tenantId })).toMatchObject({ removed: 0, failed: 1 });
  });

  it('keeps going after one file fails, rather than abandoning the rest', async () => {
    await guestWithPassport('first');
    await guestWithPassport('second');
    deleteFromStorage.mockRejectedValueOnce(new Error('transient'));

    expect(await purgeGuestDocumentFiles({ tenantId })).toMatchObject({ removed: 1, failed: 1 });
  });
});

describe('erasing a resort under GDPR', () => {
  it('takes the identity documents with it, files and rows', async () => {
    await guestWithPassport('passport');

    await anonymizeTenant(tenantId);

    expect(deleteFromStorage).toHaveBeenCalledTimes(1);
    expect(await prisma.guestDocument.count({ where: { tenantId } })).toBe(0);
  });

  it('does it before the names are scrambled, so the files can still be found', async () => {
    await guestWithPassport('ordering');
    // The key is derived from the URL on the row. Anonymising first and
    // deleting after would work too — but only until a future change drops
    // the rows as part of the scrubbing, and then the files are unreachable.
    await anonymizeTenant(tenantId);

    expect(deleteFromStorage.mock.calls[0][0]).toBe(`${tenantId}/guest-docs/ordering.jpg`);
  });
});
