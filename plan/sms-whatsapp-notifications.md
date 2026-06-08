# SMS & WhatsApp Guest Notifications
**Bangladesh-first guest communication system**

---

## কেন এটা দরকার

বাংলাদেশের অধিকাংশ resort guest:
- Email **প্রতিদিন চেক করেন না** — অনেকে inbox-ই খোলেন না
- **SMS** — সবাই পড়েন, 98% open rate, ফোন কম দামি হলেও SMS আসে
- **WhatsApp** — শহরের গেস্টরা বেশিরভাগ WhatsApp use করেন, group sharing করা যায়
- **Email শুধু corporate / foreign guests** এর জন্য reliable

---

## কী কী Notification পাঠাতে হবে

| Event | SMS | WhatsApp | Email |
|-------|-----|----------|-------|
| Booking Confirmed | ✅ সবসময় | ✅ যদি number থাকে | ✅ |
| Payment Received | ✅ | ✅ | ✅ |
| Check-in Reminder (1 দিন আগে) | ✅ | ✅ | ✅ |
| Check-out Reminder (সকালে) | ✅ | ⬜ optional | ⬜ |
| Invoice Sent | ⬜ link সহ | ✅ PDF link | ✅ |
| Booking Cancelled | ✅ | ✅ | ✅ |
| OTP / Verification | ✅ | ⬜ | ⬜ |
| Group Booking Update | ✅ | ✅ | ✅ |

---

## Phase 1 — SMS (সবচেয়ে আগে করতে হবে)

### BD SMS Gateway Options

| Provider | Cost (per SMS) | API Quality | Delivery Rate |
|----------|---------------|-------------|---------------|
| **SSL Wireless** | ~0.25–0.35 BDT | ভালো REST API | ✅ সবচেয়ে reliable |
| **Alpha.Net** | ~0.20–0.30 BDT | REST API আছে | ✅ ভালো |
| **BulkSMSBD** | ~0.25 BDT | Simple HTTP | ✅ ঠিক আছে |
| **Twilio** | ~$0.05–0.08 USD | সেরা API | ⚠️ দামি, BD delivery মাঝে মাঝে slow |
| **Vonage (Nexmo)** | ~$0.06 USD | ভালো | ⚠️ দামি |

**Recommendation: SSL Wireless (primary) + Twilio (fallback)**
- SSL Wireless BD-তে সবচেয়ে reliable এবং সস্তা
- Twilio fallback রাখলে ভালো — বিদেশি গেস্টদের জন্য

### SMS Template Examples (বাংলা + English)

```
Booking Confirmed (English):
"ResortPro: Your booking at {resortName} is confirmed!
Check-in: {checkIn} | Room: {roomName}
Booking ID: {confirmationNo}
-{resortName}"

Booking Confirmed (Bangla):
"আপনার বুকিং নিশ্চিত হয়েছে!
রিসোর্ট: {resortName}
চেক-ইন: {checkIn} | রুম: {roomName}
বুকিং নং: {confirmationNo}"

Check-in Reminder:
"Reminder: Your stay at {resortName} starts tomorrow!
Check-in: {checkInTime} | Room: {roomName}
Need help? Call: {resortPhone}"

Payment Received:
"Payment of BDT {amount} received for booking {confirmationNo} at {resortName}.
Balance due: BDT {balance}. Thank you!"
```

### API Integration Plan

**New file:** `apps/api/src/services/sms.ts`

```typescript
interface SMSProvider {
  send(to: string, message: string): Promise<{ success: boolean; messageId?: string }>
}

// SSL Wireless implementation
class SSLWirelessProvider implements SMSProvider { ... }

// Twilio fallback
class TwilioProvider implements SMSProvider { ... }

// Smart router — try primary, fallback if fails
export async function sendSMS(to: string, message: string, tenantId?: string) { ... }
```

**New Prisma model:** `SMSLog`
```prisma
model SMSLog {
  id         String   @id @default(cuid())
  tenantId   String
  to         String
  message    String
  provider   String   // "ssl_wireless" | "twilio"
  status     String   // "sent" | "failed" | "pending"
  messageId  String?
  error      String?
  sentAt     DateTime @default(now())
}
```

**Settings (per-tenant):**
```prisma
// Tenant model এ যোগ করতে হবে:
smsEnabled     Boolean  @default(false)
smsProvider    String?  // "ssl_wireless" | "twilio"
smsApiKey      String?
smsSenderId    String?  // "RESORT" max 11 chars
```

**Trigger points in existing code:**
- `apps/api/src/routes/bookings.ts` — booking confirmed/cancelled
- `apps/api/src/routes/invoices.ts` — payment recorded
- `apps/api/src/services/automation.ts` — check-in reminder cron

---

## Phase 2 — WhatsApp Business API

### Approach Options

| Option | Cost | Setup Difficulty | Features |
|--------|------|-----------------|----------|
| **Meta Cloud API (direct)** | Free up to 1000 conversations/month | Medium | Template messages, media, buttons |
| **360dialog** | ~$5/month + per message | Easy | Good dashboard, quick setup |
| **Twilio WhatsApp** | $0.005/message + template fee | Easy | Already using Twilio for SMS |
| **WATI** | ~$40/month flat | Very Easy | Best for small businesses |

**Recommendation: Meta Cloud API (direct)**
- Free tier যথেষ্ট ছোট resort এর জন্য
- Long-term সবচেয়ে সস্তা
- Full control

### WhatsApp Message Types

