# Shop: a multi-vendor marketplace inside ResortPro

Written 2026-09-27, from the founder's description: a **Shop** entry in every
resort owner's sidebar, where they buy things for their resort. The founder
sells there, and so do other people given shop accounts — who pay the platform
a percentage of what they sell. Each shop chooses where it sells: **one
country, a chosen list of countries, or everywhere.**

The first products are **3D printed items** for resorts — room number plates,
signage, key fobs — sold by the founder. Other sellers, some in South Africa,
come after.

---

## 1. What this is, in one paragraph

A resort owner already has an account, an address, a country and a currency,
and already buys things from us — themes, through the platform's own bKash.
The Shop generalises that: **products, from several sellers, shown only to the
resorts a seller can actually reach, paid for through the platform, with the
platform keeping a share.** Nothing about running a resort changes. A resort
that never opens the Shop sees one extra sidebar entry and nothing else.

---

## 2. Settled, and still open

**Settled with the founder:**

| | |
|---|---|
| Who sells | The founder first. Other shops from early on, several in South Africa. |
| Reach | Per shop: **one country · a chosen list · global**. |
| First products | 3D printed items for resorts. |
| Where it lives | Inside ResortPro, in the resort owner's sidebar. |
| Commission | The platform takes a percentage of each sale. |

**Still open — these need a yes or a different answer before phase 3:**

1. ~~Who holds the money.~~ **Settled 2026-09-27, and the founder's answer is
   better than the one this plan first recommended: a shop adds its own payment
   gateway, exactly as a resort owner already does.** See §7 — it removes the
   cross-border payout problem, removes the platform's Stripe dependency, and
   turns the monthly transfer around so the shop owes us rather than us owing
   them. It has one precondition, in §14, and it is not a small one.
2. **Personalised products.** Recommended: **yes, from the start.** A 3D printed
   sign for a resort is nearly always "with my resort's name on it", and
   retro-fitting per-order text into an order line is more work than designing
   for it now. Say so if the catalogue is genuinely fixed — it removes a whole
   table.
3. **Cash on delivery.** Recommended: **no, not at first.** Paying up front is
   how themes already work, these are made to order, and a refused COD parcel
   is a printed object nobody else wants. It can be added per country later.

---

## 3. Why inside ResortPro, and not a separate shop

Because the buyer is already known. A resort owner opening the Shop brings
their resort's country, address, currency, contact details and a payment method
the platform already trusts. A standalone store would ask for all of it again
and convert a tenth as well.

It is also where the demand is visible: the platform already knows a resort has
40 rooms and no signage module, which is the sort of thing that makes a shop
worth building rather than a generic storefront.

---

## 4. Names, and one collision to avoid

`Vendor` is **taken** — `packages/database/prisma/schema.prisma` has a
tenant-scoped `Vendor` for the supplier a resort buys its own inventory from,
with purchase orders attached. A marketplace seller is a different thing
entirely, so it is a **`Shop`** throughout: model, routes, screens, language.
Anyone who confuses the two will write a cross-tenant leak.

---

## 5. Data model

