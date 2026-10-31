/**
 * The Cloudflare for SaaS client — the only thing that asks for a certificate.
 *
 * A resort's own domain gets HTTPS because Cloudflare issues and renews a
 * certificate for a domain we do not own. Two properties of this module matter
 * more than the rest, and neither is visible from reading a route:
 *
 *   1. It is inert without credentials. Dev and staging run with the env vars
 *      unset, and a missing token must degrade to "no SSL automation" rather
 *      than break domain verification for every owner.
 *   2. The token never leaves this file. Cloudflare's errors are passed
 *      through to owners and into logs, so an error that carried the token
 *      would publish it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isCloudflareSaasConfigured,
  createCustomHostname,
  getCustomHostname,
  deleteCustomHostname,
} from '../../src/services/cloudflare-saas';

const TOKEN = 'test-token-not-a-real-one';
const ZONE  = 'zone123';

let fetchMock: ReturnType<typeof vi.fn>;

/** A Cloudflare success envelope. */
const envelope = (result: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, errors: [], result }),
});

/** A Cloudflare failure envelope — HTTP 200 with success:false happens. */
const refusal = (errors: Array<{ code: number; message: string }>, status = 400) => ({
  ok: status < 400,
  status,
  json: async () => ({ success: false, errors, result: null }),
});

/** One custom-hostname record, as Cloudflare returns it. */
const record = (over: Record<string, unknown> = {}) => ({
  id: 'ch_1',
  hostname: 'www.theirresort.com',
  ssl: { status: 'pending_validation', validation_records: [] },
  ...over,
});

const configured = () => {
  process.env.CLOUDFLARE_API_TOKEN = TOKEN;
  process.env.CLOUDFLARE_ZONE_ID = ZONE;
};

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(envelope(record()));
  vi.stubGlobal('fetch', fetchMock);
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ZONE_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ZONE_ID;
});

