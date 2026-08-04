# ResortPro Fair Pricing & Launch Rollout

> **Status:** Final — approved by founder 2026-08-04. Core implementation is complete locally; deployment configuration and end-to-end payment verification remain.
> **Supersedes:** the `$20/$50/$100` plan and the `$0 Free Forever` plan. This is the locked version.

## 1. The promise we are making

ResortPro is priced so a small resort owner never feels punished for being small,
and never feels stuck once they grow. Every paid tier is a genuinely commercial
business tool — not a crippled trial with a fake "free" label.

> **Start cheap. Pay for real growth, not for basic operations.**

There is **no $0 tier**. Anyone running a resort, even a 5-room guesthouse, is
running a real business and can afford a small, honest price. What replaces
"free" is a **3-month launch offer** on whichever paid plan the customer picks
— this does the trust-building job a $0 tier would have done, without giving
away the product forever to people who can pay.

## 2. Customer-facing plans — locked

| Customer-facing plan | Internal key | Monthly | Annual | Best for |
|---|---|---:|---:|---|
| **Solo** | `FREE` | **$10** | **$100** | A single small property, hands-on owner |
| **Independent Resort** | `STARTER` | **$19** | **$190** | A serious independent property running full operations |
| **Resort Group** | `PROFESSIONAL` | **$59** | **$590** | Several properties or one large operation |

Annual billing = 10× the monthly price (2 months free), same rule as before.

`ENTERPRISE` stays in the database enum for backward compatibility only. It is
**not a fourth public plan** — reserved for legacy accounts or a future custom
agreement (white-label, SSO, bespoke integration, on-site deployment).

Internal enum keys never change (`FREE`/`STARTER`/`PROFESSIONAL`/`ENTERPRISE`).
Only the customer-facing name and price/limit values changed — `FREE` the enum
key now maps to the paid "Solo" plan, it does not mean $0.

### Capacity limits — locked

| Plan | Properties | Rooms | Staff accounts |
|---|---:|---:|---:|
| Solo | 1 | 5 | 2 |
| Independent Resort | 1 | 20 | 20 |
| Resort Group | Up to 5 | 200 total | 100 total |

These are capacity limits, not a feature wall — a Solo tenant on 5 rooms gets
the full Solo feature list at full quality, not a crippled demo.

## 3. What each plan includes — locked

### Solo — $10/month

Everything needed to run one small property day to day:

- Rooms, bookings, calendar, front desk (check-in / check-out)
- Guest profiles and booking history
- Invoices and basic occupancy/revenue reports
- Free ResortPro subdomain booking page (`yourresort.resortpro.site`)
- Browser and desktop-app access
- Full data export at any time, forever

### Independent Resort — $19/month

Everything in Solo, plus what a real, full-service independent property needs:

- **Custom domain** for the direct booking website
- Online payment gateway setup (bKash / Stripe merchant)
- CRM (guest tags, scoring, segmentation, campaigns)
- Restaurant/KOT + table ordering
- Housekeeping, inventory, maintenance
- Marketing (email/SMS campaigns), loyalty program, offers/packages
- Rate plans, group bookings
- Vehicles and venues modules
- Standard remote support

### Resort Group — $59/month

Everything in Independent Resort, plus the scale layer for more than one property:

- Multi-property switching, up to 5 properties on one account
- Consolidated group-level reporting across properties
- Corporate accounts (B2B billing)
- OTA channel sync (Airbnb, Booking.com)
- Advanced analytics / revenue intelligence
- Higher AI content/chatbot allowance
- Priority remote support and onboarding help

Third-party usage stays separate at every tier when it creates real variable
cost: SMS, WhatsApp conversations, payment-gateway fees, AI overages, hardware
setup, and requested data migration. These charges are shown before use, never
silently bundled as "unlimited."

## 4. Customer-rights policy

Part of the product, billing copy, and support playbook at every tier:

1. **No data hostage:** every plan can export its own guests, bookings,
   invoices, and core operational data, always.
2. **No destructive downgrade:** if a paid customer stops paying, their data
   stays intact. Move the workspace to read-only first; never delete for a
   failed card.