```prisma
enum ShopReach {
  ONE_COUNTRY   // sells in exactly one
  COUNTRY_LIST  // sells in the countries listed
  GLOBAL        // sells everywhere
}

enum ShopStatus {
  DRAFT      // being set up, invisible
  ACTIVE     // selling
  SUSPENDED  // hidden, by the platform
}

/// A seller. The founder's own shop is one of these, with no special case.
model Shop {
  id            String     @id @default(uuid())
  name          String
  slug          String     @unique
  status        ShopStatus @default(DRAFT)
  /// What the shop prices in and is paid in. Buyers outside it are refused
  /// rather than silently converted — see §6.
  currency      String
  reach         ShopReach  @default(ONE_COUNTRY)
  /// ISO 3166-1 alpha-2, e.g. ["ZA","NA"]. Empty when reach is GLOBAL.
  countries     String[]   @default([])
  /// The platform's share, as a percentage. Set per shop so a first partner
  /// can be given better terms without a code change.
  commissionPct Float      @default(15)
  contactEmail  String
  payoutNotes   String?    // bank details are handled off-platform, see §6
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  members  ShopUser[]
  products ShopProduct[]
  orders   ShopOrder[]
  invoices ShopCommissionInvoice[]
  payment  ShopPaymentConfig?

  @@index([status])
  @@map("shops")
}

/// Who may run a shop. Separate from `User`, which is always inside a tenant —
/// a shop owner in South Africa has no resort and must not need one.
model ShopUser {
  id           String    @id @default(uuid())
  shopId       String
  email        String
  passwordHash String
  firstName    String
  lastName     String
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  shop Shop @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@unique([shopId, email])
  @@map("shop_users")
}

model ShopProduct {
  id          String   @id @default(uuid())
  shopId      String
  name        String
  slug        String
  description String?
  /// Minor units (paisa, cents) in the shop's currency. Never a float.
  priceMinor  Int
  images      String[] @default([])
  /// Made to order rather than held in stock — true for everything 3D printed.
  madeToOrder Boolean  @default(true)
  /// Null means unlimited; only meaningful when madeToOrder is false.
  stock       Int?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  shop    Shop                 @relation(fields: [shopId], references: [id], onDelete: Cascade)
  options ShopProductOption[]
  lines   ShopOrderLine[]

  @@unique([shopId, slug])
  @@index([shopId, isActive])
  @@map("shop_products")
}

/// "What should it say?" — the thing that makes a printed sign worth buying.
model ShopProductOption {
  id         String  @id @default(uuid())
  productId  String
  label      String  // "Text on the plate"
  kind       String  // "text" | "number" | "choice"
  required   Boolean @default(true)
  maxLength  Int?
  /// For kind = "choice".
  choices    String[] @default([])
  /// Added to the product price, in minor units. 0 for most.
  extraMinor Int      @default(0)
  sortOrder  Int      @default(0)

  product ShopProduct @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("shop_product_options")
}

enum ShopOrderStatus {
  AWAITING_PAYMENT
  PAID
  IN_PRODUCTION
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

model ShopOrder {
  id       String          @id @default(uuid())
  number   String          @unique // SHP-2026-0001
  shopId   String
  /// The resort that bought it. Orders outlive a tenant deliberately — see E9.
  tenantId String?
  status   ShopOrderStatus @default(AWAITING_PAYMENT)

  /// Frozen at the moment of the order. A price or a commission rate that
  /// changes next month must not rewrite what someone already paid.
  currency         String
  subtotalMinor    Int
  shippingMinor    Int @default(0)
  totalMinor       Int
  commissionPct    Float
  commissionMinor  Int
  /// total − commission. What the shop keeps, having been paid directly.
  shopEarnsMinor   Int

  // Where it goes. Copied from the resort, editable per order.
  shipName    String
  shipPhone   String
  shipAddress String
  shipCountry String

  // Payment, through the platform's own gateway for the buyer's country.
  paymentMethod String? // "bkash" | "card"
  paymentRef    String? // trxID / payment intent
  paidAt        DateTime?

  courier        String?
  trackingNumber String?
  shippedAt      DateTime?
  deliveredAt    DateTime?

  invoiceId String?
  buyerNote String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  shop   Shop            @relation(fields: [shopId], references: [id])
  tenant Tenant?         @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  invoice ShopCommissionInvoice? @relation(fields: [invoiceId], references: [id], onDelete: SetNull)
  lines  ShopOrderLine[]
  events ShopOrderEvent[]

  @@index([shopId, status])
  @@index([tenantId])
  @@map("shop_orders")
}

model ShopOrderLine {
  id         String @id @default(uuid())
  orderId    String
  productId  String?
  /// The name and price as they were. The product may be renamed or withdrawn.
  name       String
  unitMinor  Int
  quantity   Int    @default(1)
  totalMinor Int
  /// What the buyer typed: { "Text on the plate": "Sea Pearl 101" }
  options    Json?

  order   ShopOrder    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product ShopProduct? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@map("shop_order_lines")
}

/// Every change of state, so "where is my order" always has an answer.
model ShopOrderEvent {
  id        String   @id @default(uuid())
  orderId   String
  status    ShopOrderStatus
  note      String?
  actor     String?  // shop user id, admin email, or "system"
  createdAt DateTime @default(now())

  order ShopOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@map("shop_order_events")
}

/// A shop's own payment gateway, exactly as TenantPaymentConfig is a resort's.
///
/// The buyer pays the shop, through our checkout, with these credentials — so
/// the money never touches the platform and we still see whether it arrived.
/// Read §14 before building this: the equivalent table for resorts says in a
/// comment that it is encrypted and is not.
model ShopPaymentConfig {
  id            String @id @default(uuid())
  shopId        String @unique
  activeGateway String @default("manual") // 'bkash'|'sslcommerz'|'stripe'|'payfast'|'manual'
  /// Shape mirrors TenantPaymentConfig.credentials.
  credentials   Json   @default("{}")
  updatedAt     DateTime @updatedAt

  shop Shop @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@map("shop_payment_configs")
}

/// One month's commission a shop owes the platform. Settled off-platform.
model ShopCommissionInvoice {
  id           String    @id @default(uuid())
  shopId       String
  periodStart  DateTime
  periodEnd    DateTime
  currency     String
  grossMinor   Int
  commissionMinor Int
  netMinor     Int
  status       String    @default("due") // due | paid
  paidAt       DateTime?
  method       String?   // BANK_TRANSFER | BKASH | OTHER
  reference    String?
  recordedBy   String?   // admin email
  createdAt    DateTime  @default(now())

  shop   Shop        @relation(fields: [shopId], references: [id], onDelete: Cascade)
  orders ShopOrder[]

  @@index([shopId, status])
  @@map("shop_commission_invoices")
}
```

