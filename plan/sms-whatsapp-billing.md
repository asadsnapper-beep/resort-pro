# SMS & WhatsApp — Multi-Tenant Billing & Quota System
**প্রতিটি resort owner নিজের dashboard থেকে configure করবে, usage track হবে, credits কিনতে পারবে**

---

## System Overview

```
দুটো mode:

Mode 1 — Platform Shared Pool (default)
  ResortPro এর নিজস্ব SSL Wireless + Meta account
  Plan অনুযায়ী monthly quota include
  Extra হলে credits কিনতে হবে

Mode 2 — Owner's Own Credentials (BYOC)
  Owner নিজের SSL Wireless / Twilio / Meta credentials দেবে
  Platform শুধু API call করবে
  Billing সরাসরি owner → gateway
  ResortPro platform fee নেবে না SMS এর জন্য
```

---

## Plan Quotas (Platform Pool)

| Plan | SMS/month | WhatsApp conversations/month | Price |
|------|-----------|------------------------------|-------|
| STARTER | 100 SMS | 50 conversations | plan-এ include |
| PROFESSIONAL | 500 SMS | 200 conversations | plan-এ include |
| ENTERPRISE | 2,000 SMS | 1,000 conversations | plan-এ include |
| Extra (credits) | 1 credit = 1 SMS | 1 credit = 1 WA conversation | ক্রয়যোগ্য |

**Credit pricing:**
- 100 credits = BDT 40 (0.40 BDT/SMS — platform profit ~0.10 BDT after SSL Wireless cost)
- 500 credits = BDT 180 (0.36 BDT/SMS)
- 1,000 credits = BDT 320 (0.32 BDT/SMS)

---

## Database Schema

```prisma
// Tenant model এ যোগ করতে হবে
model Tenant {
  // ... existing fields

  // SMS/WhatsApp mode
  smsMode            String   @default("platform") // "platform" | "own"
  
  // BYOC credentials (encrypted)
  smsProvider        String?  // "ssl_wireless" | "twilio" | "alpha_net"
  smsApiKey          String?  // encrypted
  smsApiSecret       String?  // encrypted
  smsSenderId        String?  // max 11 chars, e.g. "RESORT"
  
  waMode             String   @default("platform") // "platform" | "own"
  waApiToken         String?  // encrypted - Meta or 3rd party
  waPhoneNumberId    String?  // Meta Phone Number ID
  waBusinessAccId    String?  // Meta Business Account ID
  
  // Platform pool credits & quota
  smsQuotaMonthly    Int      @default(100)  // plan-based
  smsUsedThisMonth   Int      @default(0)
  smsCredits         Int      @default(0)    // purchased extra credits
  smsQuotaResetAt    DateTime?
  
  waQuotaMonthly     Int      @default(50)
  waUsedThisMonth    Int      @default(0)
  waCredits          Int      @default(0)
  
  // Notification preferences
  notifBookingConfirm   Boolean @default(true)
  notifPaymentReceived  Boolean @default(true)
  notifCheckinReminder  Boolean @default(true)
  notifCheckoutRemind   Boolean @default(false)
  notifCancellation     Boolean @default(true)
  notifInvoiceSent      Boolean @default(false)
  notifLanguage         String  @default("en") // "en" | "bn"
  
  smsLogs            SMSLog[]
  smsCreditsLog      SMSCreditsLog[]
}

// প্রতিটা SMS এর record
model SMSLog {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  
  to           String   // phone number
  message      String
  type         String   // "booking_confirm" | "payment" | "checkin_reminder" | "checkout" | "cancellation" | "otp"
  channel      String   // "sms" | "whatsapp"
  mode         String   // "platform" | "own"  — কোন mode তে পাঠানো হয়েছে
  
  provider     String   // "ssl_wireless" | "twilio" | "alpha_net" | "meta"
  providerId   String?  // gateway এর message ID
  status       String   // "queued" | "sent" | "delivered" | "failed"
  error        String?
  
  creditUsed   Int      @default(1) // কতটা credit খরচ হয়েছে
  
  bookingId    String?
  invoiceId    String?
  guestId      String?
  
  sentAt       DateTime @default(now())
  deliveredAt  DateTime?

  @@index([tenantId, sentAt])
  @@index([tenantId, type])
}

// Credits কেনার history
model SMSCreditsLog {
  id         String   @id @default(cuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  
  amount     Int      // কত credits কেনা হয়েছে
  paidBDT    Float    // কত BDT দিয়েছে
  paymentId  String?  // Stripe payment intent ID
  note       String?  // "purchased_100" | "plan_refill_monthly" | "manual_grant"
  
  createdAt  DateTime @default(now())

  @@index([tenantId])
}
```

---

## API Endpoints

