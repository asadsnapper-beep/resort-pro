# Multi-resort: one owner, several accounts, one 360 view

Written 2026-09-19. **This file supersedes
[multi-property.md](multi-property.md)**, which planned the opposite shape (one
account holding several properties). The founder rejected that after working
through it, and chose the model below. Where the two disagree, this file wins.

> "mone koro ekjon resort malik er 4 ta resort ase se 4 tai alada resortpro er
> pakeg kinbe then se chaile ekta deshbord a 4 ta resort er data dekte parbe.
> r resort gulate singel resort er system e cholbe."
> — founder, 2026-09-18

The first customer runs **three resorts**. Nothing here is speculative
product work; it is what that customer needs in order to use ResortPro at all.

---

## 1. The shape, in one paragraph

**Every resort stays its own ResortPro account, exactly as it is today.** Its
own subscription, its own rooms, staff, guests, shareholders, bank account,
website, tax rate and invoice book. Nothing inside a resort changes. On top of
those accounts sits a thin **group layer**: one person can connect several
resort accounts to each other, switch between them from a dropdown next to the
resort name, and open a **360 Resort Dashboard** that shows every connected
resort's numbers side by side.

The group layer owns **no business data of its own**. Delete every group row
and each resort keeps working, untouched. That is the property that makes this
safe to ship in a week.

---

## 2. The six decisions (settled with the founder, 2026-09-18/19)

| # | Question | Decision |
|---|---|---|
| 1 | Add a **new** resort | A button inside the dashboard. It creates another account and is **charged** — a new subscription. |
| 2 | Add an **existing** resort | Two paths: **same email** on both accounts → one click, auto-detected. **Different email** → an approval email to that resort's owner. |
| 3 | How much access the connection grants | Chosen **by the approving owner, at approval time**: **Full** (can open and work inside) or **Numbers only** (appears in 360 as figures, cannot be opened). **Changeable later.** |
| 4 | The resort dropdown | Visible **only to someone who has more than one resort.** Everyone else sees today's UI unchanged. |
| 5 | Billing | Each resort keeps its own subscription. **Both options offered** — separate bills (phase 1) and one combined bill (phase 10, needs Stripe live). |
| 6 | Price | **10% off from the second resort onward.** |

---

## 3. Why this shape and not one account with many properties

Recorded so nobody re-opens it in three months.

There are two kinds of multi-resort owner:

- **Type 1 — one brand, several locations.** "Sea Pearl" in Cox's Bazar,
  Sylhet and Bandarban. One company, one bank account, one shareholder list.
- **Type 2 — several brands, one owner.** Palm Retreat, Hill View Lodge, Blue
  Lagoon: different names, often different companies, **different investors in
  each**.

A single account cannot serve Type 2, and the reasons are in the schema, not
in taste:

| Thing | What breaks in a shared account |
|---|---|
| `ShareholderProfile.ownershipPercent` | It is a share **of the account**. A 40% owner of one resort would see all four resorts' revenue and be paid on the wrong base. |
| `Tenant.customDomain`, brand logo, brand colour | One brand per account. Four names cannot share one. |
| `bkashAppKey`, `sslStoreId`, `TenantPaymentConfig` | One merchant account. Four resorts' guest money would land in one wallet. |
| `taxRate`, invoice numbering | One tax rate, one invoice book — separate companies each need their own. |
| Guests, loyalty, campaigns | Shared across brands, which is a consent problem, not a feature. |
| Room limits (`roomLimit`) | One plan's cap would be split across four resorts. |

Type 1 is served perfectly well by this model too: four accounts, connected,
one 360 view. They pay more than they would for one account — and they get
separate books, separate shareholders and separate websites, which is what
they were going to ask for next anyway.

**The in-account `Property` model stays** (see §13). A resort with two
buildings on one site is still one account with two properties. A resort in
another district is another account.

---

## 4. Data model

Four new tables, one new enum, and **not one change to an existing column.**
That is deliberate: no migration in this plan can lose a byte of resort data.