Additive to `Tenant`: `shopOrders ShopOrder[]`.

**Why minor units everywhere.** `Decimal` would work, but every arithmetic bug
in a marketplace is a rounding bug, and commission on 15% of 1,999 is exactly
the case that goes wrong. Integers of paisa and cents cannot drift.

---

## 6. Reach, currency, and who can buy what

A resort sees a product when **its country is within the shop's reach**:

| Shop reach | Shown to |
|---|---|
| `ONE_COUNTRY` | resorts whose `tenant.country` is that country |
| `COUNTRY_LIST` | resorts whose country is in the list |
| `GLOBAL` | every resort |

That is the whole rule, and it is applied **server-side in the product query**,
never by hiding a card in the browser. A resort in Bangladesh must not be able
to reach a South African shop's product by guessing its URL — the checkout
refuses it as well as the listing.

**Currency does not convert.** A shop prices in its own currency and is paid in
it. A resort buying from a shop in another currency is shown that currency and
charged in it. Nothing is summed across currencies anywhere — the same rule the
360 dashboard already follows, for the same reason: we have no honest exchange
rate.

**Payment is the shop's own gateway**, so a shop can sell wherever it can be
paid — see §7. The platform's own bKash is used for exactly one shop, the
founder's, because that is the account he already has. No shop is limited by
what gateway *the platform* has.

---

## 7. The money

**Each shop adds its own payment gateway, the way a resort owner already does.**
`TenantPaymentConfig` has held a resort's own bKash, SSLCommerz, Stripe or
Razorpay credentials for a long time: a guest pays through ResortPro's checkout
code, using the *resort's* credentials, and the money lands in the resort's
account. A shop works the same way — `ShopPaymentConfig`, same shape, same idea.

This is better than the platform collecting, and not by a little:

- **The cross-border payout disappears.** A South African shop takes rand into
  its own account. Nobody sends an international transfer every month.
