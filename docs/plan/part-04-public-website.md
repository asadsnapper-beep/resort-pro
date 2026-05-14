# Part 04 — Public Resort Website

## Overview
প্রতিটি resort-এর নিজস্ব public-facing website আছে। Resort owner dashboard থেকে customize করতে পারেন। Guest-রা এই website থেকে resort দেখতে এবং booking করতে পারেন।

---

## URL Structure
```
/{slug}              → Resort homepage
/{slug}/rooms        → Room listing
/{slug}/booking      → Booking form
/{slug}#feedback     → Guest feedback / review
```

---

## Website Features

### Resort Homepage
- Hero section (custom title, subtitle, cover image)
- Resort description
- Amenities showcase
- Room preview cards (with pricing)
- Booking CTA button

### Room Listing
- Available rooms with photos, type, price
- Room amenities
- Occupancy info
- "Book Now" button

### Booking Form (Guest-facing)
- Room selection
- Check-in / check-out date picker
- Guest details (name, email, phone)
- Special requests
- Confirmation email sent automatically on booking

### Guest Feedback
- Post-stay review form
- Rating system

---

## Website Content Model
Dashboard থেকে যা customize করা যায়:

```typescript
{
  heroTitle: string           // "Welcome to Paradise Resort"
  heroSubtitle: string        // "Experience luxury and comfort"
  description: string         // About the resort
  logoUrl: string             // Resort logo
  coverImageUrl: string       // Hero background image
  primaryColor: string        // Brand color
  accentColor: string         // Accent color
  amenities: string[]         // ["Pool", "Spa", "Restaurant", ...]
  checkInTime: string         // "14:00"
  checkOutTime: string        // "11:00"
  address: string
  phone: string
  email: string
}
```

---

## API Endpoints (Public — no auth required)
| Endpoint | Purpose |
|----------|---------|
| `GET /site/:slug` | Resort website data |
| `GET /site/:slug/rooms` | Available rooms |
| `POST /site/:slug/booking` | Create guest booking |
| `GET /site/:slug/availability` | Room availability check |

---

## Auto-Generated Content on Registration
Resort register করার সময় default content তৈরি হয়:
```typescript
heroTitle: `Welcome to ${resortName}`
heroSubtitle: 'Experience luxury and comfort'
```

---

## Key Files
| File | Purpose |
|------|---------|
| `apps/api/src/routes/website.ts` | Website content API + public booking API |
| `apps/web/src/app/(public)/[slug]/` | Public website pages |
| `apps/web/src/app/(dashboard)/dashboard/website/` | Website editor |
