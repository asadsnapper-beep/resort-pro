# Offline Sync — আমার পরামর্শ

## Core Insight

> **সবচেয়ে ভালো conflict resolution হলো conflict না হতে দেওয়া।**

বেশিরভাগ conflict হয় কারণ আমরা offline-এ *অনেক বেশি কিছু write করতে দিচ্ছি।*
Smart approach: **কোথায় offline write দরকার আর কোথায় দরকার নেই সেটা আগে ঠিক করা।**

---

## পরামর্শ ১ — Offline Booking Create করবে না ✋

এটাই সবচেয়ে বড় conflict-এর কারণ। আমার পরামর্শ:

**Offline-এ নতুন booking create করতে দেব না।**

কেন? কারণ:
- Room availability শুধু server জানে
- OTA (Airbnb, Booking.com) থেকে real-time booking আসতে পারে
- Double booking-এর ক্ষতি সবচেয়ে বেশি (guest embarrassment, revenue loss)

**বদলে কী করব:**

Offline-এ walk-in guest এলে **Draft Booking** তৈরি হবে:

```
┌────────────────────────────────────────────────┐
│ ⏳  DRAFT — Not Confirmed                       │
│  Room 101 · Dec 10-12 · Karim Hossain           │
│  Internet নেই — sync হলে confirm হবে            │
│                                    [Cancel Draft]│
└────────────────────────────────────────────────┘
```

- Guest-কে বলবে "আপনার booking pending, এক মিনিটে confirm হবে"
- Sync হলে server check করবে — conflict নেই → ✅ CONFIRMED
- Conflict আছে → ❌ receptionist-কে জানাবে, room change করতে বলবে

**এই একটা decision-এ সবচেয়ে বড় conflict category পুরো শেষ।**

---

## পরামর্শ ২ — Ownership Model দিয়ে Conflict এড়াও

অনেক conflict হয় কারণ একাধিক মানুষ একই জিনিস touch করতে পারে।
**Ownership** ঠিক করলে conflict এমনিই কমে যায়।

| Data | Owner | অন্যরা |
|---|---|---|
| Housekeeping Task | Assigned staff | শুধু read করতে পারে |
| F&B Order | যে waiter নিয়েছে | Kitchen শুধু status update করে |
| Support Ticket | Assigned staff | অন্যরা শুধু note যোগ করতে পারে |
| Maintenance Log | যে log করেছে | Read-only |

**Rule:** একজনের owned item অন্যজন offline-এ edit করতে পারবে না।

এতে housekeeping, F&B, maintenance, support ticket — এই চারটা category-র conflict প্রায় শূন্য হয়ে যাবে।

---

## পরামর্শ ৩ — Financial Data সবসময় Read-Only Offline

Invoice, payment, refund, extra charges — এগুলো offline-এ **শুধু দেখা যাবে, বদলানো যাবে না।**

```
[Invoice #201]  ⚠️ Editing disabled — internet প্রয়োজন
Total: ৳5,500
```

কারণ: টাকার conflict manually resolve করতে গেলে Manager-এর সময় নষ্ট হয়, mistake হওয়ার ঝুঁকি থাকে।

**Exception:** Cash payment নেওয়া যাবে offline-এ — কিন্তু শুধু *record* হবে, invoice amount পরিবর্তন হবে না।

---

## পরামর্শ ৪ — Inventory Delta Pattern (আবশ্যিক)

এটা implement না করলে inventory data নষ্ট হওয়া নিশ্চিত।

**ভুল:**
```
Offline sends: { currentStock: 45 }   ← absolute value
Cloud sends:   { currentStock: 48 }   ← absolute value
Server: কোনটা রাখব? 🤷
```

**সঠিক:**
```
Offline sends: { delta: -5 }   ← "আমি 5 কমিয়েছি"
Cloud sends:   { delta: -2 }   ← "cloud 2 কমিয়েছে"
Server: 50 - 5 - 2 = 43 ✓     ← দুটোই apply হয়েছে
```

Inventory table-এ `currentStock` সরাসরি update না করে আলাদা `inventory_movements` table রাখতে হবে।

---

## পরামর্শ ৫ — Soft Delete সর্বত্র (আবশ্যিক)

যেকোনো record delete মানে শুধু `deletedAt` timestamp set করা।
Hard delete (row সত্যিই মুছে ফেলা) কোনো table-এ করব না।

কারণ:
- Offline device delete জানে না, সেই record-এ কাজ করে ফেলে
- Hard delete-এ sync logic ভেঙে যায় (foreign key error, orphan records)

---

## পরামর্শ ৬ — Lamport Clock (Device Clock বিশ্বাস করো না)

Device-এর system clock ভুল হতে পারে। কেউ ঘড়ি পিছিয়ে দিলে last-write-wins ভুল result দেবে।

**Solution: Lamport Timestamp**

প্রতিটা device একটা sequence counter রাখে:
```
Device A: seq=1, seq=2, seq=3 ...
Device B: seq=1, seq=2, seq=3 ...
```

দুটো operation-এ কোনটা আগে সেটা seq দিয়ে বোঝা যাবে, device clock দিয়ে না।

এটা complex, কিন্তু financial + booking conflict-এ এটা দরকার।

---

## পরামর্শ ৭ — Server is Always the Authority for Availability

Desktop app কখনো নিজে বলবে না "হ্যাঁ, room available।"
শুধু বলবে "draft তৈরি হয়েছে, confirm হওয়ার জন্য sync করছি।"

এই একটা rule মানলে room double-booking প্রায় impossible।

---

## সবশেষে — Conflict-এর Tier System

এই system দিয়ে কাজ করলে সহজ হবে:

```
┌─────────────────────────────────────────────────────┐
│  TIER 1 — Auto Resolve (কোনো human দরকার নেই)       │
│                                                     │
│  • Guest profile — different fields → auto merge    │
│  • Room status — priority rule apply               │
│  • Task status — COMPLETED always wins              │
│  • Order status — DELIVERED always wins             │
│  • Notes/Comments — always append, never replace    │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  TIER 2 — Show Alert, Auto-apply safe default       │
│                                                     │
│  • Draft booking conflict → mark CONFLICT,          │
│    receptionist কে জানাও, কিন্তু block করো না       │
│  • Menu item deleted → "deleted item" label দাও     │
│  • Rate plan changed → booking keeps original rate  │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  TIER 3 — Halt, Manual Review Required             │
│                                                     │
│  • Invoice amount conflict → sync pending রাখো     │
│  • Payment/refund clash → audit log-এ রাখো         │
│  • Booking cancel vs checked-in → Manager সিদ্ধান্ত│
│  • Guest same-field conflict → side-by-side দেখাও  │
└─────────────────────────────────────────────────────┘
```

---

## সংক্ষেপে — 5টা জিনিস মানলেই 80% conflict শেষ

| # | Rule | কোন conflict শেষ হবে |
|---|---|---|
| 1 | **Booking offline-এ Draft** — server confirm করে | Double booking |
| 2 | **Ownership model** — একজনের item অন্যজন offline-এ edit করবে না | Housekeeping, F&B, Tickets |
| 3 | **Financial read-only offline** | Invoice, payment clash |
| 4 | **Inventory delta না absolute** | Stock count গড়বড় |
| 5 | **Soft delete সর্বত্র** | Orphan record, delete-write clash |

বাকি যা conflict থাকবে সেগুলো edge case — Tier 1/2/3 দিয়ে handle করা যাবে।
