/**
 * The custom-domain routes, on a deployment with no SSL automation.
 *
 * This is the configuration every environment except production runs in:
 * CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID unset. It is also the one where
 * the old behaviour was most misleading — `POST /domain/provision-ssl` wrote
 * `sslStatus: 'provisioning'` and handed back a webhook URL
 * (`/api/tenant/domain/ssl-webhook`) that has never existed as a route, so the
 * status sat at "provisioning" forever and the owner was told to wait for a
 * callback that could not arrive. (Website Builder QA 2026-10-28, WB-008.)
 *
 * Hostnames here end in `.invalid`, which is reserved and never resolves, so
 * nothing in this file touches the network: DNS verification refuses it and
 * the HTTPS probe's guard refuses it before a socket is opened.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `custom-domain-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let otherTenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

const saveDomain = (domain: string | null) =>
  app.inject({ method: 'PUT', url: '/api/tenant/domain', headers: auth(), payload: { domain } });

const verifyDomain = () =>
  app.inject({ method: 'POST', url: '/api/tenant/domain/verify', headers: auth() });

const provisionSsl = () =>
  app.inject({ method: 'POST', url: '/api/tenant/domain/provision-ssl', headers: auth() });

const domainStatus = () =>
  app.inject({ method: 'GET', url: '/api/tenant/domain/status', headers: auth() });

const body = (res: { body: string }) => JSON.parse(res.body);

/** Turn the paid custom_domain flag on or off for this tenant. */
const setFlag = (enabled: boolean) =>
  prisma.tenantFeatureFlag.upsert({
    where: { tenantId_flag: { tenantId, flag: 'custom_domain' } },
    update: { enabled },
    create: { tenantId, flag: 'custom_domain', enabled },
  });

/** Put the tenant where only DNS has succeeded, without needing real DNS. */
const asVerified = (domain: string) =>
  prisma.tenant.update({
    where: { id: tenantId },
    data: { customDomain: domain, domainVerified: true, domainVerifiedAt: new Date() },
  });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Custom Domain Test', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  tenantId = body(reg).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });

  // custom_domain is a paid flag, and registration writes a per-tenant
  // override row for every flag at the FREE level. Overrides beat plan
  // defaults, so raising the plan alone leaves all three write routes at 403 —
  // the flag has to be set the way the entitlement code calls explicit.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'ENTERPRISE', planStatus: 'active' },
  });
  await setFlag(true);

  otherTenantId = (await prisma.tenant.create({
    data: { name: 'Someone Else', slug: `${run}-other`, customDomain: 'taken.invalid' },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('PUT /api/tenant/domain', () => {
  it('saves a domain and asks for a CNAME', async () => {
    const res = await saveDomain('mine.invalid');
    expect(res.statusCode).toBe(200);
    const d = body(res).data;
    expect(d.customDomain).toBe('mine.invalid');
    expect(d.domainVerified).toBe(false);
    expect(d.cnameTarget).toBe(`${run}.resortpro.site`);
  });

  it('no longer offers an A record', async () => {
    // An A record points straight at the server, bypassing Cloudflare, so the
    // domain verifies and then serves a certificate error forever. Telling an
    // owner it is an equal option is how they end up in that state.
    const d = body(await saveDomain('mine.invalid')).data;
    expect(d.aRecord).toBeUndefined();
    expect(d.instructions.join(' ')).not.toMatch(/A record/i);
    expect(d.instructions.join(' ')).toMatch(/CNAME/);
  });

  it('refuses a domain another resort already connected', async () => {
    const res = await saveDomain('taken.invalid');
    expect(res.statusCode).toBe(409);
    expect(body(res).error).toMatch(/already connected/i);
  });

  it('resets the certificate state when the domain changes', async () => {
    // The previous domain's certificate does not cover the new one. Leaving
    // sslStatus at 'active' would show a green banner for a domain that has
    // never been issued anything.
    await asVerified('old.invalid');
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { sslStatus: 'active', sslProvisionedAt: new Date(), sslExpiresAt: new Date(), sslError: 'stale' },
    });

    await saveDomain('new.invalid');

    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { sslStatus: true, sslProvisionedAt: true, sslExpiresAt: true, sslError: true, domainVerified: true },
    });
    expect(t).toMatchObject({
      sslStatus: 'none', sslProvisionedAt: null, sslExpiresAt: null, sslError: null, domainVerified: false,
    });
  });

  it('clears the domain when given null', async () => {
    const res = await saveDomain(null);
    expect(res.statusCode).toBe(200);
    expect(body(res).data.customDomain).toBeNull();
    expect(body(res).data.instructions).toEqual([]);
  });
});

