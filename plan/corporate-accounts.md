# ResortPro — Corporate Accounts (Company Billing)

## Overview

Group Booking-er moto **ekbar-er event na** — eta ekta **company-r sathe long-term relationship**. Boro company proti mash/quarter-e resort-e guest পাঠায় (training, retreat, business trip) — alada alada shomoy, alada guest, kintu **shob-i ek company-r nam-e bill** hote hobe, individual guest-ke na. Payment-o "later" hote pare (credit terms) — poroborti mash-e invoice pathiye taka newa.

**Group Booking vs Corporate Account:**

```
Group Booking        → 1 event, 1 date range, discount applied once, guest pay kore
Corporate Account     → ongoing relationship, ANY somoy booking hote pare,
                        company-ke consolidated bill kora hoy, credit terms
```

---

## ১. Full Flow

```
Owner "Add Company" kore:
  Company name, billing address, contact person, payment terms (net-30),
  corporate discount % (optional)

Front Desk / New Booking-e ekta notun option ashe:
  "Bill to: [walk-in guest ▾]" → dropdown-e company list-o dekha jay
  Company select korle → booking-ta company-r account-e link hoy,
  guest-ke tokhon payment korte hoy na

Mash sheshe (ba jekono shomoy) owner:
  Corporate Accounts page → company select
  → "Uninvoiced Bookings" list dekhe (5ta stay, total ৳45,000)
  → "Generate Invoice" click
  → System: subtotal - discount% = total, due date = aj + payment terms
  → Invoice create hoy, PDF/email pathano jay (existing invoice system reuse)

Company payment kore (bank transfer, ইত্যাদি):
  Owner "Record Payment" kore invoice-e
  → Partial ba full payment track hoy
  → Overdue hole status automatically "OVERDUE" dekhay
```

---

## ২. Dashboard — Corporate Accounts

### `/dashboard/corporate-accounts`

```
┌────────────────────────────────────────────────────────────┐
│  Corporate Accounts                    [+ Add Company]     │
│                                                              │
│  Total Outstanding: ৳1,25,000 across 4 companies            │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  ABC Corporation                    ৳45,000 due             │
│  Net-30 · 10% corporate rate        2 unpaid invoices       │
│  [View Bookings] [Invoices] [Edit]                          │
│  ─────────────────────────────────────────────────────────  │
│  XYZ Ltd                            ৳0 due (all paid)       │
│  Net-15 · No discount               [View Bookings] [Edit]  │
└────────────────────────────────────────────────────────────┘
```

### Company Detail — Uninvoiced Bookings

```
┌────────────────────────────────────────────────────────────┐
│  ABC Corporation — Uninvoiced Bookings                      │
│                                                              │
│  ☑ Rahim Khan — Room 204 — Jun 5-7 — ৳12,000                │
│  ☑ Karim Ali — Room 301 — Jun 12-13 — ৳6,000                │
│  ☑ Salma Begum — Room 105 — Jun 20-22 — ৳15,000              │
│                                                              │
│  Subtotal: ৳33,000                                           │
│  Corporate discount (10%): -৳3,300                            │
│  Total: ৳29,700                                               │
│  Due date: Jul 15, 2026 (Net-30)                              │
│                                                              │
│  [Generate Invoice]                                           │
└────────────────────────────────────────────────────────────┘
```

### Add Company Form

```
Company Name:     [ ABC Corporation                    ]
Billing Address:  [ House 12, Road 5, Gulshan, Dhaka   ]
Tax ID (BIN):     [ optional                            ]
Contact Person:   [ Mr. Hasan                           ]
Contact Email:    [ hasan@abccorp.com                   ]
Contact Phone:    [ 01712-345678                        ]
Payment Terms:    [ 30 ] days
Corporate Discount: [ 10 ] %
Credit Limit:      ৳[ optional — cap on outstanding balance ]
Notes:             [ optional                            ]
```

---

## ৩. Booking Integration

```
New Booking / Front Desk form-e notun field:

  Bill to: ( ) Guest pays directly
           ( ) Corporate Account → [ABC Corporation ▾]

  Corporate select korle guest-checkout-e payment SKIP hoy —
  booking "unbilled, pending company invoice" status-e thake
```

**Role note**: Receptionist booking-er shomoy company **select** korte parbe (dropdown-e active company list dekhbe), kintu invoice generate/payment record — shudhu Owner/Manager.

---

## ৪. Database Schema

