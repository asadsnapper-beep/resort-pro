/**
 * The payload of a refresh token.
 *
 * `jti` is the whole reason this exists. A refresh token used to be signed as
 * `{ sub, type: 'refresh' }`, and a JWT's `iat`/`exp` have one-second
 * resolution — so two tokens issued for the same user inside the same second
 * were byte for byte identical, and `RefreshToken.token` is unique. The second
 * one died on the index and the caller got a 500.
 *
 * That is not a rare race. It is a double-clicked Sign in button, two tabs
 * restoring together, or a phone and a laptop signing in at once.
 *
 * Nothing reads these claims — the refresh route looks its row up by the token
 * string — so the extra one costs nothing.
 */
import { randomBytes } from 'crypto';

export function refreshTokenPayload(userId: string) {
  return { sub: userId, type: 'refresh' as const, jti: randomBytes(16).toString('hex') };
}
