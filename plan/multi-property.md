# Multi-property: one owner view across two to five resorts

Written 2026-09-16. Until now this was sold but never designed: the only
written record was a promise.

> "Manages two to five properties and needs one owner-level view."
> — FOUNDER_CONTEXT.md, on the Resort Group customer

`plan/subscription-plans.md` marks Multi-property ✅ on Resort Group, and
`report.md` lists it among the shipped features. Neither says what it does.

## What "one owner view" means here

**Default is the group.** With no property chosen, every page shows all of
them together, exactly as it does today. A group owner's first question is
"how are we doing", not "how is the Hill doing".

**A picker narrows to one property**, and every page that can honour it does,
so the same screens answer both questions. There is no separate "group
dashboard" to build and maintain, and a single-property resort — nearly
everyone — never sees the picker at all.

## What exists today (verified, 2026-09-16)

- Create up to `propertyLimit` properties; the limit is enforced on create.
- A room can be assigned to a property (`Room.propertyId`, set in RoomModal).
- The Properties page lists them with room counts.
- **Shipped 2026-09-16 (da9a86f):** a property picker in the top bar, hidden
  below two active properties, remembered per tenant, sent to the API as the
  `X-Property-Id` header; the room list and room status counts honour it.

## What does not exist

Every other page still shows all properties mixed: bookings, calendar, front
desk, dashboard, reports, housekeeping, maintenance. A property's own
`checkInTime`, `checkOutTime` and `timezone` are stored and never read —
bookings use the tenant's.

## The shape of the work

Only `Room` carries `propertyId`. Everything else reaches a property **through
a room**, which decides what can be scoped and what cannot:

| Scoped through | Models |
|---|---|
| `propertyId` directly | Room |
| `room.propertyId` | Booking, HousekeepingTask, MaintenanceTicket |
| `booking.room.propertyId` | FoodOrder, Invoice, Payment |
| Nothing today | Staff, Expense, MenuItem, Inventory, Guest |

A room with no property belongs to none: when a property is chosen it drops
out of the list. That is deliberate — it is how an owner finds rooms nobody
has assigned yet.

## Order of work

Each step is one commit, with tests, and is useful on its own.

1. ~~Picker + Rooms~~ — done, da9a86f.
2. **Bookings list.** `room: { propertyId }` in the where clause. Also the
   booking count badges.
3. **Front desk and calendar.** Arrivals, departures, in-house, and the
   calendar's rooms and bookings.
4. **Dashboard.** Occupancy, today's arrivals, revenue tiles.
5. **Reports.** `buildReport` takes a property, and the daily report email
   says which property it covers. This is the one an owner of five resorts
   actually wants.
6. **Housekeeping and maintenance.** Task lists by room's property.
7. **Demo data.** Three properties in the demo tenant with rooms split
   between them, so the feature can be seen without setting it up.

Then, and only then, restore the two claims removed in 77e8451:
"Multi-property owner view" on the Resort Group plan, and the
"Multi-property reporting" comparison row.

## Deliberately not in this plan

- **Per-property staff, expenses, menus and inventory.** None of them have a
  property today, and giving each one raises questions this plan cannot answer
  — does a cook work at one property or the group? Take them one at a time,
  when a customer asks.
- **A property's own check-in time and timezone.** Stored, unused. Honouring
  them changes how every booking is priced and reported across a date
  boundary, so it is its own piece of work with its own tests.
- **Per-property public websites and direct booking.** One site per tenant.
- **Per-property billing or limits.** The plan's room limit is per account.

## How to tell it works

For each step, the same test shape as step 1
(`tests/integration/property-scope-rooms.test.ts`):

- no header → everything, exactly as before;
- a property's id → only its rows;
- another tenant's property id → nothing;
- a malformed header → everything, not an empty page.

The last two matter most. A filter that silently empties a page is worse than
no filter, and a property id is a string from a browser.
