/**
 * The global rate limit is a dial, not an off switch.
 *
 * It exists because one address makes many requests: the comment on its
 * registration records that 100/min was already tripping for staff sharing an
 * office network, which is why it is 300. The E2E suite is the same shape in
 * the extreme — around sixty dashboard loads in ninety seconds from the
 * runner — and was being refused hundreds of times per run, so the job needs
 * to raise it for itself.
 *
 * What these cover is the part that would be dangerous to get wrong: every way
 * of failing to supply a number has to land on 300 rather than on zero, NaN or
 * Infinity. A limiter configured with 0 refuses everything; one configured with
 * NaN is whatever @fastify/rate-limit decides NaN means. Neither is a state
 * anyone should be able to reach by mistyping an environment variable.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rateLimitMax } from '../../src/app';

const DEFAULT = 300;

afterEach(() => {
  delete process.env.RATE_LIMIT_MAX;
});

describe('when nothing asks for a different ceiling', () => {
  it('is the production default', () => {
    delete process.env.RATE_LIMIT_MAX;
    expect(rateLimitMax()).toBe(DEFAULT);
  });
});

describe('when the value cannot be read as a positive number', () => {
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['not a number', 'lots'],
    ['zero, which would refuse everything', '0'],
    ['negative', '-50'],
    ['infinite', 'Infinity'],
  ])('falls back to the default: %s', (_why, value) => {
    process.env.RATE_LIMIT_MAX = value;
    expect(rateLimitMax()).toBe(DEFAULT);
  });
});

describe('when a job asks for a different ceiling', () => {
  it('uses it', () => {
    process.env.RATE_LIMIT_MAX = '100000';
    expect(rateLimitMax()).toBe(100000);
  });

  it('takes the whole part of a fractional value rather than passing it on', () => {
    process.env.RATE_LIMIT_MAX = '450.9';
    expect(rateLimitMax()).toBe(450);
  });

  it('does not let a lower ceiling be rejected — tightening is legitimate too', () => {
    process.env.RATE_LIMIT_MAX = '50';
    expect(rateLimitMax()).toBe(50);
  });
});
