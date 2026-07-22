# ResortPro — Global Search Design Brief

**Goal:** A fast, keyboard-friendly command palette that searches across bookings, guests,
rooms, and invoices — without leaving the current page. Feels premium, loads instantly,
closes with Escape.

**Design north star:** *Spotlight / Linear-style.* One keyboard shortcut opens everything.
No separate search page. Results appear inline, grouped by type, navigable with arrow keys.

---

## 1. Trigger

| Method | Action |
|--------|--------|
| Click search bar in top nav | Opens palette |
| `Cmd+K` / `Ctrl+K` | Opens palette from anywhere |
| `Escape` | Closes palette |
| `↑ ↓` arrow keys | Navigate results |
| `Enter` | Go to selected result |

---

## 2. Visual Design

### Overlay
- **Backdrop:** `fixed inset-0 bg-resort-900/40 backdrop-blur-[2px] z-50`
- **Palette box:** centered, `max-w-[580px] w-full mx-4`, `bg-white rounded-2xl shadow-2xl`
- **Top border:** `border-t-[2.5px] border-gold-500` (same signature as dashboard mockup)
- **Animation:** fade-in + slight scale-up (`opacity-0 scale-[0.97]` → `opacity-1 scale-100`, `duration-150`)

### Search input (inside palette)
```
h-14 px-4
├── Search icon (left, resort-600, 18px)
├── Input (flex-1, text-[15px], placeholder: "Search bookings, guests, rooms…")
├── Kbd hint: ⌘K (right, text-xs, bg-gray-100 rounded px-1.5)
└── Border-bottom: 0.5px border-resort-900/10
```

### Results area
- `max-h-[400px] overflow-y-auto py-2`
- Grouped by category with a small group label

### Group label
```
px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] font-semibold text-[#8fa8a1]
```

### Result item
```
flex items-center gap-3 px-4 py-2.5 cursor-pointer
├── Icon (18px, in colored circle 32px)
├── Main label (text-[13.5px] font-medium text-resort-900)
├── Sub label (text-[12px] text-gray-400)
└── Right badge (status chip — same style as bookings list)

hover / keyboard-selected: bg-resort-50
active: bg-resort-100
```

### Empty state
```
px-4 py-8 text-center
├── Icon: ti-search (32px, text-gray-300)
├── "No results for "…"" (text-sm text-gray-500)
└── "Try: guest name, room number, booking ID" (text-xs text-gray-400)
```

### Loading state
- 3 skeleton rows (`animate-pulse bg-gray-100 rounded-lg h-10 mx-4`)

---

## 3. Search Categories & Icons

| Category | Icon | Color | Fields searched |
|----------|------|-------|-----------------|
| Bookings | `ti-calendar` | `bg-resort-50 text-resort-600` | Confirmation no, guest name, room |
| Guests | `ti-user` | `bg-blue-50 text-blue-600` | Name, phone, email |
| Rooms | `ti-bed` | `bg-amber-50 text-amber-600` | Room number, name, type |
| Invoices | `ti-file-text` | `bg-purple-50 text-purple-600` | Invoice no, guest name |

Max **3 results per category**, max **12 total**.

---

## 4. Result Item Examples

**Booking:**
```
🗓 [resort icon]  RP-A1B2-XXXXXX          →  Room 101 · Tanvir Rahman
                  Check-in: 20 Jun          [Checked In] badge
```

**Guest:**
```
👤 [blue icon]   Farhana Karim            →  +8801XXXXXXXXX
                 3 stays · Gold member
```

**Room:**
```
🛏 [amber icon]  Room 205 — Deluxe Sea View  →  [Available] badge
                 2nd floor · King bed
```

---

## 5. API Endpoint

**`GET /api/search?q=:query&limit=12`**

Returns:
```json
{
  "bookings": [{ "id", "confirmationNo", "guestName", "roomNumber", "status", "checkIn" }],
  "guests":   [{ "id", "firstName", "lastName", "phone", "stayCount", "loyaltyTier" }],
  "rooms":    [{ "id", "number", "name", "type", "status" }],
  "invoices": [{ "id", "invoiceNumber", "guestName", "total", "status" }]
}
```

- Minimum query length: **2 characters**
- Debounce: **250ms** before API call
- Auth: tenant-scoped (uses `request.db`)
- DB: `ILIKE %query%` on relevant fields, `LIMIT 3` per model

---

## 6. Files to Create / Change

| File | Change |
|------|--------|
| `components/dashboard/GlobalSearch.tsx` | NEW — palette component |
| `components/dashboard/top-nav.tsx` | Replace static input with `<GlobalSearch />` trigger |
| `app/(dashboard)/layout.tsx` | Add `Cmd+K` keyboard listener |
| `apps/api/src/routes/search.ts` | NEW — `/api/search` endpoint |
| `apps/api/src/index.ts` | Register search route |

---

## 7. Build Order

1. **API route** (`search.ts`) — ILIKE queries, grouped response
2. **GlobalSearch component** — palette UI, keyboard nav, debounced fetch
3. **Wire into top-nav** — replace static input
4. **Cmd+K shortcut** — global keydown listener in layout
5. **Test:** type 2+ chars → results appear → arrow nav → Enter navigates
