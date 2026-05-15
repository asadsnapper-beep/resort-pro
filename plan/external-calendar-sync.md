# External Calendar Sync (iCal Import)
### "Booking.com/Airbnb এ room book হলে ResortPro জানবে"

**Status:** 📋 Planning  
**Priority:** 🔴 High — channel conflict এর সবচেয়ে বড় সমস্যা এটাই

---

## সমস্যাটা কী?

একজন resort owner একই সাথে:
- ResortPro তে booking নেয়
- Booking.com এ listing রাখে
- Airbnb এ listing রাখে

Booking.com এ কেউ book করলে ResortPro জানে না → staff আবার ওই room অন্য guest কে দিয়ে দেয় → **double booking / overbooking**।

---

## Solution: iCal Polling

Booking.com, Airbnb, Expedia — সবাই প্রতিটা listing এর জন্য একটা **iCal URL** দেয়।  
এই URL এ গেলে সব blocked/booked dates পাওয়া যায়।

**আমরা কী করবো:**
1. Resort owner সেই iCal URL টা ResortPro তে paste করবে (per room)
2. ResortPro প্রতি **1 ঘন্টায়** ওই URL fetch করবে
3. নতুন booking দেখলে → ResortPro এ automatically একটা **blocked booking** তৈরি করবে
4. ওই room তখন আর available দেখাবে না

**কোনো API key লাগবে না। Booking.com এর certification লাগবে না। শুধু URL paste করলেই হবে।**

> ⚠️ **গুরুত্বপূর্ণ scope সীমানা:**
> - এই পুরো feature শুধু **owner/staff dashboard** এর জন্য — guest কখনো জানবে না কোন OTA connected আছে
> - যে resort এর কোনো external calendar নেই, তাদের **কোনো কিছুই change হবে না** — booking flow, performance, UI সব আগের মতো থাকবে
> - Feature টা পুরোপুরি opt-in — শুধু যারা iCal URL add করবে, তারাই এটা ব্যবহার করবে

---

## iCal URL কোথায় পাওয়া যায়?

| Platform | কোথায় পাবে |
|----------|------------|
| Booking.com | Extranet → Calendar → Export Calendar → Copy iCal link |
| Airbnb | Listing → Availability → Export Calendar → iCal |
| Agoda | Extranet → Calendar → Sync → iCal URL |
| Expedia | Partner Central → Calendar → iCal Export |
| Google Calendar | Calendar settings → Integrate calendar → Secret address in iCal format |

---

## System Design

```
┌─────────────────────────────────────────────────────┐
│                   Resort Owner                       │
│  Booking.com এ listing আছে, iCal URL copy করেছে     │
└────────────────────┬────────────────────────────────┘
                     │ paste URL in ResortPro UI
                     ▼
┌─────────────────────────────────────────────────────┐
│          ResortPro Dashboard                         │
│  Rooms → Room 101 → External Calendars → + Add      │
│  Name: "Booking.com"   URL: [paste here]            │
└────────────────────┬────────────────────────────────┘
                     │ saved to DB
                     ▼
┌─────────────────────────────────────────────────────┐
│          ExternalCalendar (DB table)                 │
│  roomId: room-101                                    │
│  name: "Booking.com"                                 │
│  icalUrl: "https://admin.booking.com/hotel/ical/..."│
│  lastSyncAt: 2026-05-15 14:00                       │
│  lastError: null                                     │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │  Cron Job (hourly)   │
          │  "iCal Sync Worker"  │
          └──────────┬──────────┘
                     │ HTTP GET → iCal URL
                     ▼
┌─────────────────────────────────────────────────────┐
│          Booking.com / Airbnb Server                 │
│  Returns iCal file:                                  │
│  BEGIN:VEVENT                                        │
│  UID:booking-12345@booking.com                       │
│  DTSTART:20260610                                    │
│  DTEND:20260615                                      │
│  SUMMARY:Booking.com Reservation                    │
│  END:VEVENT                                          │
└────────────────────┬────────────────────────────────┘
                     │ parse করে
                     ▼
┌─────────────────────────────────────────────────────┐
│          Sync Logic                                  │
│  For each VEVENT:                                    │
│  1. externalUid দিয়ে আগে থেকে আছে কিনা check         │
│  2. না থাকলে → Booking তৈরি করো                      │
│     - source: "BOOKING_COM" / "AIRBNB" / "ICAL"     │
│     - status: "CONFIRMED"                            │
│     - guest: dummy (Booking.com Guest)               │
│     - externalUid: "booking-12345@booking.com"      │
│  3. থাকলে → dates/status update করো                  │
│  4. iCal এ আর নেই কিন্তু DB তে আছে → CANCELLED করো  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│          Result                                      │
│  Room 101 → June 10-15 → BLOCKED (Booking.com)      │
│  Dashboard এ দেখাবে, availability search এ বাদ যাবে │
│  New booking নিতে গেলে এই dates available না         │
└─────────────────────────────────────────────────────┘
```