### Tenant-facing (Dashboard)

```
GET    /api/sms/usage          — এই মাসে কত SMS গেছে, credit balance
GET    /api/sms/logs           — SMS history (paginated, filterable)
POST   /api/sms/test           — Test SMS পাঠাও { to, message }
POST   /api/sms/test-whatsapp  — Test WhatsApp পাঠাও

GET    /api/settings/notifications       — current config get
PATCH  /api/settings/notifications       — toggle on/off, language, triggers

PATCH  /api/settings/sms-credentials    — BYOC: API key, sender ID save
PATCH  /api/settings/wa-credentials     — BYOC: Meta token, phone number ID save

POST   /api/billing/sms-credits         — credits কিনতে Stripe checkout session
GET    /api/billing/sms-credits/history — credit purchase history
```

### Admin-facing (Super Admin)

```
GET  /api/admin/sms/overview            — সব tenant এর total usage
GET  /api/admin/sms/tenant/:id          — একটা tenant এর detail
POST /api/admin/sms/grant-credits       — manually credits দেওয়া
GET  /api/admin/sms/cost-report         — platform এর actual SMS cost vs revenue
```

---

## Core Service: `NotificationRouter`

```typescript
// apps/api/src/services/notification-router.ts

interface NotificationPayload {
  tenantId:  string
  to:        string          // phone number
  type:      NotifType
  data:      Record<string, string>  // template variables
  bookingId?: string
  invoiceId?: string
  guestId?:   string
}

export async function sendNotification(payload: NotificationPayload) {
  const tenant = await getTenantConfig(payload.tenantId)
  
  // 1. Check if this notification type is enabled
  if (!isEnabled(tenant, payload.type)) return
  
  // 2. Determine mode and check quota/credits
  const smsMode = tenant.smsMode  // "platform" | "own"
  
  if (smsMode === 'platform') {
    const canSend = await checkAndDeductQuota(tenant, 'sms')
    if (!canSend) {
      await notifyOwnerLowCredits(tenant)
      await logSMS({ ...payload, status: 'failed', error: 'quota_exceeded' })
      return
    }
  }
  
  // 3. Build message from template (language aware)
  const message = buildTemplate(payload.type, payload.data, tenant.notifLanguage)
  
  // 4. Send via correct provider
  const result = smsMode === 'own'
    ? await sendViaBYOC(tenant, payload.to, message)
    : await sendViaPlatform(payload.to, message)
  
  // 5. Log it
  await logSMS({
    tenantId: payload.tenantId,
    to:       payload.to,
    message,
    type:     payload.type,
    channel:  'sms',
    mode:     smsMode,
    provider: result.provider,
    providerId: result.messageId,
    status:   result.success ? 'sent' : 'failed',
    error:    result.error,
    ...payload,
  })
}
```

---

## Quota Management

```typescript
// apps/api/src/services/sms-quota.ts

async function checkAndDeductQuota(tenant: Tenant, channel: 'sms' | 'wa'): Promise<boolean> {
  // Monthly quota এখনো আছে কিনা
  const quotaField = channel === 'sms' ? 'smsQuotaMonthly' : 'waQuotaMonthly'
  const usedField  = channel === 'sms' ? 'smsUsedThisMonth' : 'waUsedThisMonth'
  const creditField = channel === 'sms' ? 'smsCredits' : 'waCredits'
  
  const remaining = tenant[quotaField] - tenant[usedField]
  
  if (remaining > 0) {
    // Monthly quota থেকে কাটো
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { [usedField]: { increment: 1 } }
    })
    return true
  }
  
  // Monthly quota শেষ — credits আছে কিনা দেখো
  if (tenant[creditField] > 0) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { [creditField]: { decrement: 1 } }
    })
    return true
  }
  
  return false  // কোনো quota বা credit নেই
}

// মাসের শুরুতে quota reset করার cron
// apps/api/src/services/automation.ts এ যোগ করতে হবে:
// cron.schedule('0 0 1 * *', resetMonthlyQuotas)

async function resetMonthlyQuotas() {
  await prisma.tenant.updateMany({
    data: {
      smsUsedThisMonth: 0,
      waUsedThisMonth: 0,
      smsQuotaResetAt: new Date(),
    }
  })
}
```

---

## Credits Purchase Flow

```
Owner Dashboard → Billing → "Buy SMS Credits"
        │
        ▼
POST /api/billing/sms-credits
{ package: "100" | "500" | "1000" }
        │
        ▼
Stripe Checkout Session তৈরি
(one-time payment, not subscription)
        │
        ▼ (Stripe webhook: payment_intent.succeeded)
POST /api/webhooks/stripe
        │
        ▼
SMSCreditsLog তৈরি
Tenant.smsCredits += purchased_amount
Owner কে SMS/email notification
```

