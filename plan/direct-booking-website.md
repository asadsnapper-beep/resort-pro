# Direct Booking Website Plan

## Overview
ResortPro already has a public website builder (`/dashboard/website`) and a public-facing site at `/:slug` (or custom domain). The goal is to turn this into a **fully functional direct booking engine** — so guests can search availability, see real-time pricing (with rate plans), select rooms, add packages, and pay online — all without going through Booking.com or Airbnb (saving 15%+ commission).

**Existing foundation:**
- `WebsiteContent` model (hero, tagline, gallery, amenities, testimonials)
- Public routes: `/site/:slug`, `/site/:slug/rooms`, `/site/:slug/rate`
- Custom domain support (SSL via Let's Encrypt)

---

## Goals

| Goal | Metric |
|------|--------|
| Zero-commission bookings | Guests book direct → no OTA fee |
| Real-time availability | Calendar shows blocked/available live |
| Dynamic pricing | Rate plans auto-apply (PROMO, WEEKEND, SEASONAL) |
| Package upsell | Guests add honeymoon/spa packages at checkout |
| Online payment | Stripe payment at time of booking |
| Loyalty enrolment | Direct bookers auto-enroll + earn points |
| SEO-optimised | Google indexes room pages for "resort name + book" |

---

## Phase 1 — Availability Search & Room Listing (2–3 weeks)

### New public routes

| Route | Description |
|-------|-------------|
| `/site/:slug` | Landing page (already exists, enhance) |
| `/site/:slug/book` | Booking engine entry — date picker + guest count |
| `/site/:slug/rooms` | Available rooms for selected dates |
| `/site/:slug/rooms/:roomId` | Room detail page |
| `/site/:slug/book/:roomId` | Booking checkout for one room |
| `/site/:slug/confirmation/:confirmationNo` | Post-booking confirmation page |
| `/site/:slug/my-booking` | Guest self-service (view / cancel) |

### New API routes (public, no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/site/:slug/availability?checkIn&checkOut&guests` | Available rooms with resolved rates |
| GET | `/site/:slug/rooms/:roomId` | Room detail + images + amenities |
| GET | `/site/:slug/packages` | Active packages for upsell |
| POST | `/site/:slug/bookings` | Create booking + payment intent |
| GET | `/site/:slug/booking/:confirmationNo` | Guest retrieves their booking |
| POST | `/site/:slug/booking/:confirmationNo/cancel` | Guest self-cancels |

### Availability search logic
```typescript
// GET /site/:slug/availability
async function getAvailableRooms(slug, checkIn, checkOut, guests) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });

  // Get rooms not booked in this period
  const bookedRoomIds = await prisma.booking.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkIn: { lt: new Date(checkOut) },
      checkOut: { gt: new Date(checkIn) },
    },
    select: { roomId: true },
  });

  const availableRooms = await prisma.room.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      status: { in: ['AVAILABLE', 'RESERVED'] },
      id: { notIn: bookedRoomIds.map(b => b.roomId) },
      maxOccupancy: { gte: guests },
    },
    include: { ratePlans: true },
  });

  // Apply rate plans to each room
  return Promise.all(availableRooms.map(async (room) => ({
    ...room,
    resolvedRate: await resolveRate(tenant.id, room.id, checkIn, checkOut),
  })));
}
```

---

## Phase 2 — Booking Checkout with Stripe (2–3 weeks)

### Booking flow on public site

```
Step 1: Date picker + guest count
Step 2: Browse available rooms (with resolved price)
Step 3: Select room → add packages (optional)
Step 4: Enter guest details (name, email, phone)
Step 5: Special requests
Step 6: Payment — Stripe Elements (card) or "Pay at Hotel"
Step 7: Confirmation page + email
```

### Payment options

| Option | How | When to use |
|--------|-----|------------|
| **Pay Now (full)** | Stripe PaymentIntent at checkout | Guarantees booking |
| **Pay Deposit** | Stripe for % of total (e.g. 30%) | Flexible bookings |
| **Pay at Hotel** | No Stripe, booking PENDING until check-in | Low-risk option |

### Stripe integration for public booking
```typescript
// POST /site/:slug/bookings
async function createDirectBooking(slug, body) {
  const { roomId, checkIn, checkOut, guest, paymentOption, packageIds } = body;

  // 1. Validate availability (re-check to prevent race condition)
  await assertRoomAvailable(tenantId, roomId, checkIn, checkOut);

  // 2. Resolve price
  const rate = await resolveRate(tenantId, roomId, checkIn, checkOut);
  const nights = calcNights(checkIn, checkOut);
  let total = rate.price * nights;

  // 3. Add packages
  for (const pkgId of packageIds) {
    const pkg = await getPackage(pkgId);
    total += pkg.priceType === 'PER_NIGHT' ? pkg.price * nights : pkg.price;
  }

  // 4. Create guest (upsert by email)
  const guest = await upsertGuest(tenantId, body.guest);

  // 5. Create booking
  const booking = await prisma.booking.create({
    data: { tenantId, roomId, guestId: guest.id, checkIn, checkOut,
            totalAmount: total, source: 'DIRECT_WEB', status: 'PENDING' }
  });

  // 6. Create Stripe PaymentIntent
  if (paymentOption !== 'PAY_AT_HOTEL') {
    const amount = paymentOption === 'DEPOSIT' ? total * 0.3 : total;
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: tenant.currency.toLowerCase(),
      metadata: { bookingId: booking.id, tenantId },
    });
    return { booking, clientSecret: pi.client_secret };
  }

  return { booking };
}
```

### Stripe webhook (payment confirmed)
```
POST /api/webhooks/stripe  (already exists for billing)
→ Add handler for payment_intent.succeeded where metadata.bookingId exists
→ Update booking.status = CONFIRMED, paidAmount = amount
→ Send confirmation email
→ Enroll guest in loyalty + award points (if program enabled)
```

---

## Phase 3 — Guest Portal (1–2 weeks)

### `/site/:slug/my-booking`

Guest enters their email + confirmation number to access:
- Booking details (room, dates, total, packages)
- Payment status + outstanding balance
- Online check-in form (passport details, ETA)
- Cancel button (if cancellation policy allows)
- Extend stay request form

### Online check-in
```typescript
// POST /site/:slug/booking/:confirmationNo/checkin-form
// Guest submits: ID type, ID number, nationality, ETA
// Saves to booking.specialRequests or a new GuestCheckInForm model
```

---

## Phase 4 — SEO & Direct Booking Boost (2–3 weeks)

### SEO enhancements on public site pages

#### Schema markup (JSON-LD) on room pages
```json
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "Sunset Resort",
  "url": "https://sunsetresort.com",
  "priceRange": "$$$",
  "address": { "@type": "PostalAddress", ... },
  "hasMap": "https://maps.google.com/...",
  "amenityFeature": [...]
}
```

```json
{
  "@type": "HotelRoom",
  "name": "Ocean Suite",
  "description": "...",
  "occupancy": { "@type": "QuantitativeValue", "maxValue": 4 },
  "bed": { "@type": "BedDetails", "typeOfBed": "King" }
}
```

#### Technical SEO
- Server-side rendering for all public pages (already Next.js SSR)
- `sitemap.xml` generated dynamically from rooms + pages
- `robots.txt` allowing all crawlers
- `og:image` + `og:title` meta per room for social sharing
- Canonical URLs on custom domains

### Google Hotel Ads (future)
When direct booking volume is sufficient:
- Implement **Google Hotel Center** feed (XML with prices + availability)
- Connect via **Google Connectivity Partner** program
- Direct traffic from Google's "Book a Room" button on Search / Maps

---

## Social Media Links

Resort owner dashboard এ social media links add করতে পারবে — এগুলো public website এর header/footer এ দেখাবে।

### WebsiteContent model এ নতুন fields
```
facebookUrl    String?   // https://facebook.com/resortname
instagramUrl   String?   // https://instagram.com/resortname
twitterUrl     String?   // https://twitter.com/resortname  (X)
tiktokUrl      String?   // https://tiktok.com/@resortname
youtubeUrl     String?   // https://youtube.com/@resortname
whatsappNumber String?   // +8801XXXXXXXXX (WhatsApp chat link)
tripadvisorUrl String?   // https://tripadvisor.com/hotel/...
```

### Website এ কোথায় দেখাবে
- **Footer** — icon row (Facebook, Instagram, WhatsApp, TripAdvisor, etc.)
- **Header** — optional WhatsApp floating button (always visible)
- **Room/landing page** — "Follow us" section (optional, owner toggle করতে পারবে)

### Dashboard এ কোথায় edit করবে
`/dashboard/website` → "Social & Contact" section → প্রতিটা platform এর URL input

### Implementation scope
| কাজ | কোথায় |
|-----|--------|
| Schema fields add | `WebsiteContent` model |
| Dashboard form fields | `/dashboard/website` page |
| Public website footer | `apps/web/src/app/site/[slug]/` layout |
| WhatsApp floating button | public site layout (conditional) |

---

## Phase 5 — Conversion Optimisation (ongoing)

| Feature | Impact |
|---------|--------|
| **Best Price Guarantee badge** | "Book direct — lowest price guaranteed" |
| **Urgency indicators** | "Only 2 rooms left for these dates" |
| **Package upsell at checkout** | Add honeymoon/spa package with 1 click |
| **Exit intent popup** | Offer 5% off if guest tries to leave checkout |
| **Loyalty enrolment prompt** | "Earn 500 pts on this stay — join free" |
| **Review widget** | Show TripAdvisor / Google reviews on homepage |
| **WhatsApp CTA** | "Chat with us" button (links to WhatsApp) |
| **Live availability counter** | Show how many rooms booked today |

---

## Frontend Architecture

All public booking pages live in the existing Next.js `apps/web` app:

```
apps/web/src/app/
  site/
    [slug]/
      page.tsx              ← landing page (exists)
      book/
        page.tsx            ← date picker entry
      rooms/
        page.tsx            ← room grid
        [roomId]/
          page.tsx          ← room detail
      book/
        [roomId]/
          page.tsx          ← checkout
      confirmation/
        [confirmationNo]/
          page.tsx          ← thank you page
      my-booking/
        page.tsx            ← guest portal
```

All pages use `generateMetadata()` for dynamic SEO tags from tenant settings.

---

## Competitive Positioning vs OTAs

| Metric | Booking.com | Airbnb | Direct (ResortPro) |
|--------|------------|--------|-------------------|
| Commission | ~15% | ~3% host + ~14% guest | **0%** |
| Guest data | Partial | Limited until check-in | **Full** |
| Loyalty program | None | None | **✓ Points + tiers** |
| Cancellation control | Platform rules | Platform rules | **Hotel sets policy** |
| Upsell opportunity | Limited | None | **Full (packages, F&B)** |
| Brand presence | OTA brand | Airbnb brand | **Your brand** |

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 — Availability search | 2–3 weeks | Date search + room listing live |
| Phase 2 — Checkout + Stripe | 2–3 weeks | End-to-end booking + payment |
| Phase 3 — Guest portal | 1–2 weeks | Online check-in + self-service |
| Phase 4 — SEO | 2–3 weeks | Schema markup + sitemap + meta |
| Phase 5 — Conversion | Ongoing | A/B tests + upsell features |

**Total: ~8–11 weeks to full direct booking engine**

---

## Dependencies

- Stripe (already integrated for billing — extend for guest payments)
- Rate Plans (T-31 ✅ — already done)
- Packages (T-36 ✅ — already done)
- Loyalty Program (T-38 ✅ — already done)
- Custom domain + SSL (already in Tenant model)
- Public website builder (already exists at `/dashboard/website`)

---

## Bug Fixes (June 2026)

### 1. ✅ `POST /:slug/book` — `roomId` validated as UUID but rooms use cuid()
**Problem:** `roomId: z.string().uuid()` in `publicBookSchema`. Prisma's `@default(cuid())` generates cuid IDs (e.g. `clxyz...`), not UUIDs. Every public booking submission was rejected with a 400 validation error — completely broken.  
**Fix:** Changed to `z.string().min(1)`.

### 2. ✅ `GET /api/website` returned 404 for new tenants
**Problem:** `prisma.websiteContent.findUnique()` returns `null` for a tenant that hasn't set up their website yet. Route returned `404`, causing the dashboard website editor to never load (React Query `isError: true`, form stays at skeleton indefinitely).  
**Fix:** Return `ok(content ?? { tenantId, heroTitle: '', galleryImages: [], testimonials: [], hiddenSections: [] })` — empty shell so the frontend form loads with defaults and the user can start editing right away.

### 3. ✅ `GET /:slug/availability` — invalid dates caused Prisma crash
**Problem:** No validation on `checkIn`/`checkOut` query params. `new Date('garbage')` returns `Invalid Date`, which Prisma passes to PostgreSQL causing a runtime error (500). Also, `checkOut <= checkIn` was not checked.  
**Fix:** Added `isNaN(checkIn.getTime())` guards + `checkOut <= checkIn` check, returning proper 400 responses.

### 4. ✅ Checkout page — error persisted across payment retry attempts
**Problem:** If payment failed (e.g. network error), `setError(msg)` displayed the error. If the user then changed gateway and tried again, the error was still visible during the new attempt, confusing UX.  
**Fix:** `setError(null)` at the top of `handlePay()` before each attempt.

### 5. ✅ Checkout page — unused `paymentGatewayApi` import
**Problem:** `import { paymentGatewayApi } from '@/lib/api'` was imported but never used — raw axios calls were used instead. Dead import, TypeScript warning.  
**Fix:** Import removed.