---

## কী কী Build করতে হবে

### 1. Database (Schema changes)

**নতুন model: `ExternalCalendar`**
```
id          - unique ID
tenantId    - কোন resort
roomId      - কোন room
name        - "Booking.com", "Airbnb", ইত্যাদি (staff নিজে লিখবে)
icalUrl     - paste করা URL
isActive    - on/off করা যাবে
lastSyncAt  - সর্বশেষ কখন sync হয়েছে
lastError   - কোনো error হলে এখানে থাকবে (URL invalid, timeout, etc.)
createdAt
updatedAt
```

**Booking model এ নতুন field:**
```
externalUid   - iCal এর VEVENT UID (duplicate check এর জন্য)
externalSource - "BOOKING_COM" | "AIRBNB" | "ICAL" | "DIRECT" (ইত্যাদি)
```

> `source` field আগে থেকেই আছে — `externalUid` শুধু add করতে হবে।

---

### 2. iCal Parser (utility function)

File: `apps/api/src/utils/ical-parser.ts`

**কাজ:** iCal text নিয়ে VEVENT array return করবে।

```
input:  raw iCal text (string)
output: [
  {
    uid: "booking-123@booking.com",
    start: Date,
    end: Date,
    summary: "Booking.com Reservation",
    status: "CONFIRMED" | "CANCELLED" | "TENTATIVE"
  },
  ...
]
```

**Package:** `node-ical` install করতে হবে।  
**Alternative:** Simple regex parser লেখা যায় (dependency ছাড়া) — iCal format অনেক simple।

---

### 3. Sync Job (background worker)

File: `apps/api/src/jobs/ical-sync.ts`

**কাজ:** Cron দিয়ে প্রতি ঘন্টায় চলবে।

```
Logic:
1. সব active ExternalCalendar fetch করো (tenantId দিয়ে group করা)
2. প্রতিটার জন্য:
   a. icalUrl থেকে HTTP GET করো (timeout: 10s)
   b. Parse করো → VEVENT list বানাও
   c. প্রতিটা VEVENT এর জন্য:
      - externalUid দিয়ে existing booking খোঁজো
      - না থাকলে → নতুন Booking তৈরি করো (source: ICAL/BOOKING_COM)
      - থাকলে + dates changed → update করো
      - VEVENT status CANCELLED → booking CANCELLED করো
   d. lastSyncAt update করো
   e. Error হলে → lastError তে save করো, continue (skip this calendar)
3. Log: "Synced X calendars, created Y bookings, updated Z"
```

**Cron schedule:** `'0 * * * *'` (প্রতি ঘন্টায়)  
**On startup:** একবার immediately run করবে (যাতে server restart এ wait না করতে হয়)

---

### 4. API Routes

File: `apps/api/src/routes/externalCalendars.ts`  
Prefix: `/api/external-calendars`

| Method | Path | কী করে | Auth |
|--------|------|--------|------|
| GET | `/` | সব calendars list করে (tenant এর) | Staff |
| POST | `/` | নতুন calendar add করে | Manager+ |
| PATCH | `/:id` | name/url/isActive update | Manager+ |
| DELETE | `/:id` | calendar remove করে | Manager+ |
| POST | `/:id/sync` | manually এখনই sync করে | Manager+ |
| GET | `/:id/status` | last sync info, error status | Staff |

---

### 5. Frontend UI

**Option A:** Rooms page এ প্রতিটা room এর detail এ "External Calendars" section  
**Option B:** আলাদা page `/dashboard/channels` (channel manager)

**Recommended: Option B** — কারণ একটা জায়গায় সব OTA connection দেখা যাবে।

#### Page: `/dashboard/channels`