```prisma
enum ResortAccess {
  FULL          // can switch into this resort and work in it
  NUMBERS_ONLY  // appears in 360 as figures; cannot be opened
}

/// One person's collection of resorts. Created the first time they connect a
/// second resort; a single-resort owner never has one.
model ResortGroup {
  id            String   @id @default(uuid())
  name          String                         // defaults to "<first resort> Group", editable
  ownerUserId   String                         // the person who sees 360 and switches
  payerTenantId String?                        // phase 10 (combined billing); null until then
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  members  ResortGroupTenant[]
  requests ResortLinkRequest[]
  events   ResortGroupEvent[]

  @@index([ownerUserId])
  @@map("resort_groups")
}

/// A resort inside a group.
model ResortGroupTenant {
  id           String       @id @default(uuid())
  groupId      String
  tenantId     String       @unique   // a resort belongs to at most one group — see §11 E1
  access       ResortAccess @default(FULL)
  linkedUserId String?      @unique   // the User row created inside that tenant for FULL access
  approvedById String?                // who approved; null = same-email auto-link
  approvedAt   DateTime     @default(now())
  createdAt    DateTime     @default(now())

  group  ResortGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  tenant Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([groupId])
  @@map("resort_group_tenants")
}

/// A pending "please let me connect your resort" request.
model ResortLinkRequest {
  id            String    @id @default(uuid())
  groupId       String
  tenantId      String                        // the resort being asked for
  requestedById String                        // user who asked
  tokenHash     String    @unique             // sha256 of the emailed token — never the token itself
  expiresAt     DateTime
  approvedAt    DateTime?
  declinedAt    DateTime?
  createdAt     DateTime  @default(now())

  group  ResortGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  tenant Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([groupId])
  @@map("resort_link_requests")
}

/// Every consequential thing that happened to a group. Both owners can read
/// their own resort's rows, so "who gave that person access?" always has an
/// answer.
model ResortGroupEvent {
  id          String   @id @default(uuid())
  groupId     String
  tenantId    String?
  actorUserId String?
  action      String   // link_requested | link_approved | link_declined |
                       // access_changed | unlinked | switched | resort_added
  metadata    Json?
  createdAt   DateTime @default(now())

  group ResortGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([groupId])
  @@index([tenantId])
  @@map("resort_group_events")
}
```

Back-relations added to existing models (additive only):

```prisma
model Tenant {
  // …
  groupMembership ResortGroupTenant?
  linkRequests    ResortLinkRequest[]
}
```

`StaffInvite` stores its token in plain text; this plan does not copy that.
`ResortLinkRequest.tokenHash` follows `PasswordResetToken` instead, because
this token grants a person access to somebody else's resort.

### Why the group has one owner, not a member list

v1: **only `ResortGroup.ownerUserId` sees the 360 and the dropdown.** Staff of
resort A never learn that resort B exists. A second person in the group is a
real feature, and it is a *later* feature — adding it now means a second
permission system on top of the one we already have, for a customer who has
not asked for it. Named as a known limitation in §14.

---

## 5. Security model — the five rules

These are the load-bearing ones. Every one of them gets a test that fails when
the check is removed (mutation-tested, as with the rest of this repo).

1. **Group membership is checked on the server, per request, from the
   database.** The 360 endpoint and the switch endpoint never trust the JWT's
   `tenantId` to decide what a caller may read. They read
   `ResortGroup.ownerUserId === user.sub` and then the member rows.
2. **Only a resort's own verified `OWNER` may approve, change or revoke that
   resort's connection.** Not the person asking for it. Without this, whoever
   requested access could grant themselves more of it, and the approval step
   would be theatre.
3. **The emailed token is not, by itself, authority.** Opening the approval
   link requires being **logged in as that resort's OWNER**. A forwarded or
   leaked email therefore grants nothing.
4. **`NUMBERS_ONLY` means aggregates, nothing else.** No guest name, phone,
   booking, document or staff record crosses that line — not through the 360
   endpoint, not through a query parameter, not through a detail route. The
   endpoint has no parameter that could widen it.
5. **Revocation is immediate.** Revoking `FULL` sets the linked `User` row
   `isActive = false` and deletes its refresh tokens. `middleware/auth.ts`
   re-reads `isActive` on every request, so the next request fails — no waiting
   for a JWT to expire.

---

## 6. How "full access" is implemented — and what it costs

