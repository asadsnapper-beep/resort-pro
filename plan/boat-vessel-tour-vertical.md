# ResortPro — Boat / Houseboat / Vessel Tour Vertical (নৌকা ও ট্যুর ভেসেল)

## Status: Plan only — foundation implemented, rest deferred

এই doc টা বাংলাদেশের houseboat/tour-boat (Sundarban, Tanguar Haor) operator-দের জন্য ResortPro-তে নতুন একটা business vertical support করার পুরো আলোচনা capture করে। এটা একটা conversational discussion থেকে বের হওয়া architecture — user নিজে ধাপে ধাপে ("aste dhire") এটা বানাবেন, তাই এই doc টা শুধু design reference।

**যা এখন সত্যিই implement হয়েছে (2026-07-28):** শুধু `Property.type` (`ROOM_BASED` / `VESSEL_BASED`) enum field — migration `20260728120000_property_business_type`। এর বাইরে **কিছুই build হয়নি এখনো।**

---

## ১. Business Context (আলোচনা থেকে)

- Bangladesh-এ দুই ধরনের operator আছে:
  - **Tanguar Haor houseboats**: 2D1N tour। সকাল ১০টায় on-board, পরদিন বিকেল/সন্ধ্যায় tour শেষ।
  - **Sundarban houseboats/ships**: 3D2N tour।
- Resort owner আর boat owner **আলাদা customer segment** — কখনো কখনো একই ব্যক্তি দুটোই চালাতে পারে (rare), কিন্তু সাধারণত আলাদা।
- বেশিরভাগ boat operator-এর **১টা মাত্র boat** থাকে। কেউ কেউ (larger operator) ২-৫টা পর্যন্ত।
- Boat-এও staff থাকে: room clean করা/খাবার বানানো/serve করা staff, এবং manager। Resort-এর মতোই এদেরও নিজস্ব website দরকার হবে।

### Pricing patterns (confirmed by user)
1. **Date-based demand pricing**: এক সপ্তাহে সাধারণত ২-৩টা trip থাকে (যেমন শুক্রবারের trip-এ demand বেশি → দাম একটু বেশি, বাকিগুলো একটু কম, full-moon trip-ও ভালো দামে যায়)। তাই price **fixed rule নয়, প্রতি trip-ভিত্তিক (random/manual)**।
2. **Per-person + per-cabin hybrid pricing**: মাথাপিছু দাম হয়, মাঝেমধ্যে couple cabin-এর আলাদা দাম দেওয়া থাকে।
3. **Full-charter (group buyout)**: অনেক সময় একটা group পুরো নৌকা ভাড়া নেয়।
   - Base full-charter price একটা **standard capacity** cover করে (উদাহরণ: 20 জনের নৌকা, normal per-head হিসেবে হত ৳85-90k, কিন্তু full charter-এ base ৳80k)।
   - Group-এ standard capacity-র বেশি মানুষ (যেমন ২৫ জন) থাকলে, extra ৫ জনের জন্য **marginal per-extra-guest charge** (খাবারের বাড়তি খরচ + service charge) add হয়।
4. **Payment norm**: বেশিরভাগ টাকা **আগে থেকে (upfront)** নেওয়া হয়। খুব অল্প ক্ষেত্রে কিছু টাকা পরে দেওয়া হয়।
5. **Weather/cancellation policy**: **owner-ভেদে আলাদা নিয়ম** — কারো refund policy কড়া, কারো নরম। তাই এটা platform-এ **tenant-configurable** হতে হবে, hardcode করা যাবে না।

---

## ২. Core Architectural Decision: Property.type (✅ implemented)

Business type **Tenant-level নয়, Property-level**। কারণ:
- একই tenant resort আর boat দুটোই চালাতে পারে (rare হলেও সম্ভব)।
- Multi-property architecture আগে থেকেই আছে (`Property` model, `Room.propertyId`), শুধু business-type ফর্ক করা দরকার — নতুন top-level entity বানানোর দরকার নেই।

