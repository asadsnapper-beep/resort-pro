# Multi-property: one account, three resorts

Rewritten 2026-09-16, when the first customer turned out to run **three
resorts**. The earlier version of this file planned a filter and nothing else;
it would have shipped something that looks right and cannot be used, for the
reasons in "The wall" below.

> "Manages two to five properties and needs one owner-level view."
> — FOUNDER_CONTEXT.md

## What the owner must be able to do

1. One login and one bill for all three resorts.
2. Each resort's staff see **their** resort by default and cannot be confused
   by another's arrivals.
3. Rooms numbered 101 at every resort.
4. Each resort has its own prices, its own menu, its own stock, its own
   expenses — therefore **its own profit and loss**.
5. Guests and loyalty recognised across all three.
6. Each resort has its own public booking page.
7. The owner can see one resort or all three, on the same screens.

Anything short of 3 and 4 is not multi-property; it is a filter.

## The wall

`Room` is unique on `(tenantId, number)`. Two resorts in one account cannot
both have room 101 — the API answers "Room number already exists". Nothing
about filtering fixes this, which is why the data model comes first.

## What is separate, what is shared

The rule: **separate if it is physically at one resort; shared if it belongs
to the business.**

| | Separate per property | Why |
|---|---|---|
| Room | **column** (already exists, becomes required) | physical |
| Booking, Housekeeping, Maintenance | via `room.propertyId` | follows the room |
| Rate plans, Packages, Offers | **column** | hill and beach do not cost the same |
| Menu items, Restaurant tables, Minibar | **column** | separate kitchens |
| Inventory, movements, purchase orders | **column** | separate stores |
| Expenses | **column** | without it there is no per-resort P&L |
| Staff | **column, nullable** | most work at one; an owner works across |
| External calendars (OTA) | **column** | each resort is its own listing |
| Website content | **column** | a guest books one resort, not a group |
| Assets, Vehicles, Venues | **column** | physical |

| | Shared across the group | Why |
|---|---|---|
| Guests, Loyalty, CRM, campaigns | one guest, one history | the reason to be one account |
| Corporate accounts | contracts are with the company | |
| Users and logins | one login, access per property | |
| Subscription, plan limits, billing | one bill | |
| Brand, legal pages, integrations (email, SMS, gateways) | set once | |
| Invoice numbering | one book for the business | changing it later is painful; decide now |

**Currency and tax stay tenant-level.** Three resorts in one country share
both. Revisit only if a customer crosses a border.

## Data model changes

### 1. Every room belongs to a property

- Backfill: every tenant that has rooms gets a property named after the
  tenant, and all its rooms are assigned to it. One migration, no data loss.
- `Room.propertyId` becomes **required** in a second migration, after the
  backfill is verified on staging.
- `@@unique([tenantId, number])` → `@@unique([propertyId, number])`. This is
  the change that makes room 101 possible three times.
- "Unassigned rooms" stop existing. That removes the trap where choosing a
  property silently hides rooms nobody had assigned.

### 2. `propertyId` on the models in the separate table above

Each is nullable at first and backfilled to the tenant's single property, then
made required where it makes sense (`Staff` stays nullable — group-level
people exist). One migration per group of models, each generated with
`prisma migrate diff`.

### 3. Who may see which property

New join table:

```prisma
model UserProperty {
  userId     String
  propertyId String
  @@id([userId, propertyId])
}
```

- OWNER and ADMIN see everything, always; no rows needed.
- A user **with no rows** sees everything. Every existing single-property
  account keeps working untouched.
- A user with rows sees only those properties, and the picker offers only
  those. A receptionist at the Hill cannot check in a Beach guest.
- The `X-Property-Id` header is checked against this set. A property outside
  it is refused, not silently ignored — silence would look like an empty
  resort.

## Per-property settings

`Property` already has name, address, phone, email, timezone, checkInTime,
checkOutTime, type. Today nothing reads them; the tenant's are used.

