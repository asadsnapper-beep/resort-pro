/**
 * Who may call this API from a browser, and with what.
 *
 * Every origin used to be judged the same way: resortpro.site and its
 * subdomains, plus CORS_ORIGIN, and nothing else. That is right for the
 * dashboard, and it silently broke the one feature whose whole purpose is to
 * run somewhere else. The embed widget is a script a resort pastes into its own
 * website — palmresort.com, not *.resortpro.site — and every request it made
 * was refused by the browser before the API saw it. Hosting embed.js would not
 * have helped: the widget would have loaded and then failed on its first call.
 *
 * So the two kinds of route get two answers.
 *
 * First-party origins keep exactly what they had, credentials included. The
 * public tenant site and the dashboard both depend on that, and nothing here
 * changes for them.
 *
 * Anyone else is allowed only on the public, unauthenticated routes the widget
 * uses — /site/* and /embed/* — and only *without* credentials. That is the line
 * that matters. CORS does not stop anyone calling these routes (curl never
 * asked permission); what it protects is a signed-in browser's cookies. With
 * credentials off, a third-party page cannot ride a user's session, so opening
 * these routes exposes nothing that was not already public. Every /api/* route
 * stays first-party only.
 */

const RESORTPRO_ORIGIN = /^https?:\/\/([a-z0-9-]+\.)*resortpro\.site$/i;

/** Public routes a resort's own website calls: the widget, and tenant sites. */
const PUBLIC_CROSS_ORIGIN_PATH = /^\/(site|embed)\//;

export interface CorsDecision {
  origin: boolean;
  credentials?: boolean;
}

export function corsDecision(
  origin: string | undefined,
  url: string | undefined,
  envOrigins: readonly string[],
): CorsDecision {
  // No Origin header: same-origin, or not a browser at all (curl, health
  // checks, server-to-server). Unchanged from before.
  if (!origin) return { origin: true, credentials: true };

  if (RESORTPRO_ORIGIN.test(origin) || envOrigins.includes(origin)) {
    return { origin: true, credentials: true };
  }

  if (PUBLIC_CROSS_ORIGIN_PATH.test(url ?? '')) {
    return { origin: true, credentials: false };
  }

  return { origin: false };
}
