# Part 02 — Authentication & Onboarding

## Overview
Resort owner-রা নিজেরাই sign up করতে পারেন। প্রতিটি sign up-এ একটি নতুন **Tenant** তৈরি হয়।

---

## Registration Flow

### API: `POST /api/auth/register`
**Required fields:**
- `resortName` — Resort-এর নাম
- `slug` — Unique URL identifier (a-z, 0-9, hyphen)
- `firstName`, `lastName`
- `email`, `password` (min 8 chars, uppercase + number required)

**What happens:**
1. Slug uniqueness check
2. Password bcrypt hash (12 rounds)
3. Platform settings থেকে `trialDays` fetch করা হয়
4. Tenant তৈরি হয় — `plan: STARTER`, `planStatus: trialing`, `trialEndsAt: now + trialDays`
5. Owner user তৈরি হয় (`role: OWNER`)
6. Default website content তৈরি হয়
7. Welcome email পাঠানো হয় (trial শেষের date সহ)
8. JWT + Refresh token issue হয়

### Web Pages
- `/auth/register` — Registration form
- `/auth/login` — Login form (email + password + resort slug)
- `/auth/forgot-password` — Password reset request
- `/auth/reset-password` — New password set (token-based)

### Staff Invite Flow
- Owner staff invite করতে পারেন → email-এ link যায়
- `/auth/invite/[token]` — Invite validate
- `/auth/invite/accept` — Staff account তৈরি হয়

---

## Zustand Auth Store (`apps/web/src/store/auth.ts`)

```typescript
interface AuthState {
  user: AuthUser | null
  tenant: {
    id, name, slug, plan,
    planStatus,      // trialing | active | past_due | canceled
    trialEndsAt,     // Date string
    isActive,        // false = suspended
  }
  token: string | null
  refreshToken: string | null
  setAuth(user, tenant, token, refreshToken): void
  clearAuth(): void
  isAuthenticated(): boolean
}
```

State localStorage-এ persist হয় (`resort-pro-auth` key)।

---

## Token Strategy
| Token | Expiry | Storage |
|-------|--------|---------|
| Access JWT | 15 minutes | Zustand + localStorage |
| Refresh Token | 7 days | DB + localStorage |

**Auto-refresh:** Axios interceptor — 401 response পেলে refresh token দিয়ে নতুন token নেয়, failed হলে `/auth/login`-এ redirect করে।

---

## Key Files
| File | Purpose |
|------|---------|
| `apps/api/src/routes/auth.ts` | সব auth endpoints |
| `apps/web/src/app/auth/` | Login, register, reset pages |
| `apps/web/src/store/auth.ts` | Auth state management |
| `apps/web/src/lib/api.ts` | Axios with auto-refresh interceptor |