Switching to the property's values changes how nights are counted and how a
day is bounded in reports, so it is **its own step with its own tests**, built
on the timezone work already in `services/reporting/period.ts`.

## The public booking page

Each resort needs its own page. Today `WebsiteContent` is one row per tenant
and the site is `<tenant-slug>.resortpro.site`.

- Step one: `WebsiteContent` gains `propertyId`, and the page moves to
  `<tenant-slug>.resortpro.site/<property-slug>`, with the tenant root
  listing the three resorts. The embed widget's `data-slug` accepts a
  property slug too.
- Later, if the group wants separate marketing addresses, give `Property` a
  globally-unique slug and serve `<property-slug>.resortpro.site`. Not in
  this week.

## Reports and money

- `buildReport` takes an optional property. With none it reports the group,
  with one it reports that resort.
- Expenses carry a property, so **profit and loss per resort** becomes
  possible. This is the number the owner actually wants.
- The daily report email keeps one message per tenant, with a section per
  property, and says which resorts it covers. One email per property is a
  later refinement.

## Writes, not just reads

A filter that only affects reading is half a feature.

- Creating anything property-bound while "All properties" is selected must
  **ask which property**. Never attach to the first one silently.
- With a property selected, the form pre-fills it.
- Moving a room between properties is allowed and must check the number is
  free at the destination.

## Order of work

Each step is one commit with tests, safe on its own, in this order because
each depends on the one before.

| # | Step | Done when |
|---|---|---|
| 1 | ~~Picker, Rooms list and counts~~ | shipped, da9a86f |
| 2 | Backfill + `Room.propertyId` required + unique per property | room 101 exists at all three resorts |
| 3 | `UserProperty` + header enforcement + picker respects it | a Hill receptionist cannot see Beach |
| 4 | Bookings, front desk, calendar, housekeeping, maintenance | a day at the Hill shows only the Hill |
| 5 | Rate plans, packages, offers | each resort prices itself |
| 6 | Expenses + reports per property, group and single | P&L per resort |
| 7 | Menu, tables, minibar, inventory, purchase orders | each kitchen and store is its own |
| 8 | Website content per property, public page per resort | a guest books one resort |
| 9 | Property check-in times and timezone honoured | a night is counted by the resort's clock |
| 10 | Demo tenant with three properties | the feature can be seen without setup |

Then restore the two claims removed in 77e8451: "Multi-property owner view"
and the "Multi-property reporting" row.

## Acceptance shape, every step

The same four cases as `tests/integration/property-scope-rooms.test.ts`:

- no header → everything, exactly as before;
- a property id → only its rows;
- another tenant's property id → nothing;
- a malformed header → everything, never an empty page.

Plus, from step 3 on: a property the user is not assigned to → refused.

## Risks

- **The room uniqueness swap** is the one migration that can fail on real
  data: it must run after the backfill, and a tenant with two rooms numbered
  101 in different properties only becomes possible afterwards. Verify on
  staging with production's shape first.
- **Half-scoped is confusing.** Between steps, some pages honour the picker
  and some do not. Steps 4 to 7 should land close together, and the pages
  that do not yet honour it should say so rather than look filtered.
- **`SEED_DEMO_REFRESH=1` on production** rebuilds the demo tenant on every
  API start; the demo's three properties must be created by the seed, not by
  hand, or they vanish.

## Deliberately not in this week

- Separate subdomains per property.
- Per-property currency, tax rate or invoice numbering.
- Per-property subscription limits — the plan's room limit stays per account.
- Moving a booking between properties (moving a room is enough).

## Decisions needed from the founder

1. Does this customer use the **restaurant / inventory** modules? If not,
   step 7 moves after step 10 and the week gets easier.
2. Do the three resorts need **three public booking pages** now, or is the
   group page enough for launch? That decides whether step 8 is in the week.
3. Do any staff work at **more than one** resort? If nobody does,
   `UserProperty` can be a single column instead of a join table — simpler,
   but harder to change later.