1. **Template Messages** (pre-approved by Meta) — booking confirmation, reminders
2. **Session Messages** — গেস্ট WhatsApp করলে 24 ঘণ্টা ফ্রিতে reply করা যায়
3. **Media Messages** — PDF invoice পাঠানো, room photos

### WhatsApp Template Examples

**Booking Confirmation Template** (`booking_confirmed_v1`):
```
Hello {{1}},

Your booking at *{{2}}* has been confirmed! 🎉

📅 Check-in: {{3}}
📅 Check-out: {{4}}
🛏️ Room: {{5}}
🔖 Booking ID: {{6}}

Need anything? Reply to this message.
```

**Invoice Template** (`invoice_ready_v1`):
```
Hello {{1}},

Your invoice from *{{2}}* is ready.

💰 Total: BDT {{3}}
💳 Paid: BDT {{4}}
📋 Invoice #: {{5}}

[View Invoice] — {{6}}
```

### WhatsApp Business Number Setup
1. Meta Business Manager account খুলতে হবে
2. Phone number verify করতে হবে (resort এর number)
3. Business verification (~3-7 days)
4. Template approval (~24 hours each)

---

## Phase 3 — Dashboard UI

### Settings Page (Dashboard → Settings → Notifications)

```
SMS Settings
├── Enable SMS notifications [toggle]
├── Provider: [SSL Wireless / Twilio]
├── API Key: [input]
├── Sender ID: [input, max 11 chars]
└── Test SMS: [input phone] [Send Test]

WhatsApp Settings  
├── Enable WhatsApp notifications [toggle]
├── WhatsApp Business Number: [input]
├── Meta API Token: [input]
├── Phone Number ID: [input]
└── Test WhatsApp: [input phone] [Send Test]

Notification Triggers [checkboxes]
├── ✅ Booking confirmed
├── ✅ Payment received
├── ✅ Check-in reminder (1 day before)
├── ✅ Check-out reminder
├── ✅ Booking cancelled
└── ⬜ Invoice sent
```

### Guest Profile Page এ যোগ করতে হবে
- WhatsApp number (phone থেকে আলাদা রাখা ভালো)
- Preferred contact method: Email / SMS / WhatsApp
- Language preference: English / বাংলা

---

## Technical Architecture

```
Booking/Payment Event
        │
        ▼
NotificationService.trigger(event, guestData)
        │
        ├──→ EmailService (existing)
        ├──→ SMSService (new)
        │       ├── SSL Wireless (primary)
        │       └── Twilio (fallback)
        └──→ WhatsAppService (new)
                └── Meta Cloud API
                        └── Template Message
```

**Queue করতে হবে (BullMQ):**
- Notification failure হলে 3x retry
- Rate limiting — SSL Wireless এর limit আছে
- Log সব sent/failed messages

---

## Cost Estimate (Monthly, 100 bookings/month)

| Channel | Volume | Unit Cost | Monthly Cost |
|---------|--------|-----------|-------------|
| SMS (SSL Wireless) | ~300 SMS | 0.30 BDT | ~90 BDT (~$1) |
| WhatsApp (Meta free tier) | ~200 conversations | Free | 0 |
| WhatsApp (over free tier) | 0 | $0.015 | 0 |
| **Total** | | | **~90 BDT/month** |

**বড় resort (500 bookings/month):**
- SMS: ~1500 SMS × 0.30 = 450 BDT (~$4)
- WhatsApp: 500 conversations, 500 free → ~0 cost
- **Total: ~$4-5/month**

---

## Implementation Order

```
Week 1-2: SMS Service
  ✦ SSL Wireless API integration
  ✦ Twilio fallback
  ✦ SMSLog model + migration
  ✦ Booking confirmation SMS trigger
  ✦ Payment SMS trigger
  ✦ Check-in reminder cron (existing automation এ add)

Week 3: SMS Settings UI
  ✦ Settings page SMS section
  ✦ Test SMS feature
  ✦ SMS log viewer (admin)

Week 4-5: WhatsApp Business API
  ✦ Meta Cloud API client
  ✦ Template registration (booking_confirmed, payment_received, checkin_reminder)
  ✦ WhatsApp trigger integration
  ✦ Media message support (PDF invoice)

Week 6: WhatsApp Settings UI + Polish
  ✦ Settings page WhatsApp section
  ✦ Guest preferred channel selection
  ✦ Delivery status webhook handling
  ✦ Failed notification alert to owner
```

---

## Dependencies / Prerequisites

- [ ] SSL Wireless account খুলতে হবে → https://sslwireless.com
- [ ] Business registration document লাগবে (trade license)
- [ ] Sender ID approve করাতে হবে (3-5 business days)
- [ ] Meta Business Manager account
- [ ] WhatsApp Business number (resort এর নিজস্ব number)
- [ ] Message templates আগে তৈরি করে approval নিতে হবে

---

## Files to Create/Modify

```
NEW:
  apps/api/src/services/sms.ts
  apps/api/src/services/whatsapp.ts
  apps/web/src/app/(dashboard)/dashboard/settings/notifications/page.tsx

MODIFY:
  packages/database/prisma/schema.prisma  ← SMSLog, Tenant fields
  apps/api/src/routes/bookings.ts         ← trigger SMS/WA on confirm
  apps/api/src/routes/invoices.ts         ← trigger on payment
  apps/api/src/services/automation.ts     ← check-in reminder
  apps/api/src/routes/settings.ts         ← save SMS/WA credentials
```

---

*Plan created: 2026-05-19*  
*Priority: 🔴 High — directly impacts guest satisfaction in BD market*
