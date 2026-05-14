# Part 09 — Database Schema

## Overview
PostgreSQL database। Prisma ORM। Shared schema multi-tenancy।

---

## Core Models

### Tenant (SaaS-এর main unit)
```prisma
model Tenant {
  id                    String    // UUID
  name                  String    // Resort name
  slug                  String    @unique  // URL identifier
  email                 String?
  phone                 String?
  address               String?
  logoUrl               String?
  currency              String    @default("USD")
  timezone              String    @default("UTC")
  isActive              Boolean   @default(true)  // false = suspended

  // Plan / Billing
  plan                  TenantPlan @default(FREE)  // FREE|STARTER|PROFESSIONAL|ENTERPRISE
  planStatus            String     @default("trialing")
  trialEndsAt           DateTime?
  currentPeriodEnd      DateTime?
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  billingEmail          String?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

### User (Staff/Owner)
```prisma
model User {
  id           String    // UUID
  tenantId     String
  email        String    // unique per tenant
  passwordHash String
  firstName    String
  lastName     String
  role         UserRole  // OWNER|MANAGER|STAFF|GUEST
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  phone        String?
  avatarUrl    String?
  createdAt    DateTime  @default(now())

  @@unique([tenantId, email])
}
```

### Room
```prisma
model Room {
  id           String
  tenantId     String
  number       String
  name         String
  type         RoomType     // STANDARD|DELUXE|SUITE|VILLA|COTTAGE|BUNGALOW
  status       RoomStatus   // AVAILABLE|OCCUPIED|MAINTENANCE|CLEANING|OUT_OF_ORDER
  floor        Int?
  maxOccupancy Int          @default(2)
  basePrice    Decimal      // Decimal(10,2) — avoid floating point
  amenities    String[]
  images       String[]
  description  String?
  isActive     Boolean      @default(true)

  @@unique([tenantId, number])
}
```

### Booking
```prisma
model Booking {
  id                   String
  tenantId             String
  roomId               String
  guestId              String
  confirmationNo       String     @unique  // auto-generated
  status               BookingStatus  // CONFIRMED|CHECKED_IN|CHECKED_OUT|CANCELLED|NO_SHOW
  checkIn              DateTime
  checkOut             DateTime
  adults               Int        @default(1)
  children             Int        @default(0)
  totalAmount          Decimal
  paidAmount           Decimal    @default(0)
  paymentStatus        PaymentStatus  // PENDING|PARTIAL|PAID|REFUNDED|FAILED
  specialRequests      String?
  notes                String?
  // Stripe
  stripePaymentIntentId String?
  stripePaymentLinkId   String?
  paymentLinkUrl        String?
  createdAt            DateTime   @default(now())
}
```

### Guest
```prisma
model Guest {
  id          String
  tenantId    String
  firstName   String
  lastName    String
  email       String?
  phone       String?
  nationality String?
  idType      IdDocumentType?
  idNumber    String?
  dateOfBirth DateTime?
  address     String?
  notes       String?
  totalStays  Int      @default(0)
  createdAt   DateTime @default(now())

  @@unique([tenantId, email])
}
```

---

## Operations Models

### HousekeepingTask, MenuItem, FoodOrder, InventoryItem, SupportTicket
সব-এ `tenantId` আছে।

---

## Auth Models
```prisma
model RefreshToken {
  userId    String
  token     String   @unique
  expiresAt DateTime
}

model PasswordResetToken {
  userId    String
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
}

model StaffInvite {
  tenantId  String
  email     String
  role      UserRole
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
}
```

---

## Payment Model
```prisma
model Payment {
  bookingId  String
  amount     Decimal
  method     PaymentMethod  // CASH|CARD|BANK_TRANSFER|STRIPE|OTHER
  reference  String?
  notes      String?
  createdAt  DateTime
}
```

---

## SaaS / Admin Models

### PlatformSettings (Singleton)
```prisma
model PlatformSettings {
  id        String   @id @default("singleton")
  trialDays Int      @default(14)
  plans     Json     // Array of plan configs (key, name, price, features, roomLimit)
  updatedAt DateTime @updatedAt
}
```

### StripeWebhookEvent (Idempotency)
```prisma
model StripeWebhookEvent {
  stripeId  String   @unique
  type      String
  processed Boolean  @default(false)
  data      Json
  createdAt DateTime @default(now())
}
```

---

## Automation / CRM Models
```prisma
model Sequence        // Email drip campaign definition
model SequenceStep    // Each email in the sequence
model SequenceEnrollment  // Guest enrollment tracking
model EmailTemplate   // Reusable email templates
model EmailSend       // Email send log
```

---

## Website Content
```prisma
model WebsiteContent {
  tenantId     String  @unique
  heroTitle    String
  heroSubtitle String
  description  String?
  primaryColor String  @default("#1a6b5e")
  accentColor  String  @default("#d4a853")
  amenities    String[]
  // ... other fields
}
```

---

## Notification
```prisma
model Notification {
  tenantId String
  userId   String
  title    String
  body     String
  type     String
  isRead   Boolean @default(false)
}
```

---

## Enums Summary
| Enum | Values |
|------|--------|
| TenantPlan | FREE, STARTER, PROFESSIONAL, ENTERPRISE |
| UserRole | OWNER, MANAGER, STAFF, GUEST |
| RoomType | STANDARD, DELUXE, SUITE, VILLA, COTTAGE, BUNGALOW |
| RoomStatus | AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING, OUT_OF_ORDER |
| BookingStatus | CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW |
| PaymentStatus | PENDING, PARTIAL, PAID, REFUNDED, FAILED |
| PaymentMethod | CASH, CARD, BANK_TRANSFER, STRIPE, OTHER |
| HousekeepingStatus | PENDING, IN_PROGRESS, COMPLETED, SKIPPED |
| OrderStatus | PENDING, PREPARING, READY, DELIVERED, CANCELLED |
| TicketStatus | OPEN, IN_PROGRESS, RESOLVED, CLOSED |

---

## Key Files
| File | Purpose |
|------|---------|
| `packages/database/prisma/schema.prisma` | Full schema definition |
| `packages/database/prisma/seed.ts` | DB seed data |
| `packages/database/prisma/migrations/` | Migration history |
