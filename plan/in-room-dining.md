# In-Room Dining — Guest Food Ordering System
**শুধু checked-in guest-রা তাদের room থেকে food order করতে পারবে**

---

## সমস্যাটা ঠিক কী

### বর্তমান অবস্থা
এখন website থেকে যে কেউ food order করতে পারে:
```
যে কেউ (ঢাকায় বসে থাকা মানুষও) → website → food order → ✅ accept হয়
```

এটা ভুল। Resort-এর room service শুধু **এই মুহূর্তে resort-এ থাকা guest-দের** জন্য।

### আসল দরকার
```
Guest (room-এ আছে) → phone/laptop → resort website → food menu → order
                                                         ↓
                                              ✅ যাচাই: এই guest কি এখন এখানে আছে?
                                                         ↓
                                    হ্যাঁ → order accept → রান্না → room-এ delivery
                                    না  → "আপনি এখন resort-এ নেই" → block
```

---

## সমাধানের Options — ৪টা approach

### Option 1 — QR Code (প্রতিটা Room-এ)
```
Room-এ একটা QR code print করে রাখা আছে
  ↓
Guest QR scan করে
  ↓
সরাসরি food menu খুলে যায় (room number pre-filled)
  ↓
Order করে, room-এ delivery পায়
```

**✅ সুবিধা:**
- Super simple — কোনো password, কোনো account লাগে না
- Physical presence প্রমাণ হয় (QR room-এ আছে, তাই scan করতে পারছে)
- বাংলাদেশে QR code এখন সবাই চেনে (bKash, Nagad শিখিয়েছে)
- Guest-এর কোনো app install লাগে না

**❌ অসুবিধা:**
- কেউ QR-এর ছবি তুলে বাইরে পাঠিয়ে দিলে অন্যজন order করতে পারবে
- QR rotate না করলে পুরনো guest-ও order করতে পারবে

---

### Option 2 — Booking Confirmation Number
```
Guest তার confirmation number দেয় (e.g. CBR-2026-001)
  ↓
System check করে: এই booking কি আজ CHECKED_IN আছে?
  ↓
হ্যাঁ → room number auto-fill → order করো
না  → block
```

**✅ সুবিধা:**
- Unique — প্রতিটা booking-এর আলাদা number, দুজন guest কখনো একই পাবে না
- Guest check-in কার্ডে বা SMS-এ number পায়, কাছেই থাকে
- Guess করা প্রায় impossible (CBR-2026-001 format random না হলেও sequential যথেষ্ট secure)
- নামের মতো মিল-মিলাই ঝামেলা নেই

**❌ অসুবিধা:**
- Guest কার্ড হারালে বা SMS delete করলে পাবে না (→ front desk থেকে নিতে হবে)
- QR ছবি তুললে confirmation number জানলে অন্যজন order করতে পারবে

---

### Option 3 — Phone OTP (SMS/WhatsApp)
```
Guest তার phone number দেয়
  ↓
Resort SMS/WhatsApp-এ OTP পাঠায়
  ↓
OTP দিলে verify হয়, order করতে পারে
```

**✅ সুবিধা:**
- Very secure — phone physically থাকতে হবে
- Familiar pattern (bKash OTP মানুষ জানে)

**❌ অসুবিধা:**
- SMS cost লাগে প্রতিটা order-এ
- Guest যদি অন্য number দিয়ে book করে থাকে problem
- Cox's Bazar-এ network কখনো খারাপ থাকে

---

### Option 4 — QR + Confirmation Number (Hybrid) ⭐ **Best**
```
Room-এ QR code আছে (room number encoded)
  ↓
Guest QR scan করে → food menu খোলে (room pre-filled)
  ↓
Guest তার booking confirmation number দেয় (e.g. CBR-2026-001)
  ↓
System check: এই confirmation number কি এই room-এর?
              এই booking কি এখন CHECKED_IN আছে?
  ↓
হ্যাঁ → order confirm → session চালু (4 ঘণ্টা)
না  → block + "নম্বরটা সঠিক নয়, front desk-এ যোগাযোগ করুন"
```

**✅ সুবিধা:**
- Physical presence (QR room-এ) + Unique identity (confirmation number)
- কেউ QR ছবি তুললেও confirmation number না জানলে order করতে পারবে না
- নামের চেয়ে অনেক বেশি unique ও precise — দুজন "Karim" থাকলেও সমস্যা নেই
- Guest check-in-এর সময়ই number পায়, কাছে থাকে