```prisma
enum PropertyType {
  ROOM_BASED     // existing hotel/resort behavior — default
  VESSEL_BASED   // new: boat/houseboat/tour-vessel behavior
}

model Property {
  ...
  type PropertyType @default(ROOM_BASED)
  ...
}
```

সব existing property `ROOM_BASED` default পাবে → zero breakage, কোনো migration data-loss নেই।

### ⚠️ Open problem: Property management is Enterprise-gated today

Codebase পড়ে দেখা গেছে — `apps/api/src/routes/properties.ts`-এর **সব route** (`GET`, `POST`, `PATCH`, `DELETE`, এমনকি listing) `requireMultiProperty()` দিয়ে gated, যেটা `multi_property` entitlement flag চেক করে (Enterprise plan-only)। `Room.propertyId` optional (`String?`), মানে single-location resort tenant **আজ পর্যন্ত কখনো একটাও Property row তৈরি করে না** — পুরো concept-টাই এখন শুধু multi-location Enterprise customer-দের জন্য।

এর মানে: boat vertical build করার আগে এই gate rethink করা লাগবে, কারণ single-boat operator (majority case) তার **একটামাত্র vessel** register করতে গেলেও আজকের নিয়মে Enterprise plan লাগবে — যেটা ভুল। সমাধান সম্ভবত:
- Gate-টা "managing 2+ properties" এ rewrite করা (i.e. তোমার প্রথম Property free, ২য়টা থেকে Enterprise), অথবা
- `VESSEL_BASED` property তৈরি একদম আলাদা signup flow দিয়ে handle করা (boat-owner registration নিজেই একটা default vessel Property বানিয়ে দেবে, gate bypass করে)।

**এটা এখনো fix করা হয়নি — boat vertical শুরু করার সময় অবশ্যই প্রথমে সমাধান করতে হবে, নাহলে কোনো boat owner সাইনআপ করে তাদের boat-ই যোগ করতে পারবে না।**

---

## ৩. Core New Concept: Departure (Voyage)

Room booking system-এ availability একটা continuous calendar (any check-in/check-out date কাজ করে)। Boat tour সেরকম না — এটা **fixed-schedule departure**-ভিত্তিক। তাই room-এর মতো generic date-range booking না বানিয়ে, **Departure** নামে একটা নতুন bookable unit দরকার।

- **Manually created per-trip** — কোনো recurring-rule engine (RRULE ইত্যাদি) দরকার নেই, কারণ demand/date এলোমেলো (সপ্তাহে ২-৩টা trip, dates predictable না)। Owner নিজে হাতে "নতুন departure" বানাবে: date, duration (2D1N/3D2N), base per-person price, cabin/couple-price override, standard capacity, full-charter base price + extra-guest marginal rate।
- প্রতিটা Departure-এর নিজস্ব inventory (কয়টা seat/cabin বাকি) থাকবে, room booking-এর booking-conflict logic-এর analog হিসেবে কাজ করবে কিন্তু date-range এর বদলে single fixed slot।

```
Departure (draft outline — NOT built yet)
  id, propertyId (VESSEL_BASED property), departureDate, returnDate,
  durationLabel ("2D1N" / "3D2N"),
  standardCapacity, totalCapacity,
  perPersonPrice, cabinPriceOverrides (per-cabin-type JSON or table),
  fullCharterBasePrice, extraGuestMarginalRate,
  status (DRAFT / OPEN / FULL / DEPARTED / COMPLETED / CANCELLED)
```

---

## ৪. Pricing Model (hybrid, per Departure)

দুই ধরনের booking mode একই Departure-এর উপর:

1. **Per-seat booking** — guest ব্যক্তিগতভাবে seat কেনে (per-person rate, cabin হলে cabin-rate)।
2. **Full-charter booking** — একটা group পুরো Departure buyout করে:
   - `fullCharterBasePrice` (covers up to `standardCapacity` guests)
   - `standardCapacity`-র বেশি guest হলে: `(actualGuests - standardCapacity) × extraGuestMarginalRate` add হয়।

দুই mode একসাথে conflict করবে না কারণ একটা Departure হয় per-seat-এ খোলা থাকবে, নয়তো charter হয়ে গেলে বাকি seat বন্ধ হয়ে যাবে (charter booking নিলে Departure পুরোপুরি sold হয়ে যায়)।

