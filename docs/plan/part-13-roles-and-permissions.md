# Part 13 — Roles & Permissions System

> **Status:** Planning  
> **Last updated:** 2026-06-14  
> **Author:** Resort Owner + Claude discussion

---

## Overview

ResortPro has **two separate role systems** that must never be mixed:

1. **Super Admin Layer** — ResortPro এর নিজের internal team (SaaS চালানোর জন্য)
2. **Resort Layer** — Resort owner এবং তাদের staff (B2B customer দের জন্য)

---

## Layer 1 — Super Admin Roles

ResortPro platform চালানোর জন্য internal team। এরা resort owner না — এরা SaaS এর owner এর team।

| Role | কে হবে | কী করতে পারবে |
|------|--------|--------------|
| **Owner** | Platform owner (তুমি) | সব কিছু — tenant delete, billing override, system config, যেকোনো কিছু |
| **Developer** | Technical team member | Logs দেখা, tenant debug, feature test। Billing বা business decision নয় |
| **Support Agent** | Customer support | Resort owner এর account দেখা, data verify। Delete বা billing change করতে পারবে না |
| **Sales** | Business development team | Demo account বানানো, trial extend, resort onboard। System config ছুঁতে পারবে না |
| **Finance** | Accountant | Subscription, MRR, churn, invoice দেখবে। Tenant data বা technical কিছু দেখবে না |

### Super Admin — Important Rules
- Owner role শুধু একজনের (platform owner)
- প্রতিটা action log হবে (কে কী করল, কখন)
- Support Agent resort এর data read করতে পারবে কিন্তু modify করতে পারবে না
- Sales demo account বানাতে পারবে কিন্তু real tenant এর data ছুঁতে পারবে না

---

## Layer 2 — Resort Roles

Resort owner যখন ResortPro তে sign up করে, সে তার staff কে invite করে। এই staff রা resort এর employee।

### Management

| Role | কে হবে | সংক্ষিপ্ত বিবরণ |
|------|--------|-----------------|
| **Owner** | Resort মালিক | সব কিছুর সম্পূর্ণ access। Staff hire/fire, financial report, সব department |
| **General Manager** | GM বা Deputy Manager | প্রায় owner এর মতো। Billing ছাড়া সব। Delete/modify এ log বাধ্যতামূলক |
| **Shareholder** | Investor বা co-owner (non-operational) | শুধু revenue, occupancy, profit দেখবে। কিছু করতে পারবে না — সম্পূর্ণ read-only |

### Front Office

| Role | কে হবে | সংক্ষিপ্ত বিবরণ |
|------|--------|-----------------|
| **Receptionist** | Front desk staff | Check-in, check-out, booking, guest management, invoice print। Room add/delete করতে পারবে না |
| **Reservation Agent** | Booking agent (বড় resort এ) | শুধু booking manage — availability, modify, cancel। Financial বা operational কিছু নয় |

### Food & Beverage

| Role | কে হবে | সংক্ষিপ্ত বিবরণ |
|------|--------|-----------------|
| **F&B Manager** | Restaurant manager | Menu manage, food order দেখা, daily F&B sales। Chef কে assign করবে |
| **Chef** | Head chef বা kitchen staff | Kitchen Display দেখবে, order status update করবে, menu item add করতে পারবে। Pricing বা billing দেখবে না |
| **Waiter / Server** | Table service staff | Order নেবে, system এ enter করবে। Kitchen এ চলে যাবে। Order status দেখতে পারবে |

### Housekeeping

| Role | কে হবে | সংক্ষিপ্ত বিবরণ |
|------|--------|-----------------|
| **Housekeeping Manager** | Housekeeping supervisor | সব room এর cleaning status, staff কে task assign, schedule বানানো |
| **Housekeeping Staff** | Room attendant | শুধু নিজের assigned task দেখবে। Done করবে। অন্য কিছু দেখবে না |

### Maintenance

| Role | কে হবে | সংক্ষিপ্ত বিবরণ |
|------|--------|-----------------|
| **Maintenance Manager** | Maintenance supervisor | সব maintenance request দেখবে, staff assign করবে |
| **Maintenance Staff** | Technician | নিজের assigned job দেখবে। Complete করলে done করবে। Photo upload করতে পারবে (proof) |

### Finance