describe('POST /api/tenant/domain/verify', () => {
  it('refuses when no domain is set', async () => {
    await saveDomain(null);
    const res = await verifyDomain();
    expect(res.statusCode).toBe(400);
    expect(body(res).error).toMatch(/no custom domain/i);
  });

  it('does not mark a domain verified when DNS does not point here', async () => {
    await saveDomain('mine.invalid');
    const res = await verifyDomain();
    expect(res.statusCode).toBe(422);
    expect(body(res).message).toMatch(/CNAME/);

    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { domainVerified: true } });
    expect(t?.domainVerified).toBe(false);
  });
});

describe('POST /api/tenant/domain/provision-ssl', () => {
  it('says SSL automation is not configured instead of pretending', async () => {
    // What this replaced: 200, sslStatus written to 'provisioning', and a
    // webhook URL for a route that does not exist. The owner waited forever.
    await asVerified('mine.invalid');
    const res = await provisionSsl();
    expect(res.statusCode).toBe(503);
    expect(body(res).error).toMatch(/not configured/i);
  });

  it('leaves the stored status alone when it cannot do anything', async () => {
    await asVerified('mine.invalid');
    await prisma.tenant.update({ where: { id: tenantId }, data: { sslStatus: 'none' } });
    await provisionSsl();
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { sslStatus: true } });
    expect(t?.sslStatus).toBe('none');
  });

  it('still requires DNS first', async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { customDomain: 'mine.invalid', domainVerified: false },
    });
    const res = await provisionSsl();
    expect(res.statusCode).toBe(400);
    expect(body(res).error).toMatch(/verified/i);
  });

  it('refuses when no domain is configured at all', async () => {
    await saveDomain(null);
    const res = await provisionSsl();
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/tenant/domain/status', () => {
  it('reports DNS and HTTPS as two separate things', async () => {
    await asVerified('mine.invalid');
    const d = body(await domainStatus()).data;
    expect(d.domainVerified).toBe(true);
    expect(d.https).toBeDefined();
    expect(d.https.live).toBe(false);
  });

  it('does not call a verified domain live', async () => {
    // The whole of WB-008 in one assertion: DNS resolving says nothing about
    // whether a certificate exists, and `.invalid` can never serve one.
    await asVerified('mine.invalid');
    const d = body(await domainStatus()).data;
    expect(d.https.live).toBe(false);
    expect(d.https.reachable).toBe(false);
  });

  it('reports a reserved hostname as unreachable rather than opening a socket', async () => {
    // The probe's guard answers before any connection. A result here that
    // claimed `reachable` would mean something was actually contacted.
    await asVerified('nothing-here.invalid');
    const d = body(await domainStatus()).data;
    expect(d.https.reachable).toBe(false);
    expect(d.https.error).toBeTruthy();
  });

  it('probes nothing at all when DNS has not been verified', async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { customDomain: 'mine.invalid', domainVerified: false },
    });
    const d = body(await domainStatus()).data;
    expect(d.https).toEqual({ live: false, reachable: false, expiresAt: null, daysUntilExpiry: null, error: null });
  });

  it('still gives the CNAME target, which is what the owner has to add', async () => {
    await asVerified('mine.invalid');
    const d = body(await domainStatus()).data;
    expect(d.cnameTarget).toBe(`${run}.resortpro.site`);
  });

  it('no longer hands back a server IP to point an A record at', async () => {
    await asVerified('mine.invalid');
    const d = body(await domainStatus()).data;
    expect(d.aRecord).toBeUndefined();
  });

  it('leaks no other resort\'s domain', async () => {
    await asVerified('mine.invalid');
    expect((await domainStatus()).body).not.toContain('taken.invalid');
  });
});