When a connection is approved as `FULL`, the API **creates a real `User` row
inside the approving tenant** for the requesting person's email, and stores its
id in `ResortGroupTenant.linkedUserId`. Switching resorts then means being
issued a token for that real user — never impersonating someone else's account.

Consequences, stated plainly because the approving owner must be told them:

- The person appears in that resort's **Staff list**, marked "connected from
  <group name>", so the owner can always see who is in there.
- **Role: `OWNER`.** That is what "full access" means, and it includes that
  resort's billing page and Stripe portal (`billing.ts` guards those with
  `ownerOnly`).
- The approval screen says this in one sentence, in both languages, before the
  button: *"They will be able to do everything you can in this resort,
  including billing."*

> **Alternative considered:** grant `MANAGER` instead, which excludes billing.
> Rejected for v1 because `MANAGER` is also excluded from Shareholders,
> Settings and Staff management, so "full access" would quietly not be full,
> and the owner would file it as a bug. If the founder later wants a third
> choice, it is one new option in the same dropdown: Full / Manager /
> Numbers only.

---

## 7. API surface

Every endpoint, with its guard. All live in a new
`apps/api/src/routes/resortGroup.ts` except the two auth ones.

| Method & path | Guard | Does |
|---|---|---|
| `GET /api/resort-group` | any authed user | Returns this user's group: name, member resorts (name, slug, access, planStatus, isActive), pending requests. `null` when they have none. |
| `POST /api/resort-group/links` | OWNER, verified | Body `{ slug }`. Same verified email on both → links immediately (`FULL`, `approvedById: null`). Otherwise creates a `ResortLinkRequest` and emails that resort's owner. Creates the group on first use. |
| `GET /api/resort-group/requests/incoming` | OWNER | Requests waiting on *my* resort. |
| `POST /api/resort-group/requests/:token/approve` | OWNER of the target tenant, verified | Body `{ access: 'FULL' \| 'NUMBERS_ONLY' }`. Creates the member row, and the linked `User` row when `FULL`. |
| `POST /api/resort-group/requests/:token/decline` | OWNER of the target tenant | Marks declined, emails the requester. |
| `PATCH /api/resort-group/members/:tenantId` | OWNER of **that** tenant | Body `{ access }`. `FULL → NUMBERS_ONLY` deactivates the linked user; the reverse re-activates or recreates it. |
| `DELETE /api/resort-group/members/:tenantId` | OWNER of that tenant **or** the group owner | Disconnects. Either side can walk away. |
| `GET /api/resort-group/overview` | group owner only | The 360 numbers (§8). |
| `GET /api/resort-group/events` | group owner, or OWNER of a member tenant (own rows only) | Audit trail. |
| `POST /api/auth/switch-resort` | authed, group owner, target `FULL` | Issues a new JWT + refresh cookie for the linked user in the target tenant. Rate-limited 20/min. |
| `POST /api/resort-group/new-resort` | OWNER, verified | Returns a prefilled signup + checkout for an **additional** resort, with the group discount already applied (§9). |

Error codes used by the web app: `RESORT_ALREADY_CONNECTED`,
`RESORT_NOT_FOUND`, `LINK_REQUEST_EXPIRED`, `LINK_REQUEST_USED`,
`NOT_RESORT_OWNER`, `GROUP_LIMIT_REACHED`, `ACCESS_NUMBERS_ONLY`.

---

## 8. The 360 dashboard — exactly what it shows

One page, `/dashboard/resorts`. One request. No drill-through into a
`NUMBERS_ONLY` resort; a `FULL` resort's card is clickable and switches to it.

Per resort, and as a group total:

| Metric | Definition (so two people compute it the same way) |
|---|---|
| Rooms | `Room` where `isActive = true` |
| Occupied | `Room.status = 'OCCUPIED'` |
| Occupancy % | occupied ÷ rooms × 100; **0 when rooms = 0**, never `NaN` |
| Arrivals today | `Booking.checkIn` in that resort's today, status `CONFIRMED` or `PENDING` |
| Departures today | `Booking.checkOut` in that resort's today, status `CHECKED_IN` |
| Revenue this month | `Payment` where `status = 'PAID'`, `processedAt >= month start` |
| Expenses this month | `Expense.amount` where `date >= month start` |
| Profit this month | revenue − expenses (stated as "before tax and salary", because that is what it is) |
| Dues | `Booking` `CONFIRMED`/`CHECKED_IN` with an unpaid balance |

