# Pricing Rollout — Engineering Instructions (Steps 2–4)

> Business decision: [plan/launch-pricing-and-trial-abuse-prevention.md](../plan/launch-pricing-and-trial-abuse-prevention.md) (locked 2026-08-04). This file is the **code-level how-to** for that decision — file paths, exact diffs, and what infrastructure already exists vs. what must be built from scratch.
>
> **Step 1 status: DONE.** `packages/types/src/plans.ts` is the canonical source (`FREE`=Solo $10, `STARTER`=Independent Resort $19, `PROFESSIONAL`=Resort Group $59, `ENTERPRISE`=legacy/custom, `isPublic: false`). Local dev `PlatformSettings.plans` row and `entitlement.ts` `DEFAULT_PLAN_CONFIGS` already read from it. Verified live: `/api/billing/status` and `/api/admin/mrr-growth` both return the new names/prices.
>
> **Implementation status (local, 2026-08-04):** Steps 2–4 are implemented in code. Stripe/bKash environment price IDs, migration deployment, and end-to-end payment checks remain before release.

---

## Step 2 — Entitlement gating (the big one)

### The gap, stated plainly

Grep result: **no route file calls anything like `requireFlag()`.** `DEFAULT_PLAN_CONFIGS[].flags` (in `apps/api/src/utils/entitlement.ts`) is currently pure marketing metadata — it is read by the admin settings UI and the dashboard billing page, but **nothing blocks an API call based on it.** Today, a Solo ($10) tenant can call the CRM, restaurant, marketing, loyalty, etc. endpoints exactly like a Resort Group tenant. Only `roomLimit` and `staffLimit` are actually enforced (via `checkRoomLimit`/`checkStaffLimit`, used in `apps/api/src/routes/rooms.ts:165` and `apps/api/src/routes/staff.ts:75`).