**❌ অসুবিধা:**
- QR code প্রিন্ট করে room-এ রাখতে হবে (physical work)
- Guest কার্ড হারালে front desk থেকে নিতে হবে

---

## ✅ সুপারিশ: Option 4 — QR + Confirmation Number

### কেন নাম নয়, Confirmation Number?

| | নাম (আগের ধারণা) | Confirmation Number (✅ নতুন) |
|--|--|--|
| **Uniqueness** | দুজন "Karim" থাকলে সমস্যা | প্রতিটা booking-এ আলাদা — কখনো conflict নেই |
| **Security** | "Karim" guess করা সহজ | CBR-2026-001 format অনেক কঠিন |
| **Guest experience** | নাম মনে আছে, কিন্তু ভুল হতে পারে | Check-in card-এ লেখা আছে |
| **Precision** | একই নামের দুই guest একে অপরের order করতে পারে | Confirmation = one specific booking |

### কেন এটাই best?

```
Security:        QR (physical presence) + Confirmation # (unique identity) = double lock
Uniqueness:      দুই guest-এর কখনো same number নেই
UX:              Scan → number দাও → order — মাত্র ২ step
No extra cost:   OTP-এর মতো SMS cost নেই
Practical:       Check-in card-এ number লেখা থাকবে, guest-এর কাছেই আছে
Bangladesh fit:  QR scan সবাই পারে, number enter করা সবাই পারে
```

### Check-in Card (Physical) — এটা key

```
┌─────────────────────────────────────────┐
│  🏨 CORAL BAY RESORT                    │
│  Welcome Card                           │
├─────────────────────────────────────────┤
│  Guest:    Karim Hossain                │
│  Room:     201                          │
│  Check-in: 20 May 2026                 │
│  Check-out: 23 May 2026                │
│                                         │
│  Booking Reference:                     │
│  ┌─────────────────────────────────┐   │
│  │     CBR-2026-042                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📱 Room Service:                       │
│  Room-এর QR scan করুন, তারপর          │
│  এই number দিন → food order করুন       │
│                                         │
│  WiFi: CoralBay_Guest | Pass: coral123 │
└─────────────────────────────────────────┘
```

Check-in card-এ clearly বলা থাকবে confirmation number দিয়ে food order করা যাবে।
SMS/WhatsApp-এ booking confirm হওয়ার সময়ও number যাবে।

---

## Technical Architecture

### QR Code Structure

প্রতিটা room-এর QR-এ encoded থাকবে:

```
URL: https://resort-slug.resortpro.com/order?r=ROOM_TOKEN

ROOM_TOKEN = base64(tenantId + roomId + secret) 
           → "cGFsbS1wYXJhZGlzZTo6cm9vbS0xMDE6OmFiYzEyMw=="
```

Token-এ room number সরাসরি থাকবে না — server-এ decode হবে।
প্রতি checkout-এ token rotate করা যাবে (optional security upgrade)।

---

### Verification Flow (বিস্তারিত)

```
Step 1: Guest QR scan করে
  URL: /order?r=ROOM_TOKEN
  Server: token decode → roomId বের করে
  Check: এই room কি এখন CHECKED_IN booking আছে?
    না → "এই room-এ এখন কোনো guest নেই" → block
    হ্যাঁ → Step 2

Step 2: Guest booking confirmation number দেয়
  Input: Confirmation number (e.g. "CBR-2026-042")
  Server: check করে —
    ✓ এই confirmation number কি exist করে?
    ✓ এই booking কি এই room-এর?
    ✓ এই booking কি এখন CHECKED_IN status-এ আছে?
    সব ✓ → session token issue করে (4 ঘণ্টা valid, browser-এ store)
    কোনোটা ✗ → "নম্বরটা সঠিক নয়"
              → ৩ বার ভুল হলে block + "front desk-এ যোগাযোগ করুন"

Step 3: Order করে
  Session token দিয়ে authenticated
  Room number, guest নাম auto-filled (booking থেকে)
  Order submit → restaurant dashboard-এ দেখায়
  Amount booking-এর invoice-এ যোগ হয়
```

---

### Database Schema Changes

