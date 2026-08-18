/**
 * SSRF guard for tenant-supplied calendar URLs.
 *
 * Before this, icalUrl was validated only by z.string().url() and then fetched
 * server-side — on save and every 15 minutes thereafter. An owner could point
 * it at cloud instance metadata or any service on the internal network.
 */
import { describe, it, expect } from 'vitest';
import { assertSafeExternalUrl, isPrivateAddress, UnsafeUrlError } from '../../src/utils/safe-url';

const rejects = (url: string) => expect(assertSafeExternalUrl(url)).rejects.toThrow(UnsafeUrlError);

describe('isPrivateAddress', () => {
  it.each([
    ['169.254.169.254', 'cloud instance metadata'],
    ['127.0.0.1',       'loopback'],
    ['10.0.0.5',        'RFC1918 /8'],
    ['172.16.0.1',      'RFC1918 /12 lower bound'],
    ['172.31.255.254',  'RFC1918 /12 upper bound'],
    ['192.168.1.1',     'RFC1918 /16'],
    ['100.64.0.1',      'CGNAT'],
    ['0.0.0.0',         'unspecified'],
    ['::1',             'IPv6 loopback'],
    ['fd00::1',         'IPv6 unique local'],
    ['fe80::1',         'IPv6 link-local'],
    ['::ffff:127.0.0.1','IPv4-mapped loopback'],
  ])('treats %s as private (%s)', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    ['8.8.8.8',      'public IPv4'],
    ['172.32.0.1',   'just above the RFC1918 /12 range'],
    ['172.15.0.1',   'just below the RFC1918 /12 range'],
    ['2606:4700::1', 'public IPv6'],
  ])('treats %s as public (%s)', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('assertSafeExternalUrl', () => {
  it('rejects the cloud metadata endpoint', async () => {
    await rejects('https://169.254.169.254/latest/meta-data/iam/security-credentials/');
  });

  it('rejects reaching the database or another container by service name', async () => {
    await rejects('https://postgres:5432/');
  });

  it('rejects loopback, so the API cannot be made to call itself', async () => {
    await rejects('https://127.0.0.1:4000/api/admin/tenants');
    await rejects('https://localhost:4000/api/admin/tenants');
  });

  it('rejects private ranges by literal address', async () => {
    await rejects('https://10.0.0.5/calendar.ics');
    await rejects('https://192.168.1.10/calendar.ics');
    await rejects('https://[::1]/calendar.ics');
  });

  it('rejects http, which is both tamperable and what internal services speak', async () => {
    await rejects('http://calendar.google.com/feed.ics');
  });

  it('rejects other schemes outright', async () => {
    await rejects('file:///etc/passwd');
    await rejects('gopher://evil.test/');
  });

  it('rejects embedded credentials', async () => {
    await rejects('https://user:pass@calendar.google.com/feed.ics');
  });

  it('rejects internal-looking hostnames', async () => {
    await rejects('https://api.internal/feed.ics');
    await rejects('https://db.local/feed.ics');
  });

  it('rejects a hostname that does not resolve', async () => {
    await rejects('https://this-host-does-not-exist-9f8a7b.invalid/feed.ics');
  });

  it('allows a real public https feed', async () => {
    const url = await assertSafeExternalUrl('https://calendar.google.com/calendar/ical/x/basic.ics');
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.protocol).toBe('https:');
  });
});
