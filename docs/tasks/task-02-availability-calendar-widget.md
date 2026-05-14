# Task 02 — Availability Calendar: Frontend Widget

**Plan:** [Part 04B](../plan/part-04b-public-website-advanced.md)
**Branch:** `feature/availability-calendar` (Task 01-এর same branch)
**Estimated session:** 1 session
**Dependencies:** Task 01 must be complete ✅

---

## Context

Task 01-এ API endpoint তৈরি হয়েছে।
এই task-এ frontend `AvailabilityCalendar` widget বানানো হবে এবং existing `LuxeTemplate`-এ inject করা হবে।

Widget location: `apps/web/src/components/themes/_widgets/AvailabilityCalendar.tsx`

---

## Steps

### 🔲 Step 1 — Widget folder তৈরি করো

```bash
mkdir -p apps/web/src/components/themes/_widgets
```

### 🔲 Step 2 — AvailabilityCalendar component বানাও

**File:** `apps/web/src/components/themes/_widgets/AvailabilityCalendar.tsx`

**Component props:**
```typescript
interface AvailabilityCalendarProps {
  slug: string
  primaryColor: string
  accentColor: string
  currency: string
  onRoomSelect?: (room: Room, checkIn: Date, checkOut: Date) => void
}
```

**UI Elements:**
```
┌─────────────────────────────────────────┐
│  ← January 2026                      → │
├─────────────────────────────────────────┤
│  Su  Mo  Tu  We  Th  Fr  Sa            │
│  [●] [●] [◐] [○] [○] [●] [●]          │
│  ...                                    │
├─────────────────────────────────────────┤
│  Legend: ● Available  ◐ Partial  ○ Full │
└─────────────────────────────────────────┘

(Check-in / Check-out select হলে:)
┌─────────────────────────────────────────┐
│  Available Rooms (3)                    │
│  ┌──────────────────────┐               │
│  │ Deluxe Room · $150/n │  [Book Now]  │
│  └──────────────────────┘               │
└─────────────────────────────────────────┘
```

**State:**
```typescript
const [currentMonth, setCurrentMonth] = useState(new Date())
const [checkIn, setCheckIn] = useState<Date | null>(null)
const [checkOut, setCheckOut] = useState<Date | null>(null)
const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
const [availableRooms, setAvailableRooms] = useState<Room[]>([])
const [loading, setLoading] = useState(false)
const [selectingCheckOut, setSelectingCheckOut] = useState(false)
```

**API calls:**
```typescript
// Month change হলে:
GET /site/:slug/availability/calendar?month=YYYY-MM

// Check-in + check-out select হলে:
GET /site/:slug/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
```

**Day click logic:**
```
First click  → checkIn set, selectingCheckOut = true
Second click → checkOut set (must be after checkIn)
             → availability API call
             → available rooms দেখায়
Third click (or new date) → reset করো
```

**Color coding:**
```typescript
const dayColor = {
  available: primaryColor,      // green/primary
  partial: '#f59e0b',           // amber
  full: '#ef4444',              // red
  past: '#9ca3af',              // gray (disabled)
  selected: accentColor,        // selected range
}
```

### 🔲 Step 3 — LuxeTemplate-এ inject করো

**File:** `apps/web/src/components/templates/LuxeTemplate.tsx`

Booking section-এর আগে `<AvailabilityCalendar>` যোগ করো।

```tsx
import { AvailabilityCalendar } from '../themes/_widgets/AvailabilityCalendar'

// Booking section-এর আগে:
<section id="availability" className="py-20 bg-stone-50">
  <div className="max-w-4xl mx-auto px-6">
    <h2 className="text-3xl font-serif text-center mb-3">Check Availability</h2>
    <p className="text-center text-gray-500 mb-10">Select your dates to see available rooms</p>
    <AvailabilityCalendar
      slug={data.tenant.slug}
      primaryColor={data.website?.primaryColor ?? '#1a6b5e'}
      accentColor={data.website?.accentColor ?? '#d4a853'}
      currency={data.tenant.currency}
      onRoomSelect={(room, checkIn, checkOut) => {
        // Booking form scroll + pre-fill
        setSelectedRoom(room.id)
        setBookingDates({ checkIn, checkOut })
        document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
      }}
    />
  </div>
</section>
```

### 🔲 Step 4 — BookingForm-এ pre-fill support যোগ করো

LuxeTemplate-এর existing booking form-এ `initialRoom` + `initialDates` props যোগ করো যাতে Calendar থেকে select করলে form auto-fill হয়।

### 🔲 Step 5 — Test করো

```bash
pnpm --filter web dev
# Browser: http://localhost:3000/your-resort-slug
```

Test করো:
- Calendar দেখা যাচ্ছে
- Month navigation কাজ করছে
- Date select করলে color change হচ্ছে
- Available rooms list আসছে
- "Book Now" click করলে booking form-এ যাচ্ছে

### 🔲 Step 6 — Commit করো

```bash
git add apps/web/src/components/themes/_widgets/AvailabilityCalendar.tsx
git add apps/web/src/components/templates/LuxeTemplate.tsx
git commit -m "feat: availability calendar widget + LuxeTemplate integration"
```

### 🔲 Step 7 — Main-এ merge করো

```bash
git checkout main
git pull origin main
git merge feature/availability-calendar
git push origin main
git branch -d feature/availability-calendar
git push origin --delete feature/availability-calendar
```

### 🔲 Step 8 — PROGRESS.md update করো

- T-01, T-02 → Completed
- Current Task → T-03
- Session Log update

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/web/src/components/themes/_widgets/AvailabilityCalendar.tsx` | নতুন তৈরি |
| `apps/web/src/components/templates/LuxeTemplate.tsx` | Calendar inject |

---

## Test Checklist

- [ ] Calendar render হচ্ছে
- [ ] Available days → primary color
- [ ] Partial days → amber
- [ ] Full days → red + click disabled
- [ ] Past days → gray + click disabled
- [ ] Check-in select → check-out mode on
- [ ] Check-out select → rooms list আসছে
- [ ] "Book Now" → booking form scroll হচ্ছে + room pre-selected
- [ ] Month prev/next → নতুন data load হচ্ছে
- [ ] Mobile-এ ঠিক দেখাচ্ছে
