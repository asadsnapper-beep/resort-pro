/**
 * The HTTPS probe, and the SSRF guard in front of it.
 *
 * `sslStatus` is a stored column, so the settings page used to call a domain
 * "live" on the strength of DNS alone. probeHttps is what replaced that: a real
 * TLS handshake, the only thing entitled to the word.
 *
 * The hostname it is given is tenant-supplied, which makes it an SSRF
 * primitive. `domainVerified` is not a guard against that — it is proved once
 * against DNS the owner can change the next minute. These tests pin both
 * halves: nothing private is ever connected to, and what the handshake said is
 * reported honestly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

const lookup = vi.fn();
const connect = vi.fn();

vi.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookup(...a) }));
vi.mock('tls', () => ({ connect: (...a: unknown[]) => connect(...a) }));

const { probeHttps } = await import('../../src/services/https-probe');

/** A socket that behaves like tls.connect's, driven by the test. */
function fakeSocket() {
  const sock = new EventEmitter() as EventEmitter & {
    destroy: () => void;
    authorized: boolean;
    authorizationError?: string;
    getPeerCertificate: () => Record<string, unknown>;
  };
  sock.destroy = vi.fn();
  sock.authorized = true;
  sock.getPeerCertificate = () => ({});
  return sock;
}

/** Hand the next tls.connect this socket, then fire `event` on it. */
function respondWith(sock: ReturnType<typeof fakeSocket>, event: string, arg?: unknown) {
  connect.mockImplementation(() => {
    setImmediate(() => sock.emit(event, arg));
    return sock;
  });
  return sock;
}

const publicDns = (...ips: string[]) =>
  lookup.mockResolvedValue(ips.map(address => ({ address })));

beforeEach(() => {
  lookup.mockReset();
  connect.mockReset();
  publicDns('203.0.113.10');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('the guard — what is never connected to', () => {
  it.each([
    ['169.254.169.254', 'cloud instance metadata'],
    ['127.0.0.1',       'loopback'],
    ['10.0.0.5',        'RFC1918'],
    ['192.168.1.10',    'a home or office LAN'],
    ['172.16.0.1',      'RFC1918 /12'],
    ['::1',             'IPv6 loopback'],
  ])('refuses the literal address %s (%s) without opening a socket', async (ip) => {
    const result = await probeHttps(ip);
    expect(result.live).toBe(false);
    expect(result.reachable).toBe(false);
    expect(connect).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each(['localhost', 'api.localhost', 'rp-postgres.internal', 'printer.local'])(
    'refuses the internal hostname %s',
    async (host) => {
      const result = await probeHttps(host);
      expect(result.live).toBe(false);
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it('refuses a public name that resolves into private space', async () => {
    // The actual attack: verify a domain with a correct CNAME, then repoint it.
    // The name looks ordinary; only the DNS answer gives it away.
    publicDns('10.0.0.5');
    const result = await probeHttps('probe.theirresort.com');
    expect(result.live).toBe(false);
    expect(result.error).toMatch(/not reachable from the internet/i);
    expect(connect).not.toHaveBeenCalled();
  });

  it('refuses when any one answer is private, not just the first', async () => {
    // Connecting to answer[0] and checking only that one is the bug this
    // avoids: a resolver may hand back either, in any order.
    publicDns('203.0.113.10', '127.0.0.1');
    expect((await probeHttps('split.theirresort.com')).live).toBe(false);
    expect(connect).not.toHaveBeenCalled();
  });

  it('refuses a name with no DNS answer at all', async () => {
    lookup.mockResolvedValue([]);
    expect((await probeHttps('gone.theirresort.com')).error).toMatch(/DNS/i);
    expect(connect).not.toHaveBeenCalled();
  });

  it('refuses when the lookup itself fails', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'));
    expect((await probeHttps('nx.theirresort.com')).error).toMatch(/DNS/i);
    expect(connect).not.toHaveBeenCalled();
  });

  it('never reports a refused domain as reachable', async () => {
    // `reachable` drives UI copy that says the server answered. A refusal
    // means nothing was contacted, so it must not claim otherwise.
    publicDns('169.254.169.254');
    const result = await probeHttps('metadata.theirresort.com');
    expect(result.reachable).toBe(false);
    expect(result.expiresAt).toBeNull();
  });
});

describe('the connection — what it is pointed at', () => {
  it('connects to the address it checked, not to the name', async () => {
    // Re-resolving the name inside tls.connect would reopen the rebind the
    // guard just closed.
    publicDns('203.0.113.10');
    respondWith(fakeSocket(), 'secureConnect');
    await probeHttps('theirresort.com');
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ host: '203.0.113.10' }));
  });

  it('still carries the hostname in SNI, so the certificate is checked against it', async () => {
    // Node validates the certificate's identity against `servername`. Pinning
    // the address must not turn that into a check against an IP.
    respondWith(fakeSocket(), 'secureConnect');
    await probeHttps('theirresort.com');
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ servername: 'theirresort.com', port: 443 }));
  });

  it('inspects the certificate itself rather than throwing on a bad one', async () => {
    respondWith(fakeSocket(), 'secureConnect');
    await probeHttps('theirresort.com');
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ rejectUnauthorized: false }));
  });

  it('sets a timeout, so a hostile domain cannot hold the settings page open', async () => {
    respondWith(fakeSocket(), 'secureConnect');
    await probeHttps('theirresort.com');
    const opts = connect.mock.calls[0]![0] as { timeout: number };
    expect(opts.timeout).toBeGreaterThan(0);
    expect(opts.timeout).toBeLessThanOrEqual(10_000);
  });
});

