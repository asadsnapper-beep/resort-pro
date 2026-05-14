# Task 01 — Availability Calendar: API Endpoint

**Plan:** [Part 04B](../plan/part-04b-public-website-advanced.md)
**Branch:** `feature/availability-calendar`
**Estimated session:** 1 session
**Dependencies:** None (existing `/site/:slug/availability` already exists)

---

## Context

`apps/api/src/routes/website.ts`-এ `GET /site/:slug/availability` ইতিমধ্যে আছে — এটা specific dates-এ available rooms return করে।

আমাদের দরকার একটি নতুন endpoint যেটা **পুরো মাসের** প্রতিটি দিনের availability summary return করবে। এটা দিয়ে frontend-এ calendar render হবে।

---

## Steps

### ✅ Step 1 — Branch তৈরি করো
```bash
git checkout main
git pull origin main
git checkout -b feature/availability-calendar
```

### ✅ Step 2 — নতুন endpoint যোগ করো

**File:** `apps/api/src/routes/website.ts`

Endpoint: `GET /site/:slug/availability/calendar`

**Query params:**
- `month` → format: `YYYY-MM` (e.g. `2026-01`)
- `roomType` → optional filter (e.g. `SUITE`)

**Response format:**
```json
{
  "success": true,
  "data": {
    "month": "2026-01",
    "totalRooms": 8,
    "days": {
      "2026-01-01": { "available": 5, "total": 8, "status": "partial" },
      "2026-01-02": { "available": 0, "total": 8, "status": "full" },
      "2026-01-15": { "available": 8, "total": 8, "status": "available" }
    }
  }
}
```

**Status logic:**
```
available = 0         → "full"
available = total     → "available"
0 < available < total → "partial"
```

**Implementation logic:**
1. Tenant + rooms fetch করো (where: slug, isActive: true)
2. Month-এর প্রথম থেকে শেষ দিন calculate করো
3. সেই date range-এ সব CONFIRMED + CHECKED_IN booking fetch করো
4. প্রতিটি দিনের জন্য: কতটি room-এ booking আছে count করো
5. `available = totalRooms - bookedRoomsOnThatDay`
6. status assign করো
7. Return করো

### ✅ Step 3 — Existing `/availability` endpoint review করো
Existing endpoint: `GET /site/:slug/availability?checkIn=...&checkOut=...`
এটা ঠিক আছে কিনা দেখো, দরকার হলে ছোট fix করো।

### ✅ Step 4 — Manual test করো

```bash
# API চালু থাকলে:
curl "http://localhost:4000/site/your-resort-slug/availability/calendar?month=2026-05"
```

Response দেখো — সব দিনের data আসছে কিনা।

### ✅ Step 5 — Commit করো

```bash
git add apps/api/src/routes/website.ts
git commit -m "feat: add monthly availability calendar API endpoint"
```

### 🔲 Step 6 — PROGRESS.md update করো

`docs/PROGRESS.md`-এ:
- Current Task → Task 02 (next)
- Session Log-এ entry যোগ করো
- T-01 → Completed তে move করো

### 🔲 Step 7 — Push করো

```bash
git push origin feature/availability-calendar
# branch এখনো main-এ merge করো না — T-02 এই branch-এই হবে
```

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/api/src/routes/website.ts` | নতুন endpoint add |

---

## Test Checklist

- [ ] `?month=2026-05` → সব দিনের data আসে
- [ ] Fully booked দিন → `status: "full"`
- [ ] No bookings দিন → `status: "available"`
- [ ] Partial booking → `status: "partial"`
- [ ] Wrong slug → 404 return করে
- [ ] Wrong month format → 400 return করে

---

## Notes

- এই task শেষ হলে branch delete করো না — Task 02 এই same branch-এ হবে
- Task 02 শেষে একসাথে main-এ merge হবে