describe('without credentials', () => {
  it('reports itself unconfigured', () => {
    expect(isCloudflareSaasConfigured()).toBe(false);
  });

  it.each([
    ['token only',   { CLOUDFLARE_API_TOKEN: TOKEN }],
    ['zone only',    { CLOUDFLARE_ZONE_ID: ZONE }],
  ])('is unconfigured with the %s', (_label, env) => {
    Object.assign(process.env, env);
    expect(isCloudflareSaasConfigured()).toBe(false);
  });

  it('is configured only with both', () => {
    configured();
    expect(isCloudflareSaasConfigured()).toBe(true);
  });

  it('registers nothing and contacts nobody', async () => {
    // Domain verification calls this. It must not throw, or an owner on a
    // deployment without SSL automation cannot verify their domain at all.
    await expect(createCustomHostname('www.theirresort.com')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads nothing', async () => {
    await expect(getCustomHostname('www.theirresort.com')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes nothing, and says so without throwing', async () => {
    await expect(deleteCustomHostname('www.theirresort.com')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the request it makes', () => {
  beforeEach(configured);

  const callOf = (n = 0) => fetchMock.mock.calls[n] as [string, RequestInit];

  it('posts to the configured zone', async () => {
    await createCustomHostname('www.theirresort.com');
    const [url, init] = callOf();
    expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE}/custom_hostnames`);
    expect(init.method).toBe('POST');
  });

  it('carries the token as a bearer credential', async () => {
    await createCustomHostname('www.theirresort.com');
    const headers = callOf()[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('never puts the token in the URL, where it would be logged', async () => {
    await createCustomHostname('www.theirresort.com');
    expect(callOf()[0]).not.toContain(TOKEN);
  });

  it('asks for an HTTP-validated DV certificate at TLS 1.2 or better', async () => {
    // http validation is what makes this work without the owner adding a TXT
    // record; min_tls_version keeps us off TLS 1.0/1.1 for their visitors.
    await createCustomHostname('www.theirresort.com');
    const body = JSON.parse(String(callOf()[1].body));
    expect(body).toMatchObject({
      hostname: 'www.theirresort.com',
      ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
    });
  });

  it('escapes the hostname into the query rather than pasting it', async () => {
    await getCustomHostname('a b&c.theirresort.com');
    expect(callOf()[0]).toContain('hostname=a%20b%26c.theirresort.com');
    expect(callOf()[0]).not.toContain('&c.theirresort.com');
  });
});

describe('reading a hostname back', () => {
  beforeEach(configured);

  it('is null when Cloudflare has never heard of it', async () => {
    fetchMock.mockResolvedValue(envelope([]));
    await expect(getCustomHostname('www.theirresort.com')).resolves.toBeNull();
  });

  it('returns the first match', async () => {
    fetchMock.mockResolvedValue(envelope([record({ id: 'ch_9' })]));
    const got = await getCustomHostname('www.theirresort.com');
    expect(got?.id).toBe('ch_9');
  });

  it('passes the DCV records through, so the UI can show what to add', async () => {
    fetchMock.mockResolvedValue(envelope([record({
      ssl: {
        status: 'pending_validation',
        validation_records: [{ txt_name: '_cf.theirresort.com', txt_value: 'abc', http_url: 'http://x/y', http_body: 'z' }],
      },
    })]));
    const got = await getCustomHostname('www.theirresort.com');
    expect(got?.validationRecords).toEqual([
      { txtName: '_cf.theirresort.com', txtValue: 'abc', httpUrl: 'http://x/y', httpBody: 'z' },
    ]);
  });

  it('survives a record with no ssl block at all', async () => {
    fetchMock.mockResolvedValue(envelope([{ id: 'ch_2', hostname: 'www.theirresort.com' }]));
    const got = await getCustomHostname('www.theirresort.com');
    expect(got?.sslStatus).toBe('provisioning');
    expect(got?.validationRecords).toEqual([]);
  });

  it('reports the first validation error as the reason', async () => {
    fetchMock.mockResolvedValue(envelope([record({
      ssl: { status: 'validation_timed_out', validation_errors: [{ message: 'no record found' }] },
    })]));
    const got = await getCustomHostname('www.theirresort.com');
    expect(got?.error).toBe('no record found');
    expect(got?.sslStatus).toBe('error');
  });
});

describe('mapping Cloudflare\'s SSL states onto ours', () => {
  beforeEach(configured);

  const stateOf = async (cf: string) => {
    fetchMock.mockResolvedValue(envelope([record({ ssl: { status: cf, validation_records: [] } })]));
    return (await getCustomHostname('www.theirresort.com'))?.sslStatus;
  };

  it('is active only for active', async () => {
    expect(await stateOf('active')).toBe('active');
  });

  it.each(['expired', 'deleted', 'validation_timed_out'])('treats %s as an error', async (cf) => {
    expect(await stateOf(cf)).toBe('error');
  });

  it.each(['pending_validation', 'pending_issuance', 'pending_deployment', 'initializing'])(
    'treats %s as still provisioning',
    async (cf) => {
      expect(await stateOf(cf)).toBe('provisioning');
    },
  );

  it('treats a state it has never seen as provisioning, not as a failure', async () => {
    // Cloudflare adds states. A new one must not turn a working domain red in
    // the owner's dashboard.
    expect(await stateOf('some_future_cloudflare_state')).toBe('provisioning');
  });

  it('keeps the raw state for debugging', async () => {
    fetchMock.mockResolvedValue(envelope([record({ ssl: { status: 'pending_issuance' } })]));
    const got = await getCustomHostname('www.theirresort.com');
    expect(got?.cfSslStatus).toBe('pending_issuance');
  });
});

describe('when Cloudflare refuses', () => {
  beforeEach(configured);

  it('throws with Cloudflare\'s own code and message', async () => {
    // The route passes this to the owner and writes it to sslError. A generic
    // "SSL request failed" would tell them nothing.
    fetchMock.mockResolvedValue(refusal([{ code: 1406, message: 'hostname already exists' }]));
    await expect(createCustomHostname('www.theirresort.com'))
      .rejects.toThrow(/1406 hostname already exists/);
  });

  it('never puts the token in the error', async () => {
    fetchMock.mockResolvedValue(refusal([{ code: 10000, message: 'Authentication error' }]));
    await expect(createCustomHostname('www.theirresort.com')).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(TOKEN) }) as Error,
    );
  });

  it('falls back to the status code when there are no error details', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({ success: false, errors: [], result: null }) });
    await expect(getCustomHostname('www.theirresort.com')).rejects.toThrow(/HTTP 502/);
  });

  it('treats success:false on a 200 as a failure', async () => {
    // Cloudflare answers 200 with success:false. Reading res.ok alone would
    // hand the route an empty result as though it had worked.
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false, errors: [{ code: 1, message: 'nope' }] }) });
    await expect(getCustomHostname('www.theirresort.com')).rejects.toThrow(/nope/);
  });
});

describe('deregistering', () => {
  beforeEach(configured);

  it('is false when there is nothing registered', async () => {
    fetchMock.mockResolvedValue(envelope([]));
    await expect(deleteCustomHostname('www.theirresort.com')).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the lookup only
  });

  it('deletes by the id Cloudflare gave, not by the hostname', async () => {
    fetchMock
      .mockResolvedValueOnce(envelope([record({ id: 'ch_7' })]))
      .mockResolvedValueOnce(envelope(null));
    await expect(deleteCustomHostname('www.theirresort.com')).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('/custom_hostnames/ch_7');
    expect(init.method).toBe('DELETE');
  });
});
