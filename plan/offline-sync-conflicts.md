# Offline Sync — Conflict Analysis

Conflict মানে: **একই data দুই জায়গায় একই সময়ে বদলানো হয়েছে।**

```
Device A (offline)  ──── sync ────▶  Cloud
                              ▲
Device B (online)   ──────────┘

A আর B একই record বদলালে → CONFLICT
```

---

## Conflict-এর ধরন

Conflict মূলত ৩ ধরনের:

| ধরন | মানে | উদাহরণ |
|---|---|---|
| **Write-Write** | দুই জায়গায় একই field বদলানো হয়েছে | দুই receptionist একই guest-এর phone নম্বর আলাদা করে edit করেছে |
| **Create-Create** | দুই জায়গায় এমন কিছু create হয়েছে যেটা একসাথে থাকতে পারে না | একই room-এ একই তারিখে দুটো booking |
| **Delete-Write** | একজন delete করেছে, অন্যজন update করেছে | Online-এ booking cancel হয়েছে, offline-এ same booking-এ F&B order নেওয়া হয়েছে |

---

## ১. Booking Conflict — সবচেয়ে Critical 🔴

### ১.১ একই Room, একই তারিখে দুটো Booking

```
[Offline Desktop]                    [Cloud / Web / OTA]
                                     
Receptionist: walk-in guest          Online booking form:
Room 101, Dec 10-12                  Room 101, Dec 10-12
→ Booking A তৈরি (local)  ←──────→  → Booking B তৈরি (cloud)
                         
Sync হলে: দুটোই valid মনে করবে ❌
```

**কোথায় হয়:** Front Desk + Website + Airbnb/Booking.com তিন জায়গা থেকে আসতে পারে

**কীভাবে detect করব:**
```
Push করার সময় server check করবে:
SELECT * FROM bookings
WHERE roomId = ? AND status NOT IN ('CANCELLED')
AND checkIn < :checkOut AND checkOut > :checkIn
```

**Resolution:**
- Server দুটোর মধ্যে যেটা আগে cloud-এ পৌঁছেছে সেটা **জেতে**
- Offline-এ তৈরি booking-টা `CONFLICT` status পাবে
- Desktop-এ alert: _"Room 101 ইতিমধ্যে Dec 10-12 বুক হয়ে গেছে। নতুন room বাছুন।"_

---

### ১.২ Booking Cancel Online, Offline-এ Check-in হয়ে গেছে

```
[Offline Desktop]                    [Cloud]
                                     
Guest এসেছে                          Guest phone করে cancel করেছে
Receptionist check-in করেছে          Manager cancel করেছে online
status = CHECKED_IN (local)          status = CANCELLED (cloud)
```

**Resolution:**
- Sync হলে UI-তে warning: _"এই booking cloud-এ cancel হয়ে গেছে, কিন্তু আপনি check-in করে ফেলেছেন।"_
- Manager-কে manually decide করতে হবে — software auto-override করবে না
- Audit log-এ দুটোই রেকর্ড থাকবে

---

### ১.৩ Booking-এর Amount বদলানো হয়েছে দুই জায়গায়

```
[Offline Desktop]                    [Cloud]

Extra charge যোগ করা হয়েছে          Rate plan discount apply হয়েছে
totalAmount: 5000 → 5500             totalAmount: 5000 → 4500
```

**Resolution:**
- Financial conflict-এ সবসময় **Manager-কে জানাবে**, auto-resolve করবে না
- দুটো amount দেখিয়ে জিজ্ঞেস করবে কোনটা রাখব

---

## ২. Guest Profile Conflict 🟠

### ২.১ একই Guest, দুই জায়গায় Edit

```
[Offline Desktop]                    [Cloud / Web]

Guest: Karim Hossain                 Guest: Karim Hossain
Phone: 01700-000000 বদলে             Email: karim@old.com বদলে
       01800-111111                         karim@new.com
```

**এটা আসলে conflict না — merge করা যাবে:**
- আলাদা field বদলালে → **auto-merge** (phone from offline + email from cloud)

