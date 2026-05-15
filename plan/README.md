# ResortPro — Integration Plans

This folder contains detailed implementation plans for connecting ResortPro with major booking channels and operating a direct booking website.

---

## Plans

| File | What it covers | Status | Priority | Est. effort |
|------|---------------|--------|----------|-------------|
| [external-calendar-sync.md](./external-calendar-sync.md) | **iCal import** — OTA booking এলে room auto-block, Booking.com/Airbnb URL paste করলেই কাজ করে | 📋 Planning | 🔴 Highest | ~10 hours |
| [direct-booking-website.md](./direct-booking-website.md) | Public booking engine, Stripe checkout, guest portal, SEO | 📋 Planning | 🔴 High | 8–11 weeks |
| [booking-com-integration.md](./booking-com-integration.md) | Booking.com full XML API — bi-directional sync, certified partner | 📋 Planning | 🟡 Medium | 14–20 weeks |
| [airbnb-integration.md](./airbnb-integration.md) | Airbnb Host API — OAuth, reservation webhook, messaging | 📋 Planning | 🟡 Medium | 18–28 weeks |

---

## Recommended Build Order

```
Phase 1 — এখনই করা দরকার (~10 hours)
  ✦ external-calendar-sync
    → Booking.com/Airbnb iCal URL paste করলে room automatically block হয়
    → No API key, no certification — শুধু URL
    → Double booking বন্ধ হয়

Phase 2 — পরের বড় feature (8–11 weeks)
  ✦ direct-booking-website
    → Guest সরাসরি resort এর website থেকে book করতে পারবে
    → 0% commission — OTA কে কোনো টাকা দিতে হবে না

Phase 3 — Full API integration (6+ months, certification লাগবে)
  ✦ booking-com-integration (XML API)
  ✦ airbnb-integration (Host API)
    → Real-time sync, rate push, guest data
    → OTA এর certified partner হতে হবে
```

---

## Shared Infrastructure (build once, use for all)

### `ChannelConnection` model
Stores API keys / OAuth tokens per channel per tenant.

### `ChannelRoomMap` model  
Maps ResortPro room IDs ↔ channel room/listing IDs.

### `ICalFeed` model
Per-room iCal tokens for outbound feeds + inbound polling URLs.

### `/api/webhooks/:channel` router
Single webhook entry point for all channel reservation pushes.

### Availability push queue
Background job queue (Bull/BullMQ) that batches and retries availability updates to all connected channels when bookings change.

---

## Revenue Impact Estimate

Assuming a resort with 20 rooms at $150/night avg, 70% occupancy:

| Scenario | Annual revenue | OTA commission saved |
|----------|---------------|---------------------|
| 100% via OTAs (15% avg) | $766,500 gross, $651,525 net | — |
| 30% direct + 70% OTA | $766,500 gross, $685,575 net | +$34,050/yr |
| 50% direct + 50% OTA | $766,500 gross, $708,713 net | +$57,188/yr |
| 70% direct + 30% OTA | $766,500 gross, $731,850 net | +$80,325/yr |

**Direct booking website pays for itself within months.**
