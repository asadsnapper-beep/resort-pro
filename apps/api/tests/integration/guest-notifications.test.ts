/**
 * A guest is told their booking is confirmed — once, on the channels the resort
 * switched on, and only when it really is confirmed.
 *
 * settings-deep-qa C-03: the notification switches were stored and nothing
 * read them. Providers are stubbed at fetch, so these assert exactly which
 * requests would have left, and to which number.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@resort-pro/database';
import { notifyBookingConfirmed } from '../../src/services/guest-notifications';

// The email provider, stubbed so a call can be counted. Hoisted by vitest.
const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/email', () => ({ sendEmail: sendEmailMock }));

const slug = `guest-notif-${Date.now()}`;
let tenantId: string;
let roomId: string;
const fetchMock = vi.fn();

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const hosts = () => fetchMock.mock.calls.map(([u]) => new URL(String(u)).host);

async function booking(opts: { status?: string; phone?: string | null } = {}) {
  const guest = await prisma.guest.create({
    data: {
      tenantId, firstName: 'Karim', lastName: 'Hossain', email: `g-${randomUUID()}@test.com`,
      phone: opts.phone === undefined ? '01712345678' : opts.phone,
    },
  });
  const b = await prisma.booking.create({
    data: {
      tenantId, roomId, guestId: guest.id,
      checkIn: new Date('2026-10-14'), checkOut: new Date('2026-10-16'),
      totalAmount: 8000, status: (opts.status ?? 'CONFIRMED') as never,
      confirmationNo: `GN-${randomUUID().slice(0, 8).toUpperCase()}`,
    },
  });
  return b.id;
}
const setTenant = (data: Record<string, unknown>) => prisma.tenant.update({ where: { id: tenantId }, data });
const rows = (bookingId: string, channel?: string) =>
  prisma.guestNotification.findMany({ where: { bookingId, ...(channel && { channel }) } });

beforeAll(async () => {
  const t = await prisma.tenant.create({ data: { name: 'Palm Resort', slug, planStatus: 'active', country: 'BD' } });
  tenantId = t.id;
  roomId = (await prisma.room.create({ data: { tenantId, number: '101', name: 'Sea View', basePrice: 4000 } })).id;
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
});

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => String(url).includes('graph.facebook.com')
    ? ok({ messages: [{ id: 'wamid.1' }] })
    : ok({ status: 'SUCCESS', status_code: 200, smsinfo: [{ reference_id: 'ref-1' }] }));
  vi.stubGlobal('fetch', fetchMock);
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ id: 're_test_1', error: null });
  await prisma.emailSettings.upsert({
    where: { tenantId }, create: { tenantId, sendConfirmation: true }, update: { sendConfirmation: true },
  });
  // Own accounts, so no platform quota or server env is involved.
  await setTenant({
    smsEnabled: true, notifBookingConfirm: true, smsMode: 'own', smsProvider: 'ssl_wireless', smsApiKey: 'k',
    waEnabled: false, waNotifBookingConfirm: true, waMode: 'own', waApiToken: 't', waPhoneNumberId: '123',
    notifLanguage: 'en',
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('a confirmed booking', () => {
  it('sends the guest one SMS, to their number with the country code', async () => {
    const id = await booking();
    await notifyBookingConfirmed(id);

    expect(hosts()).toEqual(['globalsms.sslwireless.com']);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.msisdn).toBe('8801712345678');
    expect(sent.sms).toMatch(/^Palm Resort: booking GN-.* confirmed\. Check-in 14 Oct, 2 nights\.$/);

    expect(await rows(id, 'sms')).toMatchObject([{ channel: 'sms', status: 'sent', via: 'own', providerId: 'ref-1' }]);
  });

  it('is messaged once when the same payment confirms it twice at the same moment', async () => {
    // A payment's verify callback and its webhook both call this.
    const id = await booking();
    await Promise.all([notifyBookingConfirmed(id), notifyBookingConfirmed(id), notifyBookingConfirmed(id)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await rows(id, 'sms')).toHaveLength(1);
  });

  it('is messaged once when confirmed again later', async () => {
    const id = await booking();
    await notifyBookingConfirmed(id);
    await notifyBookingConfirmed(id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('goes by WhatsApp alone when only WhatsApp is switched on', async () => {
    await setTenant({ smsEnabled: false, waEnabled: true });
    const id = await booking();
    await notifyBookingConfirmed(id);

    expect(hosts()).toEqual(['graph.facebook.com']);
    expect(await rows(id, 'whatsapp')).toMatchObject([{ channel: 'whatsapp', status: 'sent' }]);
    expect(await rows(id, 'sms')).toHaveLength(0);
  });

  it('goes by both when both are on', async () => {
    await setTenant({ waEnabled: true });
    const id = await booking();
    await notifyBookingConfirmed(id);
    expect(hosts().sort()).toEqual(['globalsms.sslwireless.com', 'graph.facebook.com']);
  });

  it('records a refusal with the provider\'s reason, and does not throw', async () => {
    fetchMock.mockImplementation(() => ok({ status: 'FAILED', status_code: 4001, error_message: 'Invalid SID' }));
    const id = await booking();

    await expect(notifyBookingConfirmed(id)).resolves.toBeUndefined();
    expect(await rows(id, 'sms')).toMatchObject([{ status: 'failed', detail: 'Invalid SID' }]);
  });
});

describe('nothing is sent', () => {
  it('for a booking still waiting for payment', async () => {
    const id = await booking({ status: 'PENDING' });
    await notifyBookingConfirmed(id);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await rows(id)).toHaveLength(0);
  });

  it('to a guest with no phone number', async () => {
    const id = await booking({ phone: null });
    await notifyBookingConfirmed(id);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('when the resort switched SMS off', async () => {
    await setTenant({ smsEnabled: false });
    const id = await booking();
    await notifyBookingConfirmed(id);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('when the resort switched this event off for SMS', async () => {
    await setTenant({ notifBookingConfirm: false });
    const id = await booking();
    await notifyBookingConfirmed(id);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('for a booking that does not exist, without throwing', async () => {
    await expect(notifyBookingConfirmed(randomUUID())).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the confirmation email', () => {
  it('reaches the guest once when the verify callback and the webhook both confirm the payment', async () => {
    // This is the bug: two confirmation emails after every gateway payment.
    const id = await booking();
    await Promise.all([notifyBookingConfirmed(id), notifyBookingConfirmed(id)]);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(await rows(id, 'email')).toMatchObject([{ status: 'sent', providerId: 're_test_1' }]);
  });

  it('is not sent again when the booking is confirmed a second time later', async () => {
    const id = await booking();
    await notifyBookingConfirmed(id);
    await notifyBookingConfirmed(id);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('is left out when the desk opted out, without stopping the SMS', async () => {
    const id = await booking();
    await notifyBookingConfirmed(id, { email: false });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(await rows(id, 'email')).toHaveLength(0);
    expect(hosts()).toEqual(['globalsms.sslwireless.com']);
  });

  it('with confirmation emails switched off, sends nothing and remembers nothing', async () => {
    // No claim is kept, so switching it back on lets a later trigger send.
    await prisma.emailSettings.update({ where: { tenantId }, data: { sendConfirmation: false } });
    const id = await booking();
    await notifyBookingConfirmed(id);

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(await rows(id, 'email')).toHaveLength(0);
  });

  it('records the provider\'s refusal', async () => {
    sendEmailMock.mockResolvedValue({ id: null, error: 'email_disabled' });
    const id = await booking();
    await notifyBookingConfirmed(id);
    expect(await rows(id, 'email')).toMatchObject([{ status: 'failed', detail: 'email_disabled' }]);
  });

  it('is still sent to a guest who has no phone number', async () => {
    const id = await booking({ phone: null });
    await notifyBookingConfirmed(id);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is not sent for a booking still waiting for payment', async () => {
    const id = await booking({ status: 'PENDING' });
    await notifyBookingConfirmed(id);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe('when the provider has a bad minute', () => {
  /**
   * The claim row exists to stop a guest being told twice. It was stopping
   * rather more than that: a failed attempt kept the row, so every later
   * trigger hit the unique key and returned silently. One flaky minute at the
   * provider meant the confirmation never arrived at all — and the webhook
   * that used to cover for the verify callback could no longer do so.
   */
  it('lets the next trigger try again, and the guest is told', async () => {
    const id = await booking();

    fetchMock.mockReturnValue(Promise.resolve(new Response('upstream down', { status: 502 })));
    await notifyBookingConfirmed(id);
    expect(await rows(id, 'sms')).toMatchObject([{ status: 'failed' }]);

    // The webhook arrives a moment after the verify callback.
    fetchMock.mockReturnValue(ok({ status: 'SUCCESS', status_code: 200, smsinfo: [{ reference_id: 'ref-2' }] }));
    await notifyBookingConfirmed(id);

    expect(await rows(id, 'sms')).toMatchObject([{ status: 'sent', providerId: 'ref-2' }]);
    expect(await rows(id, 'sms')).toHaveLength(1);
  });

  it('still never tells the guest twice once it has worked', async () => {
    const id = await booking();
    await notifyBookingConfirmed(id);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await notifyBookingConfirmed(id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves a message another trigger is in the middle of sending', async () => {
    const id = await booking();
    await prisma.guestNotification.create({
      data: { tenantId, bookingId: id, event: 'booking_confirmed', channel: 'sms', status: 'sending' },
    });

    await notifyBookingConfirmed(id);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await rows(id, 'sms')).toMatchObject([{ status: 'sending' }]);
  });

  it('takes over one that was abandoned half-sent', async () => {
    // A deploy or a crash between claiming and answering leaves the row
    // `sending` forever, which would block the guest's message for good.
    const id = await booking();
    const stale = await prisma.guestNotification.create({
      data: { tenantId, bookingId: id, event: 'booking_confirmed', channel: 'sms', status: 'sending' },
    });
    await prisma.$executeRaw`UPDATE guest_notifications SET "updatedAt" = NOW() - INTERVAL '30 minutes' WHERE id = ${stale.id}`;

    await notifyBookingConfirmed(id);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await rows(id, 'sms')).toMatchObject([{ status: 'sent' }]);
  });
});