Plus, per resort: name, plan, `planStatus` badge (`trialing` / `past_due` /
`canceled`), `isActive`, and **its own local date** — see E16.

**Two rules that are easy to get wrong:**

- **Each resort's "today" is computed in that resort's own timezone.**
  `tenantTodayRange()` currently defaults to `Asia/Dhaka`; the 360 must pass
  `tenant.timezone` per resort. A group with a resort in Sri Lanka otherwise
  reads yesterday's arrivals for it.
- **Money is only added up within one currency.** Resorts can be `BDT` and
  `USD`. The response groups totals by currency and shows several total rows;
  it never invents an exchange rate.

Performance: member queries run in parallel on `tenantPrisma(tenantId)`,
result cached 60s per group, group capped at **20 resorts** (E15).

---

## 9. Billing and the 10% discount

**Phase 1 (this plan): separate bills.** Four resorts, four subscriptions, four
invoices — which already works today and works with bKash, the only live
payment path. Nothing in the group layer touches an existing subscription.

**The discount rule, stated once:**

> Every resort in a group pays 10% less, **except the one that was created
> first among the group's current members.** Recomputed at each checkout and
> each renewal — never stored as a price.

- **bKash** (`POST /billing/checkout/bkash`): the amount is already computed
  server-side from `BKASH_PLAN_BDT`; multiply by `0.9` when the rule applies
  and record `groupDiscount: true` in the payment metadata. No external setup.
- **Stripe** (`POST /billing/checkout`): pass a 10%-forever coupon
  (`STRIPE_COUPON_GROUP10`) in `checkout.sessions.create`. Needs a Stripe
  account, which does not exist yet — see §15.
- Leaving a group **stops** the discount at the next renewal. No retroactive
  charge, no refund.
- If the oldest resort leaves, the next-oldest becomes the full-price one at
  its next renewal. Deterministic, and nobody's bill goes *up* mid-period.

**Phase 10 (later): one combined bill.** Designed now so phase 1 does not
block it:

- `ResortGroup.payerTenantId` names the resort that pays.
- **bKash:** one payment for the sum of all members' prices; the callback
  extends every member's `currentPeriodEnd`. This is genuinely small work —
  it is one payment record and a loop — and can ship as soon as the founder
  wants it.
- **Stripe:** one subscription on the payer's customer with **one line item
  per resort**, each item's `metadata.tenantId` naming its resort; the webhook
  maps items → tenants. A plan change for one resort becomes an item update.
  This one waits for a live Stripe account.
- Switching a group from separate to combined billing cancels the individual
  subscriptions **at period end** and starts the combined one then, so nobody
  is double-charged.

---

## 10. The steps

Small pieces, each verified and checked in before the next one starts.
Every phase ends green on CI, and every phase before 6 is invisible to
existing customers.

### Phase 1 — Schema only
- Add the enum and four models to `packages/database/prisma/schema.prisma`.
- Generate the migration offline with `prisma migrate diff
  --from-schema-datamodel … --script`; **no `db push`, no `migrate reset`.**
- **Done when:** `prisma generate` and `tsc` pass; migration applies to a
  scratch database and creates four empty tables.
- Commit: `feat(resort-group): tables for connecting resorts to each other`

### Phase 2 — `GET /api/resort-group`
- New `apps/api/src/routes/resortGroup.ts`, registered in `app.ts`.
- Returns `null` for everyone (nobody has a group yet).
- **Done when:** integration test — a normal owner gets `{ data: null }`, an
  unauthenticated call gets 401.
- Commit: `feat(resort-group): read the group a user belongs to`

### Phase 3 — Same-email connect, and disconnect
- `POST /api/resort-group/links` with the auto-detect path only:
  the caller's verified email must exist as a **verified, active OWNER** on the
  target tenant.
- `DELETE /api/resort-group/members/:tenantId`.
- Creates the group on first link; names it "<first resort> Group".
- **Done when:** tests cover — links two of my own resorts; refuses a resort
  that is not mine (404, not 403: do not confirm the slug exists); refuses a
  resort already in a group (409); refuses my own current resort (400);
  refuses a demo tenant; refuses when either email is unverified.
