# Airbnb Integration Plan

## Overview
Connect ResortPro with Airbnb via their **Host API** (formerly Airbnb API v2). Airbnb reservations sync into ResortPro automatically. Availability and pricing set in ResortPro push to Airbnb listings. Requires joining Airbnb's **Software Partner Program**.

---

## Airbnb API Access Tiers

| Tier | Access | How to get it |
|------|--------|---------------|
| **iCal only** | Read-only calendar export | Available immediately from Airbnb listing settings |
| **Software Partner (Hospitality)** | Full API: reservations, pricing, availability, messaging | Apply at airbnb.com/partner |
| **Professional Host Tools API** | Extended: multi-listing management | Requires Software Partner status first |

**ResortPro roadmap:** iCal MVP → Software Partner API

---

## Phase 1 — iCal Sync (MVP, 1–2 weeks)

### How it works
- **Airbnb → ResortPro:** Airbnb exports each listing's bookings as an iCal feed. ResortPro polls it every 6 hours.
- **ResortPro → Airbnb:** ResortPro exposes a per-room iCal feed. Host pastes it into Airbnb listing → "Block external calendar."

### ResortPro iCal polling job
```typescript
// Runs every 6 hours via cron
async function pollAirbnbIcal(tenantId: string) {
  const feeds = await prisma.icalFeed.findMany({
    where: { tenantId, channel: 'AIRBNB', direction: 'INBOUND' },
  });
  for (const feed of feeds) {
    const ical = await fetch(feed.externalUrl).then(r => r.text());
    const events = parseIcal(ical);
    for (const event of events) {
      await upsertBlockedPeriod(tenantId, feed.roomId, event);
    }
  }
}
```

### Schema additions
```prisma
// Extend existing ICalFeed model (from Booking.com plan)
model ICalFeed {
  // ... existing fields
  channel      String   // 'BOOKING_COM' | 'AIRBNB' | 'EXPEDIA'
  direction    String   // 'INBOUND' (we poll) | 'OUTBOUND' (we serve)
  externalUrl  String?  // URL we poll (for INBOUND feeds)
  lastPolledAt DateTime?
  lastError    String?
}
```

### Staff setup flow
1. Go to `/dashboard/channels`
2. Click "Connect Airbnb" → enter listing URL
3. ResortPro extracts the iCal feed URL automatically
4. Staff copies ResortPro's outbound iCal URL into Airbnb → "Add external calendar"
5. Done — both directions sync within 6 hours

---

## Phase 2 — Airbnb Host API (Full Integration, 8–12 weeks)

### Apply for Software Partner Program
- URL: https://www.airbnb.com/partner
- Requires: business registration, demo of your PMS, test listings
- Timeline: 4–8 weeks for approval

### OAuth 2.0 flow (host connects their Airbnb account)
```
1. Host clicks "Connect Airbnb" in ResortPro
2. ResortPro redirects to Airbnb OAuth:
   GET https://www.airbnb.com/oauth2/auth
     ?client_id=RESORTPRO_CLIENT_ID
     &redirect_uri=https://app.resortpro.com/api/oauth/airbnb/callback
     &scope=property_management reservations_management messaging
     &response_type=code
3. Host grants permission on Airbnb
4. Airbnb redirects back with `code`
5. ResortPro exchanges code for access_token + refresh_token
6. Store tokens encrypted in ChannelConnection
```

### API endpoints to implement

#### Inbound (Airbnb → ResortPro webhook)
```
POST /api/webhooks/airbnb
```

Airbnb sends events for:
| Event type | Handler action |
|------------|---------------|
| `reservation.created` | Create Booking with source: 'AIRBNB' |
| `reservation.canceled` | Cancel the Booking |
| `reservation.altered` | Update dates / amount |
| `reservation.pending` | Create PENDING booking, await host accept |

Webhook payload (simplified):
```json
{
  "type": "reservation.created",
  "reservation": {
    "confirmation_code": "HMXXXXXXXX",
    "listing_id": "12345678",
    "check_in": "2026-06-10",
    "check_out": "2026-06-15",
    "nights": 5,
    "total_price": { "amount": "750.00", "currency": "USD" },
    "guest": {
      "first_name": "John",
      "last_name": "Smith",
      "email": "john@example.com",
      "phone": "+1555000000"
    }
  }
}
```