- **The platform's missing Stripe account stops mattering.** A shop that can be
  paid can sell, whatever gateway it brings. Phase 9 is no longer blocked by
  something the founder has not set up.
- **We still know exactly what sold.** The payment is *initiated by our code*
  with the shop's credentials, and our callback sees the result, so the order's
  paid state is ours — not something the shop reports to us.
- **The founder never holds other people's money**, which is a different kind of
  business with a different set of obligations.

**So the commission runs the other way: the shop owes the platform.** Monthly,
the orders a shop was paid for are gathered and it is invoiced its commission.
That is easier to enforce than an unpaid payout is to chase — an invoice that
goes unpaid suspends the shop, and a suspended shop sells nothing.

- **Commission is frozen on the order.** `commissionPct` is copied at the moment
  of purchase. Raising a shop's rate must never change what it owed last month.
  (The opposite of the group discount, which is recomputed every time — a
  discount is a current price, a commission is history.)
- **A shop with no gateway cannot leave `DRAFT`.** There is nothing to sell
  through.
- **Refunds are the shop's**, since the money is theirs. A refunded order is
  excluded from the commission of the period the refund falls in.
- **The founder's own shop** uses the platform bKash credentials, which already
  exist in code as `getPlatformBkash()`. It is a shop like any other; it simply
  owes itself nothing, so its invoices are zero-rated.

`ShopPayout` is therefore misnamed for this model — it becomes
**`ShopCommissionInvoice`**, same fields, opposite direction: `grossMinor` what
the shop took, `commissionMinor` what it owes, `status` due/paid.

## 8. The order's life

```
AWAITING_PAYMENT ──paid──> PAID ──> IN_PRODUCTION ──> SHIPPED ──> DELIVERED
        │                    │            │              │
        └──> CANCELLED       └────────────┴──────────────┴──> REFUNDED
```

- Only the shop moves an order between `PAID`, `IN_PRODUCTION`, `SHIPPED` and
  `DELIVERED`. The buyer sees each change and its date.
- `SHIPPED` requires a courier name and a tracking number, typed by hand. **No
  courier integration** — a text field that is right beats an API that is
  half-wired.
- An unpaid order expires after 24 hours and becomes `CANCELLED`, so a shop is
  not printing against an order nobody paid for.
- **The payment callback follows the rule learned the hard way in billing:**
  once the gateway has captured, no branch may tell the buyer it failed. Either
  the order becomes `PAID`, or it is held and support is told, with the
  reference on screen. See the group-bill callback in `routes/billing.ts`.

---

## 9. API surface

Three audiences, three prefixes.

**The resort owner** — `/api/shop`, authenticated as a tenant user:

| | |
|---|---|
| `GET /products` | what this resort's country can buy, across all active shops |
| `GET /products/:id` | one, refused if out of reach |
| `POST /orders` | place an order; returns a payment URL |
| `GET /orders` | this resort's orders |
| `GET /orders/:id` | one, with its events |

**The shop** — `/api/shop-admin`, authenticated as a `ShopUser`:

| | |
|---|---|
| `POST /auth/login` | a separate login; a shop user has no tenant |
| `GET/POST/PATCH /products` | its own catalogue only |
| `GET /orders`, `PATCH /orders/:id/status` | its own orders only |
| `GET /payment-config`, `PUT /payment-config` | its own gateway credentials |
| `GET /invoices` | what commission it owes, and what it has settled |

**The platform** — `/api/admin/shops`, super-admin only: create a shop, set its
reach, its commission, suspend it, raise and settle commission invoices.

---

## 10. Screens

- **Resort owner:** a `Shop` sidebar entry → catalogue, product page with its
  options, cart, checkout, "My orders". Built from `@/components/patterns` and
  tokens, like every other dashboard page.
- **Shop owner:** a small separate area at `/shop` — products, orders, payouts.
  Deliberately plain. It is not the resort dashboard and should not pretend to
  be.
- **Platform:** shops, commission and invoices inside the existing admin panel.

