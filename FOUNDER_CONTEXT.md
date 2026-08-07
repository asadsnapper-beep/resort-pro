# ResortPro founder and marketing context

This file is the default business context for ResortPro marketing work. Treat
product code and the canonical pricing source as evidence; do not turn demo
content into public claims without verification.

## Product in one sentence

ResortPro is an all-in-one operating platform for independent resorts and
small resort groups, bringing bookings, front desk, payments, guest records,
housekeeping, restaurant operations, and direct booking into one shared view.

## Positioning

- Category: resort management software / hospitality operating system.
- Primary market: independent resorts and smaller multi-property resort groups.
- Geographic starting point: Bangladesh and similar markets where teams work
  across the front desk, phone, WhatsApp, spreadsheets, and local payment
  methods. Do not imply geographic exclusivity.
- Core promise: help the whole property run from the same live information so
  staff can spend less time reconciling operational details and more time on
  the guest experience.
- Strategic distinction: ResortPro connects the guest-facing booking journey
  with day-to-day property operations. It is more than a booking calendar and
  should not be described as generic project-management software.

## Primary audiences

### Independent resort owner

- Operates one property, often with a lean team.
- Wants control of bookings, payments, staff activity, and guest service
  without maintaining several disconnected tools.
- Cares about visibility, direct bookings, ease of setup, local payments,
  predictable cost, and retaining access to their data.
- Common objections: migration effort, staff training, technical complexity,
  payment support, reliability, and whether the software fits a small property.

### General manager / operations manager

- Coordinates front desk, housekeeping, restaurant, maintenance, and reports.
- Needs a reliable live view of arrivals, departures, room status, balances,
  tasks, and service requests.
- Cares about fewer handoff errors, faster answers, clear responsibility, and
  less manual reconciliation.

### Resort group owner

- Manages two to five properties and needs one owner-level view.
- Cares about consistent operations, portfolio visibility, permissions,
  reporting, onboarding, and support.

### Secondary users

Receptionists, marketers, housekeeping staff, chefs, developers/IT staff, and
read-only shareholders each have role-specific access demonstrated in the live
demo. Marketing should lead with the buyer's outcome, then show how the wider
team benefits.

## Messaging hierarchy

1. **One live picture of the day**: bookings, payments, rooms, orders, and
   guest information stay connected for the people running the property.
2. **Lighter daily operations**: replace scattered handoffs and repetitive
   reconciliation with clear, role-based workflows.
3. **A better direct-booking relationship**: publish a booking link or embed
   the booking experience on the property's own website.
4. **Hospitality stays personal**: useful guest history and connected service
   help teams recognise returning guests and respond with context.
5. **Grow without replacing the system**: start with one small property and
   move to richer operational or multi-property plans as needs expand.

## Verified capabilities

The repository currently supports or explicitly models:

- bookings, rooms, guests, check-in/check-out, invoices, and payments;
- direct-booking pages/widgets and public resort websites;
- guest CRM, offers, loyalty, and marketing campaigns;
- housekeeping, maintenance, inventory, restaurant, and room-service flows;
- reports and analytics;
- role-based views for owners, managers, receptionists, marketers,
  housekeeping, chefs, developers, and shareholders;
- web, mobile, and desktop clients;
- multi-property support on the Resort Group plan;
- English and Bangla product experiences;
- local and international payment options represented in current product copy.

Feature availability depends on plan. Check `packages/types/src/plans.ts` before
publishing a plan comparison or entitlement claim.

## Canonical public plans

Pricing and limits below were verified against `packages/types/src/plans.ts` on
2026-08-06. Re-check that source before publishing time-sensitive pricing.

| Plan | Monthly | Annual | Properties | Rooms | Staff |
|---|---:|---:|---:|---:|---:|
| Solo | $10 / ৳1,000 | $100 / ৳10,000 | 1 | 5 | 2 |
| Independent Resort | $19 / ৳1,900 | $190 / ৳19,000 | 1 | 20 | 20 |
| Resort Group | $59 / ৳5,900 | $590 / ৳59,000 | 5 | 200 | 100 |

There is no free public plan. `FREE` is an internal enum key whose public name
is Solo. Never expose internal plan keys in marketing copy. Enterprise is a
legacy/custom plan and is not a self-serve public plan.

## Brand personality and voice

If ResortPro were a person, it would be a calm, capable hospitality operator
who understands a busy property, explains software plainly, and respects the
craft of welcoming guests.

### Warm and operationally credible