```
┌────────────────────────────────────────────────────┐
│  🔗 Channel Connections                             │
│                                                     │
│  Room 101 — Ocean Suite                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ ✅ Booking.com    Last sync: 10 min ago      │   │
│  │    URL: https://admin.booking.com/...        │   │
│  │    3 bookings imported                        │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ ✅ Airbnb         Last sync: 45 min ago      │   │
│  │    URL: https://www.airbnb.com/calendar/...  │   │
│  │    1 booking imported                         │   │
│  └─────────────────────────────────────────────┘   │
│  [+ Add Calendar]                                   │
│                                                     │
│  Room 102 — Garden Villa                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ ❌ Booking.com    Error: URL invalid          │   │
│  │    Last tried: 1 hour ago                    │   │
│  └─────────────────────────────────────────────┘   │
│  [+ Add Calendar]                                   │
└────────────────────────────────────────────────────┘
```

**Add Calendar Modal:**
```
Room: [dropdown — select room]
Name: [Booking.com / Airbnb / Other]  
iCal URL: [paste here]
[Test & Save]  ←── save করার আগে URL valid কিনা check করবে
```

**"Test & Save" button কী করে:**
1. URL fetch করে
2. Valid iCal কিনা check করে
3. কতটা VEVENT আছে দেখায়
4. "Found 3 reservations — Save?" confirm চাইবে
5. Save করলে immediately sync run করবে

---

### 6. Booking list এ imported bookings আলাদা দেখানো

Booking list এ `source === 'ICAL'` হলে:
- Badge: "Booking.com" / "Airbnb" (orange/blue রঙে)
- Guest name: "Booking.com Guest" (আসল name OTA দেয় না)
- Edit করা যাবে না (read-only, OTA থেকে এসেছে)
- Cancel করলে warning: "This will only cancel in ResortPro — cancel on Booking.com too"

---

## Double Booking সমস্যা এবং সমাধান

### সমস্যাটা বোঝা যাক

iCal polling **real-time না** — Booking.com এ যে মুহূর্তে book হয়, ResortPro সেটা জানে সর্বোচ্চ ১ ঘন্টা পরে।

```
Timeline:
10:00 → Booking.com এ Room 101 June 10-15 book হলো
10:00–11:00 → ResortPro জানে না, Room 101 still "Available" দেখাচ্ছে
10:30 → Staff ResortPro তে Room 101 June 12-14 নতুন booking দিলো ← DOUBLE BOOKING!
11:00 → iCal sync চললো, তখন বুঝলো conflict হয়েছে — কিন্তু দেরি হয়ে গেছে
```

**এই gap টাই সমস্যা।**

---

### Layer 1 — Sync-Before-Book (সবচেয়ে গুরুত্বপূর্ণ)

**নিয়ম:** ResortPro তে নতুন booking তৈরি করার আগে, ওই room এর সব iCal feed তৎক্ষণাৎ sync করো।

> 🔒 **যে resort এর কোনো external calendar নেই, তাদের booking flow একটুও change হবে না।**
> এই sync step শুধু তখনই চলবে যখন room এ অন্তত একটা iCal URL add করা আছে।

```
Staff → "Create Booking" for Room 101
  ↓
[BEFORE saving]
  ↓
Room 101 এ ExternalCalendar আছে?
  NO  → Direct booking proceed করো (আগের মতোই, কোনো change নেই) ✅
  YES → সব iCal URL এখনই fetch করো (real-time, not scheduled)
        → Latest data দিয়ে availability check করো
        → Available? → Booking তৈরি হলো ✅
        → Not available? → Error: "Booked on Booking.com" ❌
```

**Implementation:**

```typescript
// apps/api/src/routes/bookings.ts → POST / (create booking)

async function createBooking(req, reply) {
  const { roomId, checkIn, checkOut, ... } = req.body;

  // Step 1: Pre-booking iCal sync (NEW)
  const externalCalendars = await prisma.externalCalendar.findMany({
    where: { roomId, isActive: true }
  });

  if (externalCalendars.length > 0) {
    // Sync করো এখনই (await — blocking)
    await syncCalendarsForRoom(roomId, externalCalendars);
    // এরপরেই availability check হবে — fresh data নিয়ে
  }

  // Step 2: Availability check (existing logic, now with fresh data)
  const conflict = await prisma.booking.findFirst({
    where: {
      roomId,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkIn: { lt: new Date(checkOut) },
      checkOut: { gt: new Date(checkIn) },
    }
  });

  if (conflict) {
    return reply.code(409).send({
      error: 'ROOM_NOT_AVAILABLE',
      message: conflict.externalSource
        ? `This room is already booked via ${conflict.externalSource} for overlapping dates.`
        : 'This room is already booked for these dates.',
    });
  }

  // Step 3: Create booking (safe now)
  ...
}
```

