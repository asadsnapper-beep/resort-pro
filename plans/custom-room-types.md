# Custom Room Type Labels

## Problem
Room types are hardcoded enum values: STANDARD, DELUXE, SUITE, VILLA, COTTAGE, BUNGALOW.
Resort owners want to rename these to match their brand (e.g. "Standard" → "Garden Room", "Suite" → "Presidential Suite").

## Approach: Display-layer override (no DB enum migration)

Keep `RoomType` enum unchanged in DB — no data loss, no room migration needed.
Store custom labels as JSON on `Tenant.roomTypeLabels`.

```json
{ "STANDARD": "Garden Room", "SUITE": "Presidential Suite" }
```

Unset keys fall back to defaults. Owner can reset any key to default.

## Plan

### 1. Schema
Add to `Tenant` model:
```prisma
roomTypeLabels Json? // { "STANDARD": "Garden Room", ... }
```
Migration: `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "roomTypeLabels" JSONB`

### 2. API
- `GET  /api/settings/room-types` — returns current labels merged with defaults
- `PATCH /api/settings/room-types` — updates one or more labels, validates keys are valid RoomType values

### 3. Shared hook (web)
`src/hooks/use-room-type-labels.ts`
- Fetches from `/api/settings/room-types`
- Returns `{ labels: Record<RoomType, string>, getLabel(type) }`
- Cached with React Query (`staleTime: 5min`)

### 4. Settings UI
`/dashboard/settings` — new "Room Types" card:
- Shows all 6 types with editable name fields
- "Reset to default" per row
- Save button

### 5. Consume hook in:
- `apps/web/src/app/(dashboard)/dashboard/rooms/page.tsx` — ROOM_TYPE_LABELS constant → hook
- `apps/web/src/components/rooms/RoomModal.tsx` — TYPE_META labels → hook
- Any other place that shows room type names

## Default labels
| Enum       | Default display |
|------------|----------------|
| STANDARD   | Standard        |
| DELUXE     | Deluxe          |
| SUITE      | Suite           |
| VILLA      | Villa           |
| COTTAGE    | Cottage         |
| BUNGALOW   | Bungalow        |

## Scope
- All plans (no entitlement gate — basic customization)
- OWNER + MANAGER can edit
- Changes apply across all staff views immediately (hook re-fetches on settings save)