- Commit: `feat(resort-group): connect a second resort that uses the same email`

### Phase 4 — Switching
- `POST /api/auth/switch-resort`: verifies group ownership and `FULL` access,
  issues JWT + refresh cookie for `linkedUserId`, deletes the previous refresh
  token row, writes a `switched` event.
- For the same-email case the linked user **already exists** — it is that
  resort's own owner row. Reuse it; do not create a second one.
- **Done when:** tests cover — switch works; switching to a `NUMBERS_ONLY`
  resort is 403; switching to a resort outside my group is 403; a revoked
  member's switch is 403; the old token still works for its own resort until it
  expires (documented, not a bug — E24).
- Commit: `feat(auth): switch to another resort in your group`

### Phase 5 — The dropdown
- `apps/web/src/components/dashboard/ResortSwitcher.tsx`, rendered next to the
  resort name. **Renders nothing when the group has fewer than two resorts** —
  so every existing customer's UI is byte-identical.
- On switch: store the new token, `queryClient.resetQueries()` (reset, not
  invalidate — stale numbers from the previous resort must never be shown as
  the new one's), then navigate to `/dashboard`.
- Mirror it into `MobileMoreSheet`.
- `apps/web/src/store/resortGroup.ts` holds the group; `lib/api.ts` unchanged.
- i18n keys in `messages/en/common.json` and `messages/bn/common.json`,
  Bangla gated by `useLocale() === 'bn'` as everywhere else.
- **Done when:** RTL tests — hidden with 0 and 1 resorts; visible with 2;
  `NUMBERS_ONLY` entries render disabled with a reason; switching calls reset.
  (`afterEach(cleanup)` explicitly — this repo's vitest config has no
  `globals`, so auto-cleanup does not register.)
- Commit: `feat(dashboard): pick which resort you are looking at`

### Phase 6 — 360 API
- `GET /api/resort-group/overview`, per §8: per-tenant timezone, per-currency
  totals, parallel queries, 60s cache.
- **Done when:** tests cover — totals equal the sum of members; a resort with
  0 rooms yields 0% not `NaN`; two currencies produce two total rows;
  a `NUMBERS_ONLY` member contributes numbers and **no** guest field appears
  anywhere in the response (assert on the serialized JSON, not on a shape);
  a suspended member is present and marked, not omitted and not fatal.
- Commit: `feat(resort-group): the numbers behind the 360 dashboard`

### Phase 7 — 360 page
- `apps/web/src/app/(dashboard)/dashboard/resorts/page.tsx`, built with
  `PageShell` / `PageHeader` / design tokens (no raw hex — CI's ratchet
  enforces it).
- Nav item in `sidebar.tsx`, **shown only when the group has ≥2 resorts**,
  role `OWNER`.
- `FULL` cards are clickable (switch + open); `NUMBERS_ONLY` cards are not,
  with a one-line explanation rather than a dead click.
- **Done when:** RTL tests for both card kinds and the empty state; page
  returns 200; design ratchet unchanged.
- Commit: `feat(dashboard): 360 view of every connected resort`

### Phase 8 — Approval flow for a resort with a different email
- `POST /api/resort-group/links` gains the request path: token (random 32
  bytes, stored as sha256), 7-day expiry, email to the target resort's owner.
- `apps/web/src/app/resort-link/[token]/page.tsx` — requires login as that
  resort's owner, shows who is asking and for which resort, and the two access
  choices with the sentence from §6.
- `GET /api/resort-group/requests/incoming` + a banner in the target owner's
  dashboard, so approval does not depend on an email arriving.
- Decline path, and an email to the requester either way.
- Rate limit: one request per (group, tenant) per minute; resending replaces
  the token.
- **Done when:** tests cover — approve as `FULL` creates the linked user;
  approve as `NUMBERS_ONLY` creates **no** user row; approving while logged in
  as a non-owner of that tenant is 403; approving while logged in as the
  *requester* is 403; expired token 410; used token 410; declining twice is
  idempotent.
- Commit: `feat(resort-group): ask another owner to connect their resort`

### Phase 9 — Changing access later, and the connections screen
- `PATCH /api/resort-group/members/:tenantId`.
- Two screens, because there are two sides:
  - **Group owner:** Settings → *My resorts* — list, access level, disconnect.
  - **Connected resort's owner:** Settings → *Connected accounts* — who has
    access to this resort, at what level, change it, revoke it, and the event
    history from §4.
- Revocation does what rule 5 says: deactivate the linked user, drop its
  refresh tokens.
- **Done when:** tests cover — downgrade to `NUMBERS_ONLY` makes the next
  request from that session fail; upgrade back to `FULL` restores access;
  only that resort's owner may change it.
- Commit: `feat(resort-group): change or revoke what a connection can see`

### Phase 10 — Add a **new** resort from inside, with the discount
- `POST /api/resort-group/new-resort` → prefilled signup (owner's name, email,
  country, currency) + checkout, and auto-connects the new account to the group
  as `FULL` once its email is verified.
- Discount applied per §9 in **both** checkout endpoints; `GET /billing/status`
  reports `groupDiscountApplied` so the UI can show "10% group price".
- Self-referral guard: a resort added this way is **not** eligible as a
  referral for the same owner.
- **Done when:** tests cover — second resort's bKash amount is exactly 90% of
  the first's; the oldest member is charged full; after the oldest leaves, the
  new oldest pays full at next checkout; a single-resort owner's amount is
  unchanged (regression).
- Commit: `feat(billing): 10% off every resort after the first`

### Phase 11 — Combined billing
Per §9. bKash part can ship immediately; the Stripe part waits for a live
Stripe account. **Not** a blocker for the customer with three resorts.

### Phase 12 — Admin, docs, QA
- Super-admin: groups visible on the tenant detail page (who is connected, at
  what level) — read-only.
- `memory/projects/resortpro.md` updated; `plan/multi-property.md` marked
  superseded; `reports/qa/README.md` gains the new surfaces.
- Full-flow QA on staging via a paste-able prompt under `plan/fixes/`.

---

## 11. Edge cases — the "no gaps" list

Each of these has a defined behaviour. Anything discovered later that is not
here is a plan defect, not a surprise.

| # | Situation | Behaviour |
|---|---|---|
| E1 | Resort already in another group | 409 `RESORT_ALREADY_CONNECTED`. `tenantId` is unique in `ResortGroupTenant`, so the database enforces it too. |
| E2 | Connecting the resort you are currently in | 400. |
| E3 | Demo tenant on either side | Refused both ways. |
| E4 | Target resort suspended (`isActive = false`) | Cannot be connected. If suspended later: shown in 360 with a "suspended" badge, switching blocked. |
| E5 | Member is `past_due` / `canceled` | Stays in 360 with its badge. Switching allowed — `middleware/auth.ts` already makes that resort read-only, and the owner needs to get in to pay. |
| E6 | Member soft-deleted (`deletedAt`) or GDPR-erased | Removed from the group; the 360 stops showing it. |
| E7 | Group owner's user deactivated | Every `isActive` check fails, so access stops immediately. The group row survives for support to reassign. |
| E8 | Owner changes their email later | Connections are between resorts, not emails. Unaffected. |
| E9 | Either email unverified | Cannot create, approve or accept a connection. |
| E10 | Approver is not that resort's `OWNER` | 403 `NOT_RESORT_OWNER`. |
| E11 | Token expired (7d) or already used | 410 with a "request it again" button. |
| E12 | Token leaked or forwarded | Worthless on its own — approval requires being logged in as that resort's owner (rule 3). |
| E13 | Same request sent twice | Idempotent: replaces the token, re-sends the email, rate-limited 1/min. |
| E14 | A and B each ask to connect the other | The second request answers "already connected" once one is approved. |
| E15 | More than 20 resorts | 400 `GROUP_LIMIT_REACHED` with a support note. The cap exists so the 360 cannot become a 40-query page. |
| E16 | Resorts in different timezones | Each resort's "today" is computed in **its own** timezone, and its local date is printed on its card. |
| E17 | Resorts in different currencies | Totals grouped by currency; no cross-currency sum, no invented FX rate. |
| E18 | `NUMBERS_ONLY` resort | Aggregates only. The endpoint has no parameter that can widen it; a test asserts no guest field appears in the JSON. |
| E19 | `FULL` access | A real `User` row, visible in that resort's Staff list, marked as connected. No impersonation anywhere. |
| E20 | Revoking `FULL` | User deactivated + refresh tokens deleted → next request 401. |
| E21 | Switching resorts | New JWT and refresh cookie; previous refresh row deleted; `resetQueries()` so no stale figure is read as the new resort's. |
| E22 | Switching to a resort whose plan lacks a module you were viewing | Always land on `/dashboard`, never a 403 page. |
| E23 | Two browser tabs | v1 shows **one resort at a time per browser** — the token lives in one `localStorage` key. The old tab's in-flight JWT keeps working until it expires, then it re-authenticates as the new resort. Documented; proper multi-tab is a later change. |
| E24 | An old JWT after a downgrade to `NUMBERS_ONLY` | Dies on the next request via the `isActive` check — not on expiry. |
| E25 | Guests / CRM / loyalty across resorts | **Not merged.** Each resort's guest data stays its own; merging it is a consent decision, not a convenience. |
| E26 | Shareholders | Untouched. A shareholder of one resort sees only that resort. |
| E27 | Websites, custom domains, payment gateways | Untouched — one per account, as today. |
| E28 | Global search, notifications, exports | Per resort in v1. |
| E29 | Staff of resort A | Never see the group, the dropdown or the 360. |
| E30 | Room limits / plan flags | Per account, exactly as today. Connecting changes no entitlement. |
| E31 | Trial | A resort added from inside gets the same trial rules as a public signup — the existing promotion logic, unchanged. |
| E32 | Referral rewards | A resort you added yourself cannot earn you a referral reward. |
| E33 | Group name | Editable by the group owner; shown in approval emails so the other owner knows what they are joining. |
| E34 | 360 page load | Parallel per-tenant queries, 60s cache, ≤20 members. |
| E35 | One member's query fails | That card shows "couldn't load", the rest of the page still renders. |

---

## 12. Testing

- **Unit:** discount rule (oldest-member logic, including after a departure),
  per-currency totals, occupancy with zero rooms, per-timezone "today".
- **Integration (API):** every row of §7's table, plus every 4xx in §11.
- **Web (RTL):** switcher visibility thresholds, disabled `NUMBERS_ONLY` entry,
  360 cards, approval page states. `afterEach(cleanup)` in each file.
- **Mutation testing** on the five security rules: delete the check, confirm a
  test goes red. A rule whose removal keeps the suite green is not tested.
- **CI:** web unit tests already run in the `build` job; the new API tests join
  the existing API suite.

---

## 13. What happens to the property work already shipped

`da9a86f` added a `PropertySwitcher` in the top bar and narrowed Rooms by
`X-Property-Id`. **It stays**, unchanged, because it answers a different
question at a different level:

- **Resort dropdown** (this plan) — *which account am I in?*
- **Property filter** (shipped) — *which building on this site am I looking
  at?*

Both hide themselves below two entries, so a single-resort, single-property
customer sees neither. They appear in the same top bar, in that order, and the
360 page does not mention properties at all.

---

## 14. Known limitations of v1 (deliberate, not forgotten)

1. **One person per group.** No "invite my business partner to the 360".
2. **One resort at a time per browser.** See E23.
3. **No combined bill until phase 11**, and the card half of it waits on
   Stripe.
4. **No cross-resort reporting beyond the 360's tiles** — no combined P&L
   export, no group-wide guest search.
5. **Group ownership cannot be transferred** in the UI; support/admin does it.

---

## 15. Founder-side prerequisites

| Needed for | What |
|---|---|
| Phase 10, Stripe half only | A Stripe account, and a 10%-forever coupon whose id goes in `STRIPE_COUPON_GROUP10`. See [fixes/stripe-card-billing-setup.md](fixes/stripe-card-billing-setup.md). |
| Phase 8 | Nothing new — approval emails go through the existing Resend setup. |
| Phases 1–7, 9 | **Nothing.** They ship on what is already live. |

The customer with three resorts is unblocked at the **end of phase 7**: three
accounts, connected, one dropdown, one 360 view. Phases 8–12 make it work for
customers whose resorts are held under different emails, and make it cheaper.
