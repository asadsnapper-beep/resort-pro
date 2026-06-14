# Support System — ResortPro

> Guest support tickets + bidirectional Telegram & WhatsApp channel integration.
> Guest WhatsApp/Telegram পাঠায় → dashboard এ ticket → staff reply → guest এর phone/Telegram এ পৌঁছায়।

---

## Features

- **Ticket list** — status filter (OPEN/IN_PROGRESS/RESOLVED/CLOSED), paginated
- **Ticket detail** — full chat thread, 5s auto-refresh
- **Status management** — Start / Resolve buttons
- **Staff reply** — message input → saves to DB + forwards to Telegram/WhatsApp if external channel
- **Source badge** — 🌐 Web / ✈️ Telegram / 💬 WhatsApp (shows on ticket card + detail header)
- **Channel Settings** — Telegram bot setup + WhatsApp webhook info (gear icon in header)

---

## Channel Integration Architecture

```
Guest → WhatsApp/Telegram message
             ↓
POST /api/ticket-webhooks/:tenantId/telegram|whatsapp
             ↓
    Same sender has open ticket?
      YES → Add message to existing ticket
      NO  → Create new ticket (source=TELEGRAM/WHATSAPP, externalChatId=chat_id/phone)
             ↓
    Ack back to guest ("Ticket created, team will assist you")
    Notify staff Telegram group (if telegramNotifChatId configured)

Staff replies in dashboard
             ↓
POST /api/tickets/:id/messages
             ↓
    forwardReplyToChannel(ticket, tenant, reply, staffName)
             ↓
    TELEGRAM → sendTelegramMessage(botToken, chatId, "🏨 Staff reply: ...")
    WHATSAPP → sendWhatsAppMessage(apiToken, phoneNumberId, phone, "Staff reply: ...")
    WEB      → no forwarding
```

---

## API Endpoints

### Tickets (existing)
```
GET    /api/tickets                        List tickets (status/priority filter, paginated)
GET    /api/tickets/:id                    Get ticket with messages
POST   /api/tickets                        Create ticket
PATCH  /api/tickets/:id/status             Update status
PATCH  /api/tickets/:id/assign             Assign to staff
POST   /api/tickets/:id/messages           Add staff message (+ forward to channel)
```

### Channel Webhooks (new)
```
POST   /api/ticket-webhooks/telegram/setup       Save bot token, register webhook with Telegram
GET    /api/ticket-webhooks/telegram/info        Config status (masked token, webhook URL)
DELETE /api/ticket-webhooks/telegram/setup       Disconnect Telegram
GET    /api/ticket-webhooks/whatsapp/info        WhatsApp config status + webhook URL + verify token
GET    /api/ticket-webhooks/:tenantId/whatsapp   Meta webhook verification challenge
POST   /api/ticket-webhooks/:tenantId/whatsapp   Inbound WhatsApp messages
POST   /api/ticket-webhooks/:tenantId/telegram   Inbound Telegram bot messages
```

---

## Database Changes (June 2026)

### SupportTicket — new fields
```prisma
source         String  @default("WEB")   // "WEB" | "TELEGRAM" | "WHATSAPP"
externalChatId String?                   // telegram chat_id or WA E.164 phone number
```

### ChatMessage — new field
```prisma
externalMsgId  String?   // Telegram message_id or WA message_id (dedup)
```

### ChatSenderType enum — new value
```prisma
BOT   // system/webhook-created messages (external channel ingest)
```

### Tenant — new fields
```prisma
telegramBotToken    String?   // bot token from @BotFather
telegramNotifChatId String?   // staff group chat_id for new ticket alerts
```
*(WhatsApp config already existed: waEnabled, waApiToken, waPhoneNumberId, waBusinessAccId)*

---

## Telegram Setup (Staff Guide)

1. Open Telegram → search **@BotFather** → `/newbot`
2. Name your bot e.g. "Coral Bay Support" → username e.g. `coralbay_support_bot`
3. Copy the bot token
4. Dashboard → Support → **Channels** button → Telegram tab
5. Paste token → optionally enter Staff Notification Group chat_id → **Connect**
6. System automatically calls `setWebhook` with your unique URL
7. Share your bot link `t.me/coralbay_support_bot` with guests
8. Done! Guest messages → tickets auto-created

---

## WhatsApp Setup (Staff Guide)

1. Configure WhatsApp Business API in **Tenant Settings** (waApiToken, waPhoneNumberId)
2. Dashboard → Support → **Channels** → WhatsApp tab
3. Copy the **Webhook URL** and **Verify Token**
4. Open Meta Business Manager → WhatsApp → Configuration → Webhooks
5. Paste Webhook URL + Verify Token → Subscribe to `messages`
6. Done! Guest WhatsApp messages → tickets auto-created

---

## Deduplication

- `externalMsgId` stored per `ChatMessage`
- Before processing any inbound webhook, check if `externalMsgId` already exists
- Prevents double-processing if Meta/Telegram retries the webhook

---

## File Structure

```
apps/api/src/
  routes/
    tickets.ts              ← Existing ticket CRUD + message forwarding hook
    ticketWebhooks.ts       ← New: inbound Telegram/WA webhooks + setup endpoints
  services/
    ticketChannels.ts       ← New: sendTelegramMessage, sendWhatsAppMessage, forwardReplyToChannel

apps/web/src/
  app/(dashboard)/dashboard/support/
    page.tsx                ← Updated: source badges, ChannelSettingsModal, bug fixes
  lib/
    api.ts                  ← Added: ticketWebhooksApi
```

---

## উন্নতির সুযোগ (Future)

- [ ] Media message support (images, voice notes via WA)
- [ ] Ticket auto-categorization (AI: detect BILLING vs MAINTENANCE from message)
- [ ] Auto-reply on ticket creation ("We received your message, ticket #XYZ created")
- [ ] SLA tracking (first response time, resolution time)
- [ ] Staff notification via Telegram when new ticket assigned to them
- [ ] Resolve ticket from Telegram command (`/resolve 1a2b3c`)
- [ ] Email channel (IMAP polling → ticket creation)
- [ ] WhatsApp template messages for proactive outreach

---

## Status

Core feature ✅ live — June 2026

### Bug fixes applied (June 2026)

1. ✅ **`sendMessage` queryKey ভুল** — `queryClient.invalidateQueries({ queryKey: ['ticket'] })` ছিল → specific ticket detail refresh হচ্ছিল না। Fixed: `['ticket', selected?.id]`।

2. ✅ **`updateStatus` এর পরে `selected` stale** — status change করার পরে action buttons (Start/Resolve) পুরনো status অনুযায়ী দেখাতো। Fixed: `onSuccess` এ `setSelected({ ...selected, status })` করা হয়েছে, plus `queryKey: ['ticket', selected?.id]` invalidate।

3. ✅ **Empty message validation** — API তে `message` field এ `z.string().min(1)` validation যোগ করা হয়েছে। Reply input button `disabled={!newMessage.trim()}`।

### New feature (June 2026)

4. ✅ **Telegram + WhatsApp bidirectional channel** — Guest message করে → ticket create হয় → staff dashboard এ দেখে reply দেয় → guest এর Telegram/WA তে পৌঁছায়। Schema migration, service layer, webhook routes, channel settings UI সব implement করা হয়েছে।