3. **Clear capacity notice:** warn the owner before a room, staff, or property
   limit blocks a new record, and name the exact next plan. Never interrupt
   existing records.
4. **No surprise price rise:** a price increase applies to new accounts first.
   Existing paid customers get at least 60 days' notice and keep their current
   price for 12 months from their latest paid start date.
5. **No feature ransom:** never remove an existing customer's core daily
   workflow to force an upgrade. Upgrade prompts explain growth capacity or
   premium service, never threaten access.

## 5. Three-month launch offer

> A new verified resort that signs up for **any** paid plan (Solo, Independent
> Resort, or Resort Group) during the launch window gets **three calendar
> months free**, then billing starts at their chosen plan's normal price.

The campaign start date, end date, and first billing date live in a
server-controlled promotion configuration — never hardcoded into the landing
page, registration page, or an email. When the promotion expires, checkout
simply shows the normal price with no fallback trial.

The existing `/try` interactive demo (no signup, sandboxed data) remains the
zero-commitment way to look around before choosing a plan — the launch offer
is for people who have already decided to create a real account.

### Fair anti-abuse policy for the launch offer

One promotion per real resort/business. A suspected duplicate never blocks the
ability to pay and use the product normally at full price — it only loses the
free three months.

1. Normal email verification and business/resort details at signup.
2. Deduplicate the **promotion**, not the account, using verified business
   details and, since every plan is paid, the payment method already on file.
3. If a promotion looks duplicated, charge normally from day one and show
   neutral copy — never "fraud" or "blocked."
4. Log the reason privately for audit; a human can review and revoke later.
5. No mandatory mobile OTP or a manual fraud queue for this launch — the
   payment method itself (bKash/card) is already a real-identity signal since
   there is no free tier to abuse into.

## 6. Existing-customer migration rules

| Current internal plan | New public treatment | Migration promise |
|---|---|---|
| `FREE` (old $0 Free Forever, if any exist) | Solo, $10 | Grandfather at $0 for 12 months from today, then move to $10 with 60 days' notice. |
| `STARTER` at $20 | Independent Resort at $19 | Move to $19 automatically, or grant an equivalent $1/month credit. Never charge more for the same scope. |
| `PROFESSIONAL` at $50 | Resort Group at $59 | Keep $50 for at least 12 months. Offer the $59 scope only after clear opt-in. |
| `ENTERPRISE` at $100 | Legacy / custom | Keep current terms until the customer accepts a written migration or chooses $59 Resort Group because it fits. |

No automatic migration may delete a property, room, staff member, domain, or
historical record. If a workspace exceeds its new plan's capacity, mark the
excess read-only and give the owner a clear upgrade path — never a hard cut.

## 7. Step-by-step implementation plan

### Step 1 — One canonical pricing source (Engineering)

- Update `packages/types/src/plans.ts`: Solo $10/$100, Independent Resort
  $19/$190, Resort Group $59/$590; limits per section 2.
- Keep enum values stable (`FREE`/`STARTER`/`PROFESSIONAL`/`ENTERPRISE`).
- Add a public-plan visibility flag so `ENTERPRISE` stays available for
  legacy/custom work without appearing as a fourth public card.
- Remove every duplicate hardcoded price/limit from website, registration,
  billing, Stripe/bKash config, emails, and admin forms.

**Acceptance check:** changing one canonical value changes every customer
surface; no page has a hand-written `$10`, `$19`, or `$59`.

### Step 2 — Entitlements by capacity (Engineering + Product)

- Solo stays fully operational at its capacity — no crippled features.
- Custom domain becomes available starting at Independent Resort ($19).
- Resort Group gates: multi-property, channel sync, corporate accounts,
  advanced analytics, higher AI allowance.
- Pre-limit warning + read-only excess state instead of a sudden hard stop.

**Acceptance check:** a Solo tenant completes a real booking and exports data;
an Independent Resort tenant attaches a custom domain; no core data locks
after a downgrade.

