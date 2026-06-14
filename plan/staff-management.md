# Staff Management — ResortPro

> Team management এর complete technical reference — staff CRUD, invite system, roles, deactivate/reactivate।

---

## Overview

ResortPro এর staff management system দুটো পথে নতুন staff যোগ করে:

1. **Add Staff (form)** — email + password দিয়ে সরাসরি account create করে
2. **Invite by Email** — token-based invite পাঠায়, staff নিজে signup করে (7 দিন valid)

---

## Features

### ১. Staff List (`/dashboard/staff`)
- **Stats bar** — Total Staff, Active, Departments
- **Server-side search** — name, email, position দিয়ে (debounced 350ms)
- **Department filter** — All / FRONT_DESK / HOUSEKEEPING / RESTAURANT / MAINTENANCE / SECURITY / MANAGEMENT
- **Role column** — actual role badge (MANAGER, RECEPTIONIST, STAFF, etc.) color-coded
- **Status dot** — avatar এ green/gray dot (active/inactive)
- **Pagination** — 20 per page

### ২. Pending Invites Panel
- Accept না করা invites হলুদ banner এ দেখায়
- Email, role, sent date, expiry দেখায়
- ✕ button দিয়ে individual invite cancel করা যায়

### ৩. Add Staff Modal
- Fields: First Name, Last Name, Email, Phone, Password (min 8), Department, Position, Hire Date
- Create হলেই system access পায় (role: STAFF by default)
- Email duplicate check আছে

### ৪. Edit Staff Modal
- Department, Position, Phone, Hire Date, First/Last Name পরিবর্তন করা যায়
- Email পরিবর্তন করা যায় না
- **নাম save হয়** — user table ও staff table দুটোই update হয়

### ৫. Staff Detail Sheet (Right sidebar)
- Avatar, name, position, department badge, status badge
- **Tenure stats** — কতদিন হলো কাজ করছে (3d / 2mo / 1y 4mo)
- **Last login** date
- Contact: email, phone
- Employment: position, department, hire date
- **System Access** — actual role (color-coded badge, not hardcoded "STAFF")
- **Actions:**
  - Edit → opens edit modal
  - Active staff → "Deactivate" (red) button
  - Inactive staff → "Reactivate" (green) button

### ৬. Invite by Email Modal
- 6টি role option: Staff, Receptionist, Manager, Marketer, Developer, Shareholder
- Role description auto-shows
- 7 দিনের token generate হয়
- `/auth/invite?token=...` লিংক email এ যায়
- Pending invites panel এ দেখা যায়

---

## Roles

| Role | Access |
|------|--------|
| `OWNER` | সব কিছু |
| `MANAGER` | Billing বাদে সব |
| `RECEPTIONIST` | Bookings, Guests, Front Desk, Housekeeping |
| `MARKETER` | Website, CRM, Email campaigns, Analytics |
| `DEVELOPER` | Website builder, Embed settings, Channel Sync |
| `SHAREHOLDER` | Read-only: Dashboard, Analytics, Reports |
| `STAFF` | Housekeeping, Maintenance, Restaurant, F&B |

---

## API Endpoints

```
GET    /api/staff                     List staff (filter: department, search, page, limit)
POST   /api/staff                     Create staff member (email + password)
PATCH  /api/staff/:id                 Update staff (name, department, position, phone, hireDate)
DELETE /api/staff/:id                 Deactivate staff (sets isActive: false on staff + user)
PATCH  /api/staff/:id/reactivate      Reactivate staff (sets isActive: true on staff + user)

POST   /api/staff/invite              Send email invite (creates StaffInvite token, sends email)
GET    /api/staff/invites             List pending invites (unused, not expired)
DELETE /api/staff/invites/:id         Cancel/expire an invite
```

---

## File Structure

```
apps/web/src/
  app/(dashboard)/dashboard/staff/
    page.tsx                  ← Staff list, invite modal, pending invites, pagination

  components/staff/
    StaffModal.tsx            ← Add/Edit staff form (react-hook-form + zod)
    StaffDetailSheet.tsx      ← Right-slide detail panel

  lib/api.ts                  ← staffApi: list, create, update, delete, reactivate, listInvites, cancelInvite

apps/api/src/routes/
  staff.ts                    ← All staff routes (~220 lines)
```

---

## Data Flow

```
Add Staff:
Manager → Add Staff modal → POST /api/staff
  → bcrypt hash password → user create (role: STAFF) → staff create
  → Account active immediately

Invite Staff:
Manager → Invite modal → POST /api/staff/invite
  → StaffInvite create (token, expiresAt: +7d)
  → Email sent with /auth/invite?token=...
  → Staff clicks link → sets password, account created
  → StaffInvite.used = true

Deactivate:
OWNER/Manager → Deactivate button → DELETE /api/staff/:id
  → staff.isActive = false, user.isActive = false
  → Login blocked

Reactivate:
OWNER/Manager → Reactivate button → PATCH /api/staff/:id/reactivate
  → staff.isActive = true, user.isActive = true
  → Login restored
```

---

## Prisma Models

```prisma
model Staff {
  id         String   @id @default(uuid())
  tenantId   String
  userId     String   @unique
  department String   // FRONT_DESK | HOUSEKEEPING | RESTAURANT | MAINTENANCE | SECURITY | MANAGEMENT
  position   String
  phone      String?
  hireDate   DateTime
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant Tenant @relation(...)
  user   User   @relation(...)
}

model StaffInvite {
  id        String   @id @default(uuid())
  tenantId  String
  email     String
  role      UserRole
  token     String   @unique
  used      Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## উন্নতির সুযোগ (Future)

- [ ] Staff schedule / shift management
- [ ] Leave / absence tracking
- [ ] Performance notes per staff member
- [ ] Role change for existing staff (currently only at invite/create time)
- [ ] Bulk invite from CSV
- [ ] Staff photo upload
- [ ] Password reset by admin

---

## Status

সব core feature ✅ live:
- Staff CRUD, invite system, deactivate + reactivate
- Server-side search, department filter, pagination
- Actual role badge (not hardcoded), pending invites panel — June 2026
