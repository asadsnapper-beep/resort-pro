# Part 14 — Staff + Roles Page Merge

> **Status:** In Progress  
> **Date:** 2026-06-14  
> **Decision:** Option A — Staff page এর ভেতরেই system access manage করা

---

## সমস্যা

Resort owner কে একই মানুষকে দুই জায়গায় add করতে হচ্ছিল:
1. **Staff page** → employee record
2. **Roles page** → system login access

এটা confusing এবং extra কাজ।

---

## সমাধান

Staff page এবং Roles page মার্জ করা। একটাই page — `/dashboard/staff`।

Roles page (`/dashboard/roles`) → redirect করবে `/dashboard/staff` এ।

---

## নতুন Staff Page — Structure

### Tabs
1. **Team** — সব employee দেখাবে (system user + non-system user)
2. **Permissions** — role permission matrix (কে কী করতে পারে — read only view)

---

### Team Tab — কী দেখাবে

প্রতিটা staff card এ:
- নাম, Position, Department
- **System Access badge** → যদি system use করে তাহলে role badge দেখাবে (Manager, Chef, etc.)
- যদি system use না করে → "No system access" tag

Actions (Owner দেখবে):
- Edit staff info
- Give/Remove system access
- Deactivate

---

### Add Staff Flow

```
"+ Add Staff" বাটন চাপলে modal আসবে:

Step 1 — Basic Info:
  - First Name, Last Name
  - Position (text field)
  - Department (dropdown: Front Desk, Housekeeping, Restaurant, Maintenance, Management, Security, Other)
  - Phone (optional)
  - Email (optional)

Step 2 — System Access:
  "Will this person use the ResortPro dashboard?"
  [ ] Yes → role dropdown দেখাবে + invite email পাঠাবে
  [ ] No  → শুধু HR record হিসেবে save হবে
```

---

### System Access দেওয়ার Flow (existing staff এর জন্য)

Staff card এ "Give Access" বাটন → modal:
- Email input (যদি আগে না দেওয়া থাকে)
- Role dropdown
- Send Invite → email যাবে

---

### Invite হলে কী হবে

- Pending Invite badge দেখাবে staff card এ
- Invite accept করলে → role badge দেখাবে
- Invite cancel করার option থাকবে

---

## Sidebar পরিবর্তন

**আগে:**
```
OPERATIONS
  - Staff          ← employee list
  ...
ACCOUNT
  - Billing
  - Referrals
  - Roles          ← system access (আলাদা)
  - Settings
```

**পরে:**
```
OPERATIONS
  - Staff          ← সব (employee + system access একসাথে)
  ...
ACCOUNT
  - Billing
  - Referrals
  - Settings
  (Roles সরিয়ে দেওয়া হবে)
```

---

## Database — কোনো পরিবর্তন নেই

- `User` table → system access আছে এমন লোক (login করতে পারে)
- `Staff` table → সব employee এর HR record

Staff যদি system access পায় → `Staff.userId` field এ link হবে।

---

## Implementation Steps

- [ ] 1. নতুন Staff page বানাও — Team tab + Permissions tab
- [ ] 2. Add Staff modal — 2 step flow (basic info + system access)
- [ ] 3. Staff card এ role badge দেখাও
- [ ] 4. "Give Access" / "Remove Access" functionality
- [ ] 5. Sidebar থেকে Roles সরাও
- [ ] 6. `/dashboard/roles` → redirect to `/dashboard/staff`
- [ ] 7. API — staff + user link করার endpoint
