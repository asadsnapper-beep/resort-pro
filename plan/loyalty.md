# Loyalty Program System — ResortPro

> Guest rewards — points earning on checkout, tier progression, redemption as discount. সব কিছু hotel এর নিজস্ব program — no external dependency।

---

## Features

- **Program settings** — enable/disable, points per $1, redemption rate, tier thresholds, program name
- **Member enrollment** — যেকোনো guest কে enroll করা যায়
- **Points award** — manual award (staff) + auto-award on booking checkout (if enabled)
- **Points redeem** — staff manually applies redemption
- **Manual adjustment** — positive/negative adjustment with reason
- **Tier system** — BRONZE → SILVER → GOLD → PLATINUM (lifetime points based)
- **Tier progress bar** — next tier পর্যন্ত কতটুকু বাকি
- **Transaction history** — last 50 transactions per member
- **Leaderboard** — top 10 by lifetime points
- **Tier distribution chart** — % breakdown per tier
- **Member table** — searchable, filterable by tier, paginated

---

## Tier System

| Tier | Default Threshold | Icon |
|------|------------------|------|
| BRONZE | 0 pts (everyone starts here) | 🥉 |
| SILVER | 500 pts lifetime | 🥈 |
| GOLD | 2,000 pts lifetime | 🥇 |
| PLATINUM | 5,000 pts lifetime | 💎 |

Thresholds configurable in Program Settings.

---

## Points Logic

```
Earn:    totalAmount × pointsPerDollar
Redeem:  points ÷ redemptionRate = $ discount
Example: $500 stay × 10 pts/$1 = 5,000 pts
         5,000 pts ÷ 100 = $50 discount
```

---

## API Endpoints

```
GET    /api/loyalty/program                    Get program config (auto-creates if missing)
PATCH  /api/loyalty/program                    Update program settings
GET    /api/loyalty/accounts                   List members (search, tier filter, paginated)
GET    /api/loyalty/accounts/:guestId          Get member details + transactions
POST   /api/loyalty/accounts/:guestId/enroll   Enroll guest → 201
POST   /api/loyalty/accounts/:guestId/award    Award points (staff)
POST   /api/loyalty/accounts/:guestId/redeem   Redeem points
POST   /api/loyalty/accounts/:guestId/adjust   Manual ± adjustment (OWNER/MANAGER)
GET    /api/loyalty/leaderboard                Top 10 by lifetime points
```

---

## Transaction Types

| Type | Description |
|------|-------------|
| `EARN` | Points awarded (booking checkout or manual) |
| `REDEEM` | Points redeemed as discount |
| `ADJUST` | Manual correction (positive or negative) |
| `EXPIRE` | Points expiry (future feature) |

---

## Service Layer

```
apps/api/src/services/loyalty.ts
  awardPoints(tenantId, guestId, points, description, bookingId?)
  redeemPoints(tenantId, guestId, points, description, bookingId?)  ← throws if insufficient
  getOrCreateAccount(tenantId, guestId)
  calcTier(lifetimePoints, prog) → 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
```

---

## File Structure

```
apps/api/src/
  routes/loyalty.ts         ← All endpoints
  services/loyalty.ts       ← Business logic (award, redeem, calcTier)

apps/web/src/app/(dashboard)/dashboard/loyalty/
  page.tsx                  ← LoyaltyPage + ProgramSettingsModal + MemberDrawer
```

---

## উন্নতির সুযোগ (Future)

- [ ] Auto-award on booking checkout (hook into checkout flow)
- [ ] Points expiry (expire if not used in X months)
- [ ] Points balance visible in guest detail sheet
- [ ] Birthday bonus points automation
- [ ] Bulk award (e.g. give 500 pts to all Gold members)
- [ ] Export member list with points balance
- [ ] Points history export per member
- [ ] Redemption voucher generation

---

## Status

সব core feature ✅ live — June 2026

### Bug fixes applied (June 2026)

1. ✅ **`ok(reply, x)` → `ok(x)` — সব 10টা endpoint** — GET program, PATCH program, GET accounts, GET accounts/:guestId (2), POST enroll, POST award, POST redeem, POST adjust, GET leaderboard — সব ঠিক, responses এখন data return করছে।

2. ✅ **POST enroll 201 status** — `ok(reply, account, 201)` → `reply.status(201).send(ok(account))`।

3. ✅ **`GET /accounts` count query search filter missing** — search করলে `total` সব accounts এর count দেখাতো (search filter ছাড়া)। Pagination total ভুল ছিল। Fix: `count({ where })` — same `where` clause as `findMany`।

4. ✅ **Search debounce নেই** — `onChange` সরাসরি query key update করত — প্রতি keystroke এ API call। Fix: `useRef` + 350ms debounce।

5. ✅ **"Points in Circulation" stat misleading** — `totalPoints` শুধু current page (50 records) এর sum দিয়ে compute হচ্ছিল। 200 member থাকলে প্রথম 50 এর sum দেখাত। Replace: Bronze Members count (tier stats থেকে — সব members এর accurate count)।