| Role | কে হবে | সংক্ষিপ্ত বিবরণ |
|------|--------|-----------------|
| **Accountant** | Finance team | Invoice, expense, payroll দেখবে। Report download করতে পারবে। Booking বা operation এ হাত দেবে না |

### Sales & Marketing

| Role | কে হবে | সংক্ষিপ্ত বিবরণ |
|------|--------|-----------------|
| **Marketing Manager** | Marketing team | Promotion, offer, package বানাবে। Occupancy trend ও guest review দেখবে |

---

## Permission Rules (সার কথা)

### Delete এবং Modify এর নিয়ম
- **Owner** — সব কিছু delete/modify করতে পারবে, log optional
- **General Manager** — delete/modify করতে পারবে কিন্তু **সব action log বাধ্যতামূলক**
- **বাকি সব role** — delete করতে পারবে না। Modify শুধু নিজের কাজের মধ্যে

### Shareholder এর নিয়ম
- সম্পূর্ণ read-only
- শুধু দেখবে: Revenue, Occupancy, Profit, Booking trends
- কোনো button click করতে পারবে না যেটা data change করে

### Chef এর Kitchen Display
- Login করলে সরাসরি Kitchen Display এ যাবে
- ৩টা column: **New Order → Preparing → Ready for Delivery**
- Order status update করতে পারবে
- Menu item add করতে পারবে (owner/manager approve করবে অথবা সরাসরি add হবে — decide করতে হবে)
- Pricing দেখবে না

### Housekeeping Staff এর নিয়ম
- Login করলে শুধু নিজের task list দেখবে
- Room number আর task type দেখবে — guest name বা booking detail নয়
- শুধু Done করতে পারবে

### Waiter/Server এর নিয়ম
- Order নেবে এবং submit করবে
- Kitchen এ automatically চলে যাবে
- Order status track করতে পারবে (ready হলে deliver করবে)
- Menu edit করতে পারবে না, payment নেবে না

---

## Staff Management (Resort Owner এর জন্য)

Resort owner তার staff কে manage করবে একটা dedicated section থেকে:

1. **Invite by email** — email দিলে invitation যাবে
2. **Role assign** — invite করার সময় role বেছে দেবে
3. **Role change** — পরে role পরিবর্তন করতে পারবে
4. **Deactivate** — access বন্ধ করতে পারবে (record মুছবে না)
5. **Activity log** — কে কী করল দেখতে পারবে (Manager এর জন্য বিশেষভাবে)

---

## Kitchen Display — বিস্তারিত

Chef এর জন্য আলাদা, clean UI:

```
┌─────────────────────────────────────────────────────┐
│  🍽️  Kitchen Display          [🕐 14:32]  [🔔]      │
├──────────────┬──────────────────┬────────────────────┤
│  NEW ORDER   │   PREPARING      │  READY TO DELIVER  │
│              │                  │                    │
│  [Order #42] │  [Order #39]     │  [Order #35]       │
│  Table 4     │  Table 2         │  Room 101          │
│  2x Pasta    │  1x Steak        │  1x Burger         │
│  1x Soup     │  2x Salad        │  3x Fries          │
│  [Start ▶]  │  [Ready ✓]      │  [Delivered ✓]    │
└──────────────┴──────────────────┴────────────────────┘
```

- Auto-refresh (15 seconds)
- Bell alert নতুন order এলে
- আজকের orders শুধু
- বড় font, dark background — kitchen এর জন্য readable

---

## Phase Plan — কোনটা আগে কোনটা পরে

### Phase 1 (এখনই দরকার)
- Owner, General Manager, Shareholder
- Receptionist
- Chef (Kitchen Display)
- Housekeeping Staff

### Phase 2 (পরে)
- Waiter/Server
- Housekeeping Manager
- Maintenance Staff, Maintenance Manager
- Accountant
- F&B Manager

### Phase 3 (বড় resort এর জন্য)
- Reservation Agent
- Marketing Manager

---

## Open Questions (এখনো decide হয়নি)

1. Chef কি menu item সরাসরি add করতে পারবে, নাকি Owner/Manager approve করবে?
2. General Manager এর log — শুধু delete এ নাকি সব modify তেও?
3. Waiter কি payment নিতে পারবে নাকি শুধু Receptionist?
4. Shareholder কি mobile app এ শুধু দেখবে নাকি web dashboard ও?
5. Staff deactivate করলে তার পুরনো task/booking record কে দেখবে?
