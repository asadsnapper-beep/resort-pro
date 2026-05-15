# Task 32 — Guest Communication (Auto Emails)

**Branch:** `feature/guest-emails`
**Priority:** 🟡 Important
**Estimate:** 1 day

---

## Goal
Guest-কে automatic email পাঠানো booking lifecycle events-এ। Resend integration।

---

## Email Triggers

| Event | Subject | Timing |
|-------|---------|--------|
| Booking confirmed | "Your booking is confirmed — {Resort Name}" | Immediately on confirm |
| Check-in tomorrow | "We look forward to welcoming you tomorrow!" | 1 day before check-in (cron) |
| Checked out | "Thank you for staying with us + Invoice" | On checkout |
| Booking cancelled | "Your booking has been cancelled" | Immediately on cancel |

---

## Prisma

```prisma
model EmailSettings {
  id                    String  @id @default(cuid())
  tenantId              String  @unique
  sendConfirmation      Boolean @default(true)
  sendPreArrival        Boolean @default(true)
  sendCheckoutInvoice   Boolean @default(true)
  sendCancellation      Boolean @default(true)
  replyToEmail          String?
  footerText            String?
  tenant                Tenant  @relation(fields: [tenantId], references: [id])
  @@map("email_settings")
}
```

---

## Steps

### Step 1 — Email templates (Resend)
Create HTML email templates for each trigger. Resort name, logo, and colors auto-injected from tenant settings.

Templates use simple inline CSS (email-safe). Include:
- Resort logo + name header
- Main content
- Booking details table (room, dates, guests, total)
- CTA button
- Footer with resort contact info

### Step 2 — Email sending utility
`apps/api/src/utils/guest-emails.ts`

```ts
export async function sendBookingConfirmation(booking, guest, tenant) {}
export async function sendPreArrivalReminder(booking, guest, tenant) {}
export async function sendCheckoutEmail(booking, guest, tenant, invoiceData) {}
export async function sendCancellationEmail(booking, guest, tenant) {}
```

Each function checks `emailSettings.send*` toggle before sending.

### Step 3 — Hook into booking routes
- `POST /api/bookings` (create + confirm) → `sendBookingConfirmation()`
- `PATCH /api/bookings/:id/check-out` → `sendCheckoutEmail()` (with invoice)
- `PATCH /api/bookings/:id/cancel` → `sendCancellationEmail()`

### Step 4 — Pre-arrival cron
`apps/api/src/jobs/pre-arrival-reminder.ts`

Runs daily at 9AM: find bookings where `checkIn = tomorrow` and `status = confirmed` → send reminder।

Register in `src/index.ts` with `node-cron`.

### Step 5 — Email settings UI
`/dashboard/settings` → new "Email" tab:
- Toggle per trigger (on/off)
- Reply-to email field
- Footer text
- Test email button (sends sample to owner's email)

---

## Acceptance Criteria
- [ ] Confirmation email sent on booking
- [ ] Pre-arrival reminder sent day before (cron)
- [ ] Checkout email includes invoice summary
- [ ] Cancellation email sent
- [ ] Each toggle works (disable individual emails)
- [ ] Test email button works
- [ ] Resort branding in email (name, logo if set)