- We are: human, observant, and grounded in real property workflows.
- We are not: sentimental, vague, or filled with hospitality clichés.
- Sounds like: “See the rooms that need attention before the first guest reaches the desk.”
- Avoid: “Deliver magical guest experiences with revolutionary technology.”

### Clear and approachable

- We are: concise, concrete, and understandable to non-technical operators.
- We are not: childish, over-casual, or stripped of useful detail.
- Sounds like: “Publish your booking link or add it to your existing website.”
- Avoid: “Leverage our robust booking ecosystem.”

### Confident and honest

- We are: specific about what the product does and transparent about limits.
- We are not: boastful, fear-based, or dependent on unsupported superlatives.
- Sounds like: “Solo supports one property, five rooms, and two staff.”
- Avoid: “The best hotel software in Bangladesh.”

### Modern but not tech-obsessed

- We are: current, thoughtful, and comfortable with technology.
- We are not: jargon-heavy or eager to make AI the hero of every message.
- The resort team and guest outcome are always the heroes. Technology is the
  useful mechanism.

## Language and style

- Default English tone: warm, direct, professional, and conversational.
- Default Bangla tone: natural Bangla used by working hospitality teams. Keep
  widely understood product terms such as booking, check-in, dashboard, room,
  payment, and report in English when forced translations feel less natural.
- Use “resort” when addressing the core audience. Use “property” where a claim
  also applies to boutique hotels or other accommodation businesses.
- Prefer “direct booking” over “commission-free booking” unless the complete
  fee structure has been verified.
- Prefer concrete operational moments over abstract benefit adjectives.
- Use contractions in English. Keep paragraphs short and scannable.
- Use sentence case for headings unless a channel convention requires otherwise.
- Use one clear CTA per asset. Name the next action, such as “Explore the live
  demo,” “See plans,” or “Book a demo.”
- Do not use fake urgency, invented scarcity, or invented social proof.

## Terms to prefer

| Prefer | Avoid or qualify |
|---|---|
| resort management platform | generic “business solution” |
| one shared/live view | seamless ecosystem |
| direct booking page or widget | commission-free, unless verified |
| guest history / guest profile | 360-degree customer view |
| resort team / property team | users, when people are the focus |
| setup / onboarding | effortless implementation |
| Resort Group | Professional (internal/legacy-facing name) |
| Solo | Free |

## Proof and claim policy

Only publish a number, testimonial, customer logo, integration statement,
security statement, uptime statement, or performance outcome when a named
source can substantiate it.

The current marketing pages contain demo testimonials and outcome statistics,
including references to Palm House, Palm Paradise Resort, Sea View Boutique
Hotel, Blue Lagoon Spa Resort, faster check-in, and increased direct bookings.
Treat all of these as unverified demo content until the founder supplies
customer consent and evidence. Do not reuse them in ads, posts, emails, case
studies, or sales collateral by default.

Likewise, verify current production readiness before stating that a payment
gateway, offline mode, hardware connection, encryption standard, backup policy,
hosting provider, SLA, or third-party integration is fully available.

## Recommended channel roles

- Website: clear positioning, product education, plan selection, demo and
  registration conversion.
- Facebook: practical Bangla-first education for owners and managers, product
  demonstrations, customer stories once verified, and live-demo invitations.
- LinkedIn: founder/operator insights, hospitality operations education,
  product decisions, partnerships, and group-level use cases.
- YouTube / short video: workflow demonstrations built around one operational
  moment at a time.
- Email: demo follow-up, onboarding education, plan guidance, and feature
  adoption. Keep each email focused on one next action.
- Blog / search: high-intent educational content around resort management,
  direct booking, front-desk operations, housekeeping coordination, guest CRM,
  and Bangladesh hospitality operations.

## Default conversion paths

- Problem-aware visitor: practical content -> relevant product workflow -> live demo.
- Solution-aware visitor: feature/use-case page -> plan comparison -> registration.
- Group or complex operation: multi-property content -> book a demo/contact.
- Existing lead: demo follow-up -> relevant plan -> registration/onboarding.

## Open decisions for the founder

These should be resolved before scaling campaigns:

- priority launch geography and customer segment;
- the single highest-value acquisition goal for the next 90 days;
- verified customer list, testimonials, and outcome evidence;
- approved production integrations and security claims;
- monthly marketing budget and channel ownership;
- founder voice examples for personal posts;
- preferred Bangla/English mix by channel.

Until these are answered, use the positioning above, state assumptions, and
avoid claims that require external proof.