```
[Offline Desktop]                    [Cloud / Web]

Phone: 01700-000000 বদলে             Phone: 01700-000000 বদলে
       01800-111111                          01900-222222
```

**এটা real conflict — একই field, দুই value:**
- UI-তে side-by-side দেখাবে
- কোনটা রাখব Manager choose করবে

---

### ২.২ Guest Delete Online, Offline-এ নতুন Booking

```
[Cloud]                              [Offline Desktop]

Duplicate guest, delete করা হয়েছে   Same guest-এর জন্য
guestId: abc-123 → deleted           নতুন booking তৈরি হয়েছে
```

**Resolution:**
- Booking push হলে server বলবে "guest not found"
- Desktop: guest re-create করবে (নতুন ID দিয়ে), তারপর booking আবার link করবে

---

## ৩. Room Status Conflict 🟠

### ৩.১ একই Room-এর Status দুই জায়গায়

```
[Offline Desktop]                    [Cloud]

Receptionist:                        Housekeeping Manager:
Room 205 → AVAILABLE                 Room 205 → MAINTENANCE
(guest check-out করেছে)              (water leak report)
```

**এটা খুব সাধারণ হবে।**

**Resolution:**
- `MAINTENANCE` সবসময় `AVAILABLE`-এর চেয়ে priority পাবে (safety rule)
- Rule: `MAINTENANCE > OCCUPIED > RESERVED > AVAILABLE`
- Higher priority status জিতবে

---

### ৩.২ Housekeeping Task Conflict

```
[Offline Desktop]                    [Cloud]

Staff Rina:                          Manager:
Task #45 → COMPLETED                 Task #45 → reassigned to Setu
(নিজে করেছে)                         (Rina sick leave দিয়েছে)
```

**Resolution:**
- COMPLETED থাকলে task COMPLETED-ই থাকবে (কাজ হয়ে গেছে)
- Audit-এ note: "Completed by Rina, was reassigned to Setu"

---

## ৪. F&B Order Conflict 🟡

### ৪.১ Order Cancel Online, Offline-এ Delivered মার্ক

```
[Offline Desktop]                    [Cloud / Kitchen Screen]

Waiter:                              Manager (guest complaint):
Order #88 → DELIVERED                Order #88 → CANCELLED

```

**Resolution:**
- `DELIVERED` wins over `CANCELLED` — কারণ food দিয়ে ফেলা হয়েছে
- Manager-কে জানাবে, payment issue হলে তিনি manually handle করবেন

---

### ৪.২ Menu Item Offline-এ Delete, Order-এ ব্যবহার হয়েছে

```
[Cloud]                              [Offline Desktop]

"Hilsa Curry" → deleted              Waiter order নিয়েছে
(out of stock, manager deleted)      Hilsa Curry × 2
```

**Resolution:**
- Sync-এ server বলবে "menu item not found"
- Desktop: order-এ item টা "Unknown Item (deleted)" দেখাবে
- Manager manually clarify করবে

---

## ৫. Inventory Conflict 🟡

### ৫.১ Stock Count দুই জায়গায় কমেছে

```
[Offline Desktop]                    [Cloud]

Housekeeping:                        Restaurant:
Towel stock: 50 → 45                 Towel stock: 50 → 48
(-5 used)                            (-2 used)
```

**এটা সবচেয়ে tricky।**

**ভুল approach:** Last-write-wins → 45 বা 48 (একটা count হারিয়ে যাবে)

**সঠিক approach:** Delta-based sync
```
Offline sent:  { delta: -5 }   (আমি 5 কমিয়েছি)
Cloud sent:    { delta: -2 }   (cloud 2 কমিয়েছে)
Server result: 50 - 5 - 2 = 43 ✓
```

- Inventory-তে `absolute value` না পাঠিয়ে **delta (পরিবর্তন)** পাঠাতে হবে

---

## ৬. Payment / Invoice Conflict 🔴

### ৬.১ Invoice Amount দুই জায়গায় বদলানো

