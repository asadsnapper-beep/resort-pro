# Invoice System — ResortPro

> Invoice management এর complete technical reference — manual invoice, booking-linked invoice, PDF, payment recording, এবং email।

---

## Overview

ResortPro এর invoice system দুটো পথে কাজ করে:

1. **Booking-linked invoice** — booking check-out হলে auto-generate হয়। `/dashboard/bookings/:id/invoice` page এ দেখা যায়।
2. **Standalone invoice** — `/dashboard/invoices` থেকে manually তৈরি করা যায়। যেকোনো guest এর জন্য।

---

## Features

### ১. Invoice List (`/dashboard/invoices`)
- **Stats row** — Total Invoiced, Collected, Outstanding, This Month (current month only)
- **Status filter** — All / DRAFT / SENT / PAID / PARTIAL / OVERDUE
- **Search** — guest name বা invoice number দিয়ে
- **Pagination** — 20 per page, page buttons
- Click → `/dashboard/invoices/:id` detail page

### ২. New Invoice (`/dashboard/invoices/new`)
- Guest info: Name (required), Email, Phone
- Settings: Due Date, Tax Rate (%), Discount Amount + Note
- Notes/internal message
- Submit → DRAFT status, redirect → detail page where items can be added

### ৩. Invoice Detail (`/dashboard/invoices/:id`)
- **Header** — Invoice number, status badge, created date, linked booking (if any)
- **Actions** — Send Email, Download PDF, Record Payment
- **Line items** — Add/delete (disabled when PAID or CANCELLED)
- **Summary sidebar** — Subtotal, Tax, Discount, Total, Paid, Outstanding
- **Settings sidebar** — Tax rate, discount, due date, notes (editable)
- **Payment history** — all payments with method icon
- **Record Payment modal** — amount (pre-fills outstanding), method (Cash/Card/Bank), reference, note
- **Delete/Cancel** — delete if no payments, cancel if payments exist

### ৪. Booking Invoice (`/dashboard/bookings/:id/invoice`)
- Computed from booking data (room × nights, food orders, extra charges)
- **Add Charge** — manual extra charges
- **Email Invoice** — sends PDF via email to guest
- **Print** — CSS print layout
- **Download PDF** — direct PDF download (requires invoice to be in the DB)

---

## Invoice Statuses

| Status | মানে |
|--------|------|
| `DRAFT` | তৈরি হয়েছে, send হয়নি |
| `SENT` | Guest কে email পাঠানো হয়েছে |
| `PAID` | সম্পূর্ণ পেমেন্ট হয়েছে |
| `PARTIAL` | কিছু paid, বাকি আছে |
| `OVERDUE` | Due date পেরিয়ে গেছে, unpaid |
| `CANCELLED` | বাতিল |

Status auto-updates when payment is recorded via `syncTotals()`.

## Invoice Item Categories

`ROOM` | `FOOD` | `SERVICE` | `LAUNDRY` | `MINIBAR` | `OTHER`

---

## API Endpoints

```
GET    /api/invoices                    List (filter: status, search, page, limit)
GET    /api/invoices/stats              Stats: totalInvoiced, collected, outstanding, thisMonth
POST   /api/invoices                    Create manual invoice
GET    /api/invoices/:id                Get single invoice (with items + payments)
PATCH  /api/invoices/:id                Update tax/discount/dueDate/notes
DELETE /api/invoices/:id                Delete (DRAFT only) or Cancel

POST   /api/invoices/:id/items          Add line item
PATCH  /api/invoices/:id/items/:itemId  Update line item
DELETE /api/invoices/:id/items/:itemId  Remove line item

POST   /api/invoices/:id/payments       Record payment
POST   /api/invoices/:id/send           Send PDF via email to guest
GET    /api/invoices/:id/pdf            Download PDF (streams binary)

POST   /api/invoices/from-booking/:bookingId  Create invoice from booking
```

---

## File Structure

```
apps/web/src/
  app/(dashboard)/dashboard/invoices/
    page.tsx              ← Invoice list, stats, filter, pagination
    new/page.tsx          ← Create manual invoice form
    [id]/page.tsx         ← Invoice detail (items, payments, settings)

  app/(dashboard)/dashboard/bookings/
    [id]/invoice/page.tsx ← Booking invoice view (computed, print, PDF, email)

apps/api/src/routes/
  invoices.ts             ← All invoice CRUD, stats, PDF, email (~700 lines)
  bookings.ts             ← Booking invoice compute + extras + send-email

packages/database/prisma/
  schema.prisma           ← Invoice, InvoiceItem, InvoicePayment models
```

