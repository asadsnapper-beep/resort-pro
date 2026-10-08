/**
 * The unsubscribe link cannot be tripped by a machine.
 *
 * It used to be `/crm/unsubscribe/<guest id>`, and the GET did the
 * unsubscribing (CRM QA 2026-10-07, finding 013). Mail scanners, corporate
 * security gateways and chat link-previewers fetch URLs in messages without
 * anyone clicking — so a guest could be unsubscribed by their own employer's
 * spam filter, and nobody would know why the emails stopped. The raw id was
 * the second half: ids appear in other responses, so holding one was enough
 * to opt that guest out.
 *
 * The first test here is the whole finding: fetch the link, then check the
 * guest is still subscribed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../../src/utils/unsubscribe-token';
import { keepEnv } from '../helpers/env';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `unsub-${Date.now()}`;
let tenantId: string;
let guestId: string;

const isSubscribed = async () => {
  const consent = await prisma.emailConsent.findUnique({ where: { guestId } });
  return consent?.subscribed !== false;
};

const resubscribe = () => prisma.emailConsent.deleteMany({ where: { guestId } });

keepEnv('UNSUBSCRIBE_SECRET');

beforeAll(async () => {
  process.env.UNSUBSCRIBE_SECRET = 'a-test-signing-secret-long-enough';

  app = await buildApp();
  await app.ready();

  tenantId = (await prisma.tenant.create({ data: { name: 'Unsub', slug: run } })).id;
  guestId = (await prisma.guest.create({
    data: { tenantId, firstName: 'Rafiq', lastName: 'Probe', email: `g-${run}@test.com` },
  })).id;
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('a machine following the link', () => {
  it('does not unsubscribe anybody', async () => {
    const token = signUnsubscribeToken(guestId);

    const res = await app.inject({ method: 'GET', url: `/crm/unsubscribe/${token}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Stop receiving these emails?');
    expect(await isSubscribed()).toBe(true);
  });

  it('is shown a button rather than a result', async () => {
    const res = await app.inject({
      method: 'GET', url: `/crm/unsubscribe/${signUnsubscribeToken(guestId)}`,
    });
    expect(res.body).toContain('<form method="POST"');
    expect(res.body).not.toContain("You've been unsubscribed");
  });
});

describe('a person pressing the button', () => {
  it('is unsubscribed, and told so', async () => {
    const res = await app.inject({
      method: 'POST', url: `/crm/unsubscribe/${signUnsubscribeToken(guestId)}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("You've been unsubscribed");
    expect(await isSubscribed()).toBe(false);

    await resubscribe();
  });

  it('is taken out of any sequence they were in', async () => {
    const sequence = await prisma.sequence.create({
      data: { tenantId, name: `Seq-${run}`, trigger: 'PRE_ARRIVAL' },
    });
    const enrollment = await prisma.sequenceEnrollment.create({
      data: { tenantId, sequenceId: sequence.id, guestId, status: 'ACTIVE' },
    });

    await app.inject({ method: 'POST', url: `/crm/unsubscribe/${signUnsubscribeToken(guestId)}` });

    const after = await prisma.sequenceEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(after.status).toBe('UNSUBSCRIBED');

    await resubscribe();
  });
});

describe('a guest id on its own', () => {
  it('is not a link any more — this was the other half of the finding', async () => {
    const res = await app.inject({ method: 'POST', url: `/crm/unsubscribe/${guestId}` });

    expect(res.statusCode).toBe(404);
    expect(await isSubscribed()).toBe(true);
  });
});

describe('a token that was tampered with', () => {
  it.each([
    ['a changed signature', (t: string) => `${t.split('.')[0]}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`],
    ['no signature at all', (t: string) => t.split('.')[0]],
    ['someone else\'s payload', (t: string) => `${Buffer.from('another-guest').toString('base64url')}.${t.split('.')[1]}`],
    ['empty', () => ''],
    ['nonsense', () => 'not-a-token'],
  ])('is refused: %s', async (_label, mangle) => {
    const token = mangle(signUnsubscribeToken(guestId));
    const res = await app.inject({ method: 'POST', url: `/crm/unsubscribe/${token || 'x'}` });

    expect(res.statusCode).toBe(404);
    expect(await isSubscribed()).toBe(true);
  });
});

describe('the token itself', () => {
  it('round-trips the guest it was made for', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken(guestId))).toBe(guestId);
  });

  it('does not verify under a different secret', () => {
    const token = signUnsubscribeToken(guestId);
    const previous = process.env.UNSUBSCRIBE_SECRET;
    process.env.UNSUBSCRIBE_SECRET = 'a-completely-different-secret-here';
    try {
      expect(verifyUnsubscribeToken(token)).toBeNull();
    } finally {
      process.env.UNSUBSCRIBE_SECRET = previous;
    }
  });
});
