# Task 30 — Guest Invoice / Folio

**Branch:** `feature/guest-invoice`
**Priority:** 🔴 Critical
**Estimate:** 1 day

---

## Goal
Guest-এর সব charges একটা itemized printable invoice-এ — room + restaurant + extras + tax।

---

## Prisma Changes

```prisma
model InvoiceExtra {
  id          String   @id @default(cuid())
  tenantId    String
  bookingId   String
  description String
  amount      Float
  quantity    Int      @default(1)
  createdAt   DateTime @default(now())
  booking     Booking  @relation(fields: [bookingId], references: [id])

  @@map("invoice_extras")
}

model Booking {
  // add:
  invoiceNumber   String?   @unique
  invoiceSentAt   DateTime?
  extras          InvoiceExtra[]
}
```

---

## Steps

### Step 1 — Invoice compute API
`GET /api/bookings/:id/invoice`

Computes:
```json
{
  "invoiceNumber": "INV-2026-0042",
  "booking": { "confirmationNumber": "...", "checkIn": "...", "checkOut": "..." },
  "guest": { "name": "...", "email": "...", "phone": "..." },
  "resort": { "name": "...", "address": "...", "phone": "...", "logo": "..." },
  "lineItems": [
    { "description": "Deluxe Room × 3 nights", "qty": 3, "rate": 5000, "amount": 15000 },
    { "description": "Room Service - Chicken Biryani", "qty": 2, "rate": 350, "amount": 700 },
    { "description": "Airport Transfer", "qty": 1, "rate": 1500, "amount": 1500 }
  ],
  "subtotal": 17200,
  "taxRate": 0.15,
  "taxAmount": 2580,
  "total": 19780,
  "amountPaid": 10000,
  "balanceDue": 9780,
  "currency": "BDT"
}
```

### Step 2 — Add extras API
`PATCH /api/bookings/:id/invoice/extras`
- Add/remove manual line items (airport transfer, laundry, minibar, etc.)

### Step 3 — Email invoice
`POST /api/bookings/:id/invoice/send-email`
- Send formatted invoice email to guest via Resend

### Step 4 — Invoice UI page
`apps/web/src/app/(dashboard)/dashboard/bookings/[id]/invoice/page.tsx`

Layout:
- Resort header (logo, name, address)
- Guest info + booking ref
- Line items table (description, qty, rate, amount)
- Subtotal / Tax / Total / Paid / Balance Due
- Action bar: Print, Email Guest, Add Extra Charge
- Print-optimized CSS (`@media print`)

### Step 5 — Auto invoice number
On first invoice load: generate `INV-{year}-{padded_seq}` and save to booking.

### Step 6 — Invoice link from booking detail
After checkout → "View Invoice" button in booking detail. Also show in booking list.

---

## Acceptance Criteria
- [ ] Invoice computes room + restaurant + extras correctly
- [ ] Tax applied based on tenant's tax rate setting
- [ ] Print button produces clean printable layout
- [ ] Email sends to guest with proper formatting
- [ ] Manual extras can be added/removed
- [ ] Invoice number auto-generated and unique
- [ ] Balance due correct (total minus payments)