```
[Offline Desktop]                    [Cloud]

Receptionist:                        Accountant:
Invoice #201                         Invoice #201
Extra charge +500 যোগ করা           Early bird discount -300 apply
Total: 5500                          Total: 4700
```

**Resolution:**
- Financial data-তে **কোনো auto-resolve নেই**
- সবসময় Manager-কে দেখাবে, manual confirmation নেবে
- Sync pending state-এ রাখবে যতক্ষণ না resolve হয়

---

### ৬.২ Payment Record হয়েছে Offline, Refund হয়েছে Online

```
[Offline Desktop]                    [Cloud]

Cash payment: 3000 received          Guest refund: 3000 processed
paidAmount: 0 → 3000                 paidAmount: 3000 → 0
```

**Resolution:**
- Conflict flag, Manager manual review
- দুটো transaction audit log-এ থাকবে

---

## ৭. Support Ticket Conflict 🟡

### ৭.১ Ticket Resolved Offline, Reassigned Online

```
[Offline Desktop]                    [Cloud]

Staff Raju:                          Manager:
Ticket #55 → RESOLVED                Ticket #55 assigned to Setu
(ঠিক করে ফেলেছে)                     (escalate করেছে)
```

**Resolution:**
- `RESOLVED` wins — কারণ কাজ হয়ে গেছে
- Setu-কে notification: "This ticket was already resolved offline"

---

### ৭.২ Note যোগ হয়েছে দুই জায়গায়

```
[Offline Desktop]                    [Cloud]

"AC ঠিক করা হয়েছে"                  "Guest confirmed satisfied"
(নতুন comment)                        (নতুন comment)
```

**এটা conflict না — দুটোই রাখা যাবে।**
Comments/notes সবসময় **append** হবে, replace না।

---

## ৮. Delete Conflict — সবচেয়ে Dangerous 🔴

যেকোনো table-এ:

```
[Offline Desktop]                    [Cloud]

Booking #77-তে                       Booking #77 
F&B order নেওয়া হয়েছে              DELETE করা হয়েছে
maintenance log করা হয়েছে           (test booking ছিল)
```

**Soft Delete ছাড়া এটা catastrophic হতে পারে।**

**Solution: Hard delete কখনো করব না।**
সব record-এ `deletedAt` column রাখব:
```sql
deletedAt DATETIME NULL  -- NULL = active, timestamp = deleted
```

- Sync-এ deleted record পাঠাবে: `{ id: "...", deletedAt: "2025-01-01T00:00:00Z" }`
- Offline-এ যদি কেউ এই record edit করে থাকে → conflict flag
- UI-তে বলবে "এই booking delete হয়ে গেছে। আপনার পরিবর্তন কী করব?"

---

## Conflict-এর সম্পূর্ণ তালিকা (Summary)

| # | Conflict | ঘটবে কোথায় | Severity | Resolution Strategy |
|---|---|---|---|---|
| 1 | একই room, একই date, দুটো booking | Front Desk + Website/OTA | 🔴 Critical | Server first-write-wins, offline booking CONFLICT |
| 2 | Booking cancel online, check-in offline | Front Desk + Manager | 🔴 Critical | Manual review, alert receptionist |
| 3 | Booking amount দুই জায়গায় বদলানো | Receptionist + Accountant | 🔴 Critical | Manual review only |
| 4 | Guest same field দুই জায়গায় edit | Any user | 🟠 High | Side-by-side UI, user chooses |
| 5 | Guest delete, offline booking ব্যবহার করেছে | Receptionist + Admin | 🟠 High | Re-create guest, re-link |
| 6 | Room status দুই জায়গায় বদলানো | Receptionist + Housekeeping | 🟠 High | Priority-based (MAINTENANCE wins) |
| 7 | Housekeeping task reassign + complete | Staff + Manager | 🟡 Medium | COMPLETED wins |
| 8 | F&B order cancel + delivered | Waiter + Manager | 🟡 Medium | DELIVERED wins |
| 9 | Menu item delete, order-এ আছে | Manager + Waiter | 🟡 Medium | Mark as "deleted item", manager reviews |
| 10 | Inventory absolute count দুই জায়গায় | Housekeeping + Restaurant | 🟠 High | Delta-based sync (never absolute) |
| 11 | Invoice amount দুই জায়গায় | Receptionist + Accountant | 🔴 Critical | Manual review only |
| 12 | Payment + Refund clash | Receptionist + Accountant | 🔴 Critical | Both in audit log, manual review |
| 13 | Ticket resolved + reassigned | Staff + Manager | 🟡 Medium | RESOLVED wins |
| 14 | Record deleted online, updated offline | Any | 🔴 Critical | Soft delete mandatory, show alert |
| 15 | Rate plan changed online, booking at old rate | Manager + System | 🟡 Medium | Booking keeps original rate (immutable) |
| 16 | Offer expired online, applied offline | Receptionist + System | 🟡 Medium | Server rejects, recalculate without discount |

