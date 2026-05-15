# Task 38 — Guest Loyalty Program

**Branch:** `feature/guest-loyalty`
**Priority:** 🟢 Nice to Have
**Estimate:** 0.5 day

---

## Goal
Repeat guest reward system। Return করলে discount পাবে — guest ধরে রাখার tool।

---

## Tiers
| Tier | Visits | Discount |
|------|--------|---------|
| — | 1-2 | 0% |
| Silver | 3-6 | 5% |
| Gold | 7-14 | 10% |
| Platinum | 15+ | 15% |

---

## Prisma Changes

```prisma
model Guest {
  // add:
  loyaltyTier   String?   // SILVER | GOLD | PLATINUM
  totalVisits   Int       @default(0)
  totalSpend    Float     @default(0)
}
```

---

## Steps

### Step 1 — Auto-update on checkout
When booking → `checked_out`: increment `guest.totalVisits`, add to `guest.totalSpend`, recalculate tier।

### Step 2 — Guest profile UI
Show loyalty tier badge (Silver 🥈 / Gold 🥇 / Platinum 💎) on guest profile and guest list।

### Step 3 — Booking create
When selecting a returning guest → show loyalty tier + discount। Apply discount to booking total।

---

## Acceptance Criteria
- [ ] Tier auto-updates on checkout
- [ ] Badge shows on guest profile
- [ ] Discount applied in booking creation
- [ ] Total visits + spend tracked accurately
