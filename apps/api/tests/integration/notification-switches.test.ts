/**
 * An owner can switch a notification on for SMS and off for WhatsApp.
 *
 * settings-deep-qa M-01: the Settings table had an SMS column and a WhatsApp
 * column, both bound to one field per event, so ticking one ticked the other
 * and there was no way to want only one. WhatsApp now has its own six fields.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `notif-switches-${Date.now()}`;
const password = 'TestPass123!';
let token: string;

const EVENTS = [
  'BookingConfirm', 'PaymentReceived', 'CheckinReminder', 'CheckoutRemind', 'Cancellation', 'InvoiceSent',
] as const;

const auth = () => ({ Authorization: `Bearer ${token}` });
const read = async () =>
  JSON.parse((await app.inject({ method: 'GET', url: '/api/tenant/sms-settings', headers: auth() })).body).data;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Notification Switches', slug, firstName: 'Owner', lastName: 'Test', email: `owner-${slug}@test.com`, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  // A fresh registration is 'incomplete' until it pays, and the subscription
  // guard answers every write with 402 until then — which is what the first run
  // of this file hit. Activate it, as the other Settings tests do.
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'STARTER' } });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('each event, independently per channel', () => {
  for (const event of EVENTS) {
    it(`${event}: SMS on, WhatsApp off, and back the other way`, async () => {
      const sms = `notif${event}`;
      const wa = `waNotif${event}`;

      let res = await app.inject({ method: 'PATCH', url: '/api/tenant/sms-settings', headers: auth(), payload: { [sms]: true, [wa]: false } });
      expect(res.statusCode, res.body).toBe(200);
      let data = await read();
      expect([data[sms], data[wa]]).toEqual([true, false]);

      res = await app.inject({ method: 'PATCH', url: '/api/tenant/sms-settings', headers: auth(), payload: { [sms]: false, [wa]: true } });
      expect(res.statusCode, res.body).toBe(200);
      data = await read();
      expect([data[sms], data[wa]]).toEqual([false, true]);
    });
  }
});

it('changing only WhatsApp leaves SMS exactly as it was', async () => {
  await app.inject({ method: 'PATCH', url: '/api/tenant/sms-settings', headers: auth(), payload: { notifBookingConfirm: true } });
  await app.inject({ method: 'PATCH', url: '/api/tenant/sms-settings', headers: auth(), payload: { waNotifBookingConfirm: false } });
  const data = await read();
  expect(data.notifBookingConfirm).toBe(true);
  expect(data.waNotifBookingConfirm).toBe(false);
});