---

## Conflict-কে কমানোর Design Rules

### Rule 1: Immutable Booking Amount
Booking একবার create হলে `totalAmount` immutable। Extra charge হলে আলাদা `booking_charges` table-এ যাবে।

### Rule 2: Delta-based Inventory
Inventory-তে কখনো `currentStock = X` পাঠাব না। সবসময় `delta = -3` পাঠাব।

### Rule 3: Append-only Comments/Notes
Ticket, booking note, guest note — সব append হবে। কেউ কারো লেখা overwrite করবে না।

### Rule 4: Soft Delete Everywhere
`deletedAt` column সব table-এ থাকবে। Hard delete কখনো না।

### Rule 5: Financial = Manual Only
যেকোনো টাকার conflict → auto-resolve করব না। সবসময় Manager alert।

### Rule 6: Status Priority Matrix
```
Room:     MAINTENANCE > OCCUPIED > RESERVED > AVAILABLE
Booking:  CHECKED_IN > CONFIRMED > PENDING
                     (CANCELLED সবচেয়ে নিচে, override করা যাবে না যদি already checked-in)
Task:     COMPLETED > IN_PROGRESS > PENDING
Order:    DELIVERED > READY > PREPARING > PENDING > CANCELLED
```

### Rule 7: Booking = Server Authority
Room availability সবসময় server check করবে push-এর সময়।
Desktop কখনো নিজে availability নিশ্চিত করবে না — শুধু server বলবে।

---

## Conflict UI — কীভাবে দেখাবে

### ছোট conflict (auto-resolved):
```
┌─────────────────────────────────────────────────┐
│ ℹ️  Sync — 3 records updated from cloud          │
└─────────────────────────────────────────────────┘
```

### Manual review দরকার:
```
┌─────────────────────────────────────────────────┐
│ ⚠️  2 Conflicts need your attention              │
│                                          [Review]│
└─────────────────────────────────────────────────┘
```

### Conflict Review Screen:
```
┌──────────────────────────────────────────────────────┐
│ Conflict: Booking #77 — Room 101, Dec 10-12          │
│                                                      │
│  Your version (offline)    │  Cloud version          │
│  ─────────────────────     │  ──────────────         │
│  Status: CHECKED_IN        │  Status: CANCELLED      │
│  Amount: 5,500 BDT         │  Amount: 5,000 BDT      │
│                                                      │
│  [Keep offline version]    [Use cloud version]       │
│  [Open booking to decide manually]                   │
└──────────────────────────────────────────────────────┘
```

---

## Conflict Log

সব conflict একটা `conflict_log` table-এ record হবে:
```sql
CREATE TABLE conflict_log (
  id          TEXT PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  field_name  TEXT,              -- কোন field, null = whole record
  local_value TEXT,              -- offline-এর value (JSON)
  cloud_value TEXT,              -- cloud-এর value (JSON)
  resolution  TEXT,              -- 'LOCAL_WIN' | 'CLOUD_WIN' | 'MANUAL' | 'PENDING'
  resolved_by TEXT,              -- user id যে resolve করেছে
  created_at  DATETIME,
  resolved_at DATETIME
);
```

এই log থেকে পরে audit করা যাবে — "কোন conflict কে কীভাবে resolve করেছিল।"