The sidebar entry is visible to `OWNER` and `MANAGER`. It does **not** depend on
a plan or a feature flag: a marketplace nobody can see earns nothing.

---

## 11. The steps

Each ships on its own and is verified before the next.

| # | | Needs |
|---|---|---|
| 1 | Schema and migration, nothing else | — |
| 2 | Admin: create a shop, set reach and commission | — |
| 3 | Products and options, admin-managed | decision (2) |
| 4 | Owner-facing catalogue + the reach rule, no buying yet | — |
| 5 | Checkout through the shop's own gateway; the founder's shop on platform bKash | **encrypted credentials — see §14** |
| 6 | Orders: the shop's screen, statuses, tracking | — |
| 7 | Commission: monthly gathering, invoice, mark settled | — |
| 8 | Shop login and the shop's own area | — |
| 9 | A shop adds its own gateway from that area | phase 8 |

**Phases 1–7 give the founder a working shop selling 3D prints to Bangladeshi
resorts.** Phases 8–9 let a South African partner run their own and be paid
into their own account — with no Stripe account needed by the platform, which
is the whole gain from the founder's answer in §7.

---

## 12. Edge cases

| | |
|---|---|
| A resort with no `country` set | Sees `GLOBAL` shops only. It cannot be matched to a list it is not in. |
| A shop suspended mid-order | Existing orders carry on; nothing new is listed or accepted. |
| A product withdrawn after an order | The line keeps its own name and price; the link goes null. |
| Price changed after an order | The order is frozen. Never recomputed. |
| Commission changed | Same. Frozen at purchase. |
| Reach narrowed after an order | The order stands. Reach governs buying, not history. |
| Buyer's country not covered by any shop | An honest empty state, not an empty grid. |
| A tenant is deleted | Orders survive with `tenantId` null — the shop was paid for them, and the commission owed must not silently shrink. |
| Two currencies | Never summed. Invoices are per shop, so per currency by construction. |
| A refund after an invoice was settled | Deducted from the next period; a settled month is not reopened. |
| An unpaid order | Expires in 24 hours. |
| A shop user with no resort | Expected — that is the whole point of `ShopUser`. They must never reach a tenant route. |
| The same email as a resort owner | Allowed. Different table, different login, no link between them. |

---

## 13. What this is not

Stated so nobody builds it by accident.

- **Not a fulfilment system.** No labels, no rates, no courier APIs.
- **Not a payment processor.** Each shop is paid into its own account through
  its own gateway; the platform initiates the payment and reads the result.
- **Not a public storefront.** Only signed-in resort owners see it; there is no
  SEO surface and no guest checkout.
- **Not connected to the resort's own inventory**, purchase orders or `Vendor`
  records. Different problem, same words.
- **No reviews, ratings, coupons, wishlists or search ranking** in this plan.

---

## 14. What it depends on

### The one that is not optional

**Gateway credentials are not encrypted, and the schema says they are.**
`TenantPaymentConfig` carries the comment *"credentials encrypted in production
via AES-256"*, and there is no encryption anywhere in `apps/api/src` — no
`createCipheriv`, no key, nothing. Every resort's bKash and SSLCommerz secrets
sit in the database as plain text today. (This is the QA finding recorded as
M-03; the comment is what made it look handled.)

That is already bad. Asking a **third party in another country** to paste their
merchant credentials into the same store makes it materially worse: their
money, their liability, and a promise in a code comment that nothing keeps.

So **encryption at rest for gateway credentials is a precondition of phase 5**,
not a later hardening pass — for the existing tenant table as well as the new
shop one, since they would share the implementation.

### Everything else

| | |
|---|---|
| Phases 1–4, 6–9 | Nothing that does not already exist |
| Phase 5 | Encrypted credentials, above |
| Selling outside Bangladesh | Nothing further — the shop brings its own gateway |
| Any of it | The founder's remaining decisions in §2 |

And the honest one: **this does not help hand the PMS to resort owners this
month.** See [handover-checklist.md](handover-checklist.md) for what does.
