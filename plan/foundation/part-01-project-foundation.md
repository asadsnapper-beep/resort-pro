# Part 01 — Project Foundation & Architecture

## Overview
ResortPro হলো একটি SaaS-based hotel/resort management platform। Resort owner-রা এক dashboard থেকে সব কিছু manage করতে পারেন।

## Tech Stack

### Monorepo Structure
```
Hotel management/
├── apps/
│   ├── api/          → Fastify backend (Node.js + TypeScript)
│   └── web/          → Next.js 14 frontend (App Router)
├── packages/
│   └── database/     → Prisma ORM + PostgreSQL schema
├── docker-compose.yml
└── docker-compose.production.yml
```

### Backend (apps/api)
- **Framework:** Fastify (fast, low overhead)
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL 16
- **Cache/Queue:** Redis 7
- **Auth:** JWT (@fastify/jwt) + Refresh tokens
- **Email:** Resend API
- **Realtime:** WebSocket (@fastify/websocket)
- **Validation:** Zod
- **API Docs:** Swagger / OpenAPI (@fastify/swagger)

### Frontend (apps/web)
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State (global):** Zustand (persisted to localStorage)
- **State (server):** TanStack React Query
- **HTTP Client:** Axios (with interceptors)
- **UI Components:** shadcn/ui + Radix UI
- **Icons:** Lucide React
- **Theme:** next-themes (dark/light mode)

### Database
- **Provider:** PostgreSQL
- **ORM:** Prisma Client v5
- **Multi-tenancy:** Shared database, shared schema (tenantId on every table)

---

## Multi-Tenancy Model
- প্রতিটি table-এ `tenantId` column আছে
- JWT token-এ `tenantId` থাকে, প্রতিটি API request-এ extract করা হয়
- Prisma queries-এ সবসময় `where: { tenantId }` থাকে
- Tenant slug দিয়ে public website URL করা হয়

## Authentication Flow
```
Registration → Tenant + Owner User তৈরি → JWT + Refresh token issue
Login → Credentials verify → JWT (15m) + Refresh token (7d)
Token Refresh → POST /auth/refresh → Rotation (পুরনো token delete)
Logout → Refresh token DB থেকে delete
```

## API Response Format
```json
{ "success": true, "data": {...} }
{ "success": false, "error": "..." }
```

## Key Files
| File | Purpose |
|------|---------|
| `apps/api/src/app.ts` | Fastify app setup, plugin registration, route mounting |
| `apps/api/src/middleware/auth.ts` | JWT verify middleware |
| `packages/database/prisma/schema.prisma` | Full database schema |
| `apps/web/src/store/auth.ts` | Zustand auth store |
| `apps/web/src/lib/api.ts` | Axios API client with interceptors |
