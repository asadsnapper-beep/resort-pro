# Single Source of Truth — ResortPro

## মূল নিয়ম

> **কোনো component এ hardcode করা যাবে না যা অন্য জায়গায় duplicate হয়।**
> একটা জায়গায় define করো — বাকি সব সেটা use করবে।

---

## Modal এর ক্ষেত্রে

### ❌ ভুল — প্রতিটা modal এ নিজের dark mode style
```tsx
// expenses/page.tsx এ
<div style={{ background: '#1b342f' }}>Add Expense</div>
<div style={{ background: isDark ? '#1a2e2a' : '#fff' }}>...</div>

// rate-plans/page.tsx এ — আবার same thing
<div style={{ background: '#1b342f' }}>New Rate Plan</div>
<div style={{ background: isDark ? '#1a2e2a' : '#fff' }}>...</div>
```

**সমস্যা:** একটা color পরিবর্তন করতে হলে ২০টা file খুঁজতে হবে।

### ✅ সঠিক — ModalShell use করো
```tsx
import { ModalShell } from '@/components/ui/modal-shell';

<ModalShell open={open} onClose={onClose} title="Add Expense" footer={...}>
  {/* content */}
</ModalShell>
```

**ফলাফল:** ModalShell এ একবার color পরিবর্তন করলে সব modal automatically update হয়।

---

## CSS Color এর ক্ষেত্রে

### ❌ ভুল — hardcoded hex (theme-aware জায়গায়)
```tsx
style={{ color: '#18231f', background: '#f4f1eb' }}
```

### ✅ সঠিক — CSS token
```tsx
style={{ color: 'var(--rp-text)', background: 'var(--rp-surface-3)' }}
```

Token গুলো `globals.css` এ define করা। সেখানে একবার dark value দিলেই সব জায়গায় কাজ করে।

### ⚠️ Exception — brand accent color এর উপর text
Brand button (যেমন `background: '#23766a'` teal) সবসময় fixed color — theme বদলালেও এটা বদলায় না।
এই ক্ষেত্রে `color: '#ffffff'` hardcode করা acceptable, কারণ:
- Background নিজেই hardcoded brand color
- White text on teal = design decision, theme decision না
- Token নেই `globals.css` এ এজন্য

```tsx
// এটা ok — brand button text সবসময় white
style={{ background: '#23766a', color: '#ffffff' }}

// এটা NOT ok — surface/text color theme দিয়ে বদলায়
style={{ background: '#f4f1eb', color: '#18231f' }}
```

---

## কোথায় কোথায় Single Source আছে এই project এ

| কী | Single Source | File |
|----|---------------|------|
| Modal style | `ModalShell` | `components/ui/modal-shell.tsx` |
| Colors (dark/light) | CSS tokens | `app/globals.css` (`:root` + `.dark`) |
| Input style | `inputCls` const | প্রতিটা page এ local — ideally `components/ui/input.tsx` |
| Button style | নেই এখনো | TODO |

---

## নতুন modal বানানোর checklist

- [ ] `ModalShell` import করেছি?
- [ ] Custom `createPortal`, custom header, custom body background লিখিনি?
- [ ] Form inputs এ `var(--rp-surface-3)` token use করেছি?
- [ ] `isDark` check করতে হচ্ছে কি? (যদি হ্যাঁ, তাহলে কোথাও token miss হচ্ছে)

---

## সব existing modal যেগুলো ModalShell use করছে ✅

**Components:**
- `RoomModal` — template, ModalShell এর style এটা থেকে নেওয়া
- `NewBookingModal`
- `StaffModal`, `GuestModal` — shared components

**Dashboard pages (সব migrate করা হয়েছে):**
- `expenses/page.tsx` — ExpenseModal
- `rate-plans/page.tsx` — PlanModal
- `packages/page.tsx` — PackageModal
- `offers/page.tsx` — OfferModal, StatsModal, confirm-delete
- `loyalty/page.tsx` — ProgramSettingsModal
- `maintenance/page.tsx` — CreateTicketModal, ResolveModal
- `support/page.tsx` — ChannelSettingsModal
- `front-desk/page.tsx` — CheckInModal, CheckOutModal
- `group-bookings/page.tsx` — GroupModal
- `channels/page.tsx` — AddCalendarModal

**Side panels (NOT modals — intentionally kept as createPortal):**
- `loyalty/page.tsx` — MemberDrawer (side panel)
- `group-bookings/page.tsx` — GroupDetailDrawer (side panel)
- `calendar/page.tsx` — popover (anchored to a specific element)