### Step 3 — Fair billing and downgrade behaviour (Engineering)

- Update Stripe, bKash, invoice records, admin billing controls, and customer
  emails to use $10/$100, $19/$190, $59/$590.
- Subscription states: active, payment retry/grace, read-only, cancelled —
  data persists through all of them.
- Add `priceProtectedUntil` per account + migration/audit record.

**Acceptance check:** a paid tenant can cancel, see the read-only workspace,
and export data without contacting support.

### Step 4 — Public pricing and onboarding (Design + Engineering)

- Update landing page, `/plans`, register page, upgrade page, admin billing,
  and the comparison table to show exactly three public plans.
- Put "Custom domain included" visibly on Independent Resort.
- Show the active 3-month launch offer behind a server-controlled flag,
  applied to whichever plan the visitor picks.

**Acceptance check:** a visitor understands in one screen: Solo for $10 to
start, $19 once you need your own domain and CRM, $59 once you run more than
one property.

### Step 5 — Launch the promotion safely (Growth + Engineering)

- Configurable `Promotion` record: date range, eligible plans (all three),
  usage rules.
- Deduplicate per verified business + payment method already on file.
- Audit record for every redemption.

**Acceptance check:** a duplicate promotion attempt is charged normally from
day one; it is never blocked from using the product.

### Step 6 — Migrate existing customers with goodwill (Founder + Support)

- Dry-run report mapping every existing tenant per section 6.
- Apply $20 → $19 automatically or credit the difference.
- Email existing users before any change, with their exact protected price
  date and a data-export link.
- `ENTERPRISE` customers stay untouched until they actively choose a new plan.

**Acceptance check:** support can explain any customer's price, limit, and
protection date from one admin screen.

### Step 7 — Test before release (QA + Engineering)

- Solo signup requires a payment method and shows $10 (or free-launch-offer
  price) correctly.
- Solo tenant creates a booking, invoice, guest record, and exports data.
- Independent Resort tenant adds a custom domain and uses paid modules.
- Resort Group tenant manages several properties and sees group reporting.
- Annual charges equal $100 / $190 / $590 everywhere.
- Promotion expiry uses server time (Asia/Dhaka), not the browser clock.
- Duplicate promotion → normal paid account, not a block.
- Cancellation/payment failure → data intact, read-only state works.
- Existing-plan migration follows section 6 exactly.

### Step 8 — Launch, measure, adjust (Founder + Growth)

Measure monthly: signup → paid conversion, Solo tenants hitting the 5-room/2-staff
wall, Solo → Independent upgrades, Independent → Resort Group upgrades, support
time and variable vendor cost per tenant, cancellation reasons, promotion abuse
rate.

Review prices only after real evidence: at least 20 paying resorts or three
months of cost data. Since there is no $0 tier to worry about cannibalizing
into, the main lever to watch is **Solo's room/staff limit** — tighten it
(not the price) if too many resorts sit comfortably inside Solo without
upgrading.

## 8. Rollback and safety plan

- Keep the old price mapping and migration audit for reconciliation.
- Feature flags for: public plan visibility, promotion, custom-domain
  entitlement, read-only downgrade state.
- If new billing integration fails, stop new paid checkout and leave every
  existing account's access intact while fixing it.
- Never roll back by deleting subscriptions, tenant data, or domains.

## 9. Out of scope for this release

- A fourth public "enterprise" tier
- Mandatory mobile OTP or a manual fraud queue
- Advertising inside the dashboard at any tier
- Removing data export to increase conversion
- Price rises for existing users without the protection/notice in section 4

## 10. Definition of done

1. Solo ($10), Independent Resort ($19), and Resort Group ($59) are the only
   public plan choices.
2. Custom domain works starting at Independent Resort.
3. All pricing/billing/registration/admin/email surfaces use one canonical
   source (`packages/types/src/plans.ts`).
4. The 3-month launch offer applies to any of the three plans, server-controlled.
5. Promotion abuse controls affect only the free-months offer, never the
   ability to pay and use the product.
6. Existing customers have an auditable, fair migration and price-protection
   record.
