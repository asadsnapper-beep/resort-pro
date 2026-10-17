/**
 * The two sequences that fire on a date actually find somebody.
 *
 * ANNIVERSARY was offered by the UI, listed in the Prisma enum, and rejected by
 * the API validator — and the form threw the 400 away, so choosing it simply
 * did nothing (CRM QA 2026-10-07, finding 007).
 *
 * BIRTHDAY was accepted and then enrolled nobody. It searched `notes` for the
 * string `birthday:MM-DD`, with a comment in the code saying "in a real
 * implementation you'd have a dob field on Guest" — and `Guest.dateOfBirth` was
 * there all along, which the daily runner used. One feature, two sources,
 * opposite answers (finding 011).
 *
 * So the test that matters is not "the trigger is accepted". It is "a guest
 * with that date ends up enrolled".
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@resort-pro/database';
import { runDailyTriggers } from '../../src/services/automation';

const run = `datetrig-${Date.now()}`;
let tenantId: string;
let roomId: string;

/** The day the triggers look at: three days from now. */
const target = new Date(Date.now() + 3 * 86400000);

const makeGuest = async (name: string, dateOfBirth?: Date) => (await prisma.guest.create({
  data: {
    tenantId, firstName: name, lastName: 'Probe',
    email: `${name}-${run}@test.com`, dateOfBirth,
  },
})).id;

const enrolledIn = async (sequenceId: string) => {
  const rows = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId }, select: { guestId: true },
  });
  return rows.map((r) => r.guestId);
};

beforeAll(async () => {
  tenantId = (await prisma.tenant.create({ data: { name: 'Triggers', slug: run } })).id;
  roomId = (await prisma.room.create({
    data: { tenantId, number: `T-${run}`.slice(0, 12), name: 'Room', basePrice: 1000 },
  })).id;
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
});

describe('a birthday sequence', () => {
  it('enrols the guest whose birthday it is, from the real column', async () => {
    // Born on the target day, some years ago.
    const birthday = new Date(Date.UTC(1990, target.getUTCMonth(), target.getUTCDate()));
    const guestId = await makeGuest('Birthday', birthday);
    const other = await makeGuest('NoBirthday');

    const seq = await prisma.sequence.create({
      data: { tenantId, name: `B-${run}`, trigger: 'BIRTHDAY', status: 'ACTIVE' },
    });

    await runDailyTriggers();

    const enrolled = await enrolledIn(seq.id);
    expect(enrolled).toContain(guestId);
    expect(enrolled).not.toContain(other);
  });

  it('does not enrol the same guest twice in one year', async () => {
    const birthday = new Date(Date.UTC(1985, target.getUTCMonth(), target.getUTCDate()));
    await makeGuest('Repeat', birthday);
    const seq = await prisma.sequence.create({
      data: { tenantId, name: `B2-${run}`, trigger: 'BIRTHDAY', status: 'ACTIVE' },
    });

    await runDailyTriggers();
    const first = (await enrolledIn(seq.id)).length;
    await runDailyTriggers();

    expect((await enrolledIn(seq.id)).length).toBe(first);
  });

  it('leaves out a guest who has opted out', async () => {
    const birthday = new Date(Date.UTC(1992, target.getUTCMonth(), target.getUTCDate()));
    const guestId = await makeGuest('OptedOut', birthday);
    await prisma.emailConsent.create({ data: { tenantId, guestId, subscribed: false } });

    const seq = await prisma.sequence.create({
      data: { tenantId, name: `B3-${run}`, trigger: 'BIRTHDAY', status: 'ACTIVE' },
    });
    await runDailyTriggers();

    expect(await enrolledIn(seq.id)).not.toContain(guestId);
  });
});

describe('an anniversary sequence', () => {
  it('enrols a guest on the anniversary of their first stay', async () => {
    const guestId = await makeGuest('Anniversary');

    // Checked out on this day, two years ago.
    const firstStay = new Date(Date.UTC(
      target.getUTCFullYear() - 2, target.getUTCMonth(), target.getUTCDate(),
    ));
    await prisma.booking.create({
      data: {
        tenantId, roomId, guestId,
        checkIn: new Date(firstStay.getTime() - 86400000),
        checkOut: firstStay,
        status: 'CHECKED_OUT', totalAmount: 5000,
        confirmationNo: `A-${run}`.slice(0, 20),
      },
    });

    const seq = await prisma.sequence.create({
      data: { tenantId, name: `A-${run}`, trigger: 'ANNIVERSARY', status: 'ACTIVE' },
    });

    await runDailyTriggers();

    expect(await enrolledIn(seq.id)).toContain(guestId);
  });

  it('leaves out a guest who has never stayed', async () => {
    const guestId = await makeGuest('NeverStayed');
    const seq = await prisma.sequence.create({
      data: { tenantId, name: `A2-${run}`, trigger: 'ANNIVERSARY', status: 'ACTIVE' },
    });

    await runDailyTriggers();

    expect(await enrolledIn(seq.id)).not.toContain(guestId);
  });
});

describe('a paused sequence', () => {
  it('enrols nobody', async () => {
    const birthday = new Date(Date.UTC(1988, target.getUTCMonth(), target.getUTCDate()));
    await makeGuest('Paused', birthday);
    const seq = await prisma.sequence.create({
      data: { tenantId, name: `P-${run}`, trigger: 'BIRTHDAY', status: 'PAUSED' },
    });

    await runDailyTriggers();

    expect(await enrolledIn(seq.id)).toHaveLength(0);
  });
});