---

## ৫. Payment & Cancellation Policy

- **Upfront-heavy payment**: booking-এর সময় বেশিরভাগ টাকা নেওয়া default হওয়া উচিত (যেমন room booking-এর deposit logic থেকে ধার করা যাবে, কিন্তু default percentage বেশি রাখা লাগবে — room-booking-এর deposit % সাধারণত কম হয়)।
- **Weather-cancellation policy: tenant-configurable** — প্রতিটা `VESSEL_BASED` property (বা tenant-level setting) নিজের refund rule সেট করতে পারবে (যেমন: "weather-cancel হলে ১০০% refund", "operator-side cancel হলে ১০০%", "guest-side cancel হলে X দিন আগে হলে Y% refund")। Hardcoded policy চলবে না — settings টেবিলে থাকা লাগবে।

---

## ৬. Staff Roles (নতুন)

Resort-এর existing staff department থেকে আলাদা কিছু role দরকার হতে পারে:
- **Captain / Boat Manager** — voyage-level অপারেশনাল দায়িত্ব (existing `MANAGER` role হয়তো reuse করা যাবে, অথবা নতুন `StaffDepartment` value)।
- **Guide** — tour guide, existing role-এ নেই।
- Housekeeping/kitchen staff থাকবে কিন্তু তাদের কাজের চক্র "per-voyage" হবে, "per-day shift" না — এটা attendance/scheduling logic-এ প্রভাব ফেলবে।

`StaffDepartment` enum-এ সম্ভবত `GUIDE` (এবং দরকার হলে `VESSEL_CREW`) add করা লাগতে পারে।

---

## ৭. Fleet Support (Multi-Property reuse)

- বেশিরভাগ operator-এর ১টা boat → ১টা `VESSEL_BASED` Property।
- ২-৫টা boat থাকা operator-দের জন্য existing multi-property architecture-ই reuse হবে (প্রতিটা boat = আলাদা Property row, একই tenant-এর অধীনে) — নতুন কোনো "Fleet" entity লাগবে না।
- এইখানেই §২-এর Enterprise-gate সমস্যাটা সরাসরি প্রভাব ফেলে: single-boat operator-এর জন্যও একটা Property লাগবে (gate ঠিক করতে হবে), কিন্তু multi-boat operator-দের জন্য gate-টা আসলে অর্থপূর্ণ থেকে যায়।

---

## ৮. Website Differences

Resort website-এ booking widget-এ calendar থাকে (any date pick করা যায়)। Vessel website-এ এটা হবে **departure list**:
- Upcoming departures grid/list (date, duration, remaining seats, price)
- "Book seat" বা "Charter full boat" — দুটো আলাদা CTA
- Fixed date হওয়ায় calendar picker দরকার নেই

---

## ৯. Deferred Scope (এই doc শুধু design — কিছুই build হয়নি নিচের অংশে)

- [ ] Fix Property Enterprise-gate for single-`VESSEL_BASED`-property tenants (§২)
- [ ] `Departure` Prisma model + migration
- [ ] Departure CRUD API (`apps/api/src/routes/departures.ts`)
- [ ] Per-seat booking flow (guest-facing)
- [ ] Full-charter booking flow + marginal pricing calculation
- [ ] Tenant-configurable cancellation/weather-refund policy (new settings table or JSON field)
- [ ] New `StaffDepartment` values (Guide, Vessel Crew) + voyage-cycle scheduling
- [ ] Vessel dashboard UI (`/dashboard/departures` — analog of `/dashboard/calendar`)
- [ ] Vessel-mode website builder (departure list instead of room calendar)
- [ ] Cabin/room-type equivalent for vessels (couple cabin pricing override)

---

## File touched so far

```
packages/database/prisma/schema.prisma                                    (PropertyType enum + Property.type)
packages/database/prisma/migrations/20260728120000_property_business_type/ (new)
apps/api/src/routes/properties.ts                                          (zod schema accepts type)
```

Nothing else. Rest is future work, user's own pace.
