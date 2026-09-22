/**
 * Who pays for a message, and what the owner is told when one does not go.
 *
 * The providers are mocked at fetch, so these run offline and assert two
 * things at once: what came back, and whether a request left at all. The
 * second matters as much as the first — an "own account" tenant with missing
 * credentials used to fall through to ResortPro's platform account, where the
 * message was sent on ResortPro's bill and counted against nobody's quota.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendSms, sendWhatsApp } from '../../src/services/messaging';
import { keepEnv } from '../helpers/env';

// These four are set and unset all through this file. Every test file shares
// one process, so without this they stay changed for whatever runs next.
keepEnv('SSL_WIRELESS_API_KEY', 'SSL_WIRELESS_SENDER_ID', 'META_WA_TOKEN', 'META_WA_PHONE_NUMBER_ID');

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const hosts = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)).host);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  delete process.env.SSL_WIRELESS_API_KEY;
  delete process.env.SSL_WIRELESS_SENDER_ID;
  delete process.env.META_WA_TOKEN;
  delete process.env.META_WA_PHONE_NUMBER_ID;
});
afterEach(() => vi.unstubAllGlobals());

describe('a resort using its own SMS account', () => {
  const own = { smsMode: 'own', smsProvider: 'ssl_wireless', smsApiKey: 'resort-key', smsSenderId: 'PALMRESORT' };

  it('sends through its own credentials', async () => {
    process.env.SSL_WIRELESS_API_KEY = 'platform-key';
    fetchMock.mockReturnValue(reply(200, { status: 'SUCCESS', status_code: 200, smsinfo: [{ reference_id: 'ref-1' }] }));

    const result = await sendSms(own, '+8801712345678', 'hi');

    expect(result).toEqual({ delivered: true, via: 'own', provider: 'ssl_wireless', id: 'ref-1' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.api_token).toBe('resort-key');
    expect(body.sid).toBe('PALMRESORT');
    expect(body.msisdn).toBe('8801712345678');
  });

  it('with its key missing, does not fall back to the platform account', async () => {
    process.env.SSL_WIRELESS_API_KEY = 'platform-key';

    const result = await sendSms({ ...own, smsApiKey: null }, '+8801712345678', 'hi');

    expect(result).toMatchObject({ delivered: false, reason: 'not_configured', via: 'own' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('choosing Alpha.Net says it is not built, and sends nothing on anyone\'s account', async () => {
    process.env.SSL_WIRELESS_API_KEY = 'platform-key';

    const result = await sendSms({ ...own, smsProvider: 'alpha_net' }, '+8801712345678', 'hi');

    expect(result).toMatchObject({ delivered: false, reason: 'unsupported_provider', via: 'own', provider: 'alpha_net' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the provider\'s own reason through when it refuses', async () => {
    fetchMock.mockReturnValue(reply(200, { status: 'FAILED', status_code: 4001, error_message: 'Invalid SID' }));

    const result = await sendSms(own, '+8801712345678', 'hi');

    expect(result).toMatchObject({ delivered: false, reason: 'rejected', detail: 'Invalid SID' });
  });

  it('reports an unreachable provider as a refusal with the reason, not a crash', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const result = await sendSms(own, '+8801712345678', 'hi');

    expect(result).toMatchObject({ delivered: false, reason: 'rejected' });
    expect((result as { detail: string }).detail).toContain('ECONNRESET');
  });
});

describe('a resort using Twilio', () => {
  const twilio = { smsMode: 'own', smsProvider: 'twilio', smsApiKey: 'AC123', smsApiSecret: 'tok', smsSenderId: '+15550001111' };

  it('counts it sent only when Twilio returns a message sid', async () => {
    fetchMock.mockReturnValue(reply(201, { sid: 'SM999', status: 'queued' }));
    expect(await sendSms(twilio, '+447700900123', 'hi')).toEqual({ delivered: true, via: 'own', provider: 'twilio', id: 'SM999' });
  });

  it('does not count a 2xx with no message sid as sent', async () => {
    // A success status alone proves nothing reached Twilio's queue — a proxy or
    // a captive portal answers 200 too. Only a sid means Twilio has the message.
    fetchMock.mockReturnValue(reply(200, { status: 'queued' }));
    expect(await sendSms(twilio, '+447700900123', 'hi')).toMatchObject({ delivered: false, reason: 'rejected' });
  });

  it('passes Twilio\'s error message through', async () => {
    fetchMock.mockReturnValue(reply(400, { code: 21211, message: "The 'To' number is not a valid phone number." }));
    expect(await sendSms(twilio, 'nonsense', 'hi')).toMatchObject({
      delivered: false, reason: 'rejected', detail: "The 'To' number is not a valid phone number.",
    });
  });

  it('needs the auth token as well as the account sid', async () => {
    const result = await sendSms({ ...twilio, smsApiSecret: null }, '+447700900123', 'hi');
    expect(result).toMatchObject({ delivered: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('a resort on the platform account', () => {
  it('is told plainly when the server has no account configured', async () => {
    const result = await sendSms({ smsMode: 'platform' }, '+8801712345678', 'hi');
    expect(result).toMatchObject({ delivered: false, reason: 'not_configured', via: 'platform' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends with the server\'s key when one is configured', async () => {
    process.env.SSL_WIRELESS_API_KEY = 'platform-key';
    fetchMock.mockReturnValue(reply(200, { status: 'SUCCESS', status_code: 200 }));

    const result = await sendSms({ smsMode: 'platform', smsApiKey: 'ignored-resort-key' }, '+8801712345678', 'hi');

    expect(result).toMatchObject({ delivered: true, via: 'platform' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).api_token).toBe('platform-key');
  });
});

describe('WhatsApp', () => {
  const own = { waMode: 'own', waApiToken: 'EAAG-token', waPhoneNumberId: '1234567890' };

  it('counts it sent when Meta returns a message id', async () => {
    fetchMock.mockReturnValue(reply(200, { messages: [{ id: 'wamid.ABC' }] }));
    expect(await sendWhatsApp(own, '+8801712345678', 'hi')).toEqual({ delivered: true, via: 'own', provider: 'meta', id: 'wamid.ABC' });
    expect(hosts()).toEqual(['graph.facebook.com']);
  });

  it('explains the 24-hour rule instead of passing on Meta\'s opaque refusal', async () => {
    fetchMock.mockReturnValue(reply(400, { error: { code: 131047, message: 'Re-engagement message' } }));
    const result = await sendWhatsApp(own, '+8801712345678', 'hi');
    expect(result).toMatchObject({ delivered: false, reason: 'rejected' });
    expect((result as { detail: string }).detail).toMatch(/24 hours/);
    expect((result as { detail: string }).detail).toMatch(/template/);
  });

  it('passes other Meta errors through as they are', async () => {
    fetchMock.mockReturnValue(reply(401, { error: { code: 190, message: 'Invalid OAuth access token.' } }));
    expect(await sendWhatsApp(own, '+8801712345678', 'hi')).toMatchObject({ detail: 'Invalid OAuth access token.' });
  });

  it('with its own token missing, does not fall back to the platform account', async () => {
    process.env.META_WA_TOKEN = 'platform-token';
    process.env.META_WA_PHONE_NUMBER_ID = '999';
    const result = await sendWhatsApp({ ...own, waApiToken: null }, '+8801712345678', 'hi');
    expect(result).toMatchObject({ delivered: false, reason: 'not_configured', via: 'own' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
