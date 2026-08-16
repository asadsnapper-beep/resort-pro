/**
 * Who may use which theme, and what a theme costs right now.
 *
 * Themes are sold one-time and permanently (see
 * plan/theme-studio-and-design-service.md, 2026-08-13): once a resort has
 * bought one it is theirs forever, with no expiry and no dependence on their
 * subscription still being active. Ownership is therefore just "does a
 * ThemePurchase row exist", never a date comparison.
 *
 * This lives in one place because the same two questions get asked from three
 * directions — the theme picker showing a price, the save that has to refuse
 * an unpaid theme, and checkout charging for one. If those ever disagreed, a
 * customer would be shown one price and charged another.
 */

/** The pricing columns any of these checks need. Loose types so a Prisma
 *  `select` of exactly these fields satisfies it without extra ceremony —
 *  Decimal arrives as a string over the wire and as Decimal in-process. */
export interface ThemePricingFields {
  priceUsd: unknown;
  priceBdt: unknown;
  offerPriceUsd?: unknown;
  offerPriceBdt?: unknown;
  offerEndsAt?: Date | null;
}

export interface EffectivePrice {
  /** What a buyer pays right now, offer included. */
  usd: number;
  bdt: number;
  /** The undiscounted price, so the UI can show it struck through. */
  listUsd: number;
  listBdt: number;
  onOffer: boolean;
  /** True when the theme costs nothing — anyone may use it. */
  isFree: boolean;
}

/**
 * An offer counts only while it is actually running: once `offerEndsAt` has
 * passed, the list price is what applies again. A null `offerEndsAt` means the
 * offer runs until an admin clears it.
 */
export function effectiveThemePrice(theme: ThemePricingFields): EffectivePrice {
  const listUsd = Number(theme.priceUsd ?? 0) || 0;
  const listBdt = Number(theme.priceBdt ?? 0) || 0;

  const hasOffer = theme.offerPriceUsd !== undefined && theme.offerPriceUsd !== null;
  const notExpired = !theme.offerEndsAt || theme.offerEndsAt.getTime() > Date.now();
  const onOffer = hasOffer && notExpired;

  return {
    // If an admin set only the USD offer, the BDT side falls back to its list
    // price rather than guessing a converted figure — the two currencies are
    // deliberately independent, and falling back never undercharges.
    usd: onOffer ? Number(theme.offerPriceUsd) : listUsd,
    bdt: onOffer && theme.offerPriceBdt != null ? Number(theme.offerPriceBdt) : listBdt,
    listUsd,
    listBdt,
    onOffer,
    isFree: listUsd <= 0,
  };
}

export type ThemeAccessDenial =
  /** Someone else commissioned this bespoke design. */
  | { allowed: false; code: 'THEME_NOT_AVAILABLE'; message: string }
  /** A paid theme this resort has not bought yet. */
  | { allowed: false; code: 'THEME_NOT_PURCHASED'; message: string; price: EffectivePrice };

export type ThemeAccess = { allowed: true } | ThemeAccessDenial;

interface ThemeAccessInput extends ThemePricingFields {
  exclusiveToTenantId: string | null;
}

/**
 * Decide whether `tenantId` may apply `theme`, given whether they own it.
 *
 * Kept free of database access so the picker can reuse it across a whole list
 * with one purchases query instead of one per theme.
 */
export function themeAccessFor(
  theme: ThemeAccessInput,
  tenantId: string,
  owned: boolean,
): ThemeAccess {
  // Bespoke work belongs to the resort that commissioned it. For that resort
  // the design request was the purchase, so no ThemePurchase row is expected.
  if (theme.exclusiveToTenantId) {
    return theme.exclusiveToTenantId === tenantId
      ? { allowed: true }
      : { allowed: false, code: 'THEME_NOT_AVAILABLE', message: 'That theme is not available for your resort.' };
  }

  const price = effectiveThemePrice(theme);
  if (price.isFree || owned) return { allowed: true };

  return {
    allowed: false,
    code: 'THEME_NOT_PURCHASED',
    message: 'This theme has to be purchased before your website can use it.',
    price,
  };
}
