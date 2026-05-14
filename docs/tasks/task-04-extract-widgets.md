# Task 04 — Extract Shared Widgets from LuxeTemplate

**Plan:** [Part 04B](../plan/part-04b-public-website-advanced.md)
**Branch:** `feature/theme-system` (Task 03-এর same branch)
**Estimated session:** 1 session
**Dependencies:** Task 03 ✅

---

## Context

LuxeTemplate-এ এখন BookingForm, RestaurantMenu, ContactForm সরাসরি embedded। এই task-এ এগুলোকে shared `_widgets/` folder-এ extract করা হবে যাতে যেকোনো নতুন theme এগুলো import করে use করতে পারে।

Widget pattern: সব widget `WidgetProps` interface extend করবে।

---

## Steps

### 🔲 Step 1 — BookingForm widget extract করো

**Source:** `apps/web/src/components/templates/LuxeTemplate.tsx` (booking section)
**Target:** `apps/web/src/components/themes/_widgets/BookingForm.tsx`

```typescript
'use client'
import { WidgetProps } from '../types'

interface BookingFormProps extends WidgetProps {
  initialRoomId?: string
  initialCheckIn?: Date
  initialCheckOut?: Date
}

export function BookingForm({ slug, primaryColor, accentColor, currency, initialRoomId, initialCheckIn, initialCheckOut }: BookingFormProps) {
  // LuxeTemplate থেকে booking form logic move করো
  // State: guestName, guestEmail, guestPhone, roomId, checkIn, checkOut, adults, children, notes
  // API: POST /site/:slug/bookings
  // Success: confirmation message দেখাও
}
```

### 🔲 Step 2 — MenuWidget extract করো

**Target:** `apps/web/src/components/themes/_widgets/MenuWidget.tsx`

```typescript
'use client'
import { WidgetProps } from '../types'

interface MenuWidgetProps extends WidgetProps {
  // No extra props needed
}

export function MenuWidget({ slug, primaryColor, accentColor, currency }: MenuWidgetProps) {
  // LuxeTemplate থেকে restaurant menu section move করো
  // API: GET /site/:slug/menu
  // Categories, items, prices দেখাও
}
```

### 🔲 Step 3 — ContactForm widget extract করো

**Target:** `apps/web/src/components/themes/_widgets/ContactForm.tsx`

```typescript
'use client'
import { WidgetProps } from '../types'

export function ContactForm({ slug, primaryColor, accentColor }: WidgetProps) {
  // Contact/inquiry form
  // Fields: name, email, phone, message, arrival date (optional)
  // API: POST /site/:slug/contact (যদি না থাকে stub করো)
}
```

### 🔲 Step 4 — Widgets index file বানাও

**File:** `apps/web/src/components/themes/_widgets/index.ts`

```typescript
export { AvailabilityCalendar } from './AvailabilityCalendar'
export { BookingForm } from './BookingForm'
export { MenuWidget } from './MenuWidget'
export { ContactForm } from './ContactForm'
```

### 🔲 Step 5 — LuxeTemplate update করো

LuxeTemplate-এ embedded code সরিয়ে widget import করো:

```tsx
import { BookingForm, MenuWidget, ContactForm } from '../themes/_widgets'

// Booking section:
<BookingForm
  slug={data.tenant.slug}
  primaryColor={data.website?.primaryColor ?? '#1a6b5e'}
  accentColor={data.website?.accentColor ?? '#d4a853'}
  currency={data.tenant.currency}
  initialRoomId={selectedRoomId}
  initialCheckIn={bookingDates?.checkIn}
  initialCheckOut={bookingDates?.checkOut}
/>

// Menu section:
<MenuWidget
  slug={data.tenant.slug}
  primaryColor={data.website?.primaryColor ?? '#1a6b5e'}
  accentColor={data.website?.accentColor ?? '#d4a853'}
  currency={data.tenant.currency}
/>

// Contact section:
<ContactForm
  slug={data.tenant.slug}
  primaryColor={data.website?.primaryColor ?? '#1a6b5e'}
  accentColor={data.website?.accentColor ?? '#d4a853'}
  currency={data.tenant.currency}
/>
```

### 🔲 Step 6 — Test করো

```bash
pnpm --filter web dev
# Resort website সব section ঠিকমতো কাজ করছে কিনা check করো
# Booking form submit করো (test resort)
# Menu দেখা যাচ্ছে কিনা
```

### 🔲 Step 7 — Commit করো

```bash
git add apps/web/src/components/themes/_widgets/
git add apps/web/src/components/templates/LuxeTemplate.tsx
git commit -m "feat: extract BookingForm, MenuWidget, ContactForm into shared _widgets/"
```

### 🔲 Step 8 — PROGRESS.md update করো

- T-04 → Completed
- Current Task → T-05

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/web/src/components/themes/_widgets/BookingForm.tsx` | নতুন তৈরি (extracted) |
| `apps/web/src/components/themes/_widgets/MenuWidget.tsx` | নতুন তৈরি (extracted) |
| `apps/web/src/components/themes/_widgets/ContactForm.tsx` | নতুন তৈরি (extracted) |
| `apps/web/src/components/themes/_widgets/index.ts` | নতুন তৈরি |
| `apps/web/src/components/templates/LuxeTemplate.tsx` | Widgets দিয়ে replace |

---

## Test Checklist

- [ ] Booking form কাজ করছে (submit → API call → success message)
- [ ] Restaurant menu load হচ্ছে
- [ ] Contact form submit হচ্ছে
- [ ] LuxeTemplate আগের মতো দেখাচ্ছে (visual regression নেই)
- [ ] TypeScript error নেই
- [ ] Mobile-এ widgets ঠিক দেখাচ্ছে
