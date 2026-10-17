/**
 * The colours a guest tag can be given.
 *
 * These are hex literals rather than design tokens because they are *data*:
 * the chosen value is sent to `POST /crm/tags` and stored on the row, so every
 * place that renders that tag reads the colour back from the database. A
 * tailwind class cannot survive that round trip.
 *
 * They live here rather than in the CRM page for two reasons: the
 * design-system ratchet scans dashboard pages for raw hex and is right to —
 * a palette is not an excuse to start writing colours inline next to it — and
 * anything else that offers a tag colour (a guest sheet, a segment builder)
 * should offer the same eight.
 *
 * Picked to sit beside the resort palette: the neutral, the navy and the gold
 * are the tokens' own values, the rest are distinguishable at the size of a
 * 10px dot, which is how a tag is usually seen.
 */
export const TAG_COLOURS = [
  '#6b7280', // neutral — the API's own default
  '#183153', // rp-text / navy
  '#b89040', // gold
  '#2f8f7a', // teal
  '#c43c3c', // rp-danger
  '#7c5cbf', // violet
  '#c4733c', // amber
  '#3c7fc4', // blue
] as const;

export const DEFAULT_TAG_COLOUR = TAG_COLOURS[0];