**এই একটা step দিয়েই ৯৫% double booking বন্ধ হয়।**

---

### Layer 2 — Frequent Polling (প্রতি ১৫ মিনিট)

প্রতি ঘন্টার বদলে **প্রতি ১৫ মিনিটে** sync করলে gap আরো কমে।

```
Cron schedule: '*/15 * * * *'  (প্রতি ১৫ মিনিট)
```

তবে এটা Booking.com এর server কে বেশি request পাঠাবে। Tradeoff:

| Interval | Risk window | Server load |
|----------|------------|-------------|
| 60 min | up to 60 min gap | Low |
| 15 min | up to 15 min gap | Medium |
| 5 min | up to 5 min gap | High (may get rate-limited) |

**Recommended: 15 minutes** — ভালো balance।  
Booking.com iCal typically allows frequent polling। তবে rate limit হলে → back to 30 min।

---

### Layer 3 — Conflict Detection + Alert

Sync এর সময় যদি দেখা যায় OTA booking একটা existing ResortPro booking এর সাথে overlap করছে → staff কে জানাও।

```
iCal sync চললো:
  → Booking.com booking: Room 101, June 12-14 (VEVENT UID: bcom-999)
  → ResortPro তে already আছে: Room 101, June 12-14 (booking ID: book-123, source: DIRECT)

CONFLICT DETECTED!
  → booking-123 এর status: CONFIRMED → CONFLICT (নতুন status)
  → Dashboard এ red alert দেখাবে
  → Staff কে email/push notification যাবে
  → Staff manually resolve করবে (কোনটা রাখবে, কোনটা cancel করবে)
```

**Schema addition:**

```
Booking model:
  status: "CONFLICT"  ← নতুন status add করতে হবে
  conflictNote: String?  ← "Conflict with Booking.com booking bcom-999"
```

**Dashboard alert:**

```
┌────────────────────────────────────────────────┐
│ ⚠️  2 Booking Conflicts Detected               │
│                                                 │
│ Room 101 — June 12–14                          │
│   ResortPro booking #B-123 (John Doe)          │
│   vs Booking.com (bcom-999@booking.com)        │
│   [Keep ResortPro] [Cancel ResortPro]          │
│                                                 │
│ Room 203 — July 5–8                            │
│   ResortPro booking #B-456 (Sarah K.)          │
│   vs Airbnb (airbnb-xyz@airbnb.com)            │
│   [Keep ResortPro] [Cancel ResortPro]          │
└────────────────────────────────────────────────┘
```

---

### Layer 4 — UI Warning (Staff কে সতর্ক করা)

Booking তৈরির সময় room select করলে, যদি ওই room এ external calendar থাকে:

```
┌──────────────────────────────────────────────────────┐
│  Room 101 — Ocean Suite                               │
│                                                       │
│  ⚠️  This room is connected to Booking.com (iCal)    │
│     Availability syncs every 15 minutes.              │
│     Last sync: 3 minutes ago.                         │
│     A real-time check will run before saving.         │
└──────────────────────────────────────────────────────┘
```

Staff বুঝবে: "এই room টার একটা sync delay আছে, তবে save করার আগে auto-check হবে।"

---

### কোন Layer কোন সমস্যা সমাধান করে

| Scenario | Layer 1 | Layer 2 | Layer 3 | Layer 4 |
|----------|---------|---------|---------|---------|
| Staff নতুন booking দিচ্ছে | ✅ Sync করে তারপর block করে | — | — | ✅ Warning দেখায় |
| OTA booking + ResortPro booking ইতিমধ্যে আছে | — | ✅ দ্রুত ধরা পড়ে | ✅ Alert পাঠায় | — |
| Staff ২ জন একসাথে same room book করছে | ✅ Database lock | — | — | — |
| iCal sync এর পরও conflict থাকলে | — | — | ✅ Flag করে manual resolution এর জন্য | — |

---

