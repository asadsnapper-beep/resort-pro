import { describe, it, expect } from 'vitest';
import { deliveryVerdict, notImplemented, NOT_CONFIGURED } from '../../src/utils/delivery';

/**
 * The rule: only an id counts as delivery.
 *
 * Routes used to await sendEmail, discard its `{ id, error }`, and answer
 * `{ sent: true }`. On a server with no provider the dashboard therefore said
 * "Test email sent" while the service had logged "[email] skipped (email
 * disabled)". These cases pin every branch of that away.
 */
describe('what counts as delivered', () => {
  it('accepts an attempt that came back with an id', () => {
    expect(deliveryVerdict({ id: 're_123', error: null })).toEqual({
      delivered: true, id: 're_123',
    });
  });

  it('refuses to call an unconfigured server a success', () => {
    const verdict = deliveryVerdict({ id: null, error: NOT_CONFIGURED });

    expect(verdict.delivered).toBe(false);
    if (verdict.delivered) throw new Error('unreachable');
    // 503, because nothing is broken — the capability is absent, and retrying
    // will not change that.
    expect(verdict.status).toBe(503);
    expect(verdict.code).toBe('DELIVERY_NOT_CONFIGURED');
    expect(verdict.error).toContain('nothing was sent');
  });

  it('passes a provider rejection through, with the reason', () => {
    const verdict = deliveryVerdict({ id: null, error: 'domain not verified' });

    if (verdict.delivered) throw new Error('unreachable');
    expect(verdict.status).toBe(502);
    expect(verdict.code).toBe('DELIVERY_FAILED');
    // The owner can act on "domain not verified"; they cannot act on "Failed".
    expect(verdict.error).toContain('domain not verified');
  });

  it('will not claim delivery without an id, even with no error', () => {
    // The case that makes the rule strict rather than merely careful: nothing
    // came back to point at, so there is nothing to call delivered.
    const verdict = deliveryVerdict({ id: null, error: null });

    if (verdict.delivered) throw new Error('unreachable');
    expect(verdict.status).toBe(502);
    expect(verdict.code).toBe('DELIVERY_UNCONFIRMED');
  });

  it('treats an empty id as no id', () => {
    const verdict = deliveryVerdict({ id: '', error: null });
    expect(verdict.delivered).toBe(false);
  });
});

describe('a capability that is not built', () => {
  it('answers 501 and says nothing was sent', () => {
    const outcome = notImplemented('SMS delivery');

    // 501 is the honest status: the request was understood, and this server
    // does not implement it. The old answer was { sent: true }.
    expect(outcome.status).toBe(501);
    expect(outcome.code).toBe('NOT_IMPLEMENTED');
    expect(outcome.error).toBe('SMS delivery is not available yet — nothing was sent.');
  });
});
