/**
 * Who counts as subscribed.
 *
 * One rule, in one place, because the codebase had three (CRM QA 2026-10-07,
 * finding 004):
 *
 *  - The contacts list and the birthday/anniversary SQL treated a guest with no
 *    consent row as subscribed.
 *  - Five Prisma filters — campaign send, win-back, pre-arrival, post-stay and
 *    the booking-confirmed sweep — required a row with `subscribed: true`.
 *  - The analytics KPI counted only explicit rows.
 *
 * On the demo tenant that meant ten contacts shown as "Subscribed", zero
 * consent rows, and a campaign to "all subscribed guests" reaching nobody. The
 * owner is told the audience exists, sends to it, and is told it was sent.
 *
 * **The rule: a guest is subscribed unless they have opted out.** That is what
 * `EmailConsent.subscribed` defaulting to true already meant, what the
 * unsubscribe route writes (a row with `subscribed: false`), and what the UI
 * has always shown. The row records a decision; its absence is not one.
 *
 * Import this rather than writing the filter again. The point of the finding
 * was not that one of the three was wrong — it was that there were three.
 */

/** For `prisma.guest.findMany({ where: { ...SUBSCRIBED_GUEST } })`. */
export const SUBSCRIBED_GUEST = {
  OR: [
    { consent: { is: null } },
    { consent: { is: { subscribed: true } } },
  ],
};

/**
 * The same rule one level down, for models that reach a guest by relation —
 * `prisma.booking.findMany({ where: { guest: SUBSCRIBED_GUEST_RELATION } })`.
 */
export const SUBSCRIBED_GUEST_RELATION = {
  is: SUBSCRIBED_GUEST,
};

/** Guests who have opted out — the complement, for counting. */
export const UNSUBSCRIBED_GUEST = {
  consent: { is: { subscribed: false } },
};