```prisma
model CorporateAccount {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  companyName     String
  billingAddress  String?
  taxId           String?
  contactName     String
  contactEmail    String
  contactPhone    String

  paymentTermDays Int      @default(30)
  discountPercent Float    @default(0)
  creditLimit     Float?

  isActive        Boolean  @default(true)
  notes           String?

  bookings        Booking[]
  invoices        CorporateInvoice[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@map("corporate_accounts")
}

model CorporateInvoice {
  id                 String   @id @default(uuid())
  tenantId           String
  tenant             Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  corporateAccountId String
  corporateAccount   CorporateAccount @relation(fields: [corporateAccountId], references: [id], onDelete: Cascade)

  invoiceNumber   String   @unique // "CORP-2026-0001"
  bookingIds      String[]         // snapshot of included bookings at generation time

  subtotal        Float
  discountAmount  Float    @default(0)
  totalAmount     Float
  paidAmount      Float    @default(0)

  status          String   @default("DRAFT") // DRAFT | SENT | PARTIAL | PAID | OVERDUE
  dueDate         DateTime
  sentAt          DateTime?
  paidAt          DateTime?
  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@map("corporate_invoices")
}

// Booking model-এ যোগ হবে:
model Booking {
  // existing fields...
  corporateAccountId String?
  corporateAccount    CorporateAccount? @relation(fields: [corporateAccountId], references: [id])
}
```

---

## ৫. API Endpoints

```
// Owner/Manager
GET    /api/corporate-accounts                    → list + outstanding balance per company
POST   /api/corporate-accounts                     → create company
PATCH  /api/corporate-accounts/:id                  → update
DELETE /api/corporate-accounts/:id                  → deactivate

GET    /api/corporate-accounts/:id/bookings         → all bookings (uninvoiced + invoiced)
GET    /api/corporate-accounts/:id/invoices         → invoice history

POST   /api/corporate-accounts/:id/invoices         → generate invoice from selected uninvoiced bookings
  body: { bookingIds: string[] }
PATCH  /api/corporate-accounts/invoices/:id          → update status, record payment
  body: { status?, paidAmount? }

// Receptionist+ (booking-time lookup)
GET    /api/corporate-accounts/active                → simple {id, companyName} list for the "Bill to" dropdown

// Existing booking endpoints
PATCH  /api/bookings/:id  → accepts corporateAccountId field
```

---

## ৬. Sidebar / Navigation

```
"Corporate Accounts" — Rooms & Bookings group (near Group Bookings)
Roles: OWNER, MANAGER (full access) — RECEPTIONIST doesn't get the nav
item itself, but sees the company dropdown inside the booking form.
```

---

## ৭. Implementation Steps

```
Step 1 — Database (0.5 day)
  ✦ CorporateAccount + CorporateInvoice models
  ✦ Booking.corporateAccountId field
  ✦ Migrate

Step 2 — API (2 days)
  ✦ Company CRUD
  ✦ Uninvoiced-bookings query (bookings with corporateAccountId set,
    not yet included in any invoice's bookingIds)
  ✦ Invoice generation (subtotal, discount, due date calc, auto-numbering)
  ✦ Invoice status update / payment recording
  ✦ /active endpoint for booking-form dropdown

Step 3 — Dashboard UI (2 days)
  ✦ /dashboard/corporate-accounts — list + outstanding balance
  ✦ Add/Edit Company modal
  ✦ Company detail — uninvoiced bookings + Generate Invoice
  ✦ Invoice history + Record Payment

Step 4 — Booking Form Integration (1 day)
  ✦ "Bill to" radio/dropdown in New Booking + Front Desk check-in
  ✦ Skip guest-payment-required flow when billed to company

Step 5 — Polish (0.5 day)
  ✦ Overdue auto-detection (dueDate < today && status != PAID)
  ✦ Empty states, role guards

Total: ~6 days
```

---

## ৮. Open Questions (owner-এর decision লাগবে)

```
- Invoice PDF/email — existing Invoice system (bookings/[id]/invoice)
  reuse করা যাবে, নাকি আলাদা corporate invoice template লাগবে?
- Credit limit ছাড়িয়ে গেলে নতুন booking company-তে bill করতে block
  করবে, নাকি শুধু warning দেখাবে?
- Partial payment থাকা অবস্থায় booking cancel হলে কী হবে — এই edge
  case পরে handle করা যায়, launch-blocker না।
```