describe('who may touch any of this', () => {
  it('refuses a request with no token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tenant/domain/status' });
    expect(res.statusCode).toBe(401);
  });

  it('refuses a resort that is not entitled to custom domains', async () => {
    await setFlag(false);
    const res = await saveDomain('mine.invalid');
    expect(res.statusCode).toBe(403);
    expect(body(res).code).toBe('PLAN_UPGRADE_REQUIRED');
    await setFlag(true);
  });

  it('gates provisioning on the same flag, not just saving', async () => {
    await setFlag(false);
    expect((await provisionSsl()).statusCode).toBe(403);
    expect((await verifyDomain()).statusCode).toBe(403);
    await setFlag(true);
  });

  it('still lets a manager read the status, which carries no secrets', async () => {
    // GET /domain/status is OWNER or MANAGER and deliberately has no flag
    // check — a resort that downgraded must still be able to see what state
    // its domain is in.
    await setFlag(false);
    expect((await domainStatus()).statusCode).toBe(200);
    await setFlag(true);
  });
});

/**
 * The same routes with credentials present — the production path, and the only
 * configuration in which the response that used to carry the phantom webhook
 * is reached at all. Asserting its absence on an unconfigured deployment was
 * vacuous: the 503 returns first, so the assertion passed while the line was
 * still there. A mutation put the webhook back and nothing failed, which is
 * how this block came to exist.
 *
 * Cloudflare is stubbed at `fetch`. Nothing here reaches the network.
 */