---

## Dashboard UI — Settings → Notifications

### Tab 1: SMS Settings

```
┌─────────────────────────────────────────────────────┐
│ SMS Notifications                    [Enable ●]      │
├─────────────────────────────────────────────────────┤
│ Usage This Month                                     │
│ ████████░░░░░░░░░░  180 / 500 SMS used              │
│ Credits remaining: 0    [Buy Credits]                │
├─────────────────────────────────────────────────────┤
│ SMS Provider                                         │
│ ● Platform (included in plan)                        │
│ ○ Use my own credentials                             │
│   └─ Provider: [SSL Wireless ▾]                     │
│   └─ API Key: [••••••••••••]                        │
│   └─ Sender ID: [RESORT    ] (max 11 chars)         │
├─────────────────────────────────────────────────────┤
│ Send Test SMS: [+8801XXXXXXXXX] [Send Test ▶]        │
└─────────────────────────────────────────────────────┘
```

### Tab 2: WhatsApp Settings

```
┌─────────────────────────────────────────────────────┐
│ WhatsApp Notifications               [Enable ●]      │
├─────────────────────────────────────────────────────┤
│ Usage This Month                                     │
│ ████░░░░░░░░░░░░░░  45 / 200 conversations          │
│ Credits remaining: 50   [Buy Credits]                │
├─────────────────────────────────────────────────────┤
│ WhatsApp Provider                                    │
│ ● Platform (included in plan)                        │
│ ○ Use my own Meta Business account                   │
│   └─ Phone Number ID: [________________]            │
│   └─ API Token: [••••••••••••••••••••]              │
│   └─ Business Account ID: [____________]            │
├─────────────────────────────────────────────────────┤
│ Send Test WhatsApp: [+8801XXXXXXXXX] [Send Test ▶]   │
└─────────────────────────────────────────────────────┘
```

### Tab 3: Notification Triggers

```
┌─────────────────────────────────────────────────────┐
│ Which events trigger notifications?                  │
├────────────────────────────────┬──────┬─────────────┤
│ Event                          │ SMS  │ WhatsApp    │
├────────────────────────────────┼──────┼─────────────┤
│ ✅ Booking Confirmed           │  ✅  │     ✅      │
│ ✅ Payment Received            │  ✅  │     ✅      │
│ ✅ Check-in Reminder (1 day)   │  ✅  │     ✅      │
│ ⬜ Check-out Reminder          │  ⬜  │     ⬜      │
│ ✅ Booking Cancelled           │  ✅  │     ✅      │
│ ⬜ Invoice Sent                │  ⬜  │     ✅      │
├────────────────────────────────┴──────┴─────────────┤
│ Message Language: ● English  ○ বাংলা  ○ Both        │
└─────────────────────────────────────────────────────┘
```

---

## Super Admin Dashboard — SMS Overview

```
/admin/sms

Total SMS sent this month: 4,823
Platform cost (SSL Wireless): BDT 1,206
Credits sold: BDT 1,840
Net profit from SMS: BDT 634

Top senders:
┌─────────────────────┬──────────┬──────────┬──────────┐
│ Resort              │ SMS Used │ Quota    │ Credits  │
├─────────────────────┼──────────┼──────────┼──────────┤
│ Palm Paradise Resort│   312    │ 500      │ 0        │
│ Cox's Bay Resort    │   501    │ 500      │ 150      │  ← quota শেষ, credits use হচ্ছে
│ Sundarbans Lodge    │    48    │ 100      │ 0        │
└─────────────────────┴──────────┴──────────┴──────────┘

[Grant Credits] [Export Report]
```

---

## Low Credit Alert System

```typescript
// Quota 80% পূর্ণ হলে warn করো
// Quota শেষ হলে alert করো

async function notifyOwnerLowCredits(tenant: Tenant) {
  const totalAvail = tenant.smsQuotaMonthly + tenant.smsCredits
  const used = tenant.smsUsedThisMonth
  
  if (used >= totalAvail) {
    // পুরো quota শেষ
    await sendEmail({
      to: tenant.billingEmail || ownerEmail,
      subject: `SMS quota শেষ — ${tenant.name}`,
      html: `...আপনার SMS quota শেষ হয়ে গেছে। Credits কিনুন...`
    })
    // Dashboard notification
    await createTenantNotification(tenant.id, {
      title: 'SMS quota exhausted',
      message: 'Buy credits to continue sending SMS notifications',
      type: 'warning',
      link: '/dashboard/billing#sms-credits'
    })
  } else if (used >= totalAvail * 0.8) {
    // 80% শেষ — warning
    await createTenantNotification(tenant.id, {
      title: `SMS quota 80% used`,
      message: `${totalAvail - used} SMS remaining this month`,
      type: 'info',
      link: '/dashboard/billing#sms-credits'
    })
  }
}
```