```prisma
model RoomQRToken {
  id        String   @id @default(cuid())
  tenantId  String
  roomId    String
  token     String   @unique   // random token, not predictable
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  
  tenant Tenant @relation(...)
  room   Room   @relation(...)
  
  @@index([token])
  @@map("room_qr_tokens")
}

// FoodOrder model-এ নতুন fields:
// roomId      String?   // কোন room থেকে order এলো
// orderSource String    // "IN_ROOM" | "RESTAURANT" | "WALK_IN"
// verifiedBy  String?   // "QR_SCAN" | "STAFF" | "PHONE_OTP"
```

---

### API Endpoints

```
# QR Verification
GET  /api/public/:slug/room-order/verify?token=ROOM_TOKEN
     → room check করে, active CHECKED_IN booking আছে কিনা দেখে
     → Response: { roomNumber, hasActiveBooking }

POST /api/public/:slug/room-order/authenticate
     Body: { token, confirmationNo }   ← নাম নয়, confirmation number
     → confirmation number match করে —
        ✓ exist করে?
        ✓ এই room-এর?
        ✓ CHECKED_IN?
     → সব match → guest session token দেয় (4hr JWT)
     → fail → attempt count বাড়ে, ৩ বার পরে lockout

# Menu (Public — no auth)
GET  /api/public/:slug/menu
     → সব available menu items

# Order (Requires session token)
POST /api/public/:slug/room-order
     Header: x-guest-session: SESSION_TOKEN
     Body: { items[], notes }
     → order create করে, restaurant dashboard-এ notify করে

GET  /api/public/:slug/room-order/:orderId/status
     → order status track করে (pending → preparing → ready → delivered)
```

---

## UI Flow — Guest Side

### Screen 1: QR Scan করার পর
```
┌─────────────────────────────────────────┐
│  🏨 Coral Bay Resort                    │
│  Room Service — Room 201                │
│                                         │
│  আপনার Booking Reference নম্বর দিন:   │
│  (Check-in card-এ পাবেন)               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  e.g. CBR-2026-042              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [  যাচাই করুন  →  ]                  │
│                                         │
│  🔒 শুধু এই room-এর checked-in guest   │
│     order করতে পারবেন                  │
│                                         │
│  নম্বর নেই? → Front Desk: 📞 101      │
└─────────────────────────────────────────┘
```

### Screen 2: Menu
```
┌─────────────────────────────────────────┐
│  🍽️  Room Service Menu                  │
│  Room 201 · Karim Hossain               │
│                                         │
│  🌅 Breakfast                           │
│  ┌─────────────────────────────────┐   │
│  │ Deshi Breakfast Set    ৳350     │   │
│  │ ব্যাকরণ, ডাল, ডিম, পরোটা  [+] │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Continental Breakfast  ৳550     │   │
│  │ Toast, egg, juice, coffee   [+] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🐟 Main Course                         │
│  [... more items ...]                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🛒 Cart: 2 items · ৳900       │   │
│  │  [ Order করুন ]                 │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Screen 3: Order Tracking
```
┌─────────────────────────────────────────┐
│  ✅ Order Placed!                        │
│  Order #ORD-2026-042                    │
│                                         │
│  ●━━━━━━━━━━━━━○━━━━━━━━━━━○           │
│  Confirmed   Preparing    Delivered     │
│                                         │
│  Estimated time: 20-30 minutes          │
│  আপনার খাবার room 201-এ পৌঁছে দেওয়া  │
│  হবে।                                   │
│                                         │
│  Items:                                 │
│  • Deshi Breakfast Set × 1   ৳350      │
│  • Fresh Coconut Water × 2   ৳240      │
│  ─────────────────────────────         │
│  Total: ৳590                           │
└─────────────────────────────────────────┘
```

---

## UI — Restaurant Staff Side (Dashboard)

Dashboard-এর **F&B Orders** page-এ নতুন column:

```
┌────────────────────────────────────────────────────────────────┐
│  📋 New Order — #ORD-2026-042                  🔔 Just now     │
│                                                                  │
│  📍 Room 201 · Karim Hossain         [IN-ROOM ORDER]          │
│                                                                  │
│  • Deshi Breakfast Set × 1                                      │
│  • Fresh Coconut Water × 2                                      │
│  Notes: "No spicy please"                                       │
│                                                                  │
│  Total: ৳590              [✅ Accept] [🚫 Reject]             │
└────────────────────────────────────────────────────────────────┘
```

Staff order accept করলে guest-এর phone-এ WhatsApp/SMS যাবে (optional):
> "আপনার order #042 confirm হয়েছে। ২০-৩০ মিনিটে room 201-এ পৌঁছাবে। 🍽️"

---

## QR Code Management — Dashboard

Settings বা Rooms page-এ নতুন section:

```
Rooms & Villas → Room 201 → [ 🔗 Download QR Code ]
                                      ↓
                          PDF / PNG download হবে
                          A5 size, resort branding সহ
                          Print করে room-এ রাখো
