import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { buildApp } from '../../src/app';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';

let app: FastifyInstance;
let token = '';
let tenantId = '';
let guestId = '';
const slug = `crm-test-${Date.now()}`;
const password = 'TestPass123!';

const request = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, headers: { Authorization: `Bearer ${token}` }, payload });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const email = `owner-${slug}@test.com`;
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { resortName: 'CRM Test Resort', slug, firstName: 'CRM', lastName: 'Owner', email, password },
  });
  expect(registration.statusCode).toBe(201);
  tenantId = JSON.parse(registration.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { plan: 'ENTERPRISE', planStatus: 'active' } });
  await applyPlanFlagsToTenant(tenantId, 'ENTERPRISE');

  const guest = await prisma.guest.create({
    data: { tenantId, firstName: 'No', lastName: 'Consent', email: `guest-${slug}@test.com` },
  });
  guestId = guest.id;
  await prisma.guest.create({
    data: { tenantId, firstName: 'Second', lastName: 'Guest', email: `second-${slug}@test.com` },
  });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await app.close();
});

describe('CRM core workflows', () => {
  it('lists contacts with working pagination metadata', async () => {
    const response = await request('GET', '/api/crm/contacts?limit=1&page=1');
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body).data;
    expect(data.guests).toHaveLength(1);
    expect(data.total).toBe(2);
    expect(data.pages).toBe(2);
  });

  it('creates default templates and keeps template CRUD readable', async () => {
    const initial = await request('GET', '/api/crm/templates');
    expect(initial.statusCode).toBe(200);
    expect(JSON.parse(initial.body).data.length).toBeGreaterThan(0);

    const created = await request('POST', '/api/crm/templates', {
      name: 'CRM Integration Template', subject: 'Hello', html: '<p>Hello</p>',
    });
    expect(created.statusCode).toBe(200);
    const id = JSON.parse(created.body).data.id;

    expect((await request('PUT', `/api/crm/templates/${id}`, { subject: 'Updated' })).statusCode).toBe(200);
    const listed = JSON.parse((await request('GET', '/api/crm/templates')).body).data;
    expect(listed.find((template: { id: string }) => template.id === id).subject).toBe('Updated');
    expect((await request('DELETE', `/api/crm/templates/${id}`)).statusCode).toBe(200);
  });

  it('assigns and removes a tenant-owned guest tag', async () => {
    const created = await request('POST', '/api/crm/tags', { name: 'CRM Test VIP', color: '#123456' });
    expect(created.statusCode).toBe(200);
    const tagId = JSON.parse(created.body).data.id;

    expect((await request('POST', `/api/crm/contacts/${guestId}/tags`, { tagId, action: 'add' })).statusCode).toBe(200);
    const detail = JSON.parse((await request('GET', `/api/crm/contacts/${guestId}`)).body).data;
    expect(detail.tags.some((relation: { tag: { id: string } }) => relation.tag.id === tagId)).toBe(true);

    expect((await request('POST', `/api/crm/contacts/${guestId}/tags`, { tagId, action: 'remove' })).statusCode).toBe(200);
    expect((await request('DELETE', `/api/crm/tags/${tagId}`)).statusCode).toBe(200);
  });

  it('creates an anniversary sequence and adds a step', async () => {
    const created = await request('POST', '/api/crm/sequences', {
      name: 'Anniversary sequence', trigger: 'ANNIVERSARY',
    });
    expect(created.statusCode).toBe(200);
    const sequenceId = JSON.parse(created.body).data.id;

    const step = await request('POST', `/api/crm/sequences/${sequenceId}/steps`, {
      subject: 'Happy anniversary', html: '<p>Come back soon</p>', delayDays: 0,
    });
    expect(step.statusCode).toBe(200);

    const sequences = JSON.parse((await request('GET', '/api/crm/sequences')).body).data;
    expect(sequences.find((sequence: { id: string }) => sequence.id === sequenceId).steps).toHaveLength(1);
  });

  it('does not claim a campaign was sent when nobody has consented', async () => {
    const created = await request('POST', '/api/crm/campaigns', {
      name: 'No consent campaign', subject: 'Test', html: '<p>Test</p>',
    });
    const campaignId = JSON.parse(created.body).data.id;

    const sent = await request('POST', `/api/crm/campaigns/${campaignId}/send`, {});
    expect(sent.statusCode).toBe(409);
    expect(JSON.parse(sent.body).error).toMatch(/No explicitly subscribed guests/);

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.status).toBe('DRAFT');
  });

  it('enrolls booking-confirmed and check-in sequences from real booking events', async () => {
    const bookingSequence = await prisma.sequence.create({
      data: { tenantId, name: 'Booking event sequence', trigger: 'BOOKING_CONFIRMED' },
    });
    const checkInSequence = await prisma.sequence.create({
      data: { tenantId, name: 'Check-in event sequence', trigger: 'CHECK_IN' },
    });
    const room = await prisma.room.create({
      data: { tenantId, number: 'CRM-101', name: 'CRM Test Room', type: 'STANDARD', maxOccupancy: 2, basePrice: 1000 },
    });
    const checkIn = new Date(Date.now() + 86_400_000);
    const checkOut = new Date(Date.now() + 2 * 86_400_000);
    const created = await app.inject({
      method: 'POST', url: '/api/bookings', headers: { Authorization: `Bearer ${token}` },
      payload: {
        roomId: room.id, guestId,
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10),
        adults: 1, children: 0, source: 'DIRECT', skipEmail: true,
      },
    });
    expect(created.statusCode).toBe(201);
    const bookingId = JSON.parse(created.body).data.id;
    expect(await prisma.sequenceEnrollment.findUnique({
      where: { sequenceId_guestId: { sequenceId: bookingSequence.id, guestId } },
    })).not.toBeNull();

    const checkedIn = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-in`,
      headers: { Authorization: `Bearer ${token}` }, payload: {},
    });
    expect(checkedIn.statusCode).toBe(200);
    expect(await prisma.sequenceEnrollment.findUnique({
      where: { sequenceId_guestId: { sequenceId: checkInSequence.id, guestId } },
    })).not.toBeNull();
  });

  it('records an all-failed delivery as FAILED instead of SENT', async () => {
    await prisma.emailConsent.upsert({
      where: { guestId },
      create: { tenantId, guestId, subscribed: true },
      update: { subscribed: true, unsubscribedAt: null },
    });
    const created = await request('POST', '/api/crm/campaigns', {
      name: 'Disabled email campaign', subject: 'Test', html: '<p>Test</p>',
    });
    const campaignId = JSON.parse(created.body).data.id;

    const sent = await request('POST', `/api/crm/campaigns/${campaignId}/send`, {});
    expect(sent.statusCode).toBe(200);
    expect(JSON.parse(sent.body).data).toMatchObject({ sent: 0, failed: 1, total: 1, status: 'FAILED' });

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.status).toBe('FAILED');
    expect(campaign.sentAt).toBeNull();
  });

  it('loads tenant-isolated analytics after campaign stats exist', async () => {
    const response = await request('GET', '/api/crm/analytics');
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body).data;
    expect(data.totalContacts).toBe(2);
    expect(data.subscribed).toBe(1);
    expect(data.campaignStats).toHaveLength(1);
  });
});
