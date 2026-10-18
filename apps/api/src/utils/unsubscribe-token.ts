/**
 * Signed unsubscribe links.
 *
 * The link in every marketing email used to be `/crm/unsubscribe/<guest id>`,
 * and the GET did the unsubscribing (CRM QA 2026-10-07, finding 013). Two
 * separate problems in one URL:
 *
 *  - **A GET that changes things.** Mail scanners, corporate security gateways
 *    and chat link-previewers fetch URLs in messages without anyone clicking.
 *    A guest could be unsubscribed by their own employer's spam filter, and
 *    neither they nor the resort would know why the emails stopped.
 *  - **A raw guest id.** Ids are handed out in other responses, so anyone
 *    holding one could unsubscribe that guest, and a sequential-looking id
 *    invites trying the next one.
 *
 * So the id is replaced by an HMAC-signed token, and the GET only shows a page
 * with a button. The POST behind that button is what actually unsubscribes.
 *
 * **No expiry, deliberately.** People unsubscribe from emails that have been in
 * their inbox for months, and a link that answers "this has expired" to someone
 * trying to opt out is both a compliance problem and the most annoying possible
 * moment to fail. The signature is there to stop guessing, not to age out —
 * and the worst a leaked token allows is unsubscribing one guest, which that
 * guest can ask to undo.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const b64url = (buf: Buffer) => buf.toString('base64url');

function secret(): string {
  // A dedicated secret if there is one, otherwise the app's. Production
  // refuses to start without JWT_SECRET (see env-preflight), so this is never
  // a silent fallback to something weak.
  const value = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;
  if (!value) {
    throw new Error('Cannot sign an unsubscribe link without UNSUBSCRIBE_SECRET or JWT_SECRET');
  }
  return value;
}

const sign = (payload: string) =>
  b64url(createHmac('sha256', secret()).update(payload).digest());

/** The token that stands in for a guest id in an unsubscribe link. */
export function signUnsubscribeToken(guestId: string): string {
  const payload = b64url(Buffer.from(guestId, 'utf8'));
  return `${payload}.${sign(payload)}`;
}

/**
 * @returns the guest id this token was made for, or null if it was not made
 *          here. Never throws on bad input — this is reached from the open
 *          internet, and anything can arrive.
 */
export function verifyUnsubscribeToken(token: string): string | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  let expected: Buffer;
  let given: Buffer;
  try {
    expected = Buffer.from(sign(payload), 'utf8');
    given = Buffer.from(signature, 'utf8');
  } catch {
    return null;
  }

  // Constant-time, and length-checked first because timingSafeEqual throws on
  // a mismatch rather than returning false.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const guestId = Buffer.from(payload, 'base64url').toString('utf8');
  return guestId.length > 0 ? guestId : null;
}

/** The full link to put in an email. */
export function unsubscribeUrl(guestId: string): string {
  const base = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
  return `${base}/crm/unsubscribe/${signUnsubscribeToken(guestId)}`;
}