---

## Key Functions (API)

### `nextInvoiceNumber(tenantId)`
Invoice number generate করে format: `INV-YYYY-NNNN`.  
**Safe approach:** `findFirst({ orderBy: { invoiceNumber: 'desc' } })` দিয়ে last number নেয়, COUNT না করে। এতে deletion এর পর gap হয় না এবং race condition কম।

### `syncTotals(invoiceId)`
Item change বা payment record এর পরে invoice এর totals ও status update করে:
- `subtotal` = sum of (quantity × unitPrice)
- `taxAmount` = subtotal × taxRate / 100
- `total` = subtotal + taxAmount − discountAmt
- `paidAmount` = sum of all payments
- `status` → SENT / PARTIAL / PAID / OVERDUE (automatically)

### `buildInvoicePdf(invoiceId)`
PDFKit দিয়ে A4 PDF generate করে। Returns `Buffer`.  
- Tenant header (name, address, phone, email)
- Guest info + invoice number + date + status badge
- Line items table (description, qty, unit price, total)
- Totals section (subtotal, tax, discount, grand total, paid, outstanding)
- Payment history
- Notes + footer

### `recalcTotals(items, taxRate, discountAmt)`
Pure function — DB call নেই। Items array থেকে subtotal/tax/total calculate করে।

---

## Data Flow

```
Manual Invoice:
Staff → /invoices/new → POST /api/invoices → status: DRAFT
  → /invoices/:id → Add items → PATCH items → syncTotals()
  → Record Payment → POST /invoices/:id/payments → syncTotals()
  → Send Email → POST /invoices/:id/send → PDF attachment

Booking Invoice (auto):
Check-out → booking status: CHECKED_OUT
  → auto-create invoice via createBookingInvoice()
  → INV-YYYY-NNNN number assigned
  → /bookings/:id/invoice → computed view (roomTotal + food + extras)
  → Email → POST /bookings/:id/invoice/send-email
  → PDF → GET /api/invoices/:invoiceId/pdf
```

---

## Prisma Models

```prisma
model Invoice {
  id            String   @id @default(uuid())
  tenantId      String
  bookingId     String?  @unique
  invoiceNumber String   @unique
  guestName     String
  guestEmail    String?
  guestPhone    String?
  status        String   // DRAFT | SENT | PAID | PARTIAL | OVERDUE | CANCELLED
  subtotal      Decimal  @default(0)
  taxRate       Decimal  @default(0)
  taxAmount     Decimal  @default(0)
  discountAmt   Decimal  @default(0)
  discountNote  String?
  total         Decimal  @default(0)
  paidAmount    Decimal  @default(0)
  dueDate       DateTime?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant   Tenant          @relation(...)
  booking  Booking?        @relation(...)
  items    InvoiceItem[]
  payments InvoicePayment[]
}

model InvoiceItem {
  id          String  @id @default(uuid())
  invoiceId   String
  description String
  category    String  // ROOM | FOOD | SERVICE | LAUNDRY | MINIBAR | OTHER
  quantity    Int
  unitPrice   Decimal
  total       Decimal
  invoice     Invoice @relation(...)
}

model InvoicePayment {
  id        String   @id @default(uuid())
  invoiceId String
  amount    Decimal
  method    String   // CASH | CARD | BANK_TRANSFER | STRIPE | OTHER
  reference String?
  note      String?
  paidAt    DateTime @default(now())
  invoice   Invoice  @relation(...)
}
```

---

## উন্নতির সুযোগ (Future)

- [ ] Invoice template customization (logo, color, footer text)
- [ ] Recurring invoices (monthly retainer clients)
- [ ] Bulk export to Excel/CSV
- [ ] Stripe payment link from invoice (online payment)
- [ ] Overdue auto-reminder email (cron job)
- [ ] Multi-currency support per invoice
- [ ] Invoice audit log (who changed what, when)

---

## Status

সব core feature ✅ live:
- Manual invoice create, line items, payments, PDF, email
- Booking-linked invoice auto-create, extra charges, print/PDF
- Pagination, filter, stats (including thisMonth) — June 2026
- Invoice number collision fix (findFirst orderBy vs COUNT) — June 2026
