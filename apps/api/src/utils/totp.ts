/**
 * Time-based one-time passwords (RFC 6238), for the admin second factor.
 *
 * Written against the RFC rather than pulled in as a dependency: the algorithm
 * is an HMAC, a truncation and a modulo, and `totp.test.ts` checks it against
 * the test vectors published in the RFC itself. A wrong implementation here
 * fails those vectors immediately, which is a stronger guarantee than a package
 * version number.
 *
 * SHA-1 is not a mistake. RFC 6238 specifies it, every authenticator app
 * implements it, and the security of a TOTP does not rest on collision
 * resistance — it rests on the shared secret and a 30-second window.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;
/** How many steps either side of now are accepted — one, for clock drift. */
const DEFAULT_WINDOW = 1;

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = B32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Not a base32 secret.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh secret, 20 bytes as the RFC's own examples use. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * The code for one counter value.
 *
 * Exported for the RFC test vectors, which are expressed as times rather than
 * as "now", and for the 8-digit variants those vectors use.
 */
export function hotp(secret: string, counter: number, digits = DIGITS): string {
  const key = base32Decode(secret);

  const message = Buffer.alloc(8);
  // Counter is a 64-bit big-endian integer. Written as two 32-bit halves
  // because a bitwise shift in JS would silently truncate to 32 bits.
  message.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  message.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac('sha1', key).update(message).digest();

  // Dynamic truncation, RFC 4226 §5.3: the low nibble of the last byte picks
  // where to read four bytes from, and the top bit is masked off so the result
  // is positive on platforms that treat it as signed.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function totp(secret: string, atMs = Date.now(), digits = DIGITS): string {
  return hotp(secret, Math.floor(atMs / 1000 / STEP_SECONDS), digits);
}

/**
 * Whether a code is currently valid.
 *
 * Accepts the step before and after as well, because a phone's clock and a
 * server's are never exactly the same and a code typed at second 29 arrives at
 * second 31. Comparison is constant-time: the codes are short and an attacker
 * controls one side, which is the shape timing attacks like.
 */
export function verifyTotp(
  secret: string,
  code: string,
  { atMs = Date.now(), window = DEFAULT_WINDOW }: { atMs?: number; window?: number } = {},
): boolean {
  const given = code.replace(/\s/g, '');
  if (!/^\d+$/.test(given) || given.length !== DIGITS) return false;

  const step = Math.floor(atMs / 1000 / STEP_SECONDS);
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = hotp(secret, step + drift);
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/**
 * The `otpauth://` URI an authenticator app reads from a QR code.
 *
 * The issuer appears twice by convention — once in the label and once as a
 * parameter — because apps differ on which one they show.
 */
export function otpauthUri(secret: string, account: string, issuer = 'ResortPro'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Codes for the day the phone is lost.
 *
 * There is one admin account on this platform and one person holding it, so
 * "enrol a second device" is not an available answer — without these, a lost
 * phone means nobody can reach the admin panel again. Stored hashed, used once.
 */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function normaliseRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
