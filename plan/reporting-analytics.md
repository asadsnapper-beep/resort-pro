# ResortPro — Reporting & Analytics

## Overview

Resort owner-দের জন্য business intelligence — occupancy, revenue, booking trends, room performance, guest analytics। Monthly/weekly/daily reports। Export করার option।

---

## ১. Reports Dashboard `/dashboard/reports`

```
┌──────────────────────────────────────────────────────┐
│  Reports & Analytics                                 │
│                                                      │
│  Period: [This Month ▾]  Compare: [Last Month ▾]   │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Revenue  │ │Occupancy │ │ Bookings │ │  ADR   │ │
│  │ ৳3.2L   │ │  78%     │ │   42     │ │৳7,619 │ │
│  │ ↑12% vs │ │ ↑5% vs   │ │ ↑8% vs  │ │↑৳320  │ │
│  │last mo. │ │last mo.  │ │last mo. │ │vs last │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└──────────────────────────────────────────────────────┘
```

**Key Metrics Explained:**
- **ADR** (Average Daily Rate) = Total Room Revenue ÷ Rooms Sold
- **RevPAR** = ADR × Occupancy % (Revenue Per Available Room)
- **Occupancy %** = Rooms Sold ÷ Total Available Room-Nights

---

## ২. Report Types

### A. Revenue Report
```
Total Revenue breakdown:
  ├── Room Revenue:          ৳2,40,000
  ├── Restaurant Revenue:    ৳48,000
  ├── Activity Revenue:      ৳12,000
  ├── Offers/Discounts:      -৳18,000
  └── Total Net Revenue:     ৳2,82,000

Monthly Revenue Chart (bar chart — 12 months)
Revenue by room type (pie chart)
Revenue by booking channel (Direct / OTA / Walk-in)
```

### B. Occupancy Report
```
Occupancy Rate by Date (calendar heatmap):
  [jun calendar — darker = higher occupancy]
  Jun 1: 95%  Jun 2: 90%  Jun 7: 40%...

By Room Type:
  Deluxe:   85% occupied
  Standard: 72% occupied
  Suite:    60% occupied

Peak days vs Low days analysis
Avg lead time (how far in advance guests book)
```

### C. Booking Report
```
Bookings by source:
  Direct website: 45%
  Walk-in:        30%
  Phone:          15%
  OTA (manual):   10%

Cancellation rate: 8%
Avg booking value: ৳16,000
Avg length of stay: 2.1 nights

Booking funnel (if direct website):
  Visitors → Availability check → Room view → Booking start → Completed
  1,240      890 (72%)           540 (61%)    120 (22%)      85 (71%)
```

### D. Room Performance Report
```
Per Room Performance:
Room  Type      Nights   Revenue   Occupancy  ADR
101   Standard   18      ৳1,08,000   60%     ৳6,000
201   Deluxe     24      ৳1,92,000   80%     ৳8,000
301   Suite      12      ৳1,44,000   40%    ৳12,000

Best performing room: 201
Worst performing: 301 (low occupancy despite high rate → consider pricing)
```

### E. Guest Report
```
Total unique guests:    234
Repeat guests:           67 (28.6%)
New guests:             167
Average stays per guest: 1.3

Top guests by spend:
  1. Rahman Ahmed    ৳48,000   3 stays
  2. Fatima Khan     ৳32,000   2 stays

Guest origin (if tracked):
  Dhaka: 60%  CTG: 20%  Other: 20%
```

### F. Staff / Housekeeping Report (future)
```
Rooms cleaned per staff per day
Avg cleaning time
Complaints filed
```

---

## ৩. Scheduled Reports (Email)

```
Owner-কে automatically email করা:

Daily Report (optional):
  → Every morning 8am: yesterday's summary
  → Arrivals/departures today

Weekly Report:
  → Sunday: last week revenue + occupancy

Monthly Report:
  → 1st of month: last month full breakdown

Settings:
  [✓] Daily summary   Sent to: owner@resort.com
  [✓] Weekly report   Sent to: owner@resort.com
  [✓] Monthly report  Sent to: owner@resort.com, manager@resort.com
```

---

## ৪. Export Options

```
Each report exportable as:
  📄 PDF — formatted, printable
  📊 Excel/CSV — raw data for custom analysis
  📧 Email — send to any email

Data retention:
  FREE:    3 months history
  STARTER: 12 months
  PRO:     36 months
  ENT:     Unlimited
```

---

## ৫. API Endpoints

```
GET /api/tenant/reports/revenue
  ?from=2026-05-01&to=2026-05-31&groupBy=day|week|month

GET /api/tenant/reports/occupancy
  ?from=&to=&groupBy=

GET /api/tenant/reports/bookings
  ?from=&to=

GET /api/tenant/reports/rooms
  ?from=&to=

GET /api/tenant/reports/guests
  ?from=&to=

GET /api/tenant/reports/summary
  ?period=today|week|month|year|custom&from=&to=
  → All key metrics in one call (for dashboard widgets)

GET /api/tenant/reports/export
  ?type=revenue|occupancy|bookings&from=&to=&format=pdf|csv
  → Returns file blob
```

---

## ৬. Database (Query-based, no new model)

```
Reports are aggregate queries on existing data:
  - Booking table (amount, dates, roomId, status, source)
  - Room table (type, basePrice)
  - Guest table (city, country)
  - HousekeepingTask (for staff reports)

No new model needed. Just complex SQL/Prisma aggregation queries.

Performance: Add indexes on:
  Booking.checkIn, Booking.checkOut, Booking.tenantId
  Booking.status, Booking.createdAt
```

---

## ৭. Implementation Steps

```
Step 1 — API (3 days)
  ✦ Revenue aggregation query
  ✦ Occupancy calculation
  ✦ Booking analytics
  ✦ Room performance query
  ✦ Guest analytics
  ✦ Summary endpoint (all KPIs)

Step 2 — Dashboard UI (3 days)
  ✦ /dashboard/reports page
  ✦ Revenue chart (Recharts AreaChart/BarChart)
  ✦ Occupancy calendar heatmap
  ✦ Room performance table
  ✦ Date range picker + comparison
  ✦ Export buttons

Step 3 — Scheduled Reports (1 day)
  ✦ Cron job for daily/weekly/monthly email
  ✦ Report email template

Total: ~7 days
```
