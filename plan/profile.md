# User Profile System — Plan & Status

## Overview

The Profile page lets any logged-in user update their personal info (name, phone, avatar) and change their password.

## Architecture

```
apps/web/src/app/(dashboard)/dashboard/profile/page.tsx   ← Full UI
apps/api/src/routes/auth.ts                               ← PATCH /auth/me, POST /auth/change-password
packages/types/src/index.ts                               ← AuthUser interface
apps/web/src/store/auth.ts                                ← Zustand auth store
```

## API Endpoints

| Route | Auth | Description |
|-------|------|-------------|
| `GET /api/auth/me` | Any auth | Get current user (id, email, role, firstName, lastName, phone, avatarUrl) |
| `PATCH /api/auth/me` | Any auth | Update firstName, lastName, phone, avatarUrl |
| `POST /api/auth/change-password` | Any auth | Change password (verifies currentPassword, bcrypt) |

## Features

- **Avatar:** upload via `ImageUpload` component or paste URL. Falls back to initials with color picker.
- **Color picker:** 6 color options for initials avatar — cosmetic only (no DB field), resets on refresh.
- **Password strength:** real-time indicator (length, uppercase, number). Shows colored bar + checklist.
- **Confirm password:** turns red if mismatch, green if match.
- **Email field** is read-only (email changes require support).

## Bug Fixes

### 1. `phone` and `avatarUrl` missing from `AuthUser` type

**File:** `packages/types/src/index.ts`

`AuthUser` only had `{ id, email, role, tenantId, firstName, lastName }`. The API's `PATCH /auth/me` and `GET /auth/me` return `phone` and `avatarUrl`, but since they weren't in the type, the frontend used unsafe `as` casts:

```typescript
// Before (unsafe)
const [phone] = useState((user as { phone?: string | null })?.phone ?? '');

// After — clean, no cast needed
const [phone] = useState(user?.phone ?? '');
```

**Fix:** Added to `AuthUser`:
```typescript
phone?: string | null;
avatarUrl?: string | null;
```

Also simplified `updateUser` signature in the auth store from `Partial<AuthUser & { phone: string | null; avatarUrl: string | null }>` → `Partial<AuthUser>`.

### 2. Profile page didn't fetch fresh user data on mount

**File:** `apps/web/src/app/(dashboard)/dashboard/profile/page.tsx`

`phone` and `avatarUrl` are NOT in the JWT payload — only `id, email, role, tenantId`. After a fresh login, the Zustand store user object has `phone: undefined` and `avatarUrl: undefined`. The form fields initialized from the store were always blank.

**Fix:** Added `useEffect` to call `authApi.me()` on mount:
```typescript
useEffect(() => {
  authApi.me().then(res => {
    const fresh = res?.data?.data;
    if (!fresh) return;
    updateUser(fresh);
    setFirstName(fresh.firstName ?? '');
    setLastName(fresh.lastName ?? '');
    setPhone(fresh.phone ?? '');
    setAvatarUrl(fresh.avatarUrl ?? '');
  }).catch(() => {});
}, []);
```

This ensures phone and avatar are always shown correctly, even on first load after login.

## Known Limitations

- **Avatar color is not persisted** — The color picker (6 colors for initials background) has no corresponding DB field. The chosen color is lost on page refresh. Not a critical bug — the avatar only shows when there's no `avatarUrl` set.
