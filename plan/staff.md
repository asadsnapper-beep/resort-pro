# Staff System — ResortPro

> Staff management: add, edit, deactivate/reactivate, invite by email, role assignment.

---

## Features

- **Staff list** — searchable (name/email/position), department filter, paginated (20/page)
- **Staff detail sheet** — tenure, contact info, employment details, system access, role badge
- **Add Staff** — create account with role selection (STAFF/RECEPTIONIST/MANAGER/MARKETER/DEVELOPER/SHAREHOLDER)
- **Edit Staff** — update name, department, position, phone, hire date
- **Deactivate / Reactivate** — soft-disable with confirm dialogs (deactivate: OWNER only; reactivate: OWNER + MANAGER)
- **Invite by Email** — send invite link with role picker, 7-day expiry, pending invite management
- **Stats** — Total Staff (from backend pagination), Pending Invites, Departments (6 fixed)

---

## API Endpoints

```
GET    /api/staff                    List staff (search, department, page, limit)
POST   /api/staff                    Create staff member (with role)
PATCH  /api/staff/:id                Update staff (name, dept, position, phone, hireDate)
DELETE /api/staff/:id                Deactivate (OWNER only)
PATCH  /api/staff/:id/reactivate     Reactivate (OWNER + MANAGER)
POST   /api/staff/invite             Send email invite with role
GET    /api/staff/invites            List pending (unused, non-expired) invites
DELETE /api/staff/invites/:id        Cancel invite
```

---

## Role System

| Role         | Access Level |
|--------------|-------------|
| OWNER        | Full access including billing |
| MANAGER      | Full access except billing; manage all operations |
| RECEPTIONIST | Bookings, front desk, guests, check-in/out, housekeeping |
| MARKETER     | Website, CRM, email/SMS campaigns, offers, analytics |
| DEVELOPER    | Website builder, embed settings, channel sync |
| SHAREHOLDER  | Read-only: dashboard, analytics, reports, expenses |
| STAFF        | Housekeeping tasks, maintenance, restaurant, F&B orders |

> **Two paths to create staff:**
> - **Add Staff** button — creates account immediately with chosen role (requires password)
> - **Invite by Email** — sends invite link; new member sets own password on accept

---

## File Structure

```
apps/api/src/routes/staff.ts
apps/web/src/app/(dashboard)/dashboard/staff/page.tsx
apps/web/src/components/staff/StaffModal.tsx
apps/web/src/components/staff/StaffDetailSheet.tsx
apps/web/src/lib/api.ts        ← staffApi.invite() added
```

---

## Bug Fixes (June 2026)

### 1. ✅ `POST /` hardcoded `role: 'STAFF'`
**Problem:** Every staff member created via "Add Staff" got `role: STAFF` regardless — no way to add a MANAGER or RECEPTIONIST directly.
**Fix:**
- Added `role: z.enum(INVITE_ROLES).default('STAFF')` to `createStaffSchema`
- `prisma.user.create` now uses `role: body.role`
- `StaffModal` now shows a "System Role" dropdown in create mode

### 2. ✅ `PATCH /:id` returned stale `user.firstName/lastName`
**Problem:** The `$transaction([staffUpdate, userUpdate])` returned the first operation's result — `staffUpdate` ran before `userUpdate`, so the response had old name values.
**Fix:** Transaction now runs both updates (no includes), then re-fetches with `prisma.staff.findFirst` to return fresh data.

### 3. ✅ Misleading "Active" and "Departments" stat cards
**Problem:** `activeCount` and `deptCount` were computed from `staff` (current page of max 20) — not from total. With 100 staff, "Active: 18" meant only 18 on this page are active.
**Fix:**
- Replaced "Active" card with **"Pending Invites"** (accurate — comes from `pendingInvites.length`)
- "Departments" now uses `DEPARTMENTS.filter(Boolean).length` = 6 (system constant, always accurate)

### 4. ✅ `handleSendInvite` used raw dynamic `import` + manual loading state
**Problem:** Invite sending used `const { api } = await import('@/lib/api')` + manual `setInviting(true/false)` instead of the consistent `useMutation` pattern.
**Fix:**
- Added `invite` method to `staffApi` in `api.ts`
- Replaced `handleSendInvite` with `inviteMutation = useMutation(...)` using `staffApi.invite`
- Removed manual `inviting` state — uses `inviteMutation.isPending`
- Error toast now shows API error message

### 5. ✅ `cancelInviteMutation` error had no description
**Problem:** `onError: () => toast({ title: 'Error', variant: 'destructive' })` — no message explaining what failed.
**Fix:** `onError` now shows `err?.response?.data?.error ?? 'Failed to cancel invite'`.

### 6. ✅ `StaffDetailSheet` contact list `key={label}` collision
**Problem:** `key={label}` used the display value as the React key. If phone is missing → key `'—'`; if two items share the same value, React renders incorrectly.
**Fix:** Changed to stable keys `key="email"` and `key="phone"`.

---

## উন্নতির সুযোগ (Future)

- [ ] Staff performance metrics (tickets resolved, tasks completed)
- [ ] Schedule / shift management
- [ ] Document upload (ID, contracts) per staff
- [ ] Role change after creation (currently role is set at create time only)
- [ ] Bulk import via CSV
- [ ] Password reset trigger from admin panel
- [ ] Staff activity log (last actions in system)
