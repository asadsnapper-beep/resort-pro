/**
 * Whether something was actually delivered, and what to tell the caller if not.
 *
 * `sendEmail` returns `{ id, error }`. Several routes awaited it, threw the
 * result away, and answered `{ sent: true }` — so on a server with no email
 * provider the dashboard said "Test email sent to …" and "Report emailed"
 * while nothing had been sent. The 2026-09-08 and 2026-09-09 QA audits found
 * the same shape in four places; crm.ts had already been reading the result all
 * along, so the fix is consistency, not invention.
 *
 * The rule lives in one pure function so it can be argued with in a test, and
 * so the next caller has something to reach for instead of inventing an
 * optimistic answer.
 *
 * Delivery requires an id. An attempt with no error and no id is not treated as
 * success: nothing came back to point at, and claiming delivery on that basis
 * is the very habit being removed.
 */

export interface DeliveryAttempt {
  id: string | null;
  error: string | null;
}

export type DeliveryVerdict =
  | { delivered: true; id: string }
  | { delivered: false; status: number; code: string; error: string };

/** The service's own marker for "this server has no provider configured". */
export const NOT_CONFIGURED = 'email_disabled';

export function deliveryVerdict(attempt: DeliveryAttempt): DeliveryVerdict {
  if (attempt.error === NOT_CONFIGURED) {
    return {
      delivered: false,
      // 503, not 500: nothing is broken, the capability is absent. Retrying
      // changes nothing until someone configures a provider.
      status: 503,
      code: 'DELIVERY_NOT_CONFIGURED',
      error: 'This server has no email provider configured, so nothing was sent.',
    };
  }

  if (attempt.error) {
    return {
      delivered: false,
      // 502: our request reached the provider and the provider refused it.
      status: 502,
      code: 'DELIVERY_FAILED',
      error: `The email provider rejected the message: ${attempt.error}`,
    };
  }

  if (!attempt.id) {
    return {
      delivered: false,
      status: 502,
      code: 'DELIVERY_UNCONFIRMED',
      error: 'The email provider returned no confirmation, so delivery cannot be claimed.',
    };
  }

  return { delivered: true, id: attempt.id };
}

/**
 * For a capability that is deliberately not built yet.
 *
 * The SMS and WhatsApp test buttons answered `{ sent: true, … }` with "coming
 * soon" buried in a message the UI never showed, so the owner was told a test
 * message had gone to their phone. 501 is the honest answer: the request was
 * understood and this server does not implement it.
 */
export function notImplemented(what: string): { status: number; code: string; error: string } {
  return {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    error: `${what} is not available yet — nothing was sent.`,
  };
}
