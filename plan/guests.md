# Guests System — ResortPro

> Guest profile management — name, contact, nationality, ID, booking history, documents.

---

## Features

- **Guest list** — paginated (20/page), search by name/email, total count
- **Guest detail sheet** — right drawer with contact info, ID, notes, booking history, documents
- **Add / Edit modal** — react-hook-form + zod validation, all fields
- **Delete with confirmation** — modal confirm before delete
- **Document management** — `GuestDocumentList` + `DocumentScannerModal` (passport scan, etc.)
- **Booking history** — last 10 bookings with status badge, room name, dates, amount
- **Stats strip** — Total Guests (from API total), With Phone, Nationalities (from current page)

---

## API Endpoints

```
GET    /api/guests                  List (paginated, search)
GET    /api/guests/:id              Get one (with last 10 bookings)
POST   /api/guests                  Create (409 if email already exists)
PATCH  /api/guests/:id              Update (409 if new email conflicts)
DELETE /api/guests/:id              Delete (409 if active bookings exist)
```

---

## Search

Searches across: `firstName`, `lastName`, `email` (case-insensitive contains).

---

## File Structure

```
apps/api/src/routes/
  guests.ts                ← CRUD + booking-check on delete

apps/web/src/
  app/(dashboard)/dashboard/guests/
    page.tsx               ← GuestsPage (list + pagination + modals)

  components/guests/
    GuestModal.tsx         ← Add / Edit form (react-hook-form + zod)
    GuestDetailSheet.tsx   ← Right-drawer detail panel
    GuestDocumentList.tsx  ← Document list + upload
    DocumentScannerModal.tsx ← ID scan / upload modal
```

---

## Guest Model Fields

| Field | Type | Notes |
|-------|------|-------|
| firstName, lastName | string | required |
| email | string | unique per tenant |
| phone | string? | optional |
| nationality | string? | optional |
| idType | enum? | PASSPORT / NATIONAL_ID / DRIVERS_LICENSE / OTHER |
| idNumber | string? | optional |
| address | string? | optional |
| notes | string? | internal staff notes |

---

## উন্নতির সুযোগ (Future)

- [ ] Phone number search (add `phone` to OR filter in API)
- [ ] Stats (With Phone, Nationalities) from full dataset, not just current page
- [ ] Loyalty points display in detail sheet
- [ ] Guest merge (duplicate profiles)
- [ ] VIP / blacklist flag
- [ ] Export guest list as CSV
- [ ] Birthday / anniversary reminders

---

## Status

সব core feature ✅ live — June 2026

### Bug fixes applied (June 2026)

1. ✅ **DELETE active guest — orphan risk** — API তে কোনো check ছিল না। CONFIRMED / CHECKED_IN / PENDING bookings থাকলে এখন 409 error দেয়: `"Cannot delete guest — they have N active bookings. Check out or cancel their bookings first."`

2. ✅ **PATCH email uniqueness check** — Email পরিবর্তন করলে duplicate check হচ্ছিল না — Prisma unique constraint error raw হয়ে আসত। এখন: নতুন email অন্য guest এর সাথে conflict করলে 409 error।

3. ✅ **Debounce broken — `let` in component body** — `let debounceTimer` প্রতি render এ নতুন variable তৈরি করে — `clearTimeout` কিছুই clear করতো না। প্রতিটা keystroke এ search API call হচ্ছিল। Fixed: `useRef` ব্যবহার করা হয়েছে।

4. ✅ **React key collision in contact list** — `GuestDetailSheet` এ contact rows `key={label}` ছিল। phone/address/nationality সব null হলে তিনটা row `key="—"` পায় — React reconciliation bug। Fixed: stable keys (`'email'`, `'phone'`, `'address'`, `'nationality'`)।

5. ✅ **Delete error message** — Frontend এ generic "Failed to delete" দেখাতো। এখন API এর specific error message দেখায় (active bookings count সহ)।
