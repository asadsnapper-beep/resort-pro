# Booking.com Channel Manager Integration Plan

## Overview
Sync ResortPro availability, rates, and reservations bi-directionally with Booking.com via their Connectivity API (XML / REST). When a guest books on Booking.com, a booking auto-creates in ResortPro. When staff blocks a room or changes a rate in ResortPro, it pushes to Booking.com in real time.

---

## How Booking.com Connectivity Works

Booking.com requires properties to connect through a **Connectivity Provider** (channel manager). There are two paths:

| Path | Who it's for | Effort |
|------|-------------|--------|
| **Certified Connectivity Partner** | Build directly against Booking.com XML API, get certified | High — requires Booking.com partnership agreement |
| **via existing Channel Manager** (e.g. SiteMinder, Cloudbeds, RMS) | Plug ResortPro into an intermediary via iCal or push webhook | Lower — but adds third-party cost |

**Recommended for ResortPro:** Build a lightweight **iCal + webhook bridge** for MVP, then pursue full XML Connectivity API certification at scale.

---

## Phase 1 — iCal Sync (MVP, 2–3 weeks)

### What it does
- ResortPro exposes a **public iCal feed** per room (`/ical/:tenantSlug/:roomId.ics`)
- Staff pastes the URL into Booking.com → Booking.com pulls it every 2–4 hours
- Booking.com bookings pushed to ResortPro via a **webhook receiver**

### Schema changes needed
```prisma
model ICalFeed {
  id        String   @id @default(cuid())
  tenantId  String
  roomId    String
  token     String   @unique  // secret in URL for security
  createdAt DateTime @default(now())

  tenant Tenant @relation(...)
  room   Room   @relation(...)
}
```

### API routes needed

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ical/:token.ics` | Public iCal feed for one room |
| GET | `/api/ical/feeds` | List all feeds for tenant |
| POST | `/api/ical/feeds` | Generate a feed token for a room |
| DELETE | `/api/ical/feeds/:id` | Revoke a feed |
| POST | `/api/webhooks/booking-com` | Receive Booking.com reservation push (XML) |

### iCal feed format
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ResortPro//EN
BEGIN:VEVENT
UID:{bookingId}@resortpro
DTSTART;VALUE=DATE:{YYYYMMDD}
DTEND;VALUE=DATE:{YYYYMMDD}
SUMMARY:BLOCKED – {guestName}
STATUS:CONFIRMED
END:VEVENT
...
END:VCALENDAR
```

### Booking.com → ResortPro webhook
Booking.com sends a reservation notification (XML or JSON) to a URL you configure in their extranet:
```
POST /api/webhooks/booking-com
```
Handler:
1. Validate shared secret header
2. Parse reservation XML → extract room, dates, guest name/email, amount
3. Look up room by Booking.com property_id + room_id mapping
4. Create Booking with `source: 'BOOKING_COM'`
5. Send confirmation email if email settings allow

---

## Phase 2 — Full XML Connectivity API (Production, 6–10 weeks)

### Booking.com XML API endpoints to implement

#### Pull (Booking.com calls ResortPro)
| Endpoint | Our handler | Description |
|----------|-------------|-------------|
| `reservations` | POST `/api/webhooks/booking-com/reservation` | New / modified / cancelled reservation |
| `ping` | POST `/api/webhooks/booking-com/ping` | Health check |

#### Push (ResortPro calls Booking.com)
| Action | Booking.com endpoint | Trigger |
|--------|---------------------|---------|
| Availability update | `avail_and_rates` | Room status changes, new booking created |
| Rate update | `avail_and_rates` | RatePlan created/modified |
| Reservation confirmation | `reservations/reply` | After creating booking in ResortPro |

### Rate mapping
```
ResortPro RatePlan → Booking.com RatePlan ID
  STANDARD  → bcom_rate_plan_id: "standard_rate"
  WEEKEND   → bcom_rate_plan_id: "weekend_rate"
  PROMO     → bcom_rate_plan_id: "promo_rate"
  ...
```
Store mapping in new `ChannelRateMap` model.

### Schema additions (Phase 2)
```prisma
model ChannelConnection {
  id              String  @id @default(cuid())
  tenantId        String
  channel         String  // 'BOOKING_COM' | 'AIRBNB' | 'EXPEDIA'
  propertyId      String  // channel's property identifier
  apiKey          String  // encrypted
  isActive        Boolean @default(true)
  lastSyncAt      DateTime?
  createdAt       DateTime @default(now())

  tenant      Tenant @relation(...)
  roomMaps    ChannelRoomMap[]
}

model ChannelRoomMap {
  id           String @id @default(cuid())
  connectionId String
  roomId       String
  channelRoomId String  // Booking.com's room_type_id
  channelRatePlanId String?

  connection ChannelConnection @relation(...)
  room       Room @relation(...)

  @@unique([connectionId, roomId])
}
```

### Availability push logic
Trigger on:
- Booking created / cancelled / checked out
- Room status changed (MAINTENANCE, etc.)
- RatePlan created / modified / deleted

```typescript
async function pushAvailabilityToBookingCom(tenantId, roomId, fromDate, toDate) {
  const conn = await getChannelConnection(tenantId, 'BOOKING_COM');
  const roomMap = await getChannelRoomMap(conn.id, roomId);
  const blockedDates = await getBlockedDates(tenantId, roomId, fromDate, toDate);
  await bookingComApi.updateAvailability({
    property_id: conn.propertyId,
    room_type_id: roomMap.channelRoomId,
    dates: blockedDates,
    availability: 0, // blocked
  });
}
```

---

## Phase 3 — UI (Channel Manager Dashboard)

### New page: `/dashboard/channels`

**Sections:**
1. **Connected Channels** — cards for Booking.com / Airbnb / Expedia with status indicator
2. **Room Mapping** — table matching ResortPro rooms ↔ channel room types
3. **Sync Log** — last 50 push/pull events with status (success/fail/pending)
4. **iCal Feeds** — per-room iCal URL generator with copy button

### Settings per channel
- Property ID
- API Key / Secret (encrypted at rest)
- Auto-accept reservations toggle
- Map commission % (for revenue reporting)
- Rate markup/markdown per channel

---

## Certification & Go-Live Checklist

- [ ] Apply for Booking.com Connectivity Partner program
- [ ] Complete test environment validation (sandbox reservations)
- [ ] Handle all reservation states: new, modified, cancelled, no-show
- [ ] Implement rate parity monitoring (ResortPro rate ≤ Booking.com rate)
- [ ] Handle overbooking: reject if room already booked, send error XML
- [ ] Error alerting: notify tenant if sync fails for > 15 min
- [ ] Reconciliation job: nightly diff between ResortPro bookings and Booking.com report

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 — iCal MVP | 2–3 weeks | iCal feeds + webhook receiver live |
| Phase 2 — XML API | 6–10 weeks | Full bi-directional sync certified |
| Phase 3 — UI | 2–3 weeks | Channel manager dashboard |
| Certification | 4–6 weeks | Booking.com certified partner |

**Total: ~14–20 weeks to full certification**

---

## Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| Booking.com API rate limits | Queue push jobs with retry + backoff |
| Double bookings | Pessimistic lock on room availability check |
| Rate parity violations | Alert if ResortPro rate > channel rate |
| XML format changes | Version-pin API, monitor Booking.com changelog |