describe('with SSL automation configured', () => {
  const CF = 'https://api.cloudflare.com';
  let fetchMock: ReturnType<typeof vi.fn>;

  const cfEnvelope = (result: unknown) => ({
    ok: true, status: 200,
    json: async () => ({ success: true, errors: [], result }),
  });

  const hostnameRecord = (sslStatus: string, over: Record<string, unknown> = {}) => ({
    id: 'ch_test', hostname: 'mine.invalid',
    ssl: { status: sslStatus, validation_records: [], ...over },
  });

  /** Cloudflare answers; anything else is a test bug, so it throws. */
  const cloudflareSays = (answer: (url: string, init: RequestInit) => unknown) => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (!String(url).startsWith(CF)) throw new Error(`unexpected fetch: ${url}`);
      return answer(String(url), init);
    });
  };

  beforeEach(async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'test-token-not-a-real-one';
    process.env.CLOUDFLARE_ZONE_ID = 'zone-test';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    cloudflareSays(() => cfEnvelope([hostnameRecord('pending_validation')]));
    await asVerified('mine.invalid');
    await prisma.tenant.update({ where: { id: tenantId }, data: { sslStatus: 'none', sslError: null } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
  });

  it('provisions, and says nothing about a webhook', async () => {
    const res = await provisionSsl();
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('ssl-webhook');
    expect(body(res).data.webhook).toBeUndefined();
  });

  it('writes the status Cloudflare reported, not a hopeful guess', async () => {
    cloudflareSays(() => cfEnvelope([hostnameRecord('active')]));
    await provisionSsl();
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { sslStatus: true } });
    expect(t?.sslStatus).toBe('active');
  });

  it('reuses an existing registration instead of asking twice', async () => {
    // Re-registering a hostname is an error at Cloudflare, and an owner may
    // press the button more than once.
    const methods: string[] = [];
    cloudflareSays((_u, init) => {
      methods.push(String(init?.method ?? 'GET'));
      return cfEnvelope([hostnameRecord('pending_issuance')]);
    });
    await provisionSsl();
    expect(methods).toEqual(['GET']);
  });

  it('registers the hostname when Cloudflare has never seen it', async () => {
    const methods: string[] = [];
    cloudflareSays((_u, init) => {
      const method = String(init?.method ?? 'GET');
      methods.push(method);
      return method === 'GET' ? cfEnvelope([]) : cfEnvelope(hostnameRecord('pending_validation'));
    });
    await provisionSsl();
    expect(methods).toEqual(['GET', 'POST']);
  });

  it('passes the DCV records through, so the owner can see what to add', async () => {
    cloudflareSays(() => cfEnvelope([hostnameRecord('pending_validation', {
      validation_records: [{ txt_name: '_cf.mine.invalid', txt_value: 'abc' }],
    })]));
    const d = body(await provisionSsl()).data;
    expect(d.validationRecords).toEqual([
      { txtName: '_cf.mine.invalid', txtValue: 'abc', httpUrl: undefined, httpBody: undefined },
    ]);
  });

  it('reports a Cloudflare refusal as 502, with Cloudflare\'s own words', async () => {
    cloudflareSays(() => ({
      ok: false, status: 400,
      json: async () => ({ success: false, errors: [{ code: 1406, message: 'hostname already exists' }], result: null }),
    }));
    const res = await provisionSsl();
    expect(res.statusCode).toBe(502);
    expect(body(res).error).toMatch(/1406 hostname already exists/);
  });

  it('records that failure against the tenant rather than losing it', async () => {
    cloudflareSays(() => ({
      ok: false, status: 400,
      json: async () => ({ success: false, errors: [{ code: 10000, message: 'Authentication error' }], result: null }),
    }));
    await provisionSsl();
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { sslStatus: true, sslError: true } });
    expect(t?.sslStatus).toBe('error');
    expect(t?.sslError).toMatch(/Authentication error/);
  });

  it('never writes the token into a field an owner can read', async () => {
    cloudflareSays(() => ({
      ok: false, status: 403,
      json: async () => ({ success: false, errors: [{ code: 10000, message: 'Authentication error' }], result: null }),
    }));
    const res = await provisionSsl();
    expect(res.body).not.toContain('test-token-not-a-real-one');
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { sslError: true } });
    expect(t?.sslError).not.toContain('test-token-not-a-real-one');
  });

  it('asks Cloudflare nothing until DNS is verified', async () => {
    await prisma.tenant.update({ where: { id: tenantId }, data: { domainVerified: false } });
    const res = await provisionSsl();
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the certificate state back on the status route', async () => {
    cloudflareSays(() => cfEnvelope([hostnameRecord('active')]));
    const d = body(await domainStatus()).data;
    expect(d.sslStatus).toBe('active');
    // Still not "live": the column now says active, and nothing answers on
    // 443 for a reserved hostname. Both facts are reported.
    expect(d.https.live).toBe(false);
  });

  it('falls back to the stored status when Cloudflare is unreachable', async () => {
    await prisma.tenant.update({ where: { id: tenantId }, data: { sslStatus: 'provisioning' } });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await domainStatus();
    expect(res.statusCode).toBe(200);
    expect(body(res).data.sslStatus).toBe('provisioning');
  });

  it('deregisters the old hostname when the domain changes', async () => {
    const seen: Array<{ url: string; method: string }> = [];
    cloudflareSays((url, init) => {
      const method = String(init?.method ?? 'GET');
      seen.push({ url, method });
      return method === 'GET' ? cfEnvelope([hostnameRecord('active')]) : cfEnvelope(null);
    });
    await saveDomain('replacement.invalid');
    expect(seen.some(c => c.method === 'DELETE' && c.url.includes('ch_test'))).toBe(true);
  });

  it('does not fail the owner\'s save when deregistering fails', async () => {
    // Their row is already updated by then. A stale hostname left at
    // Cloudflare is our problem, not an error to show them.
    fetchMock.mockRejectedValue(new Error('Cloudflare: 1000 something'));
    const res = await saveDomain('another.invalid');
    expect(res.statusCode).toBe(200);
    expect(body(res).data.customDomain).toBe('another.invalid');
  });
});

/**
 * Verification succeeding, which is where the hostname is normally registered.
 *
 * `.invalid` can never satisfy a real CNAME lookup, so this leans on the
 * route's own development branch — the one that exists so a domain can be
 * verified without public DNS. It is the only way to reach the half of the
 * verify route that talks to Cloudflare, and that half had no coverage at all:
 * a mutation replacing Cloudflare's reported status with a hardcoded
 * "provisioning" passed every other test in this file.
 */