Also: `TenantEntitlement` (in `entitlement.ts`) has no `propertyLimit` field at all, even though `PLAN_PRICING.*.propertyLimit` exists. Property-count enforcement does not exist anywhere — `apps/api/src/routes/properties.ts:21` calls `resolveTenantEntitlement` but only for something else (check what it reads before assuming it's already gating property count — as of this writing it is not).

So Step 2 is genuinely new infrastructure, not a tweak.

### 2a. Add missing flags to the registry

`apps/api/src/utils/feature-flags.ts` — `FLAG_REGISTRY` currently only has: `beta_analytics`, `revenue_forecast`, `ai_content`, `ai_chatbot`, `ai_business_insights`, `advanced_reports`, `export_pdf`, `new_booking_flow`, `dark_mode_toggle`, `restaurant_module`, `crm_v2`. Missing, needed per the plan doc's per-plan feature lists:

```ts
{ flag: 'custom_domain', label: 'Custom Domain', description: 'Bring your own domain for the booking site.', category: 'Modules', defaultOn: false },
{ flag: 'payment_gateway', label: 'Online Payment Gateway', description: 'bKash/Stripe merchant checkout on the booking site.', category: 'Modules', defaultOn: false },
{ flag: 'housekeeping_module', label: 'Housekeeping', category: 'Modules', defaultOn: false, ... },
{ flag: 'inventory_module', label: 'Inventory', category: 'Modules', defaultOn: false, ... },
{ flag: 'maintenance_module', label: 'Maintenance', category: 'Modules', defaultOn: false, ... },
{ flag: 'marketing_module', label: 'Marketing', category: 'Modules', defaultOn: false, ... },
{ flag: 'loyalty_module', label: 'Loyalty', category: 'Modules', defaultOn: false, ... },
{ flag: 'offers_module', label: 'Offers & Packages', category: 'Modules', defaultOn: false, ... },
{ flag: 'rate_plans_module', label: 'Rate Plans', category: 'Modules', defaultOn: false, ... },
{ flag: 'group_bookings_module', label: 'Group Bookings', category: 'Modules', defaultOn: false, ... },
{ flag: 'vehicles_module', label: 'Vehicles', category: 'Modules', defaultOn: false, ... },
{ flag: 'venues_module', label: 'Venues', category: 'Modules', defaultOn: false, ... },
{ flag: 'corporate_accounts_module', label: 'Corporate Accounts', category: 'Modules', defaultOn: false, ... },
{ flag: 'channel_sync', label: 'OTA Channel Sync', category: 'Modules', defaultOn: false, ... },
```

Then set each plan's `flags: []` array in `entitlement.ts`'s `DEFAULT_PLAN_CONFIGS` per the plan doc §3:

- **FREE (Solo):** `[]` — no extra flags, only core (bookings/calendar/front-desk/guests/invoices/reports/subdomain), which are never flag-gated (see 2c).
- **STARTER (Independent Resort):** `['custom_domain', 'payment_gateway', 'crm_v2', 'restaurant_module', 'housekeeping_module', 'inventory_module', 'maintenance_module', 'marketing_module', 'loyalty_module', 'offers_module', 'rate_plans_module', 'group_bookings_module', 'vehicles_module', 'venues_module', 'export_pdf', 'ai_content']`
- **PROFESSIONAL (Resort Group):** everything in STARTER + `['channel_sync', 'corporate_accounts_module', 'advanced_reports', 'beta_analytics', 'ai_chatbot']`
- **ENTERPRISE:** everything (unchanged, already has the fullest list).

### 2b. Add `propertyLimit` to `TenantEntitlement` + a check function

In `entitlement.ts`:

```ts
export interface TenantEntitlement {
  plan: string;
  propertyLimit: number;   // NEW
  roomLimit: number;
  staffLimit: number;
  aiMonthlyTokenCap: number;
  flags: Record<string, boolean>;
}
```

Add `propertyLimit: planConfig?.propertyLimit ?? 1` to `resolveTenantEntitlement`'s return (need to also add `propertyLimit` to the `PlanConfig` interface, sourced from `PLAN_PRICING.*.propertyLimit`). Add a `checkPropertyLimit(tenantId)` function mirroring `checkRoomLimit`/`checkStaffLimit`, counting `prisma.property.count({ where: { tenantId } })`. Wire it into `apps/api/src/routes/properties.ts`'s create handler the same way `rooms.ts:165` and `staff.ts:75` already do it — copy that exact pattern.

### 2c. Build the actual gate — a `requireFlag` preHandler

Nothing like this exists yet. Add to `apps/api/src/middleware/auth.ts` (next to `requireAuth`/`requireRole`):

```ts
export function requireFlag(flag: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.user as JwtPayload;
    const entitlement = await resolveTenantEntitlement(tenantId);
    if (!entitlement.flags[flag]) {
      return reply.status(403).send({
        success: false,
        error: 'This feature requires a higher plan.',
        upgradeRequired: true,
      });
    }
  };
}
```

Then add it to the route registration's `preHandler` array (alongside the existing `requireRole(...)`) in every module route file that should be Solo-blocked: `crm.ts`, `restaurant.ts`, `restaurantTables.ts`, `housekeeping.ts`, `inventory.ts`, `maintenance.ts`, `marketing.ts`, `loyalty.ts`, `offers.ts`, `ratePlans.ts`, `groupBookings.ts`, `vehicles.ts`, `venues.ts`, `corporateAccounts.ts`, `externalCalendars.ts` (channel sync). **Do not gate** `bookings.ts`, `rooms.ts`, `guests.ts`, `invoices.ts`, `frontDesk.ts`, `reports.ts` (basic), `dashboard.ts` — these are core/Solo-included per the plan doc §3 and must stay open at every plan.

For **custom domain**, gate it where the domain is actually set (likely in `tenants.ts`'s domain-update handler, not a whole route file) — check `apps/web/src/app/admin/(panel)/domains` / the corresponding API route added in the earlier "custom domain" feature work this session touched, and add `requireFlag('custom_domain')` there specifically.

**Acceptance check (from the plan doc, Step 2):** a Solo tenant can complete a real booking and export data (must still work); a Solo tenant hitting `POST /api/crm/...` or similar gets a 403 with `upgradeRequired: true`; an Independent Resort tenant can attach a custom domain.

### 2d. Frontend: show an upgrade prompt, not a broken page

Wherever the dashboard calls a gated endpoint, catch the `403 upgradeRequired` shape and show an upsell (not a silent failure). The sidebar (`apps/web/src/components/dashboard/sidebar.tsx`) should also hide/lock nav items the tenant's plan doesn't include — check `useAuthStore`'s `tenant.plan` or a fetched entitlement object, cross-reference against `PLAN_PRICING[plan].isPublic`-gated feature list (you'll need a shared `PLAN_FEATURES` map, could live in `packages/types/src/plans.ts` alongside `PLAN_PRICING` — same shape as the `flags` arrays in `entitlement.ts` above, just exposed to the frontend too since `entitlement.ts` is API-only).

---

## Step 3 — Billing (Stripe/bKash/subscription states)

### Already fine (no action needed)

- `apps/api/src/routes/billing.ts`'s `PLANS` (Stripe) and `BKASH_PLAN_BDT`/`BKASH_PLAN_ANNUAL_BDT` already read from `PLAN_PRICING` (done in the pricing-normalization work earlier). Changing `plans.ts` already changed these — verified live via `/api/admin/mrr-growth`.
- `Tenant.planStatus` enum (`trialing | active | past_due | canceled | incomplete`) already exists in the schema.
- `apps/web/src/app/(dashboard)/layout.tsx:71-86` already redirects `canceled`/`past_due` tenants to `/dashboard/suspended` or `/dashboard/upgrade` — a coarse read-only-ish mechanism already exists client-side.

### Still needed

1. **Real Stripe price IDs.** `STRIPE_PRICE_STARTER`/`STRIPE_PRICE_PRO`/`STRIPE_PRICE_ENTERPRISE` env vars point at whatever Stripe products were created for the *old* $20/$50/$100 prices (or are still placeholders). Create three new Stripe Price objects at $10/$19/$59 (and matching annual $100/$190/$590 prices, or use Stripe's built-in yearly-interval price on the same product) and update the env vars in Coolify. There's no `STRIPE_PRICE_FREE` env var yet — add one now that Solo needs a real checkout.
2. **True read-only, not just a redirect.** The current mechanism only redirects the *web app's* navigation — it does not stop API writes if someone hits the API directly (e.g., via the desktop app, or a stale browser tab). Add a check in `requireAuth` (or a new `blockIfReadOnly` preHandler) that rejects mutating requests (`POST`/`PATCH`/`PUT`/`DELETE`, but not `GET`) with 402 when `tenant.planStatus` is `past_due`/`canceled`, **except** for the billing/upgrade endpoints themselves (mirror `BILLING_EXEMPT_PATHS` from the web layout).
3. **`priceProtectedUntil` field.** Add to `Tenant` in `schema.prisma` (migration required, use the shadow-DB-diff workflow this project always uses — never `db push`). Set it on every plan change (new signup, upgrade, or the Step 6 migration script) to `now() + 12 months`. Use it to decide whether a price increase applies to a given tenant yet.
4. **Promotion record** for the 3-month launch offer — see Step 5 in the plan doc; this needs its own migration (`PromotionRedemption`-style model, simplified now that OTP/mandatory wallet-linking are explicitly out of scope per the locked doc §9). A minimal version: `promotionKey`, `tenantId` (unique), `redeemedAt`, `expiresAt`. No fraud-scoring fields needed for this simplified version — just enough to (a) know a tenant is in the 3-free-months window, (b) prevent the exact same verified business from redeeming twice (check by normalized business name + address, per §6's fair-anti-abuse rules — a simple case-insensitive match is enough, this is explicitly *not* meant to be hardened against determined abuse).

---

## Step 4 — Public-facing pages (landing, `/plans`, register, `/upgrade`, `/bn`)

**Every one of these files currently shows three cards keyed `STARTER`/`PROFESSIONAL`/`ENTERPRISE`** — the *old* 3-tier scheme, before Solo/Free existed as a public plan. They all need the same mechanical change: **drop `ENTERPRISE` from the public card set, add `FREE` in its place**, and update copy. `ENTERPRISE` stays in the codebase for admin-assigned legacy accounts (the admin tenants dropdown at `apps/web/src/app/admin/(panel)/tenants/page.tsx` should **keep** showing all four — that's an internal tool, not a public plan picker).

Also: the landing page (`apps/web/src/app/page.tsx`) still has "Founding Resort" / "First 100" copy left over from an earlier, now-superseded pricing iteration (see the plan doc's "Supersedes" line). That framing is gone in the locked doc — remove it, don't just relabel it.

### 4a. `apps/web/src/app/page.tsx` — landing page

Current `planCards` (search for `const planCards = [`) has 3 entries keyed `STARTER`/`PROFESSIONAL`/`ENTERPRISE`, with `featured: true` on the `STARTER` card and a `"First 100"` badge tied to `plan.featured` in the render code below it (search for `First 100`). Replace with:

```ts
const planCards = [
  {
    key: 'FREE' as const,
    label: 'Solo',
    title: 'Everything a small property needs, day one.',
    description: 'Bookings, calendar, front desk, guest history, invoices, and a free booking page.',
    features: ['1 property · 5 rooms · 2 staff', 'Bookings, guests & invoices', 'Full data export, always'],
  },
  {
    key: 'STARTER' as const,
    label: 'Independent Resort',
    title: 'Everything you need to run one property, fully.',
    description: 'Your own domain, CRM, restaurant, and every operational module.',
    features: ['1 property · 20 rooms · 20 staff', 'Custom domain & online payments', 'CRM, restaurant, housekeeping & more'],
    featured: true,
  },
  {
    key: 'PROFESSIONAL' as const,
    label: 'Resort Group',
    title: 'One view across every property you run.',
    description: 'For owners managing more than one property.',
    features: ['Up to 5 properties · 200 rooms', 'Multi-property owner view', 'Priority onboarding & support'],
  },
];
```

Remove the `"First 100"` badge block entirely (it referenced a promotion structure the locked doc no longer uses — the 3-month offer now applies to whichever plan is chosen, not a capped first-100 slot). Replace with nothing, or a small "3 months free to start" note applied uniformly to all three cards, sourced from the (still-to-be-built) `Promotion` config rather than hardcoded.

### 4b. `apps/web/src/app/plans/page.tsx`

Same shape of change: `PLANS` array currently has `id: 'STARTER'`, `id: 'PROFESSIONAL'`, `id: 'ENTERPRISE'`. Add a Solo (`id: 'FREE'`) entry first, drop the Enterprise entry (or keep it as a non-card "Need more than Resort Group? Contact sales" line — that pattern already exists on this page, reuse it, just make sure it no longer implies Enterprise is a selectable public card). `COMPARE_ROWS` table needs a 4th... no, 3rd column relabeled Solo/Independent/Resort Group instead of Starter/Professional/Enterprise.

### 4c. `apps/web/src/app/bn/page.tsx`

Same `PLANS` array shape (`name: 'STARTER'`, `'PROFESSIONAL'`, `'ENTERPRISE'`) — add a Solo entry in Bangla, drop Enterprise. Follow the existing `bnTaka`/`bnNum` helper pattern already in this file for BDT figures and Bengali-numeral room/staff counts.

### 4d. `apps/web/src/app/auth/register/page.tsx`

`PLAN_META` record currently has `STARTER`/`PROFESSIONAL`/`ENTERPRISE` keys. Add a `FREE` key:

```ts
FREE: { label: PLAN_PRICING.FREE.displayName, color: '#6b7280', icon: /* pick something */, desc: `$${PLAN_PRICING.FREE.monthlyUsd}/mo · Up to ${PLAN_PRICING.FREE.roomLimit} rooms` },
```

Remove (or keep only for direct-link/legacy support, not in the visible picker UI) the `ENTERPRISE` entry from whatever list actually renders the selectable plan cards on this page.

### 4e. `apps/web/src/app/(dashboard)/dashboard/upgrade/page.tsx`

Same pattern — `PLANS` array keyed `STARTER`/`PROFESSIONAL`/`ENTERPRISE`. A tenant already on Solo needs to see Solo→Independent and Solo→Resort Group upgrade options; a tenant already on Independent needs Independent→Resort Group. Don't show "upgrade to Enterprise" here — that path is admin-assisted/custom per the plan doc, not self-serve.

### 4f. Everywhere above: use `PUBLIC_PLAN_ORDER`

`packages/types/src/plans.ts` already exports `PUBLIC_PLAN_ORDER` (filters `PLAN_PRICING` by `isPublic`). Where practical, iterate over `PUBLIC_PLAN_ORDER` instead of a hand-written array of 3 keys — that way if `ENTERPRISE.isPublic` or a future 4th plan's visibility ever flips, these pages update themselves instead of needing another manual pass through all 5 files.

---

## Testing checklist (mirrors the plan doc's Step 7)

- [ ] Solo signup requires a payment method, checkout shows $10 (or $0 if the 3-month promo is active) correctly.
- [ ] Solo tenant: create a booking, guest, invoice; export data. All must work with zero errors.
- [ ] Solo tenant: hit a gated endpoint (e.g. CRM) directly → 403 `upgradeRequired`, not a 500 or silent pass-through.
- [ ] Independent Resort tenant: attach a custom domain, use CRM/restaurant/housekeeping.
- [ ] Resort Group tenant: switch between properties, see group-level reporting.
- [ ] Annual charges equal $100 / $190 / $590 everywhere (Stripe checkout, bKash checkout, `/plans` page, register page, upgrade page — all five, not just the API).
- [ ] Promotion expiry check uses server time in `Asia/Dhaka`, not `new Date()` evaluated in whatever timezone the request originates from.
- [ ] Duplicate promotion attempt → tenant still gets a normal paid account at full price, never blocked.
- [ ] Cancel a subscription → data intact, dashboard shows read-only, API rejects writes (test via direct API call, not just clicking through the web UI).
- [ ] Existing tenant on old `$20` `STARTER` → confirm the Step 6 migration script (not yet written) moves them to $19 or issues the credit, per the plan doc §6.
