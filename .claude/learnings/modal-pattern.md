# Modal Pattern — ResortPro

## দুই ধরনের Modal

### 1. ModalShell (preferred — নতুন সব modal এর জন্য)

```tsx
import { ModalShell } from '@/components/ui/modal-shell';

<ModalShell
  open={open}
  onClose={onClose}
  title="Create Thing"
  description="Subtitle text"
  footer={
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
      <button onClick={onClose}>Cancel</button>
      <button onClick={handleSubmit}>Save</button>
    </div>
  }
>
  {/* form content */}
</ModalShell>
```

**ModalShell automatically:**
- `createPortal` → `document.body` তে render করে
- `body.overflow = 'hidden'` manage করে
- Dark mode background `#1a2e2a` দেয়
- Resort design system header দেয়

### 2. Legacy Modal (`components/ui/modal.tsx`)

পুরনো modals এ use হচ্ছে। নতুনতে avoid করো।

---

## Dark Mode Modal Checklist

নতুন modal বানানোর সময় এই list check করো:

- [ ] `createPortal` use হচ্ছে? (নইলে parent transform/overflow এ আটকে যাবে)
- [ ] Modal container এ `dark:bg-[#1a2e2a]` আছে?
- [ ] Header border এ `dark:border-white/10` আছে?
- [ ] Title text এ `dark:text-[#dfd9d0]` আছে?
- [ ] Close button এ `dark:hover:bg-white/10` আছে?
- [ ] Input fields এ `var(--rp-surface-3)` background আছে?
- [ ] Labels এ `var(--rp-text-subtle)` color আছে?

---

## Step Indicator Dark Mode Pattern

Multi-step modal (NewBookingModal এর মতো):

```tsx
// Inactive step circle
'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/40'

// Active step text
'text-resort-700 dark:text-[#4db6ac]'

// Connector line
'bg-gray-200 dark:bg-white/10'
```

---

## Already Migrated Modals

এগুলো ইতিমধ্যে fix করা হয়েছে:
- `NewBookingModal` — `dark:bg-[#1a2e2a]`, step indicators, labels
- `RoomModal`, `RoomDetailSheet`, `WalkInModal`
- `GuestDetailSheet`, `DocumentScannerModal`, `IdScanModal`
- `BookingDetailSheet`, `StaffDetailSheet`