describe('verification, when DNS does succeed', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let realNodeEnv: string | undefined;

  const cfEnvelope = (result: unknown) => ({
    ok: true, status: 200,
    json: async () => ({ success: true, errors: [], result }),
  });

  beforeEach(async () => {
    realNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    process.env.CLOUDFLARE_API_TOKEN = 'test-token-not-a-real-one';
    process.env.CLOUDFLARE_ZONE_ID = 'zone-test';
    fetchMock = vi.fn().mockResolvedValue(cfEnvelope([{
      id: 'ch_verify', hostname: 'mine.invalid',
      ssl: { status: 'pending_validation', validation_records: [] },
    }]));
    vi.stubGlobal('fetch', fetchMock);
    await saveDomain('mine.invalid');
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (realNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = realNodeEnv;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
  });

  it('marks the domain verified', async () => {
    const res = await verifyDomain();
    expect(res.statusCode).toBe(200);
    expect(body(res).data.verified).toBe(true);
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { domainVerified: true } });
    expect(t?.domainVerified).toBe(true);
  });

  it('registers the hostname for a certificate as part of verifying', async () => {
    // DNS proving the owner controls the domain is the gate that lets us hand
    // it to Cloudflare. Nothing unverified ever reaches that call.
    await verifyDomain();
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/custom_hostnames');
  });

  it('writes the status Cloudflare reported, not a hopeful guess', async () => {
    fetchMock.mockResolvedValue(cfEnvelope([{
      id: 'ch_verify', hostname: 'mine.invalid', ssl: { status: 'active', validation_records: [] },
    }]));
    await verifyDomain();
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { sslStatus: true } });
    expect(t?.sslStatus).toBe('active');
  });

  it('returns the DCV records with the verification result', async () => {
    fetchMock.mockResolvedValue(cfEnvelope([{
      id: 'ch_verify', hostname: 'mine.invalid',
      ssl: { status: 'pending_validation', validation_records: [{ txt_name: '_cf.mine.invalid', txt_value: 'xyz' }] },
    }]));
    const d = body(await verifyDomain()).data;
    expect(d.validationRecords[0]).toMatchObject({ txtName: '_cf.mine.invalid', txtValue: 'xyz' });
  });

  it('still verifies the domain when the certificate request fails', async () => {
    // Verification succeeded — that is a fact about DNS. Only the certificate
    // request failed, and refusing the whole call would make the owner think
    // their DNS is wrong.
    fetchMock.mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ success: false, errors: [{ code: 10000, message: 'Authentication error' }], result: null }),
    });
    const res = await verifyDomain();
    expect(res.statusCode).toBe(200);
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { domainVerified: true, sslStatus: true, sslError: true },
    });
    expect(t?.domainVerified).toBe(true);
    expect(t?.sslStatus).toBe('error');
    expect(t?.sslError).toMatch(/Authentication error/);
  });

  it('reuses an existing registration when an owner verifies twice', async () => {
    const methods: string[] = [];
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      methods.push(String(init?.method ?? 'GET'));
      return cfEnvelope([{ id: 'ch_verify', hostname: 'mine.invalid', ssl: { status: 'pending_issuance' } }]);
    });
    await verifyDomain();
    await verifyDomain();
    expect(methods).toEqual(['GET', 'GET']);
  });

  it('verifies without Cloudflare at all when it is not configured', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
    const res = await verifyDomain();
    expect(res.statusCode).toBe(200);
    expect(body(res).data.verified).toBe(true);
    expect(body(res).data.sslStatus).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves the certificate status alone when there is no automation', async () => {
    // The whole WB-008 lie in one row: the client is inert without
    // credentials, so entering this branch at all writes 'provisioning' from
    // the `?? 'provisioning'` fallback — a status nothing will ever move,
    // promising a certificate no part of this deployment can issue.
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
    await verifyDomain();
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { sslStatus: true, domainVerified: true },
    });
    expect(t?.domainVerified).toBe(true);
    expect(t?.sslStatus).toBe('none');
  });
});
