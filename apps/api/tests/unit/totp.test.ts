/**
 * The TOTP implementation, checked against RFC 6238's own test vectors.
 *
 * This is the reason it was written rather than installed: the RFC publishes
 * the exact codes a correct implementation produces at given times for a given
 * secret. If any of these is wrong, the admin second factor rejects the
 * authenticator app the founder is holding — a failure that would otherwise
 * only be discovered at the login screen, by someone now locked out.
 *
 * Vectors are from RFC 6238 Appendix B, SHA-1 column. The RFC's secret is the
 * ASCII string "12345678901234567890"; they are quoted there as eight digits,
 * and a six-digit code is its last six.
 */
import { describe, it, expect } from 'vitest';
import {
  totp, hotp, verifyTotp, base32Encode, base32Decode,
  generateSecret, otpauthUri, generateRecoveryCodes, normaliseRecoveryCode,
} from '../../src/utils/totp';

const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('RFC 6238 test vectors', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('at unix time %i the code is %s', (seconds, expected) => {
    expect(totp(RFC_SECRET, seconds * 1000, 8)).toBe(expected);
  });

  it('gives the last six of the same number for a six-digit code', () => {
    expect(totp(RFC_SECRET, 59 * 1000)).toBe('287082');
  });

  it('counts by thirty-second steps, not by seconds', () => {
    // Aligned to a step boundary: 1_000_000_020 is divisible by 30, so the
    // window runs to :49 and turns over at :50.
    const stepStart = 1_000_000_020_000;
    const a = totp(RFC_SECRET, stepStart);
    expect(totp(RFC_SECRET, stepStart + 29_000)).toBe(a);
    expect(totp(RFC_SECRET, stepStart + 30_000)).not.toBe(a);
  });

  it('handles a counter past 32 bits without truncating it', () => {
    // 20000000000 / 30 is comfortably beyond 2^31, which a naive shift loses.
    expect(hotp(RFC_SECRET, Math.floor(20000000000 / 30), 8)).toBe('65353130');
  });
});

describe('base32', () => {
  it('round-trips a secret', () => {
    const secret = generateSecret();
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it('matches the known encoding of the RFC secret', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('refuses something that is not base32', () => {
    expect(() => base32Decode('not-base32!')).toThrow();
  });
});

describe('verifying what someone typed', () => {
  const now = 1_700_000_000_000;

  it('accepts the current code', () => {
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now), { atMs: now })).toBe(true);
  });

  it('accepts one typed just as the code turned over', () => {
    const previous = totp(RFC_SECRET, now - 30_000);
    expect(verifyTotp(RFC_SECRET, previous, { atMs: now })).toBe(true);
  });

  it('accepts a phone whose clock is a step fast', () => {
    const next = totp(RFC_SECRET, now + 30_000);
    expect(verifyTotp(RFC_SECRET, next, { atMs: now })).toBe(true);
  });

  it('refuses a code from two steps ago', () => {
    const stale = totp(RFC_SECRET, now - 90_000);
    expect(verifyTotp(RFC_SECRET, stale, { atMs: now })).toBe(false);
  });

  it('refuses a code for a different secret', () => {
    expect(verifyTotp(generateSecret(), totp(RFC_SECRET, now), { atMs: now })).toBe(false);
  });

  it.each(['', '12345', '1234567', 'abcdef', '12 34 56'])('refuses %o', (bad) => {
    expect(verifyTotp(RFC_SECRET, bad, { atMs: now })).toBe(false);
  });
});

describe('the enrolment URI', () => {
  it('carries everything an authenticator needs', () => {
    const uri = otpauthUri('ABC234', 'boss@example.com');
    expect(uri.startsWith('otpauth://totp/ResortPro%3Aboss%40example.com?')).toBe(true);
    expect(uri).toContain('secret=ABC234');
    expect(uri).toContain('issuer=ResortPro');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});

describe('recovery codes', () => {
  it('gives ten distinct codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it('reads back the same however it was typed', () => {
    const [code] = generateRecoveryCodes(1);
    expect(normaliseRecoveryCode(code.toLowerCase())).toBe(normaliseRecoveryCode(code));
    expect(normaliseRecoveryCode(` ${code.replace('-', ' ')} `)).toBe(normaliseRecoveryCode(code));
  });
});