### সৎ সীমাবদ্ধতা (Honest Limitation)

**iCal দিয়ে ১০০% real-time double booking prevention সম্ভব না।**

- Layer 1 (sync-before-book) দিয়ে ৯৫%+ double booking বন্ধ হবে
- কিন্তু যদি ঠিক sync এর পরের সেকেন্ডে Booking.com এ book হয়, সেটা ধরা সম্ভব না iCal দিয়ে
- **100% solution:** XML API certification (Phase 3) — তখন Booking.com immediately webhook পাঠাবে, কোনো polling lag থাকবে না

```
iCal solution:     ████████████████████░░ ~95% effective
XML API solution:  ████████████████████████ ~99.9% effective
```

**তবু iCal solution এখনই করার কারণ:** XML API certification ৩-৬ মাস লাগে। iCal দিয়ে এখনই ৯৫% problem solve হয়, কোনো API key ছাড়া।

---

## Edge Cases (handle করতে হবে)

| Case | কী হবে |
|------|--------|
| iCal URL expire হয়ে গেছে | `lastError` তে "HTTP 404/403" → UI তে warning দেখাবে |
| Same UID দুইবার আসছে | Duplicate check → skip |
| iCal এ CANCELLED event | Booking → CANCELLED |
| ResortPro তে already manually booking আছে ওই dates এ | Conflict flag করবে, override করবে না |
| iCal URL response timeout | 10s timeout → error log, next hour retry |
| Booking.com private URL changed | Staff কে notify করবে (email + dashboard alert) |

---

## কী কী করবো না (scope বাইরে)

| Feature | কেন না |
|---------|--------|
| ResortPro → Booking.com এ push করা | XML certification লাগে — আলাদা plan আছে |
| Guest এর real name/email আনা | Booking.com API certification ছাড়া possible না |
| Payment sync করা | OTA payment OTA তে থাকে, ResortPro তে আসে না |
| Real-time webhook (instant notification) | Booking.com/Airbnb certified partner হতে হবে |
| Website guest কে OTA connection দেখানো | Guest এর জানার দরকার নেই — internal tool only |
| যাদের external calendar নেই তাদের flow change করা | Feature সম্পূর্ণ opt-in, no forced changes |

**এই feature শুধু "room block" করবে — আর কিছু না।**  
Guest এর details, payment, messages — কিছুই sync হবে না।  
ওই সব পরের phase এ।

> **Guest perspective:** Website থেকে book করা guest শুধু দেখবে room available নাকি না।  
> "কেন available না" — Booking.com এ আছে বলে কিনা, সেটা guest জানার কোনো উপায় নেই এবং থাকবেও না।

---

## Files যেগুলো তৈরি/পরিবর্তন হবে

```
packages/database/prisma/schema.prisma    ← ExternalCalendar model, Booking.externalUid
apps/api/src/
  utils/
    ical-parser.ts                        ← NEW: iCal text parser
  jobs/
    ical-sync.ts                          ← NEW: hourly cron job
  routes/
    externalCalendars.ts                  ← NEW: CRUD + manual sync
  app.ts                                  ← register route + start cron

apps/web/src/
  lib/api.ts                              ← externalCalendarsApi add
  components/dashboard/sidebar.tsx        ← "Channels" link add
  app/(dashboard)/dashboard/
    channels/page.tsx                     ← NEW: channel manager UI
```

**নতুন dependency:**
- `node-ical` — iCal parse করার জন্য (API server এ)

---

## Timeline

| Step | কাজ | সময় |
|------|-----|------|
| 1 | Schema + DB push | 30 min |
| 2 | iCal parser utility | 1 hr |
| 3 | Sync job (cron) | 2 hr |
| 4 | API routes | 1.5 hr |
| 5 | Frontend UI | 3 hr |
| 6 | Testing + edge cases | 2 hr |

**মোট: ~10 ঘন্টা**

---

## Done হলে কী benefit হবে

✅ Booking.com এ কেউ book করলে ResortPro এ ওই room **automatically blocked**  
✅ Staff দেখতে পাবে কোন room Booking.com এ বুক হয়েছে  
✅ Double booking আর হবে না  
✅ কোনো API key বা certification লাগবে না — শুধু URL paste  
✅ যেকোনো iCal সাপোর্ট করে — Booking.com, Airbnb, Agoda, Expedia, Google Calendar  