```

**Bulk download:**
Settings → Operations → [ ⬇️ Download All Room QR Codes (ZIP) ]
→ সব room-এর QR একসাথে ZIP-এ

---

## Edge Cases — কী কী হতে পারে

| Situation | System কী করবে |
|-----------|----------------|
| Room empty (কোনো booking নেই) | "এই room-এ এখন কোনো guest নেই" |
| Confirmation number ভুল দিয়েছে | ৩ বার try-এর পর ১৫ মিনিট block, "front desk-এ যোগাযোগ করুন" |
| Restaurant বন্ধ (রাত ১১টার পর) | "Restaurant এখন বন্ধ। সকাল ৭টা থেকে খোলা।" |
| Guest checkout হয়ে গেছে | QR scan করলে "আপনার stay শেষ হয়েছে" |
| দুইজন guest একই room-এ share করছে | একই confirmation number — দুজনই order করতে পারবে |
| Kitchen busy / item unavailable | Menu-তে "Out of stock" badge, order block |

---

## Billing — কে দেবে?

### Option A: Room charge (চালান সাথে)
- Order amount booking-এর invoice-এ যোগ হয়
- Checkout-এর সময় একসাথে payment
- Guest-কে আলাদা payment করতে হবে না

### Option B: Separate payment
- Order-এর সময় bKash/card দিয়ে pay
- Invoice-এ যোগ হবে না

**সুপারিশ: Option A (Room charge)** — guest experience ভালো, hassle কম।

---

## Implementation Order

```
Week 1 — Backend Foundation
  ✦ RoomQRToken model → DB push
  ✦ QR token generate API (per room)
  ✦ Verify token endpoint (room check + booking check)
  ✦ Guest authenticate endpoint (name match)
  ✦ Guest session token (JWT, 4hr expiry)
  ✦ Public food order endpoint (session-protected)

Week 2 — Guest UI (Public Website)
  ✦ /order?r=TOKEN page — name input screen
  ✦ Menu browsing page (mobile-first design)
  ✦ Cart + checkout
  ✦ Order tracking page (real-time status)

Week 3 — Dashboard & QR Management
  ✦ F&B Orders dashboard — room badge, IN-ROOM label
  ✦ Real-time notification (new in-room order)
  ✦ QR code generation + download (per room)
  ✦ Bulk QR download (ZIP)
  ✦ Room charge → invoice integration

Testing
  ✦ Full flow test: QR scan → order → delivery
  ✦ Edge cases: empty room, wrong name, closed kitchen
  ✦ Mobile UX (guests mostly use phone)
```

---

## Estimated Effort

| Task | Est. |
|------|------|
| Backend (tokens, verify, order API) | 3–4 days |
| Guest ordering UI (mobile) | 3–4 days |
| Order tracking (real-time) | 1–2 days |
| Dashboard updates (in-room badge, notify) | 1–2 days |
| QR generation + download | 1 day |
| Invoice integration | 1 day |
| Testing | 2 days |
| **Total** | **~3 weeks** |

---

## Future Upgrades (Phase 2)

- **Multi-language menu** — Bangla + English toggle
- **Diet filter** — Vegetarian, Halal, No spicy
- **Scheduled order** — "সকাল ৭:৩০-এ breakfast দিন"
- **Order history** — Guest তার সব order দেখতে পাবে
- **Rating** — খাবার delivery-র পর rating দেওয়ার option
- **Upsell** — "এই item-এর সাথে কি X নেবেন? (+৳১২০)"
- **Minibar tracking** — Room-এ যা কিছু নেয় সব invoice-এ

---

*Related: [direct-booking-website.md](./direct-booking-website.md) — public booking engine*
*Related: [sms-whatsapp-notifications.md](./sms-whatsapp-notifications.md) — order notification via SMS/WA*
