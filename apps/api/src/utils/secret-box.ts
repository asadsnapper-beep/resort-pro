/**
 * Encrypting the credentials other people trust us with.
 *
 * A resort owner pastes their bKash app secret, their SSLCommerz store
 * password and their SMS API key into ResortPro. `schema.prisma` has said for
 * a long time that those are "encrypted in production via AES-256". They are
 * not, and never were: there is no cipher anywhere in this codebase, and every
 * one of those secrets is readable in the database and in any backup of it.
 * The comment is what made it look handled (QA finding M-03).
 *
 * This is the missing cipher. Two properties matter more than anything else
 * about how it is written:
 *
 *  - **It is authenticated.** AES-256-GCM, so a secret that has been altered in
 *    the database fails to decrypt instead of returning quiet nonsense that
 *    then gets sent to a payment gateway.
 *  - **It never pretends.** With no key configured, encrypting throws. It does
 *    not fall back to storing plaintext, because that is exactly the failure
 *    this file exists to end.
 *
 * Old plaintext is read back unchanged, so this can be deployed before
 * anything is converted and convert gradually. Nothing here logs a value,
 * encrypted or not.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Marks a value as ours, and which scheme produced it. */
const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class MissingEncryptionKey extends Error {
  constructor() {
    super(
      'CREDENTIALS_KEY is not set, so a credential cannot be encrypted. '
      + 'Generate one with `openssl rand -base64 32` and set it on the API. '
      + 'Storing the value unencrypted is not an option.',
    );
    this.name = 'MissingEncryptionKey';
  }
}

function readKey(): Buffer {
  const raw = process.env.CREDENTIALS_KEY;
  if (!raw) throw new MissingEncryptionKey();

  // base64 first, then hex — both are things a person plausibly pastes.
  const decoded = /^[0-9a-fA-F]{64}$/.test(raw.trim())
    ? Buffer.from(raw.trim(), 'hex')
    : Buffer.from(raw.trim(), 'base64');

  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIALS_KEY must decode to ${KEY_BYTES} bytes, got ${decoded.length}. `
      + 'Use `openssl rand -base64 32`.',
    );
  }
  return decoded;
}

/** Whether a usable key is configured. For a startup warning, not a code path. */
export function hasEncryptionKey(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

/** Whether this stored value was produced by encryptSecret. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const key = readKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX
    + `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Read a stored credential.
 *
 * A value that was never encrypted comes back as it is — that is what makes a
 * gradual conversion possible. A value that *claims* to be encrypted and will
 * not decrypt throws, rather than being handed on as an empty string.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;

  const parts = stored.slice(PREFIX.length).split(':');
  // The ciphertext of an empty credential is legitimately empty — a resort that
  // cleared a field still has to read back as "". Only the iv and the tag are
  // always present, so emptiness is checked on those rather than on all three.
  if (parts.length !== 3) {
    throw new Error('A stored credential is marked encrypted but is malformed.');
  }
  const [ivB64, tagB64, ctB64] = parts;
  if (!ivB64 || !tagB64) {
    throw new Error('A stored credential is marked encrypted but is malformed.');
  }

  const key = readKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Wrong key, or the row was altered. Both must be loud.
    throw new Error('A stored credential could not be decrypted — wrong key, or it has been altered.');
  }
}

/**
 * The same, for a bag of credentials kept as JSON.
 *
 * `TenantPaymentConfig.credentials` holds `{ bkash: { appKey, appSecret, … } }`.
 * The whole object is encrypted as one string rather than field by field, which
 * also hides *which* gateways a resort has configured.
 */
export function encryptRecord(value: unknown): { enc: string } {
  return { enc: encryptSecret(JSON.stringify(value ?? {})) };
}

export function decryptRecord<T = Record<string, unknown>>(stored: unknown): T {
  if (stored && typeof stored === 'object' && 'enc' in stored) {
    const enc = (stored as { enc: unknown }).enc;
    if (typeof enc !== 'string') {
      throw new Error('A stored credential bag has an unreadable envelope.');
    }
    return JSON.parse(decryptSecret(enc)) as T;
  }
  // Never encrypted — the shape every row has today.
  return (stored ?? {}) as T;
}
