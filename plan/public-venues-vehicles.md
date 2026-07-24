# ResortPro — Venues & Vehicle Rental on the Public Website

## Why this is missing

Venues (`plan/event-venue.md`) and Vehicle Rental (`plan/vehicle-rental.md`) were both built dashboard-only — the public resort website (`/[slug]`, theme-driven) currently only ever fetches `tenant + website content + rooms` from `GET /site/:slug`. No Packages, Offers, Venues, or Vehicles show up publicly at all right now — this isn't unique to Venues/Vehicles, it's a general gap, but you specifically asked about these two.

## The pattern that already exists (Menu)

The Restaurant menu already solves this exact problem the right way: `MenuWidget` is a **self-fetching client component** — it calls `GET /site/:slug/menu` on its own, renders nothing if the list is empty, and is plugged into each theme as an optional section (hidden via `website.hiddenSections`). I'll copy this pattern exactly instead of bloating the main `/site/:slug` payload.

---

## ১. Public API (new, in `apps/api/src/routes/website.ts`)

```
GET  /site/:slug/venues              Active venues — name, type, capacity, rates
GET  /site/:slug/vehicles            Available vehicles — name, type, hourly/daily rate
POST /site/:slug/venue-enquiry       Guest submits a date + message
POST /site/:slug/vehicle-enquiry     Guest submits a date range + message
```

No self-service payment/booking from the public site (matches the decision already made in `event-venue.md` — "Public website enquiry form not included yet"). Enquiries create a `SupportTicket` (category REQUEST) — reuses the exact mechanism `/site/:slug/feedback` already uses, so it shows up in the owner's existing Support/Tickets inbox with zero new notification plumbing.

---

## ২. Two new widgets (`_widgets/VenuesWidget.tsx`, `_widgets/VehiclesWidget.tsx`)

Same shape as `MenuWidget`:
```
Guest scrolls to "Venues & Events" / "Vehicle Rental" section on the website
  → grid of cards (name, capacity/type, rate)
  → "Enquire" button → small form (name, phone/email, preferred date, message)
  → POST enquiry → confirmation state ("We'll get back to you shortly")

Section self-hides entirely if the resort has no active venues/vehicles —
no empty section ever shows on a resort that doesn't offer these.
```

---

## ৩. Wire into all themes

```
apps/web/src/components/themes/coastal/index.tsx
apps/web/src/components/themes/luxe/index.tsx
apps/web/src/components/themes/minimal/index.tsx
apps/web/src/components/themes/tea-garden-eco-resort/index.tsx
apps/web/src/components/themes/config-renderer.tsx   ← uploaded/AI themes
```

Each gets two new optional section entries (`venues`, `vehicles`) in its existing
`hiddenSections`-controlled section map — same mechanism `menu`/`gallery`/`testimonials`
already use, so owners can toggle them off from the website editor like everything else.

---

## File Structure

```
apps/api/src/routes/website.ts                                     (extended)
apps/web/src/components/themes/_widgets/VenuesWidget.tsx            (new)
apps/web/src/components/themes/_widgets/VehiclesWidget.tsx          (new)
apps/web/src/components/themes/{coastal,luxe,minimal,tea-garden-eco-resort}/index.tsx  (extended)
apps/web/src/components/themes/config-renderer.tsx                  (extended)
```
