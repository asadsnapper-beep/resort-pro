/**
 * The cipher that should have been there all along.
 *
 * `schema.prisma` has claimed since the payment-gateway work that credentials
 * are "encrypted in production via AES-256". Nothing encrypted anything, so
 * every resort's bKash app secret and SSLCommerz store password has been
 * readable in the database and in every backup of it.
 *
 * Two properties are load-bearing and each has a test that fails without it:
 * an altered value must refuse to decrypt rather than return quiet nonsense
 * that gets sent to a payment gateway, and a missing key must stop a write
 * rather than fall back to storing plaintext.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { keepEnv } from '../helpers/env';
import {
  encryptSecret, decryptSecret, isEncrypted, hasEncryptionKey,
  encryptRecord, decryptRecord, MissingEncryptionKey,
} from '../../src/utils/secret-box';

keepEnv('CREDENTIALS_KEY');

// 32 bytes, as `openssl rand -base64 32` produces.
const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');
const SECRET = 'bkash_app_secret_xY9';

beforeEach(() => { process.env.CREDENTIALS_KEY = KEY; });

describe('a credential going in and coming back', () => {
  it('comes back exactly as it went in', () => {
    expect(decryptSecret(encryptSecret(SECRET))).toBe(SECRET);
  });

  it('survives what people actually paste', () => {
    for (const value of ['', ' leading space', 'unicode ৳ ও ্য', 'a'.repeat(4096), '{"json":true}']) {
      expect(decryptSecret(encryptSecret(value))).toBe(value);
    }
  });

  it('does not leave the secret anywhere in what is stored', () => {
    const stored = encryptSecret(SECRET);
    expect(stored).not.toContain(SECRET);
    expect(Buffer.from(stored, 'utf8').includes(Buffer.from(SECRET, 'utf8'))).toBe(false);
  });

  it('looks different every time, so equal secrets are not visibly equal', () => {
    // Two resorts using the same gateway password must not produce the same
    // row — that alone would leak which of them share credentials.
    expect(encryptSecret(SECRET)).not.toBe(encryptSecret(SECRET));
  });

  it('is recognisable as ours, and plain text is not', () => {
    expect(isEncrypted(encryptSecret(SECRET))).toBe(true);
    expect(isEncrypted(SECRET)).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });
});

describe('a value that has been tampered with', () => {
  it('refuses rather than returning nonsense', () => {
    const stored = encryptSecret(SECRET);
    const [prefix, iv, tag, ct] = [stored.slice(0, 7), ...stored.slice(7).split(':')];

    // Flip a byte of the ciphertext.
    const bytes = Buffer.from(ct, 'base64');
    bytes[0] ^= 0xff;
    const altered = `${prefix}${iv}:${tag}:${bytes.toString('base64')}`;

    expect(() => decryptSecret(altered)).toThrow(/could not be decrypted/);
  });

  it('refuses a swapped authentication tag', () => {
    const a = encryptSecret('secret-a');
    const b = encryptSecret('secret-b');
    const [ivA, , ctA] = a.slice(7).split(':');
    const [, tagB] = b.slice(7).split(':');

    expect(() => decryptSecret(`enc:v1:${ivA}:${tagB}:${ctA}`)).toThrow(/could not be decrypted/);
  });

  it('refuses one written with a different key', () => {
    const stored = encryptSecret(SECRET);
    process.env.CREDENTIALS_KEY = OTHER_KEY;
    expect(() => decryptSecret(stored)).toThrow(/could not be decrypted/);
  });

  it('refuses a malformed envelope instead of guessing', () => {
    expect(() => decryptSecret('enc:v1:only-one-part')).toThrow(/malformed/);
  });
});

describe('with no key configured', () => {
  beforeEach(() => { delete process.env.CREDENTIALS_KEY; });

  it('will not encrypt, and says how to fix it', () => {
    expect(() => encryptSecret(SECRET)).toThrow(MissingEncryptionKey);
    expect(() => encryptSecret(SECRET)).toThrow(/openssl rand -base64 32/);
  });

  it('never quietly stores plaintext instead', () => {
    // The whole point. A fallback here would recreate the bug.
    let stored: string | null = null;
    try { stored = encryptSecret(SECRET); } catch { /* expected */ }
    expect(stored).toBeNull();
  });

  it('still reads back credentials written before any of this', () => {
    expect(decryptSecret('plain_old_bkash_key')).toBe('plain_old_bkash_key');
  });

  it('refuses an encrypted value rather than handing back an empty string', () => {
    process.env.CREDENTIALS_KEY = KEY;
    const stored = encryptSecret(SECRET);
    delete process.env.CREDENTIALS_KEY;
    expect(() => decryptSecret(stored)).toThrow(MissingEncryptionKey);
  });

  it('reports itself as unconfigured', () => {
    expect(hasEncryptionKey()).toBe(false);
  });
});

describe('the key itself', () => {
  it('takes base64 or hex, since both get pasted', () => {
    process.env.CREDENTIALS_KEY = Buffer.alloc(32, 3).toString('hex');
    expect(decryptSecret(encryptSecret(SECRET))).toBe(SECRET);
  });

  it('refuses a key of the wrong size instead of padding it', () => {
    process.env.CREDENTIALS_KEY = Buffer.alloc(16, 1).toString('base64');
    expect(() => encryptSecret(SECRET)).toThrow(/32 bytes, got 16/);
  });
});

describe('a bag of gateway credentials', () => {
  const bag = { bkash: { appKey: 'k', appSecret: 's' }, sslcommerz: { storeId: 'x' } };

  it('goes in and comes back whole', () => {
    expect(decryptRecord(encryptRecord(bag))).toEqual(bag);
  });

  it('hides which gateways a resort has configured, not just the secrets', () => {
    const stored = JSON.stringify(encryptRecord(bag));
    expect(stored).not.toContain('bkash');
    expect(stored).not.toContain('sslcommerz');
    expect(stored).not.toContain('appSecret');
  });

  it('reads back the shape every row has today', () => {
    expect(decryptRecord(bag)).toEqual(bag);
    expect(decryptRecord(null)).toEqual({});
    expect(decryptRecord(undefined)).toEqual({});
  });

  it('refuses an envelope it cannot read', () => {
    expect(() => decryptRecord({ enc: 42 })).toThrow(/unreadable envelope/);
  });
});
