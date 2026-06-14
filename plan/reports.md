# Reports System — Plan & Status

## Overview

The Reports system generates a full end-of-day summary for hotel/resort management — occupancy, revenue, arrivals, departures, no-shows, housekeeping, and maintenance. Reports can be viewed in-browser, printed, emailed, or **automatically dispatched to Telegram / WhatsApp every evening**.

## Architecture

```
apps/web/src/app/(dashboard)/dashboard/reports/page.tsx   ← Full UI + dispatch settings panel
apps/api/src/routes/reports.ts                            ← REST API
apps/api/src/jobs/daily-report-dispatch.ts                ← Cron job (every minute)
packages/database/prisma/schema.prisma                    ← ReportDispatchSettings model
```

## API Endpoints (`/api/reports`)

| Route | Auth | Description |
|-------|------|-------------|
| `GET /daily?date=YYYY-MM-DD` | Any auth | Build and return today's report (or any date) |
| `POST /daily/email` | OWNER/MANAGER | Email report to specified or account email |
| `GET /dispatch` | OWNER/MANAGER | Get auto-dispatch settings for this tenant |
| `PUT /dispatch` | OWNER/MANAGER | Save auto-dispatch settings |
| `POST /dispatch/test` | OWNER/MANAGER | Send a test report immediately |

## Report Data Shape

```typescript
{
  date: "YYYY-MM-DD",
  tenant: { name, currency },
  occupancy: { totalRooms, occupied, rate, nightsSold },
  arrivals: [{ bookingId, guestName, room, nights, checkOut, status }],
  departures: [{ bookingId, guestName, room, totalBill, paidAmount, status }],
  noShows: [{ bookingId, guestName, room }],
  revenue: { rooms, restaurant, extras, total },
  payments: { cash, card, bankTransfer, other },
  housekeeping: { completed, pending },
  maintenance: { open, resolvedToday },
}
```

## Auto-Dispatch Feature

### DB Model: `ReportDispatchSettings`

```prisma
model ReportDispatchSettings {
  id               String    @id @default(cuid())
  tenantId         String    @unique
  enabled          Boolean   @default(false)
  dispatchTime     String    @default("22:00")   // HH:MM, 24h
  telegramEnabled  Boolean   @default(false)
  telegramBotToken String?
  telegramChatId   String?
  whatsappEnabled  Boolean   @default(false)
  whatsappPhone    String?
  lastDispatchedAt DateTime?
  lastDispatchDate String?   // YYYY-MM-DD, prevents duplicate sends per day
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  tenant           Tenant    @relation(...)
}
```

### Cron Job (`apps/api/src/jobs/daily-report-dispatch.ts`)

- Runs **every minute** via `node-cron`
- Finds all tenants with `enabled: true` and `dispatchTime == current HH:MM`
- Skips if `lastDispatchDate == today` (prevents duplicate sends)
- Builds full daily report via `buildDailyReport()`
- Sends **HTML-formatted** message to Telegram via Bot API
- Sends **plain text** message to WhatsApp via Meta Cloud API (tenant config or env vars)
- Updates `lastDispatchedAt` and `lastDispatchDate` after successful dispatch

### Telegram Setup (for the hotel owner)
1. Chat with [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token
2. Start a chat with the new bot (or add it to a group)
3. Call `https://api.telegram.org/bot<TOKEN>/getUpdates` to find the `chat_id`
4. Enter token + chat_id in Reports → Auto-Dispatch → Telegram
5. Click "Send Test Message" to verify

### WhatsApp Setup
- Uses the same Meta Cloud API gateway configured in Settings → SMS & WhatsApp
- The owner enters the phone number where reports should be received

## Bug Fixes Applied

### 1. `status: 'COMPLETED'` → `status: 'PAID'` (critical — revenue was always $0)

**File:** `apps/api/src/routes/reports.ts`

`PaymentStatus` enum only has `PAID | PENDING | PROCESSING | PARTIAL | REFUNDED`.
Two queries used `status: 'COMPLETED'` which returned 0 results — all revenue figures were always $0.

```typescript
// Before (departures payments query)
payments: { where: { status: 'COMPLETED' } },

// After
payments: { where: { status: 'PAID' } },
```

Same fix applied to the `roomPayments` query at the top of `buildDailyReport()`.

### 2. `ok(reply, report)` → `ok(report)` (critical — report page always showed empty)

**File:** `apps/api/src/routes/reports.ts`

The `ok()` utility signature is `ok<T>(data: T, message?: string)`. Passing `reply` as the first argument returned the FastifyReply object instead of report data. The frontend at `res?.data?.data` received the serialised reply object.

```typescript
// Before
return ok(reply, report);       // GET /daily
return ok(reply, { sent: true, ... }); // POST /daily/email

// After
return ok(report);
return ok({ sent: true, to: recipientEmail, date: dateStr });
```

## Frontend

- **Date navigator** with ← → arrows, date picker, "Today" shortcut
- **KPI strip**: Occupancy %, Total Revenue, Arrivals, Departures
- **Revenue breakdown** with bar chart per source
- **Payment methods** breakdown
- **Arrivals table** with status badges
- **Departures table** with balance/settled status
- **Operations**: No-shows, Housekeeping progress, Maintenance tickets
- **Print** button with print-only CSS
- **Email** button with optional custom recipient
- **Auto-Dispatch Settings panel** at bottom of page:
  - Master enable/disable toggle
  - Dispatch time picker (HH:MM)
  - Telegram section: bot token, chat ID, test button
  - WhatsApp section: recipient phone, test button
  - Last-dispatched timestamp
  - Save button
