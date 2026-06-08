# ResortPro — Review & Reputation Management

## Overview

Guest checkout-এর পরে automatically review request পাঠানো। Reviews collect করা, dashboard-এ দেখা, public website-এ best reviews display করা। TripAdvisor/Google review link-ও promote করা।

---

## ১. Review Collection Flow

```
Guest checks out
    ↓
24 hours later (configurable):
  → WhatsApp: "হ্যালো Rahman ভাই! আপনার থাকার অভিজ্ঞতা কেমন ছিল?"
  → SMS: Same message with link
  → Email: Formal review request
    ↓
Guest clicks link → Review page (public, no login needed)
    ↓
Fills review form → Submit
    ↓
Owner dashboard-এ notification
Owner approves → Shows on website
```

---

## ২. Review Form (Public Page)

```
URL: /<slug>/review?token=<unique_token>

┌───────────────────────────────────────┐
│  How was your stay?                   │
│  Ocean Pearl Resort                   │
│                                        │
│  Overall Rating:                      │
│  ★ ★ ★ ★ ☆   (click to rate)        │
│                                        │
│  Your name: [ Rahman Ahmed     ]      │
│                                        │
│  Breakdown (optional):                │
│  Cleanliness:    ★ ★ ★ ★ ★          │
│  Service:        ★ ★ ★ ★ ☆          │
│  Location:       ★ ★ ★ ★ ★          │
│  Value:          ★ ★ ★ ☆ ☆          │
│                                        │
│  Your review:                         │
│  [                              ]     │
│  [                              ]     │
│  [                              ]     │
│                                        │
│  Share a photo (optional):            │
│  [+ Upload photo]                     │
│                                        │
│  [Submit Review]                      │
│                                        │
│  Also review us on:                   │
│  [TripAdvisor ↗]  [Google Maps ↗]   │
└───────────────────────────────────────┘
```

---

## ৩. Owner Dashboard `/dashboard/reviews`

```
┌──────────────────────────────────────────────────┐
│  Reviews & Reputation                            │
│                                                  │
│  ⭐ 4.7 / 5   Based on 67 reviews               │
│                                                  │
│  Cleanliness: ████████░░ 4.8                    │
│  Service:     ███████░░░ 4.6                    │
│  Location:    █████████░ 4.9                    │
│  Value:       ██████░░░░ 4.3                    │
│                                                  │
│  Pending Approval: 3   Approved: 62   Hidden: 2 │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ ⭐⭐⭐⭐⭐ Rahman Ahmed    Jun 4, 2026    │ │
│  │ "Incredible experience! The ocean view     │ │
│  │ from our room was breathtaking..."         │ │
│  │ Status: ● Pending                          │ │
│  │ [Approve & Show on Website]  [Hide]        │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  [Reply to Review] button (optional)            │
└──────────────────────────────────────────────────┘
```

### Review Request Settings
```
Auto-send review request: [✓]
Send after: [ 24 ] hours after checkout
Send via: [✓] WhatsApp  [✓] Email  [ ] SMS

TripAdvisor URL: [ https://tripadvisor.com/... ]
Google Review URL: [ https://g.page/... ]

Auto-approve reviews with rating ≥ 4: [ ]
(Leave off = manual approval for all)
```

---

## ৪. Website Display

Testimonials section-এ approved reviews দেখাবে।

```
Current: website.testimonials[] → manual JSON data
New: fetch from Review model (approved = true)

Fallback: if no approved reviews → show manual testimonials
```

---

## ৫. Database Schema

```prisma
model Review {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  bookingId   String?
  booking     Booking? @relation(fields: [bookingId], references: [id])

  guestName   String
  guestEmail  String?

  rating      Float    // 1–5
  title       String?
  body        String?
  photos      String[]

  // Sub-ratings (optional)
  ratingClean    Float?
  ratingService  Float?
  ratingLocation Float?
  ratingValue    Float?

  // Owner response
  ownerReply  String?
  repliedAt   DateTime?

  // Visibility
  isApproved  Boolean  @default(false)
  isHidden    Boolean  @default(false)

  // Token for public form (one-time use)
  token       String   @unique @default(cuid())
  tokenUsed   Boolean  @default(false)

  source      String   @default("INTERNAL")  // INTERNAL | IMPORTED
  createdAt   DateTime @default(now())
}
```

---

## ৬. API Endpoints

```
// Owner (authenticated)
GET    /api/tenant/reviews              → list (filter by status)
PATCH  /api/tenant/reviews/:id          → approve/hide/reply
DELETE /api/tenant/reviews/:id          → delete

POST   /api/tenant/reviews/send-request → manually send request to a guest
  body: { bookingId, channel: "whatsapp"|"email" }

GET    /api/tenant/reviews/stats        → avg rating, count, breakdown

// Public (no auth — token-based)
GET    /api/public/review/:token        → get booking info for form pre-fill
POST   /api/public/review/:token        → submit review
GET    /api/public/:slug/reviews        → get approved reviews for website display
```

---

## ৭. Implementation Steps

```
Step 1 — Database (0.5 day)
  ✦ Review model
  ✦ Migrate

Step 2 — API (2 days)
  ✦ Public review submit (token-based)
  ✦ Owner management endpoints
  ✦ Auto-send after checkout (hook into check-out API)
  ✦ Website display endpoint

Step 3 — Dashboard UI (1.5 days)
  ✦ /dashboard/reviews page
  ✦ Approve/hide/reply actions
  ✦ Stats + rating breakdown
  ✦ Settings (send timing, channels, external links)

Step 4 — Public Review Page (0.5 day)
  ✦ /<slug>/review?token= page
  ✦ Star rating + form

Step 5 — Website Integration (0.5 day)
  ✦ Replace static testimonials with live Review data
  ✦ All themes updated

Total: ~5 days
```