#### Outbound (ResortPro → Airbnb API)

| Action | Airbnb API call | Trigger in ResortPro |
|--------|----------------|---------------------|
| Block dates | `PUT /v2/calendar/listing/{id}` | Booking created, room → MAINTENANCE |
| Unblock dates | `PUT /v2/calendar/listing/{id}` | Booking cancelled |
| Update price | `PUT /v2/listing_rooms/{id}/pricing` | RatePlan modified |
| Accept reservation | `POST /v2/reservations/{code}/accept` | Auto-accept if enabled |
| Decline reservation | `POST /v2/reservations/{code}/decline` | Room already booked |
| Send message | `POST /v2/threads/{id}/messages` | Pre-arrival / checkout email |

### Availability push logic
```typescript
async function syncToAirbnb(tenantId: string, roomId: string, fromDate: Date, toDate: Date) {
  const conn = await getChannelConnection(tenantId, 'AIRBNB');
  const map = await getChannelRoomMap(conn.id, roomId);
  const bookings = await getBookingsInRange(tenantId, roomId, fromDate, toDate);

  // Build day-by-day availability array
  const calendar = buildCalendar(fromDate, toDate, bookings);

  await airbnbApi.updateCalendar({
    access_token: conn.accessToken,
    listing_id: map.channelRoomId,
    calendar,
  });
}
```

### Listing sync (ResortPro room → Airbnb listing)
Keep these in sync:
- **Title / description** → Airbnb listing name + summary
- **Photos** → room.images[]
- **Amenities** → room.amenities[] mapped to Airbnb amenity IDs
- **Base price** → Airbnb nightly price
- **Max guests** → room.maxOccupancy
- **House rules** → tenant settings

---

## Phase 3 — Airbnb Messaging Integration

Airbnb guests message hosts through Airbnb's internal thread. Integrate with ResortPro's support ticket / chat system:

```
Airbnb message → POST /api/webhooks/airbnb/message
→ Create SupportTicket or ChatMessage with source='AIRBNB'
→ Staff replies in ResortPro → push to Airbnb thread via API
```

This allows staff to handle all guest communication from a single inbox.

---

## Phase 4 — UI (within `/dashboard/channels`)

### Airbnb section
- OAuth "Connect" button (opens Airbnb login)
- Connected account info (host name, listing count)
- Listing ↔ Room mapping table
- Per-listing sync status (last pushed, errors)
- Auto-accept toggle
- Message sync toggle
- Commission % input (for P&L reporting)

---

## Key Differences: Booking.com vs Airbnb

| Feature | Booking.com | Airbnb |
|---------|------------|--------|
| API style | XML (legacy) | REST + JSON |
| Auth | Shared secret | OAuth 2.0 |
| Certification | XML Connectivity Partner | Software Partner Program |
| Approval time | 4–6 weeks | 4–8 weeks |
| Guest data | Full name + email | Limited (name only until check-in) |
| Commission | ~15% | ~3% host + ~14% guest |
| Instant Book | Auto-accept | Host choice |
| Messaging | Email only | In-app thread (API access) |

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 — iCal | 1–2 weeks | Bi-directional iCal sync live |
| Software Partner approval | 4–8 weeks | (parallel with development) |
| Phase 2 — Host API | 8–12 weeks | Full reservation + availability sync |
| Phase 3 — Messaging | 3–4 weeks | Unified inbox for Airbnb messages |
| Phase 4 — UI | 2–3 weeks | Channel dashboard with Airbnb section |

**Total: ~18–28 weeks to full integration**

---

## Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| Software Partner rejection | Start with iCal MVP; reapply with more listings |
| Airbnb rate limits (1,000 req/hr) | Cache calendar state; batch updates |
| Guest privacy (Airbnb masks emails) | Use Airbnb messaging API for pre-arrival comms |
| Token expiry | Implement refresh_token rotation with retry |
| Overbooking (iCal 6hr lag) | Show "iCal delay" warning in UI; Phase 2 fixes this |
