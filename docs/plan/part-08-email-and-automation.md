# Part 08 — Email System & Automation Engine

## Overview
দুইটি আলাদা email layer আছে:
1. **Transactional emails** — Auth, booking confirmation, etc.
2. **Automation Engine** — Guest-দের জন্য drip campaign / email sequences

---

## Email Service (`apps/api/src/services/email.ts`)

### Provider
**Resend API** (`RESEND_API_KEY` env var)
- Fallback: `re_placeholder` (dev-এ email যায় না)
- FROM: `ResortPro <noreply@resortpro.app>` (configurable via `EMAIL_FROM`)

### Core Function
```typescript
sendEmail({ to, subject, html, replyTo? })
→ returns { id, error }
```

### Branded Email Wrapper
`wrapEmail({ body, tenantName, primaryColor, accentColor, unsubscribeUrl })`
- Full HTML email template
- Resort-branded header (primary color)
- Footer with unsubscribe link

### Template Variable Replacer
`renderTemplate(html, vars)` — `{{variableName}}` → actual value

---

## Transactional Emails Sent

| Event | Recipient | Content |
|-------|-----------|---------|
| Registration | Resort owner | Welcome + trial end date + dashboard link |
| Password reset | Owner/staff | Reset link (1 hour expiry) |
| Staff invite | New staff | Invite link + resort name |
| Booking confirmation | Guest | Confirmation #, room, dates |
| Pre-arrival (3 days before) | Guest | Arrival reminder + upsell |
| Post-stay | Guest | Thank you + feedback link |
| Win-back | Guest | Come back offer + discount |
| Birthday | Guest | Birthday gift offer |
| Guest payment link | Guest | Stripe payment link |

---

## Automation Engine (`apps/api/src/services/automation.ts`)

### What it does
- Cron-based engine — checks every 30 minutes
- Processes enrolled guests through email sequences
- Handles pre-arrival, post-stay, birthday, win-back sequences

### Email Sequence Model (DB)
```prisma
model Sequence {
  trigger: SequenceTrigger   // BOOKING_CONFIRMED, PRE_ARRIVAL, POST_STAY, WIN_BACK, BIRTHDAY
  steps: SequenceStep[]      // Each step = one email at a specific day offset
}

model SequenceEnrollment {
  guest + sequence + status (ACTIVE/COMPLETED/PAUSED/CANCELLED)
  currentStep: Int           // Which step they're on
}
```

### Sequence Triggers
| Trigger | When enrolled |
|---------|--------------|
| BOOKING_CONFIRMED | Booking created |
| PRE_ARRIVAL | Before check-in (configurable days) |
| POST_STAY | After check-out |
| WIN_BACK | Guest hasn't visited in X days |
| BIRTHDAY | Guest's birthday month |

### Email Templates Available
- `BOOKING_CONFIRMED` — Confirmation with details table
- `PRE_ARRIVAL` — "Your stay is almost here" + upsell
- `POST_STAY` — Thank you + feedback link
- `WIN_BACK` — "We miss you" + special offer
- `BIRTHDAY` — Birthday gift + booking CTA

---

## SaaS Trial Email Cron (`apps/api/src/services/trial-emails.ts`)

Separate service for ResortPro's own SaaS lifecycle emails।

**Schedule:** Every 12 hours (startup + setInterval in `app.ts`)

**Logic:** `±12 hour window` around target day to avoid double-sending

See **Part 07** for full email sequence details।

---

## CRM Routes (`/api/crm`)
- Manage email sequences per tenant
- Enroll guests in sequences
- View enrollment status
- Pause / resume / cancel enrollments

---

## Key Files
| File | Purpose |
|------|---------|
| `apps/api/src/services/email.ts` | Core email service + templates |
| `apps/api/src/services/automation.ts` | Guest email automation engine |
| `apps/api/src/services/trial-emails.ts` | SaaS trial lifecycle emails |
| `apps/api/src/routes/crm.ts` | Email sequence management API |
| `apps/web/src/app/(dashboard)/dashboard/crm/` | CRM dashboard page |