---

## BYOC (Bring Your Own Credentials) Flow

```typescript
// apps/api/src/services/sms-byoc.ts

async function sendViaBYOC(tenant: Tenant, to: string, message: string) {
  if (!tenant.smsApiKey) throw new Error('No API credentials configured')
  
  switch (tenant.smsProvider) {
    case 'ssl_wireless':
      return sendSSLWireless({
        apiKey:   decrypt(tenant.smsApiKey),
        senderId: tenant.smsSenderId || 'RESORT',
        to,
        message,
      })
    
    case 'twilio':
      return sendTwilio({
        accountSid: decrypt(tenant.smsApiKey),
        authToken:  decrypt(tenant.smsApiSecret!),
        from:       tenant.smsSenderId!,
        to,
        message,
      })
    
    case 'alpha_net':
      return sendAlphaNet({ ... })
  }
}
```

**Security:** API keys অবশ্যই encrypt করে রাখতে হবে:
```typescript
// AES-256 encryption
import { encrypt, decrypt } from '../utils/crypto'

// Save করার সময়:
await prisma.tenant.update({
  where: { id },
  data: { smsApiKey: encrypt(apiKey) }
})

// Use করার সময়:
const key = decrypt(tenant.smsApiKey)
```

---

## Files to Create/Modify

```
NEW:
  apps/api/src/services/notification-router.ts   ← main entry point
  apps/api/src/services/sms-platform.ts          ← SSL Wireless platform account
  apps/api/src/services/sms-byoc.ts              ← BYOC (owner credentials)
  apps/api/src/services/whatsapp-platform.ts     ← Meta platform account
  apps/api/src/services/whatsapp-byoc.ts         ← BYOC WhatsApp
  apps/api/src/services/sms-quota.ts             ← quota/credits management
  apps/api/src/routes/sms-settings.ts            ← settings API
  apps/api/src/routes/sms-credits.ts             ← credits purchase API
  apps/web/src/app/(dashboard)/dashboard/settings/notifications/page.tsx

MODIFY:
  packages/database/prisma/schema.prisma         ← Tenant fields, SMSLog, SMSCreditsLog
  apps/api/src/routes/bookings.ts                ← trigger on booking events
  apps/api/src/routes/invoices.ts                ← trigger on payment
  apps/api/src/services/automation.ts            ← check-in reminder + monthly quota reset
  apps/api/src/routes/billing.ts                 ← credits Stripe checkout
  apps/api/src/routes/admin.ts                   ← admin SMS overview
```

---

## Implementation Order

```
Week 1: Database + Core Service
  ✦ Schema migration (SMSLog, SMSCreditsLog, Tenant fields)
  ✦ notification-router.ts (platform mode only)
  ✦ ssl-wireless.ts platform integration
  ✦ sms-quota.ts (check, deduct, reset cron)
  ✦ Booking trigger

Week 2: Settings API + Dashboard UI
  ✦ GET/PATCH /api/settings/notifications
  ✦ PATCH /api/settings/sms-credentials (BYOC save — encrypted)
  ✦ POST /api/sms/test
  ✦ Dashboard UI — SMS tab, WA tab, triggers tab
  ✦ Usage progress bar

Week 3: Credits System
  ✦ POST /api/billing/sms-credits → Stripe checkout
  ✦ Webhook: credits গুনে দাও
  ✦ Credits history UI
  ✦ Low credit alert (80% + 100%)

Week 4: WhatsApp
  ✦ Meta Cloud API integration
  ✦ Template registration
  ✦ WhatsApp trigger integration
  ✦ BYOC WA credentials

Week 5: Admin Dashboard + Polish
  ✦ Admin SMS overview page
  ✦ Manual credit grant
  ✦ Cost report
  ✦ BYOC for all providers (Twilio, Alpha.Net)
```

---

## Revenue Model Summary

```
Platform earns from SMS:
  Platform cost (SSL Wireless): ~0.30 BDT/SMS
  Plan include করে charge: plan fee তে built-in
  Extra credits: 0.32–0.40 BDT/SMS বিক্রি করে
  Profit margin: ~0.02–0.10 BDT/SMS

Example: 50 tenants, avg 300 SMS/month each
  Total SMS: 15,000/month
  Platform cost: BDT 4,500
  Included in plans: "free" (plan revenue এ cover হয়)
  Extra credits sold: ~2,000 SMS × 0.38 = BDT 760 profit
```

---

*Plan created: 2026-05-19*
*Depends on: sms-whatsapp-notifications.md*
*Priority: 🔴 High*