describe('what the handshake said', () => {
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toUTCString();

  it('is live only when the chain was trusted', async () => {
    const sock = fakeSocket();
    sock.authorized = true;
    sock.getPeerCertificate = () => ({ subject: { CN: 'theirresort.com' }, valid_to: inDays(60) });
    respondWith(sock, 'secureConnect');

    const result = await probeHttps('theirresort.com');
    expect(result).toMatchObject({ live: true, reachable: true, error: null });
    expect(result.daysUntilExpiry).toBe(60);
  });

  it('is reachable but not live when the certificate is not trusted', async () => {
    // The exact state an owner lands in with an A record: the server answers,
    // and the browser shows a name-mismatch warning.
    const sock = fakeSocket();
    sock.authorized = false;
    sock.authorizationError = 'ERR_TLS_CERT_ALTNAME_INVALID';
    sock.getPeerCertificate = () => ({ valid_to: inDays(30) });
    respondWith(sock, 'secureConnect');

    const result = await probeHttps('theirresort.com');
    expect(result.live).toBe(false);
    expect(result.reachable).toBe(true);
    expect(result.error).toContain('ERR_TLS_CERT_ALTNAME_INVALID');
    expect(result.daysUntilExpiry).toBe(30);
  });

  it('reports an expired certificate as not live, with a negative count', async () => {
    const sock = fakeSocket();
    sock.authorized = false;
    sock.authorizationError = 'CERT_HAS_EXPIRED';
    sock.getPeerCertificate = () => ({ valid_to: inDays(-3) });
    respondWith(sock, 'secureConnect');

    const result = await probeHttps('theirresort.com');
    expect(result.live).toBe(false);
    expect(result.daysUntilExpiry).toBeLessThan(0);
  });

  it('handles an answer with no certificate at all', async () => {
    const sock = fakeSocket();
    sock.getPeerCertificate = () => ({});
    respondWith(sock, 'secureConnect');

    const result = await probeHttps('theirresort.com');
    expect(result.live).toBe(false);
    expect(result.reachable).toBe(true);
    expect(result.error).toMatch(/no certificate/i);
  });

  it('turns a refused connection into words an owner can act on', async () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    respondWith(fakeSocket(), 'error', err);
    expect((await probeHttps('theirresort.com')).error).toMatch(/nothing is listening/i);
  });

  it('says so when the domain simply does not answer', async () => {
    respondWith(fakeSocket(), 'timeout');
    const result = await probeHttps('theirresort.com');
    expect(result.live).toBe(false);
    expect(result.error).toMatch(/did not respond/i);
  });

  it('never throws, whatever the socket does', async () => {
    respondWith(fakeSocket(), 'error', Object.assign(new Error('boom'), { code: 'EWHATEVER' }));
    await expect(probeHttps('theirresort.com')).resolves.toMatchObject({ live: false });
  });

  it('settles once, so a socket that errors after connecting cannot change the answer', async () => {
    const sock = fakeSocket();
    sock.authorized = true;
    sock.getPeerCertificate = () => ({ valid_to: inDays(10) });
    connect.mockImplementation(() => {
      setImmediate(() => {
        sock.emit('secureConnect');
        sock.emit('error', Object.assign(new Error('late'), { code: 'ECONNRESET' }));
      });
      return sock;
    });

    expect((await probeHttps('theirresort.com')).live).toBe(true);
    expect(sock.destroy).toHaveBeenCalled();
  });
});
