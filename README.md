# ResortPro — All-in-One Resort Management SaaS

> The complete platform for small resort owners: bookings, housekeeping, restaurant, guest support, public website, and mobile app — all in one.

---

## Table of Contents

- [Architecture](#architecture)
- [Quick Start (5 minutes)](#quick-start)
- [Project Structure](#project-structure)
- [Apps](#apps)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ResortPro                            │
├──────────────┬──────────────────────────┬───────────────────┤
│  Mobile App  │     Web Dashboard        │   Public Website  │
│  (Expo RN)   │     (Next.js 14)         │   (Next.js SSR)   │
├──────────────┴──────────────────────────┴───────────────────┤
│                    Fastify REST API                          │
│           JWT Auth · WebSocket Chat · Swagger Docs          │
├─────────────────────────────────────────────────────────────┤
│          PostgreSQL (Prisma)  ·  Redis  ·  BullMQ           │
└─────────────────────────────────────────────────────────────┘
```

**Multi-tenancy:** Shared database with `tenantId` on every table. Each resort gets a unique subdomain (`slug.resortpro.com`).

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### 1. Clone and install

```bash
git clone <repo>
cd resort-pro
pnpm install
```

### 2. Start infrastructure

```bash
docker-compose up -d
# Starts: PostgreSQL (5432), Redis (6379), Mailpit (8025)
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your settings
```

### 4. Set up database

```bash
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed demo data
```

### 5. Start development

```bash
pnpm dev
# API:     http://localhost:4000
# Web:     http://localhost:3000
# API Docs: http://localhost:4000/docs
# Mail UI:  http://localhost:8025
```

### Demo Login Credentials

After seeding, use these to log in:

| Role    | Email                         | Password      | Slug                    |
|---------|-------------------------------|---------------|-------------------------|
| Owner   | owner@palmparadise.com        | Password123!  | palm-paradise-resort    |
| Manager | manager@palmparadise.com      | Password123!  | palm-paradise-resort    |
| Staff   | staff@palmparadise.com        | Password123!  | palm-paradise-resort    |

---

## Project Structure

```
resort-pro/
├── apps/
│   ├── api/              # Fastify REST API
│   │   ├── src/
│   │   │   ├── app.ts          # App factory (plugins, routes)
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── routes/         # Route handlers
│   │   │   ├── middleware/     # Auth middleware
│   │   │   └── utils/          # Helpers
│   │   └── tests/
│   │       ├── unit/           # Unit tests (Vitest)
│   │       └── integration/    # Integration tests
│   │
│   ├── web/              # Next.js 14 App
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   │   ├── (dashboard)/  # Protected dashboard
│   │   │   │   ├── (public)/     # Public resort websites
│   │   │   │   └── auth/         # Login, Register
│   │   │   ├── components/     # React components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # API client, utils
│   │   │   └── store/          # Zustand state
│   │   └── tests/e2e/          # Playwright E2E tests
│   │
│   └── mobile/           # React Native + Expo
│       ├── src/
│       │   ├── screens/        # App screens
│       │   ├── navigation/     # React Navigation
│       │   ├── store/          # Auth store
│       │   └── lib/            # API client, utils
│       └── app.json
│
└── packages/
    ├── database/         # Prisma schema + seed
    ├── types/            # Shared TypeScript types
    └── config/           # Shared ESLint, TS configs
```

---

## Apps

### API (`apps/api`)

Fastify-based REST API with:
- JWT authentication (access + refresh tokens)
- Role-based access control (OWNER, MANAGER, STAFF, GUEST)
- WebSocket live chat
- Rate limiting (100 req/min)
- Swagger/OpenAPI docs at `/docs`

**Key files:**
- [`src/app.ts`](apps/api/src/app.ts) — Plugin registration, route mounting
- [`src/middleware/auth.ts`](apps/api/src/middleware/auth.ts) — `requireAuth`, `requireRole`
- [`src/routes/`](apps/api/src/routes/) — One file per resource

### Web (`apps/web`)

Next.js 14 App Router with:
- `/` — Landing/marketing page
- `/auth/login` + `/auth/register` — Authentication
- `/dashboard/*` — Protected admin dashboard
- `/[slug]` — Public resort website (SSR)

**Key files:**
- [`src/lib/api.ts`](apps/web/src/lib/api.ts) — Typed API client with auto token refresh
- [`src/store/auth.ts`](apps/web/src/store/auth.ts) — Zustand auth store (persisted)
- [`src/components/dashboard/sidebar.tsx`](apps/web/src/components/dashboard/sidebar.tsx) — Nav

### Mobile (`apps/mobile`)

React Native + Expo with:
- Secure token storage via `expo-secure-store`
- Auto-refresh JWT interceptor
- Push notification support (expo-notifications)
- iOS + Android via single codebase

**Key files:**
- [`src/navigation/AppNavigator.tsx`](apps/mobile/src/navigation/AppNavigator.tsx) — Route guard
- [`src/store/auth.ts`](apps/mobile/src/store/auth.ts) — Secure auth store
- [`src/screens/DashboardScreen.tsx`](apps/mobile/src/screens/DashboardScreen.tsx) — Owner overview

---

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `JWT_SECRET` | JWT signing secret | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token secret | ✅ |
| `RESEND_API_KEY` | Resend email API key | ⭕ |
| `STRIPE_SECRET_KEY` | Stripe secret key | ⭕ |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | ✅ |

---

## Database

### Schema Overview

```
Tenant (resort)
  ├── Users (staff + owner accounts)
  ├── Rooms (accommodations)
  ├── Guests (CRM)
  ├── Bookings → Payments
  ├── Staff → HousekeepingTasks
  ├── MenuItems → FoodOrders → FoodOrderItems
  ├── InventoryItems → InventoryMovements
  ├── SupportTickets → ChatMessages
  ├── Amenities
  ├── WebsiteContent
  └── Notifications
```

### Common Commands

```bash
pnpm db:migrate         # Run pending migrations
pnpm db:migrate:reset   # Reset DB and re-run all migrations
pnpm db:seed            # Seed with demo data
pnpm db:studio          # Open Prisma Studio (visual editor)
```

---

## API Reference

Interactive docs available at **http://localhost:4000/docs** (Swagger UI).

### Auth Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Register new resort + owner | ❌ |
| POST | `/api/auth/login` | Login | ❌ |
| POST | `/api/auth/refresh` | Refresh access token | ❌ |
| GET | `/api/auth/me` | Get current user | ✅ |
| POST | `/api/auth/logout` | Logout (invalidate refresh) | ❌ |

### Core Resources

All resource endpoints follow RESTful conventions and require `Authorization: Bearer <token>`:

- `GET/POST /api/rooms` · `PATCH/DELETE /api/rooms/:id`
- `GET/POST /api/bookings` · `PATCH /api/bookings/:id/check-in|check-out|cancel`
- `GET/POST /api/guests` · `PATCH/DELETE /api/guests/:id`
- `GET/POST /api/staff` · `PATCH/DELETE /api/staff/:id`
- `GET/POST /api/housekeeping` · `PATCH /api/housekeeping/:id/status|assign`
- `GET/POST /api/menu` · `PATCH/DELETE /api/menu/:id`
- `GET/POST /api/food-orders` · `PATCH /api/food-orders/:id/status`
- `GET/POST /api/inventory` · `POST /api/inventory/:id/movement`
- `GET/POST /api/tickets` · `POST /api/tickets/:id/messages`
- `GET/PUT /api/website`
- `GET /api/dashboard` · `GET /api/dashboard/revenue` · `GET /api/dashboard/occupancy`

---

## Testing

### Run all tests

```bash
pnpm test              # Unit + integration tests across all apps
pnpm test:e2e          # Playwright E2E tests (requires dev server)
```

### API tests (Vitest)

```bash
cd apps/api
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

**Test files:**
- `tests/unit/booking.test.ts` — `generateConfirmationNo`, `calculateNights`
- `tests/unit/response.test.ts` — `ok`, `paginated`, `parsePageParams`
- `tests/integration/auth.test.ts` — Auth endpoints via Fastify `inject()`

### Web E2E tests (Playwright)

```bash
cd apps/web
pnpm test:e2e          # Run all E2E tests
pnpm test:e2e:ui       # Run with UI mode (interactive)
```

**Test files:**
- `tests/e2e/landing.spec.ts` — Landing page content + navigation
- `tests/e2e/auth.spec.ts` — Login/register flows + validation
- `tests/e2e/dashboard.spec.ts` — Dashboard (auth guard, sidebar, navigation)

---

## Deployment

### Docker Production Build

```bash
# Build API
docker build -t resort-pro-api ./apps/api

# Build Web
docker build -t resort-pro-web ./apps/web
```

### Environment Checklist Before Deploy

- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Set `DATABASE_URL` to production PostgreSQL
- [ ] Set `CORS_ORIGIN` to your production domain
- [ ] Set `RESEND_API_KEY` for transactional emails
- [ ] Set `STRIPE_SECRET_KEY` for payments
- [ ] Run `pnpm db:migrate` on production DB
- [ ] Configure `NODE_ENV=production`

### Mobile App (EAS Build)

```bash
cd apps/mobile
eas build --platform ios      # iOS
eas build --platform android  # Android
eas submit                    # Submit to stores
```

---

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes following existing patterns
3. Run tests: `pnpm test`
4. Run lint: `pnpm lint`
5. Submit a PR

### Code Conventions

- **API routes:** One file per resource in `apps/api/src/routes/`
- **Validation:** Zod schemas at the top of route files
- **Auth:** Use `requireAuth` or `requireRole(...)` as `preHandler`
- **Responses:** Always use `ok()` or `paginated()` helpers
- **Types:** Shared types in `packages/types/src/index.ts`
- **No `any`:** TypeScript strict mode enforced

---

## License

MIT — ResortPro
