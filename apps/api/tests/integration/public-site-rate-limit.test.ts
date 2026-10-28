/**
 * Whose budget a resort website spends when it renders itself.
 *
 * `GET /site/:slug` is read by the Next server rendering a resort's public
 * website, so from the API's side every visitor of every tenant site arrives
 * as one address: the web container's. The global ceiling keys on the address,
 * which is correct for an authenticated API and wrong here — it would have
 * made 300/min the budget for the entire public fleet.
 *
 * Nobody noticed because the renderer cached for a minute, so one page view
 * per resort per minute reached the API. Removing that cache is WB-002, and it
 * would have turned this into 429s on resort websites. So this route counts
 * per resort instead.
 *
 * The limiter runs before the handler, so none of this needs a tenant to
 * exist: an unknown slug is still counted, and still carries the headers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const GLOBAL_MAX = 5; // Deliberately tiny, so "not on the global budget" is cheap to show.
const PUBLIC_SITE_MAX = 600;

let app: FastifyInstance;
let previousMax: string | undefined;

const get = (url: string) => app.inject({ method: 'GET', url });
const remaining = (res: { headers: Record<string, unknown> }) =>
  Number(res.headers['x-ratelimit-remaining']);

beforeAll(async () => {
  previousMax = process.env.RATE_LIMIT_MAX;
  process.env.RATE_LIMIT_MAX = String(GLOBAL_MAX);
  // Imported here, not at the top: the ceiling is read when the app is built,
  // and the env var has to be in place first.
  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
}, 60000);

afterAll(async () => {
  await app.close();
  // The suite shares one process, so leaving this set would quietly re-ceiling
  // every file that builds an app after this one.
  if (previousMax === undefined) delete process.env.RATE_LIMIT_MAX;
  else process.env.RATE_LIMIT_MAX = previousMax;
});

describe('the global ceiling, which the rest of the API shares', () => {
  it('still refuses a caller past it', async () => {
    // /site/theme/:key is public and has no override, so it is on the global
    // budget — the same prefix and the same address as the route below.
    const codes: number[] = [];
    for (let i = 0; i < GLOBAL_MAX + 1; i++) {
      codes.push((await get('/site/theme/no-such-theme')).statusCode);
    }
    expect(codes.slice(0, GLOBAL_MAX)).toEqual(Array(GLOBAL_MAX).fill(404));
    expect(codes[GLOBAL_MAX]).toBe(429);
  });
});

describe('a resort website reading its own content', () => {
  it('is not spending that budget — the previous test exhausted it', async () => {
    const res = await get('/site/some-resort');
    expect(res.statusCode).not.toBe(429);
  });

  it('has a ceiling of its own, and a finite one', async () => {
    const res = await get('/site/some-resort');
    expect(Number(res.headers['x-ratelimit-limit'])).toBe(PUBLIC_SITE_MAX);
  });

  it('counts a repeat visit to the same resort against that resort', async () => {
    const first = await get('/site/counted-resort');
    const second = await get('/site/counted-resort');
    expect(remaining(second)).toBe(remaining(first) - 1);
  });

  it('gives a different resort its own count, so one cannot throttle another', async () => {
    const busy = await get('/site/busy-resort');
    await get('/site/busy-resort');
    await get('/site/busy-resort');
    const quiet = await get('/site/quiet-resort');

    expect(remaining(busy)).toBe(PUBLIC_SITE_MAX - 1);
    expect(remaining(quiet)).toBe(PUBLIC_SITE_MAX - 1);
  });
});
